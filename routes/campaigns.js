/**
 * routes/campaigns.js — Campaign CRUD + launch logic.
 *
 * Endpoints:
 *   GET    /api/campaigns           → List all campaigns
 *   GET    /api/campaigns/:id       → Get single campaign
 *   POST   /api/campaigns           → Create campaign
 *   PUT    /api/campaigns/:id       → Update campaign
 *   DELETE /api/campaigns/:id       → Delete campaign
 *   POST   /api/campaigns/:id/launch → Launch campaign (populate queue)
 *   POST   /api/campaigns/:id/pause  → Pause a running campaign
 *   POST   /api/campaigns/:id/resume → Resume a paused campaign
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { personalise, completeCampaignIfNoActiveQueue } = require('../scheduler');

/** List all campaigns. */
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const campaigns = await db.prepare(`
      SELECT c.*,
             COALESCE(SUM(q.opens_count), 0) as total_opens,
             COALESCE(SUM(q.clicks_count), 0) as total_clicks
      FROM campaigns c
      LEFT JOIN queue q ON c.id = q.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get single campaign with stats. */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found.' });

    // Attach steps
    const steps = await db.prepare('SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_number ASC').all(req.params.id);
    campaign.steps = steps || [];

    // Attach queue stats
    const stats = await db.prepare(`
      SELECT status, COUNT(*) as count
      FROM queue WHERE campaign_id = ?
      GROUP BY status
    `).all(req.params.id);

    campaign.queue_stats = {};
    stats.forEach(s => { campaign.queue_stats[s.status] = s.count; });

    // Attach tracking totals
    const trackingRow = await db.prepare(`
      SELECT COALESCE(SUM(opens_count), 0) as total_opens,
             COALESCE(SUM(clicks_count), 0) as total_clicks
      FROM queue WHERE campaign_id = ?
    `).get(req.params.id);

    campaign.total_opens = trackingRow ? trackingRow.total_opens : 0;
    campaign.total_clicks = trackingRow ? trackingRow.total_clicks : 0;

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Create a new campaign. */
router.post('/', async (req, res) => {
  const {
    name, subject, body_html, body_plain,
    contact_list, delay_seconds = 30,
    start_time = '08:00', end_time = '22:00',
    content_variations, content_mode = 'single',
    steps
  } = req.body;

  if (!name || !subject || !contact_list) {
    return res.status(400).json({ error: 'name, subject, and contact_list are required.' });
  }

  try {
    const db = await getDb();

    // Count contacts in the specified list
    const countRow = await db.prepare(
      'SELECT COUNT(*) as total FROM contacts WHERE list_name = ?'
    ).get(contact_list);

    const createBoth = db.transaction(async (txDb) => {
      const result = await txDb.prepare(`
        INSERT INTO campaigns
          (name, subject, body_html, body_plain, contact_list,
           delay_seconds, start_time, end_time, total_contacts,
           content_variations, content_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name, subject, body_html || '', body_plain || '',
        contact_list, delay_seconds, start_time, end_time,
        countRow ? countRow.total : 0,
        content_variations ? JSON.stringify(content_variations) : null,
        content_mode
      );

      const campaignId = result.lastInsertRowid;

      if (steps && Array.isArray(steps)) {
        for (const step of steps) {
          await txDb.prepare(`
            INSERT INTO campaign_steps (campaign_id, step_number, subject, body_html, body_plain, delay_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(campaignId, step.step_number, step.subject, step.body_html || '', step.body_plain || '', step.delay_seconds || 86400);
        }
      }
      return campaignId;
    });

    const campaignId = await createBoth();
    res.json({ success: true, id: campaignId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update a campaign (only if draft or paused). */
router.put('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const campaign = await db.prepare('SELECT status FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.status === 'sending') {
      return res.status(400).json({ error: 'Cannot edit a campaign while it is sending. Pause it first.' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const fields = req.body;
  const allowed = [
    'name', 'subject', 'body_html', 'body_plain', 'contact_list',
    'delay_seconds', 'start_time', 'end_time', 'content_variations', 'content_mode',
  ];

  const updates = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(key === 'content_variations' ? JSON.stringify(fields[key]) : fields[key]);
    }
  }

  try {
    const db = await getDb();
    const updateBoth = db.transaction(async (txDb) => {
      if (updates.length > 0) {
        values.push(req.params.id);
        await txDb.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
      
      if (fields.steps !== undefined && Array.isArray(fields.steps)) {
        await txDb.prepare('DELETE FROM campaign_steps WHERE campaign_id = ?').run(req.params.id);
        for (const step of fields.steps) {
          await txDb.prepare(`
            INSERT INTO campaign_steps (campaign_id, step_number, subject, body_html, body_plain, delay_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(req.params.id, step.step_number, step.subject, step.body_html || '', step.body_plain || '', step.delay_seconds || 86400);
        }
      }
    });

    await updateBoth();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a campaign and its queue items. */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const deleteBoth = db.transaction(async (txDb) => {
      await txDb.prepare('DELETE FROM queue WHERE campaign_id = ?').run(req.params.id);
      await txDb.prepare('DELETE FROM campaign_recipients WHERE campaign_id = ?').run(req.params.id);
      await txDb.prepare('DELETE FROM campaign_steps WHERE campaign_id = ?').run(req.params.id);
      await txDb.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    });
    await deleteBoth();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create campaign from CSV data (AutoHotkey integration endpoint).
 * Accepts: campaign name, subjects, recipients (CSV rows), HTML template, optional account_id.
 * Creates campaign in draft status and queues all recipients atomically.
 */
router.post('/create-from-csv', async (req, res) => {
  const {
    name,
    subjects = [],
    recipients = [],  // array of objects: { email, ...fields }
    html_template = '',
    account_id = null,
    delay_seconds = 30,
    start_time = '08:00',
    end_time = '22:00',
  } = req.body;

  if (!name || recipients.length === 0) {
    return res.status(400).json({ error: 'Campaign name and recipients array are required.' });
  }

  try {
    const db = await getDb();

    // If account_id is specified, verify it exists and is active
    let accountsForRoundRobin = [];
    if (account_id) {
      const acct = await db.prepare('SELECT id FROM accounts WHERE id = ? AND status = \'active\'').get(account_id);
      if (!acct) {
        return res.status(400).json({ error: `Account ${account_id} not found or inactive.` });
      }
      accountsForRoundRobin = [acct];
    } else {
      // Get all active accounts for round-robin
      accountsForRoundRobin = await db.prepare(
        "SELECT id FROM accounts WHERE status = 'active'"
      ).all();
      if (accountsForRoundRobin.length === 0) {
        return res.status(400).json({ error: 'No active sender accounts available.' });
      }
    }

    // Build subject string (semicolon-separated or newline-separated)
    const subjectString = Array.isArray(subjects) ? subjects.join(';') : subjects.toString();

    // Create campaign in draft mode, atomically with queue
    const createFromCsvTx = db.transaction(async (txDb) => {
      const result = await txDb.prepare(`
        INSERT INTO campaigns
          (name, subject, body_html, status, delay_seconds, start_time, end_time, total_contacts)
        VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)
      `).run(name, subjectString, html_template, delay_seconds, start_time, end_time, recipients.length);

      const campaignId = result.lastInsertRowid;

      // Queue all recipients with round-robin account assignment
      const now = new Date();
      let currentScheduledTime = now.getTime();

      for (let index = 0; index < recipients.length; index++) {
        const recipient = recipients[index];
        const recipEmail = recipient.email || '';
        if (!recipEmail) continue;  // Skip rows without email

        const accountId = accountsForRoundRobin[index % accountsForRoundRobin.length].id;

        // Random spacing 30-90 seconds
        const spacingSeconds = Math.floor(Math.random() * (90 - 30 + 1)) + 30;
        if (index > 0) {
          currentScheduledTime += spacingSeconds * 1000;
        }

        const scheduledAt = new Date(currentScheduledTime);

        // Serialize recipient fields as JSON
        const fieldsJson = JSON.stringify(
          Object.keys(recipient).reduce((acc, key) => {
            if (key !== 'email') acc[key] = recipient[key];
            return acc;
          }, {})
        );

        await txDb.prepare(`
          INSERT INTO queue (campaign_id, recipient_email, account_id, status, scheduled_at, fields)
          VALUES (?, ?, ?, 'pending', ?, ?)
        `).run(campaignId, recipEmail, accountId, scheduledAt.toISOString(), fieldsJson);
      }

      return campaignId;
    });

    const campaignId = await createFromCsvTx();

    res.json({
      success: true,
      campaign_id: campaignId,
      message: `Campaign "${name}" created with ${recipients.length} recipients queued (draft mode).`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Launch a campaign — populate the queue with all contacts.
 * Uses round-robin account assignment.
 */
router.post('/:id/launch', async (req, res) => {
  try {
    const db = await getDb();
    const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.status === 'sending') {
      return res.status(400).json({ error: 'Campaign is already sending.' });
    }

    // Get active accounts for rotation
    const accounts = await db.prepare(
      "SELECT id FROM accounts WHERE status = 'active'"
    ).all();
    if (accounts.length === 0) {
      return res.status(400).json({ error: 'No active sender accounts. Add at least one Gmail account first.' });
    }

    // Get contacts for this campaign's list
    const contacts = await db.prepare(
      'SELECT email, fields FROM contacts WHERE list_name = ?'
    ).all(campaign.contact_list);

    if (contacts.length === 0) {
      return res.status(400).json({ error: `No contacts found in list "${campaign.contact_list}".` });
    }

    // Check if there are steps. Fetch the first step if it exists
    const firstStep = await db.prepare('SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_number = 1').get(req.params.id);

    // Populate queue and recipients tracking table
    const launchTx = db.transaction(async (txDb) => {
      // Clear any existing queue items for this campaign
      await txDb.prepare('DELETE FROM queue WHERE campaign_id = ?').run(req.params.id);

      // Reset recipients status tracker for this campaign
      await txDb.prepare('DELETE FROM campaign_recipients WHERE campaign_id = ?').run(req.params.id);

      const now = new Date();
      let currentScheduledTime = now.getTime();
      
      for (let index = 0; index < contacts.length; index++) {
        const contact = contacts[index];
        const accountId = accounts[index % accounts.length].id;
        
        // Random spacing between 30 and 90 seconds (in milliseconds)
        const spacingSeconds = Math.floor(Math.random() * (90 - 30 + 1)) + 30;
        if (index > 0) {
          currentScheduledTime += spacingSeconds * 1000;
        }
        
        const scheduledAt = new Date(currentScheduledTime);

        // Seed campaign_recipients
        await txDb.prepare(`
          INSERT INTO campaign_recipients (campaign_id, recipient_email, status, current_step)
          VALUES (?, ?, 'active', 1)
        `).run(req.params.id, contact.email);

        // Queue Step 1
        await txDb.prepare(`
          INSERT INTO queue (campaign_id, recipient_email, account_id, status, scheduled_at, fields, step_number, campaign_step_id)
          VALUES (?, ?, ?, 'pending', ?, ?, 1, ?)
        `).run(req.params.id, contact.email, accountId, scheduledAt.toISOString(), contact.fields || null, firstStep ? firstStep.id : null);
      }

      // Update campaign status
      await txDb.prepare(`
        UPDATE campaigns
        SET status = 'sending', total_contacts = ?, sent_count = 0, failed_count = 0
        WHERE id = ?
      `).run(contacts.length, req.params.id);
    });

    await launchTx();

    res.json({
      success: true,
      message: `Campaign launched. ${contacts.length} emails queued across ${accounts.length} account(s).`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Pause a running campaign. */
router.post('/:id/pause', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Resume a paused campaign. */
router.post('/:id/resume', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Preview campaign email templates with resolved spintax and dynamic fields */
router.get('/:id/preview', async (req, res) => {
  try {
    const db = await getDb();
    const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });

    // Retrieve active accounts for display name / sender email preview
    const accounts = await db.prepare("SELECT * FROM accounts WHERE status = 'active'").all();
    const defaultAccount = accounts.length > 0 ? accounts[0] : { email: 'no-sender@peakxender.com', display_name: 'System Default' };

    // Get up to 3 sample contacts to show different personalization outputs
    const count = parseInt(req.query.count, 10) || 3;
    const contacts = await db.prepare(
      'SELECT * FROM contacts WHERE list_name = ? LIMIT ?'
    ).all(campaign.contact_list, count);

    // Support previewing a specific step
    const stepNum = parseInt(req.query.step, 10) || 1;
    const step = await db.prepare('SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_number = ?').get(req.params.id, stepNum);
    const subject = step ? step.subject : campaign.subject;
    const body_html = step ? step.body_html : campaign.body_html;

    const mockContacts = contacts.length > 0 ? contacts : [
      { email: 'john@example.com', fields: JSON.stringify({ first_name: 'John', store_name: 'John\'s Shop' }) },
      { email: 'jane@example.com', fields: JSON.stringify({ first_name: 'Jane', store_name: 'Jane\'s Boutique' }) }
    ];
    
    const previews = mockContacts.map((c, index) => {
      const acc = accounts[index % accounts.length] || defaultAccount;
      return {
        recipient_email: c.email,
        sender_email: acc.email,
        subject: personalise(subject, c.email, c.fields, acc.display_name),
        body_html: personalise(body_html, c.email, c.fields, acc.display_name)
      };
    });

    res.json(previews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get recipients tracking status for a campaign */
router.get('/:id/recipients', async (req, res) => {
  try {
    const db = await getDb();
    const recipients = await db.prepare(`
      SELECT recipient_email, status, current_step, last_sent_at, created_at
      FROM campaign_recipients
      WHERE campaign_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);
    res.json(recipients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update status of a campaign recipient (e.g. mark as Replied or Unsubscribed) */
router.post('/:id/recipients/status', async (req, res) => {
  const { email, status } = req.body;
  if (!email || !status) {
    return res.status(400).json({ error: 'recipient email and status are required.' });
  }

  try {
    const db = await getDb();
    const tx = db.transaction(async (txDb) => {
      await txDb.prepare(`
        UPDATE campaign_recipients
        SET status = ?
        WHERE campaign_id = ? AND recipient_email = ?
      `).run(status, req.params.id, email);

      if (status === 'replied' || status === 'unsubscribed') {
        // Cancel all pending/sending queue items for this recipient in this campaign
        await txDb.prepare(`
          DELETE FROM queue
          WHERE campaign_id = ? AND recipient_email = ? AND status IN ('pending', 'sending')
        `).run(req.params.id, email);
      }
    });

    await tx();

    // Finalize campaign if no active queue items remain after recipient status change.
    await completeCampaignIfNoActiveQueue(db, req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
