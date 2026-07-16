/**
 * routes/queue.js — Queue monitoring and activity logs.
 *
 * Endpoints:
 *   GET /api/queue/:campaignId       → Queue items for a campaign
 *   GET /api/queue/:campaignId/stats → Aggregate stats
 *   GET /api/queue/logs/recent       → Recent send logs
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

/** Get recent logs across all campaigns. */
router.get('/logs/recent', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  try {
    const db = await getDb();
    const logs = await db.prepare(`
      SELECT l.*, a.email as sender_email, c.name as campaign_name,
             q.final_subject, q.final_body
      FROM logs l
      LEFT JOIN accounts a ON l.account_id = a.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN queue q ON q.id = COALESCE(
        l.queue_id,
        (SELECT id FROM queue WHERE campaign_id = l.campaign_id AND recipient_email = l.recipient_email LIMIT 1)
      )
      ORDER BY l.created_at DESC
      LIMIT ?
    `).all(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get queue items for a specific campaign. */
router.get('/:campaignId', async (req, res) => {
  const status = req.query.status; // optional filter
  try {
    const db = await getDb();
    let sql = 'SELECT * FROM queue WHERE campaign_id = ?';
    const params = [req.params.campaignId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY id';
    const items = await db.prepare(sql).all(...params);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get aggregate stats for a campaign's queue. */
router.get('/:campaignId/stats', async (req, res) => {
  try {
    const db = await getDb();
    const stats = await db.prepare(`
      SELECT
        COUNT(*)                                          as total,
        SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent'     THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed'   THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'sending'  THEN 1 ELSE 0 END) as sending
      FROM queue
      WHERE campaign_id = ?
    `).get(req.params.campaignId);
    res.json(stats || { total: 0, pending: 0, sent: 0, failed: 0, sending: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
