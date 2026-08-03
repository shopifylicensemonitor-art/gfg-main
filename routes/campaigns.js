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
const logger = require('../logger');
const { processNextItem, personalise, completeCampaignIfNoActiveQueue } = require('../scheduler');

function createDefaultCampaignContent(subject, bodyHtml, bodyPlain) {
  const normalizedSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : 'Untitled campaign';
  const normalizedBodyHtml = typeof bodyHtml === 'string' && bodyHtml.trim()
    ? bodyHtml.trim()
    : '<p>This campaign is ready for editing.</p><p>Replace this placeholder content with your outreach message.</p>';
  const normalizedBodyPlain = typeof bodyPlain === 'string' && bodyPlain.trim()
    ? bodyPlain.trim()
    : 'This campaign is ready for editing. Replace this placeholder content with your outreach message.';

  return {
    subject: normalizedSubject,
    body_html: normalizedBodyHtml,
    body_plain: normalizedBodyPlain,
  };
}

function resolveLaunchRecipientPlan({ existingQueueRows = [], recipients = [], contacts = [] }) {
  const normalizedExistingRows = Array.isArray(existingQueueRows) ? existingQueueRows : [];
  if (normalizedExistingRows.length > 0) {
    return {
      useExistingQueue: true,
      recipients: normalizedExistingRows
        .map((row) => {
          if (!row) return null;
          const recipientEmail = row.recipient_email || row.email || row.recipientEmail || '';
          if (!recipientEmail) return null;
          return {
            recipient_email: recipientEmail,
            account_id: row.account_id ?? row.accountId ?? null,
            fields: row.fields ?? row.field_values ?? null,
          };
        })
        .filter(Boolean),
    };
  }

  const normalizedRecipients = Array.isArray(recipients) ? recipients : [];
  const normalizedContacts = Array.isArray(contacts) ? contacts : [];

  const resolvedRecipients = normalizedRecipients.length > 0
    ? normalizedRecipients.map((recipient) => {
        const recipientEmail = recipient?.recipient_email || recipient?.email || recipient?.recipientEmail || '';
        if (!recipientEmail) return null;
        return {
          recipient_email: recipientEmail,
          account_id: recipient?.account_id ?? recipient?.accountId ?? null,
          fields: recipient?.fields ?? recipient?.field_values ?? null,
        };
      }).filter(Boolean)
    : normalizedContacts.map((contact) => {
        const recipientEmail = contact?.recipient_email || contact?.email || contact?.recipientEmail || '';
        if (!recipientEmail) return null;
        return {
          recipient_email: recipientEmail,
          account_id: contact?.account_id ?? contact?.accountId ?? null,
          fields: contact?.fields ?? contact?.field_values ?? null,
        };
      }).filter(Boolean);

  return {
    useExistingQueue: false,
    recipients: resolvedRecipients,
  };
}

router.createDefaultCampaignContent = createDefaultCampaignContent;
router.resolveLaunchRecipientPlan = resolveLaunchRecipientPlan;

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

  if (!name) {
    return res.status(400).json({ error: 'Campaign name is required.' });
  }

  try {
    const db = await getDb();
    const resolvedContactList = contact_list || `campaign-${Date.now()}`;
    const content = createDefaultCampaignContent(subject, body_html, body_plain);

    // Count contacts in the specified list when one is provided.
    const countRow = resolvedContactList
      ? await db.prepare('SELECT COUNT(*) as total FROM contacts WHERE list_name = ?').get(resolvedContactList)
      : null;

    const createBoth = db.transaction(async (txDb) => {
      const result = await txDb.prepare(`
        INSERT INTO campaigns
          (name, subject, body_html, body_plain, contact_list,
           delay_seconds, start_time, end_time, total_contacts,
           content_variations, content_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name, content.subject, content.body_html, content.body_plain,
        resolvedContactList, delay_seconds, start_time, end_time,
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
        let val = fields[key];
        if (key === 'content_variations') {
          val = typeof fields[key] === 'string' ? fields[key] : JSON.stringify(fields[key]);
        }
        values.push(val);
      }
    }

    if (fields.contact_list) {
      const countRow = await db.prepare(
        'SELECT COUNT(*) as total FROM contacts WHERE list_name = ?'
      ).get(fields.contact_list);
      updates.push('total_contacts = ?');
      values.push(countRow ? countRow.total : 0);
    }

    const fallbackContent = createDefaultCampaignContent(fields.subject, fields.body_html, fields.body_plain);
    const updateBoth = db.transaction(async (txDb) => {
      if (updates.length > 0) {
        values.push(req.params.id);
        await txDb.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      if (!fields.subject && !fields.body_html && !fields.body_plain) {
        await txDb.prepare(`
          UPDATE campaigns
          SET subject = ?, body_html = ?, body_plain = ?
          WHERE id = ?
        `).run(fallbackContent.subject, fallbackContent.body_html, fallbackContent.body_plain, req.params.id);
      } else if (!fields.subject || !fields.body_html || !fields.body_plain) {
        const current = await txDb.prepare('SELECT subject, body_html, body_plain FROM campaigns WHERE id = ?').get(req.params.id);
        const nextSubject = fields.subject || current?.subject || fallbackContent.subject;
        const nextBodyHtml = fields.body_html || current?.body_html || fallbackContent.body_html;
        const nextBodyPlain = fields.body_plain || current?.body_plain || fallbackContent.body_plain;
        await txDb.prepare(`
          UPDATE campaigns
          SET subject = ?, body_html = ?, body_plain = ?
          WHERE id = ?
        `).run(nextSubject, nextBodyHtml, nextBodyPlain, req.params.id);
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

    // If account_id is specified, verify it exists and is active.
    // For local/testing environments, fall back to any active account or a synthetic placeholder
    // so the campaign can still be created even before a full mail account is configured.
    let accountsForRoundRobin = [];
    if (account_id) {
      const acct = await db.prepare('SELECT id FROM accounts WHERE id = ? AND status = \'active\'').get(account_id);
      if (!acct) {
        const fallbackAccount = await db.prepare("SELECT id FROM accounts WHERE status = 'active' ORDER BY id LIMIT 1").get();
        if (!fallbackAccount) {
          accountsForRoundRobin = [];
        } else {
          accountsForRoundRobin = [fallbackAccount];
        }
      } else {
        accountsForRoundRobin = [acct];
      }
    } else {
      // Get all active accounts for round-robin
      accountsForRoundRobin = await db.prepare(
        "SELECT id FROM accounts WHERE status = 'active'"
      ).all();
    }

    if (accountsForRoundRobin.length === 0) {
      accountsForRoundRobin = [{ id: null }];
    }

    // Build subject string (semicolon-separated or newline-separated)
    const subjectString = Array.isArray(subjects) ? subjects.join(';') : subjects.toString();
    const contactListName = req.body.contact_list || `csv-${Date.now()}`;

    // Create campaign in draft mode, atomically with queue
    const createFromCsvTx = db.transaction(async (txDb) => {
      const result = await txDb.prepare(`
        INSERT INTO campaigns
          (name, subject, body_html, body_plain, contact_list, status, delay_seconds, start_time, end_time, total_contacts)
        VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
      `).run(name, subjectString, html_template, html_template, contactListName, delay_seconds, start_time, end_time, recipients.length);

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

    const existingQueueRows = await db.prepare(
      'SELECT recipient_email, account_id, fields FROM queue WHERE campaign_id = ? AND status IN (\'pending\', \'sending\')'
    ).all(req.params.id);
    const plan = resolveLaunchRecipientPlan({
      existingQueueRows,
      recipients: req.body.recipients || req.body.contacts || [],
      contacts,
    });

    if (!plan.recipients || plan.recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients available for launch. Add contacts or provide recipients in the request.' });
    }

    const content = createDefaultCampaignContent(campaign.subject, campaign.body_html, campaign.body_plain);

    // Check if there are steps. Fetch the first step if it exists
    const firstStep = await db.prepare('SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_number = 1').get(req.params.id);

    // Populate queue and recipients tracking table
    const launchTx = db.transaction(async (txDb) => {
      // Clear any existing queue items for this campaign
      await txDb.prepare('DELETE FROM queue WHERE campaign_id = ?').run(req.params.id);

      // Reset recipients status tracker for this campaign
      await txDb.prepare('DELETE FROM campaign_recipients WHERE campaign_id = ?').run(req.params.id);

      await txDb.prepare(`
        UPDATE campaigns
        SET subject = ?, body_html = ?, body_plain = ?
        WHERE id = ?
      `).run(content.subject, content.body_html, content.body_plain, req.params.id);

      const now = new Date();
      let currentScheduledTime = now.getTime();

      for (let index = 0; index < plan.recipients.length; index++) {
        const recipient = plan.recipients[index];
        const recipientEmail = recipient.recipient_email || recipient.email || '';
        const accountId = recipient.account_id ?? accounts[index % accounts.length]?.id ?? null;
        if (!recipientEmail) continue;

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
        `).run(req.params.id, recipientEmail);

        // Queue Step 1
        await txDb.prepare(`
          INSERT INTO queue (campaign_id, recipient_email, account_id, status, scheduled_at, fields, step_number, campaign_step_id)
          VALUES (?, ?, ?, 'pending', ?, ?, 1, ?)
        `).run(req.params.id, recipientEmail, accountId, scheduledAt.toISOString(), recipient.fields || null, firstStep ? firstStep.id : null);
      }

      // Update campaign status
      await txDb.prepare(`
        UPDATE campaigns
        SET status = 'sending', total_contacts = ?, sent_count = 0, failed_count = 0
        WHERE id = ?
      `).run(plan.recipients.length, req.params.id);
    });

    await launchTx();

    // Attempt to kick off immediate processing; capture any error to return to the client
    let processingStarted = true;
    let processingError = null;
    try {
      await processNextItem();
    } catch (processErr) {
      processingStarted = false;
      processingError = processErr && processErr.message ? processErr.message : String(processErr);
      logger.warn({ err: processErr, campaignId: req.params.id }, 'Launch queued campaign but immediate processing failed');
    }

    res.json({
      success: true,
      message: `Campaign launched. ${plan.recipients.length} emails queued across ${accounts.length} account(s).`,
      processing_started: processingStarted,
      processing_error: processingError,
      recipients_count: plan.recipients.length,
      accounts_count: accounts.length,
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

/** Retry immediate processing for a campaign's queued items. */
router.post('/:id/retry-processing', async (req, res) => {
  try {
    const db = await getDb();
    const campaign = await db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });

    const pendingRow = await db.prepare("SELECT COUNT(*) as total FROM queue WHERE campaign_id = ? AND status IN ('pending','sending')").get(req.params.id);
    if (!pendingRow || pendingRow.total === 0) {
      return res.status(400).json({ error: 'No pending queue items for this campaign to process.' });
    }

    let processingStarted = true;
    let processingError = null;
    try {
      await processNextItem();
    } catch (err) {
      processingStarted = false;
      processingError = err && err.message ? err.message : String(err);
      logger.warn({ err, campaignId: req.params.id }, 'Retry processing failed');
    }

    res.json({ success: true, processing_started: processingStarted, processing_error: processingError });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Retry processing repeatedly until pending queue for this campaign is drained or safety limit reached. */
router.post('/:id/retry-all', async (req, res) => {
  const maxIterations = parseInt(req.body.max_iterations, 10) || 50;
  const maxSeconds = parseInt(req.body.max_seconds, 10) || 30;

  try {
    const db = await getDb();
    const campaign = await db.prepare('SELECT id, status FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });

    // Requeue any permanently failed items to pending for a fresh attempt
    const nowIso = new Date().toISOString();
    await db.prepare("UPDATE queue SET status = 'pending', retry_count = 0, scheduled_at = ? WHERE campaign_id = ? AND status = 'failed'").run(nowIso, req.params.id);

    // If campaign is not sending, set it to sending so the scheduler can process it
    if (campaign.status !== 'sending') {
      await db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ?").run(req.params.id);
    }

    let iterations = 0;
    const start = Date.now();
    let processedCount = 0;
    let lastError = null;

    while (iterations < maxIterations && ((Date.now() - start) / 1000) < maxSeconds) {
      const pendingRow = await db.prepare("SELECT COUNT(*) as total FROM queue WHERE campaign_id = ? AND status = 'pending' AND scheduled_at <= ?").get(req.params.id, new Date().toISOString());
      if (!pendingRow || pendingRow.total === 0) break;

      const before = pendingRow.total;
      try {
        await processNextItem();
      } catch (err) {
        lastError = err && err.message ? err.message : String(err);
        logger.warn({ err, campaignId: req.params.id }, 'retry-all: processNextItem failed');
        break;
      }

      const afterRow = await db.prepare("SELECT COUNT(*) as total FROM queue WHERE campaign_id = ? AND status = 'pending' AND scheduled_at <= ?").get(req.params.id, new Date().toISOString());
      const after = afterRow ? afterRow.total : 0;
      processedCount += Math.max(0, before - after);
      iterations++;
    }

    const remainingRow = await db.prepare("SELECT COUNT(*) as total FROM queue WHERE campaign_id = ? AND status IN ('pending','sending')").get(req.params.id);
    const remaining = remainingRow ? remainingRow.total : 0;

    res.json({ success: true, processed_count: processedCount, remaining_pending: remaining, iterations, processing_error: lastError });
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
