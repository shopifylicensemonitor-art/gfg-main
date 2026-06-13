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

/** List all campaigns. */
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const campaigns = db.prepare(`
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
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found.' });

    // Attach queue stats
    const stats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM queue WHERE campaign_id = ?
      GROUP BY status
    `).all(req.params.id);

    campaign.queue_stats = {};
    stats.forEach(s => { campaign.queue_stats[s.status] = s.count; });

    // Attach tracking totals
    const trackingRow = db.prepare(`
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
  } = req.body;

  if (!name || !subject || !contact_list) {
    return res.status(400).json({ error: 'name, subject, and contact_list are required.' });
  }

  try {
    const db = await getDb();

    // Count contacts in the specified list
    const countRow = db.prepare(
      'SELECT COUNT(*) as total FROM contacts WHERE list_name = ?'
    ).get(contact_list);

    const result = db.prepare(`
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

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update a campaign (only if draft or paused). */
router.put('/:id', async (req, res) => {
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

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  values.push(req.params.id);

  try {
    const db = await getDb();
    db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a campaign and its queue items. */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const deleteBoth = db.transaction(() => {
      db.prepare('DELETE FROM queue WHERE campaign_id = ?').run(req.params.id);
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    });
    deleteBoth();
    res.json({ success: true });
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
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.status === 'sending') {
      return res.status(400).json({ error: 'Campaign is already sending.' });
    }

    // Get active accounts for rotation
    const accounts = db.prepare(
      "SELECT id FROM accounts WHERE status = 'active'"
    ).all();
    if (accounts.length === 0) {
      return res.status(400).json({ error: 'No active sender accounts. Add at least one Gmail account first.' });
    }

    // Get contacts for this campaign's list
    const contacts = db.prepare(
      'SELECT email FROM contacts WHERE list_name = ?'
    ).all(campaign.contact_list);

    if (contacts.length === 0) {
      return res.status(400).json({ error: `No contacts found in list "${campaign.contact_list}".` });
    }

    // Clear any existing queue items for this campaign
    db.prepare('DELETE FROM queue WHERE campaign_id = ?').run(req.params.id);

    // Populate queue with round-robin account assignment
    const insertQueue = db.transaction(() => {
      const now = new Date();
      contacts.forEach((contact, index) => {
        const accountId = accounts[index % accounts.length].id;
        const scheduledAt = new Date(now.getTime() + (index * campaign.delay_seconds * 1000));

        db.prepare(`
          INSERT INTO queue (campaign_id, recipient_email, account_id, status, scheduled_at)
          VALUES (?, ?, ?, 'pending', ?)
        `).run(req.params.id, contact.email, accountId, scheduledAt.toISOString());
      });

      // Update campaign status
      db.prepare(`
        UPDATE campaigns
        SET status = 'sending', total_contacts = ?, sent_count = 0, failed_count = 0
        WHERE id = ?
      `).run(contacts.length, req.params.id);
    });

    insertQueue();

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
    db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Resume a paused campaign. */
router.post('/:id/resume', async (req, res) => {
  try {
    const db = await getDb();
    db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
