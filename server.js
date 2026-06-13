/**
 * server.js — Express entry point for MailFlow + PeakConix backend.
 *
 * Starts the API server and the background scheduler.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const { requirePin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve the React frontend (production build) from gfg-main/dist
app.use(express.static(path.join(__dirname, 'gfg-main', 'dist')));

// ---------------------------------------------------------------------------
// API Routes — lazy-loaded after DB is ready
// ---------------------------------------------------------------------------
app.use('/api/accounts', requirePin, require('./routes/accounts'));
app.use('/api/campaigns', requirePin, require('./routes/campaigns'));
app.use('/api/contacts', requirePin, require('./routes/contacts'));
app.use('/api/queue', requirePin, require('./routes/queue'));
app.use('/api/templates', requirePin, require('./routes/templates'));
app.use('/api/track', require('./routes/tracking'));

// Health check
app.get('/api/health', requirePin, async (_req, res) => {
  try {
    const db = await getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
    res.json({
      status: 'ok',
      accounts: row ? row.count : 0,
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Dashboard stats aggregator
app.get('/api/dashboard', requirePin, async (_req, res) => {
  try {
    const db = await getDb();
    
    const accountsRow = db.prepare("SELECT SUM(daily_sent) as today_sent, COUNT(*) as total FROM accounts WHERE status = 'active'").get() || { today_sent: 0, total: 0 };
    const queueRow = db.prepare("SELECT COUNT(*) as pending FROM queue WHERE status = 'pending'").get() || { pending: 0 };
    const campaignsRow = db.prepare("SELECT COUNT(*) as active FROM campaigns WHERE status = 'sending'").get() || { active: 0 };
    const failedRow = db.prepare("SELECT SUM(failed_count) as failed FROM campaigns").get() || { failed: 0 };
    const trackingRow = db.prepare("SELECT COALESCE(SUM(opens_count), 0) as opens, COALESCE(SUM(clicks_count), 0) as clicks FROM queue").get() || { opens: 0, clicks: 0 };

    const stats = {
      today_sent: accountsRow.today_sent || 0,
      active_accounts: accountsRow.total || 0,
      pending: queueRow.pending || 0,
      active_campaigns: campaignsRow.active || 0,
      failed: failedRow.failed || 0,
      opens: trackingRow.opens || 0,
      clicks: trackingRow.clicks || 0,
    };

    const campaigns = db.prepare(`
      SELECT c.*,
             COALESCE(SUM(q.opens_count), 0) as total_opens,
             COALESCE(SUM(q.clicks_count), 0) as total_clicks
      FROM campaigns c
      LEFT JOIN queue q ON c.id = q.campaign_id
      GROUP BY c.id
      ORDER BY c.id DESC
      LIMIT 5
    `).all();

    const queue = db.prepare(`
      SELECT q.*, c.name as campaign_name, a.email as account_email
      FROM queue q
      LEFT JOIN campaigns c ON q.campaign_id = c.id
      LEFT JOIN accounts a ON q.account_id = a.id
      ORDER BY q.id DESC
      LIMIT 10
    `).all();

    res.json({ stats, campaigns, queue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all: serve React app for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'gfg-main', 'dist', 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
(async () => {
  // Wait for DB to be fully initialised before accepting requests
  await getDb();

  app.listen(PORT, () => {
    console.log(`\n  MailFlow server running on http://localhost:${PORT}`);
    console.log(`  API endpoints:  http://localhost:${PORT}/api/health\n`);
  });

  // Start the background email scheduler
  require('./scheduler');
})();
