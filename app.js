/**
 * app.js — Express application setup for Peak Xender.
 *
 * Exported for use by server.js (local Node) and netlify/functions/api.js (Netlify Functions).
 */

require('dotenv').config();

// JWT signing and verification must never use an implicit shared secret.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in every environment.');
}

// Ensure AI_ENCRYPTION_KEY is set in production to protect stored API keys.
if (process.env.NODE_ENV === 'production' && !process.env.AI_ENCRYPTION_KEY) {
  throw new Error('AI_ENCRYPTION_KEY is required in production.');
}

if (process.env.NODE_ENV === 'production' && (!process.env.DATABASE_URL || process.env.USE_SQLITE === 'true')) {
  throw new Error('Production requires durable PostgreSQL via DATABASE_URL; SQLite is for local development only.');
}

if (!process.env.AI_ENCRYPTION_KEY) {
  console.warn('Warning: AI_ENCRYPTION_KEY not set; falling back to JWT_SECRET for key material. This is not recommended in production.');
}

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const path = require('path');
const { getDb } = require('./db');
const { requireAuth } = require('./middleware/session');
const { attachTenant } = require('./middleware/tenant');
const { resolveWorkspace } = require('./middleware/workspace');
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

// Strict CORS: only allow explicitly configured origins
const allowedOrigins = [
  'https://send.peakconix.site',
  'https://peak-x-sender-v3-test.netlify.app',
];

// Add dev localhost origins only in non-production
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  );
}

const configuredOrigin = process.env.FRONTEND_ORIGIN || '';
if (configuredOrigin && !allowedOrigins.includes(configuredOrigin)) {
  allowedOrigins.push(configuredOrigin);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, mobile apps, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In non-production, also allow localhost/LAN
    if (process.env.NODE_ENV !== 'production') {
      const isLocal = /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
      const isLan = /^http:\/\/(?:192\.168|10|172\.(?:1[6-9]|2\d|3[0-1])|169\.254)\.\d+\.\d+(:\d+)?$/.test(origin);
      if (isLocal || isLan) {
        return callback(null, true);
      }
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(compression());

// Cookie parser — required for HttpOnly session cookies
app.use(cookieParser());

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

// Auth routes — public
app.use('/api/auth', strictLimiter, require('./routes/auth'));

// Protected routes — require JWT auth + tenant UUID validation
app.use('/api/accounts', generalLimiter, requireAuth, attachTenant, resolveWorkspace, require('./routes/accounts'));
app.use('/api/campaigns', generalLimiter, requireAuth, attachTenant, resolveWorkspace, require('./routes/campaigns'));
app.use('/api/contacts', generalLimiter, requireAuth, attachTenant, resolveWorkspace, require('./routes/contacts'));
app.use('/api/queue', generalLimiter, requireAuth, attachTenant, resolveWorkspace, require('./routes/queue'));
app.use('/api/templates', generalLimiter, requireAuth, attachTenant, resolveWorkspace, require('./routes/templates'));
app.use('/api/ai', generalLimiter, requireAuth, attachTenant, resolveWorkspace, require('./routes/ai'));
app.use('/api/inbox', generalLimiter, requireAuth, attachTenant, resolveWorkspace, require('./routes/inbox'));
app.use('/api/manual', generalLimiter, requireAuth, attachTenant, resolveWorkspace, require('./routes/manual'));

// Tracking routes are PUBLIC (open/click tracking pixels)
app.use('/api/track', require('./routes/tracking'));

// Health check (PUBLIC)
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

// Dashboard stats aggregator (workspace-scoped)
const dashboardCache = new Map();
const DASHBOARD_CACHE_TTL_MS = 15_000;
app.get('/api/dashboard', generalLimiter, requireAuth, attachTenant, resolveWorkspace, async (req, res) => {
  try {
    const db = await getDb();
    const workspaceId = req.workspace.id;
    const cacheKey = String(workspaceId);
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.payload);
    }

    const totalSentRow = await db.prepare("SELECT COALESCE(SUM(daily_sent), 0) AS today_sent FROM accounts WHERE status = 'active' AND workspace_id = ?").get(workspaceId) || { today_sent: 0 };
    const activeAccountsRow = await db.prepare("SELECT COUNT(*) AS active_accounts FROM accounts WHERE status = 'active' AND workspace_id = ?").get(workspaceId) || { active_accounts: 0 };
    const queueRow = await db.prepare("SELECT COUNT(*) AS pending FROM queue WHERE status = 'pending' AND workspace_id = ?").get(workspaceId) || { pending: 0 };
    const campaignsRow = await db.prepare("SELECT COUNT(*) AS active FROM campaigns WHERE status = 'sending' AND workspace_id = ?").get(workspaceId) || { active: 0 };
    const failedRow = await db.prepare("SELECT COALESCE(SUM(failed_count), 0) AS failed FROM campaigns WHERE workspace_id = ?").get(workspaceId) || { failed: 0 };
    const trackingRow = await db.prepare("SELECT COALESCE(SUM(opens_count), 0) AS opens, COALESCE(SUM(clicks_count), 0) AS clicks FROM queue WHERE workspace_id = ?").get(workspaceId) || { opens: 0, clicks: 0 };

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
      SELECT c.id, c.name, c.status, c.created_at,
             COALESCE(SUM(q.opens_count), 0) as total_opens,
             COALESCE(SUM(q.clicks_count), 0) as total_clicks
      FROM campaigns c
      LEFT JOIN queue q ON c.id = q.campaign_id
      WHERE c.user_id = ?
      GROUP BY c.id, c.name, c.status, c.created_at
      ORDER BY c.id DESC
      LIMIT 25
    `).all(workspaceId);

    const queue = await db.prepare(`
      SELECT q.id, q.campaign_id, q.status, q.created_at,
             c.name as campaign_name, a.email as account_email
      FROM queue q
      LEFT JOIN campaigns c ON q.campaign_id = c.id
      LEFT JOIN accounts a ON q.account_id = a.id
      WHERE q.user_id = ?
      ORDER BY q.id DESC
      LIMIT 25
    `).all(workspaceId);

    const payload = { stats, campaigns, queue };
    for (const [key, entry] of dashboardCache) {
      if (entry.expiresAt <= Date.now()) dashboardCache.delete(key);
    }
    dashboardCache.set(cacheKey, { expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS, payload });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
