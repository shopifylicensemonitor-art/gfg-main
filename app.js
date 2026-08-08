/**
 * app.js — Express application setup for Peak Xender.
 *
 * Exported for use by server.js (local Node) and netlify/functions/api.js (Netlify Functions).
 */

require('dotenv').config();

// Ensure AI_ENCRYPTION_KEY is set in production to protect stored API keys.
if (process.env.NODE_ENV === 'production' && !process.env.AI_ENCRYPTION_KEY) {
  console.error('FATAL: AI_ENCRYPTION_KEY environment variable is required in production. Set AI_ENCRYPTION_KEY to a strong secret (use a KMS or env secret).');
  process.exit(1);
}

if (!process.env.AI_ENCRYPTION_KEY) {
  if (!process.env.JWT_SECRET) {
    console.warn('Warning: AI_ENCRYPTION_KEY and JWT_SECRET are both missing. Using dev fallbacks which are insecure.');
  } else {
    console.warn('Warning: AI_ENCRYPTION_KEY not set; falling back to JWT_SECRET for key material. This is not recommended in production.');
  }
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const { requireAuth } = require('./middleware/session');
const logger = require('./logger');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);

const isLocalhost = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const normalizedIp = ip.replace(/^::ffff:/, '');

  return (
    normalizedIp === '127.0.0.1' ||
    normalizedIp === '::1'
  );
};

// Rate limiting middleware
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalhost,
  message: { error: 'Too many requests, please try again later.' }
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalhost,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
const allowedOrigins = [
  'https://send.peakconix.site',
  'https://peak-x-sender-v3-test.netlify.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const configuredOrigin = process.env.FRONTEND_ORIGIN || '';
if (configuredOrigin) {
  allowedOrigins.push(configuredOrigin);
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
    const isLocalNetwork = /^http:\/\/(?:192\.168|10|172\.(?:1[6-9]|2\d|3[0-1])|169\.254)\.\d+\.\d+(:\d+)?$/.test(origin);

    if (isLocalhost || isLocalNetwork) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files if present
app.use(express.static(path.join(__dirname, 'gfg-main', 'dist')));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// Auth routes are PUBLIC
app.use('/api/auth', strictLimiter, require('./routes/auth'));

// Protected routes (JWT or PIN)
app.use('/api/accounts', generalLimiter, requireAuth, require('./routes/accounts'));
app.use('/api/campaigns', generalLimiter, requireAuth, require('./routes/campaigns'));
app.use('/api/contacts', generalLimiter, requireAuth, require('./routes/contacts'));
app.use('/api/queue', generalLimiter, requireAuth, require('./routes/queue'));
app.use('/api/templates', generalLimiter, requireAuth, require('./routes/templates'));
app.use('/api/ai', generalLimiter, requireAuth, require('./routes/ai'));
app.use('/api/inbox', generalLimiter, requireAuth, require('./routes/inbox'));

// Tracking routes are PUBLIC
app.use('/api/track', require('./routes/tracking'));

// Health check
app.get('/api/health', async (_req, res) => {
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
    
    const totalSentRow = await db.prepare("SELECT SUM(daily_sent) as today_sent FROM accounts").get() || { today_sent: 0 };
    const activeAccountsRow = await db.prepare("SELECT COUNT(*) as active_accounts FROM accounts WHERE status = 'active'").get() || { active_accounts: 0 };
    const queueRow = await db.prepare("SELECT COUNT(*) as pending FROM queue WHERE status = 'pending'").get() || { pending: 0 };
    const campaignsRow = await db.prepare("SELECT COUNT(*) as active FROM campaigns WHERE status = 'sending'").get() || { active: 0 };
    const failedRow = await db.prepare("SELECT SUM(failed_count) as failed FROM campaigns").get() || { failed: 0 };
    const trackingRow = await db.prepare("SELECT COALESCE(SUM(opens_count), 0) as opens, COALESCE(SUM(clicks_count), 0) as clicks FROM queue").get() || { opens: 0, clicks: 0 };

    const stats = {
      today_sent: totalSentRow.today_sent || 0,
      active_accounts: activeAccountsRow.active_accounts || 0,
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

module.exports = app;
