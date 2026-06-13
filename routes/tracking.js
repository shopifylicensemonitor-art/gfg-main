/**
 * routes/tracking.js — Open & Click tracking redirectors.
 *
 * Exposes:
 *   GET /api/track/open/:queue_item_id   → Serve 1x1 pixel and increment opens_count
 *   GET /api/track/click/:queue_item_id  → Redirect and increment clicks_count
 *
 * NOTE: These endpoints must be unprotected so external email clients can reach them.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// Transparent 1x1 GIF tracking pixel
const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** Track Email Open. */
router.get('/open/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    db.prepare('UPDATE queue SET opens_count = opens_count + 1 WHERE id = ?').run(id);
  } catch (err) {
    console.error(`[Tracking] Error registering open on queue item #${id}:`, err.message);
  }

  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  });
  res.end(pixel);
});

/** Track Link Click. */
router.get('/click/:id', async (req, res) => {
  const { id } = req.params;
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Missing redirect URL parameter (?url=...).');
  }

  try {
    const db = await getDb();
    db.prepare('UPDATE queue SET clicks_count = clicks_count + 1 WHERE id = ?').run(id);
  } catch (err) {
    console.error(`[Tracking] Error registering click on queue item #${id}:`, err.message);
  }

  res.redirect(url);
});

module.exports = router;
