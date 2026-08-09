/**
 * routes/manual.js — Free Plan Manual Send Tracker & Limits API.
 *
 * Tracks manual mailto: outreach sends and enforces the daily cap.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { getEntitlementValue, verifyLimit } = require('../middleware/entitlements');

/**
 * GET /api/manual/count — Fetch current user's manual send count for today
 */
router.get('/count', async (req, res) => {
  try {
    const db = await getDb();
    const wsId = req.workspace.id;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const row = await db.prepare(
      'SELECT count FROM manual_send_logs WHERE workspace_id = ? AND user_id = ? AND sent_date = ?'
    ).get(wsId, userId, today);

    const count = row ? row.count : 0;
    const limitRaw = await getEntitlementValue(wsId, 'manual_send.daily_limit');
    const dailyLimit = parseInt(limitRaw, 10) || 50;

    res.json({
      count,
      dailyLimit,
      remaining: Math.max(0, dailyLimit - count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/manual/track-send — Record a manual mailto: send & enforce daily limit
 */
router.post('/track-send', async (req, res) => {
  const { recipientEmail, subject } = req.body;
  try {
    const db = await getDb();
    const wsId = req.workspace.id;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const row = await db.prepare(
      'SELECT count FROM manual_send_logs WHERE workspace_id = ? AND user_id = ? AND sent_date = ?'
    ).get(wsId, userId, today);

    const currentCount = row ? row.count : 0;
    const canSend = await verifyLimit(wsId, 'manual_send.daily_limit', currentCount);

    if (!canSend) {
      return res.status(403).json({
        error: 'Daily manual send limit reached for your plan. Upgrade your plan to increase manual send limits.',
        code: 'MANUAL_SEND_LIMIT_EXCEEDED',
      });
    }

    if (row) {
      await db.prepare(
        'UPDATE manual_send_logs SET count = count + 1 WHERE workspace_id = ? AND user_id = ? AND sent_date = ?'
      ).run(wsId, userId, today);
    } else {
      await db.prepare(
        'INSERT INTO manual_send_logs (workspace_id, user_id, sent_date, count) VALUES (?, ?, ?, 1)'
      ).run(wsId, userId, today);
    }

    await db.prepare(`
      INSERT INTO logs (workspace_id, account_id, recipient_email, status, message)
      VALUES (?, NULL, ?, 'manual_sent', ?)
    `).run(wsId, recipientEmail || 'manual', `Manual send tracked: ${subject || 'Outreach'}`);

    res.json({
      success: true,
      newCount: currentCount + 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
