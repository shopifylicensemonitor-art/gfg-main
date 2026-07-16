/**
 * server.js — Express entry point for Peak Xender backend.
 *
 * Starts the API server and the background scheduler.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const { requireAuth } = require('./middleware/session');
const logger = require('./logger');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting middleware
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many requests, please try again later.' }
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login/sensitive requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Support localhost (any port), loopback, local network IPs (e.g. 192.168.x.x, 10.x.x.x, 172.16-31.x.x, 169.254.x.x) on standard frontend ports
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
    const isLocalNetwork = /^http:\/\/(?:192\.168|10|172\.(?:1[6-9]|2\d|3[0-1])|169\.254)\.\d+\.\d+(:\d+)?$/.test(origin);
    const isAllowedWeb = origin === 'https://peak-x-sender-v3-test.netlify.app' || origin === allowedOrigin;
    
    if (isLocalhost || isLocalNetwork || isAllowedWeb) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// Request logger middleware
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve the React frontend (production build) from gfg-main/dist
app.use(express.static(path.join(__dirname, 'gfg-main', 'dist')));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// Auth routes are PUBLIC (no auth middleware) and rate-limited strictly
app.use('/api/auth', strictLimiter, require('./routes/auth'));

// Protected routes (JWT or PIN) - rate-limited generally
app.use('/api/accounts', generalLimiter, requireAuth, require('./routes/accounts'));
app.use('/api/campaigns', generalLimiter, requireAuth, require('./routes/campaigns'));
app.use('/api/contacts', generalLimiter, requireAuth, require('./routes/contacts'));
app.use('/api/queue', generalLimiter, requireAuth, require('./routes/queue'));
app.use('/api/templates', generalLimiter, requireAuth, require('./routes/templates'));

// Tracking routes are PUBLIC (email clients must reach them) and NOT rate limited
app.use('/api/track', require('./routes/tracking'));

// Health check
app.get('/api/health', generalLimiter, requireAuth, async (_req, res) => {
  try {
    const db = await getDb();
    const row = await db.prepare('SELECT COUNT(*) as count FROM accounts').get();
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
app.get('/api/dashboard', generalLimiter, requireAuth, async (_req, res) => {
  try {
    const db = await getDb();
    
    const accountsRow = await db.prepare("SELECT SUM(daily_sent) as today_sent, COUNT(*) as total FROM accounts WHERE status = 'active'").get() || { today_sent: 0, total: 0 };
    const queueRow = await db.prepare("SELECT COUNT(*) as pending FROM queue WHERE status = 'pending'").get() || { pending: 0 };
    const campaignsRow = await db.prepare("SELECT COUNT(*) as active FROM campaigns WHERE status = 'sending'").get() || { active: 0 };
    const failedRow = await db.prepare("SELECT SUM(failed_count) as failed FROM campaigns").get() || { failed: 0 };
    const trackingRow = await db.prepare("SELECT COALESCE(SUM(opens_count), 0) as opens, COALESCE(SUM(clicks_count), 0) as clicks FROM queue").get() || { opens: 0, clicks: 0 };

    const stats = {
      today_sent: accountsRow.today_sent || 0,
      active_accounts: accountsRow.total || 0,
      pending: queueRow.pending || 0,
      active_campaigns: campaignsRow.active || 0,
      failed: failedRow.failed || 0,
      opens: trackingRow.opens || 0,
      clicks: trackingRow.clicks || 0,
    };

    const campaigns = await db.prepare(`
      SELECT c.*,
             COALESCE(SUM(q.opens_count), 0) as total_opens,
             COALESCE(SUM(q.clicks_count), 0) as total_clicks
      FROM campaigns c
      LEFT JOIN queue q ON c.id = q.campaign_id
      GROUP BY c.id
      ORDER BY c.id DESC
      LIMIT 5
    `).all();

    const queue = await db.prepare(`
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
// Start & Graceful Shutdown
// ---------------------------------------------------------------------------
const { stopScheduler } = require('./scheduler');

let server;
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
    });
  }

  try {
    stopScheduler();
  } catch (err) {
    logger.error({ err: err.message }, 'Error stopping scheduler');
  }

  try {
    const db = await getDb();
    if (db && typeof db.close === 'function') {
      await db.close();
      logger.info('Database connections closed.');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error closing database connections');
  }

  logger.info('Shutdown complete.');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

(async () => {
  // Wait for DB to be fully initialised before accepting requests
  await getDb();

  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const localIps = [];
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIps.push(iface.address);
      }
    }
  }

  server = app.listen(PORT, () => {
    logger.info(`Peak Xender server running on http://localhost:${PORT}`);
    localIps.forEach(ip => {
      logger.info(`  Network:   http://${ip}:${PORT}`);
    });
    logger.info(`API endpoints: http://localhost:${PORT}/api/health`);
  });

  // Start the background email scheduler
  require('./scheduler');
})();
