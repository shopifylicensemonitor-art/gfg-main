# MailFlow Setup & Deployment Guide

This guide provides a detailed, step-by-step process to set up, configure, and deploy **MailFlow** (Peak Xender)—a high-performance bulk email outreach platform featuring Google OAuth/SMTP integration, dynamic spintax personalization, and link/open tracking. 

It covers only the architectures, configurations, and scopes that are proven to work reliably, avoiding common errors such as Gmail OAuth "Insufficient Permission" prompts.

---

## Table of Contents
1. [Google Cloud Console Project Setup](#1-google-cloud-console-project-setup)
2. [Database Schema (Dual SQLite & Postgres)](#2-database-schema-dual-sqlite--postgres)
3. [Environment Configuration (`.env`)](#3-environment-configuration-env)
4. [Backend Directory Structure](#4-backend-directory-structure)
5. [Backend Core Implementations](#5-backend-core-implementations)
6. [Background Scheduler & Personalization](#6-background-scheduler--personalization)
7. [Frontend API Client Integration](#7-frontend-api-client-integration)
8. [Deploying to Render & Supabase](#8-deploying-to-render--supabase)

---

## 1. Google Cloud Console Project Setup

To connect Gmail accounts (via OAuth2) and authenticate admins, you must configure a project in the Google Cloud Console.

### Step 1.1: Create the Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top navigation and select **New Project**.
3. Name your project (e.g., `MailFlow`) and click **Create**.

### Step 1.2: Configure OAuth Consent Screen
1. Navigate to **APIs & Services** > **OAuth Consent Screen**.
2. Select **External** and click **Create**.
3. Fill in the **App Information** (App name, User support email, Developer contact email).
4. **Scopes (CRITICAL STEP)**:
   - Click **Add or Remove Scopes**.
   - Under manually added scopes, add the following scopes only:
     - `https://www.googleapis.com/auth/gmail.send` (to send emails)
     - `https://www.googleapis.com/auth/userinfo.email` (to retrieve account email during connection)
     - `https://www.googleapis.com/auth/userinfo.profile` (to retrieve profile details for admin sign-in)
   - *Warning*: Do **not** request `gmail.readonly` or full Gmail scopes. If requested, Google will deny connection attempts unless the app undergoes a expensive security review, and it will throw `Insufficient Permission` errors during the callback profile lookup.
5. **Test Users**:
   - Add the Gmail addresses you intend to use as sender accounts or administrators. Since the app is in the "Testing" phase, only these listed accounts will be permitted to connect.

### Step 1.3: Generate OAuth Client Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth Client ID**.
3. Select **Web Application** as the application type.
4. Name the client (e.g., `MailFlow Credentials`).
5. **Authorized JavaScript Origins**:
   - Local: `http://localhost:5173` (Frontend dev server)
   - Production: `https://your-frontend-app.netlify.app` (or custom domain)
6. **Authorized Redirect URIs**:
   - **For Connected Sender Accounts (Accounts Callback)**:
     - Local: `http://localhost:3000/api/accounts/callback`
     - Production: `https://your-backend-service.onrender.com/api/accounts/callback`
   - **For Admin User Login (Login Callback)**:
     - Local: `http://localhost:3000/api/auth/callback`
     - Production: `https://your-backend-service.onrender.com/api/auth/callback`
7. Click **Create** and save the **Client ID** and **Client Secret**.

---

## 2. Database Schema (Dual SQLite & Postgres)

MailFlow features a dual-mode database connector (`db.js`). It connects to a cloud-based **PostgreSQL** instance (e.g., Supabase) if a `DATABASE_URL` env variable is set, otherwise, it falls back to a local **SQLite** file (`mailflow.db`).

### Schema Definitions
The database schema uses the following tables:

*   **`users`**: Administrative users authorized to manage MailFlow.
*   **`accounts`**: Connected Gmail (OAuth) and SMTP sender accounts.
*   **`contacts`**: Recipient lists uploaded via CSV.
*   **`campaigns`**: Details of outreach campaigns.
*   **`queue`**: Queued, personalized outreach emails with assigned senders and scheduled dates.
*   **`logs`**: Audit trail of successful, failed, and retried emails.
*   **`templates`**: Saved content layouts.

---

## 3. Environment Configuration (`.env`)

Create a `.env` file in your root folder. Use the following schema:

```env
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

# Database URL - Leave empty to fall back to SQLite
DATABASE_URL=postgres://user:password@host:port/dbname

# Google Client Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/accounts/callback
GOOGLE_LOGIN_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Security & Sessions
JWT_SECRET=your_super_secret_jwt_key_here
ADMIN_EMAIL=your_admin_gmail@gmail.com
ACCESS_PIN=123456

# Open/Click Link Redirection Tracker Host
TRACKING_BASE_URL=http://localhost:3000

# Scheduler configuration
SCHEDULER_BATCH_SIZE=10
```

---

## 4. Backend Directory Structure

Ensure your backend project directory is organized as follows:

```
mailflow-backend/
├── .env
├── db.js
├── logger.js
├── server.js
├── scheduler.js
├── middleware/
│   └── session.js
├── execution/
│   └── spintax.js
└── routes/
    ├── accounts.js
    ├── auth.js
    ├── campaigns.js
    ├── contacts.js
    ├── queue.js
    ├── templates.js
    └── tracking.js
```

---

## 5. Backend Core Implementations

Here is the exact code for the backend files.

### 5.1 Logger Config (`logger.js`)
Handles unified logging across the server.

```javascript
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  enabled: process.env.NODE_ENV !== 'test',
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV || 'development'
  }
});

module.exports = logger;
```

### 5.2 Session Middleware (`middleware/session.js`)
Authorizes incoming REST API calls using JWT tokens or a backup safety PIN.

```javascript
/**
 * middleware/session.js — JWT session verification middleware.
 *
 * Checks for Bearer token in Authorization header.
 * Falls back to PIN auth if no JWT is configured (backward compatible).
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'peakxender-dev-secret-change-me';

/**
 * Middleware that accepts EITHER a valid JWT Bearer token
 * OR the legacy PIN-based auth. This ensures backward compatibility
 * while enabling the new auth flow.
 */
function requireAuth(req, res, next) {
  // Try JWT Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (_) {
      return res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
    }
  }

  // Reject if no token
  return res.status(401).json({ error: 'Unauthorized. Provide a valid JWT token.' });
}

module.exports = { requireAuth };
```

### 5.3 Database Adapter (`db.js`)
Configures SQLite/PostgreSQL connectors and initialises DDL schemas.

```javascript
/**
 * db.js — Dual-mode database connector (SQLite + PostgreSQL).
 *
 * If DATABASE_URL is set in .env, connects to PostgreSQL (e.g. Supabase).
 * Otherwise, uses sql.js (pure JS/WASM) for local SQLite storage.
 *
 * Both adapters expose the same async API:
 *   db.prepare(sql).all(...params)   → Promise<[{ col: val, … }, …]>
 *   db.prepare(sql).get(...params)   → Promise<{ col: val, … } | undefined>
 *   db.prepare(sql).run(...params)   → Promise<{ changes, lastInsertRowid }>
 *   db.exec(sql)                     → Promise<void>
 *   db.transaction(fn)               → async callable wrapper
 */

require('dotenv').config();

let ready = null; // Promise that resolves to the wrapped db

// ============================================================================
// PostgreSQL Adapter
// ============================================================================

function createPgAdapter() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('supabase')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  /** Convert SQLite-style `?` placeholders to PG-style `$1, $2, ...` */
  function convertPlaceholders(sql) {
    let idx = 0;
    return sql.replace(/\?/g, () => `$${++idx}`);
  }

  /** Convert SQLite datetime('now') to PG NOW() */
  function convertDatetime(sql) {
    return sql.replace(/datetime\('now'\)/gi, 'NOW()');
  }

  /** Full SQL conversion pipeline */
  function convertSql(sql) {
    return convertDatetime(convertPlaceholders(sql));
  }

  const wrapped = {
    _isPg: true,

    async close() {
      await pool.end();
    },

    async exec(sql) {
      // PG exec: run raw SQL (for DDL)
      await pool.query(sql);
    },

    prepare(sql) {
      const pgSql = convertSql(sql);
      return {
        async all(...params) {
          const flat = flattenParams(params);
          const result = await pool.query(pgSql, flat);
          return result.rows;
        },
        async get(...params) {
          const flat = flattenParams(params);
          const result = await pool.query(pgSql, flat);
          return result.rows[0] || undefined;
        },
        async run(...params) {
          const flat = flattenParams(params);
          const result = await pool.query(pgSql, flat);
          // Try to extract lastInsertRowid from RETURNING clause
          let lastId = 0;
          if (result.rows && result.rows[0] && result.rows[0].id) {
            lastId = result.rows[0].id;
          }
          return { changes: result.rowCount || 0, lastInsertRowid: lastId };
        },
      };
    },

    transaction(fn) {
      return async (...args) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Replace pool with client for the duration of the transaction
          const txDb = { ...wrapped };
          const origPrepare = wrapped.prepare.bind(wrapped);
          txDb.prepare = (sql) => {
            const pgSql = convertSql(sql);
            return {
              async all(...params) {
                const flat = flattenParams(params);
                const result = await client.query(pgSql, flat);
                return result.rows;
              },
              async get(...params) {
                const flat = flattenParams(params);
                const result = await client.query(pgSql, flat);
                return result.rows[0] || undefined;
              },
              async run(...params) {
                const flat = flattenParams(params);
                const result = await client.query(pgSql, flat);
                let lastId = 0;
                if (result.rows && result.rows[0] && result.rows[0].id) {
                  lastId = result.rows[0].id;
                }
                return { changes: result.rowCount || 0, lastInsertRowid: lastId };
              },
            };
          };
          const result = await fn(txDb, ...args);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      };
    },
  };

  return wrapped;
}

// ============================================================================
// SQLite Adapter (wrapped in Promises for API compatibility)
// ============================================================================

function createSqliteAdapter() {
  const initSqlJs = require('sql.js');
  const fs = require('fs');
  const path = require('path');

  const DB_PATH = path.join(__dirname, 'mailflow.db');
  let rawDb = null;

  function save() {
    if (!rawDb) return;
    const data = rawDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  return (async () => {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      rawDb = new SQL.Database(fileBuffer);
      console.log('SQLite database loaded from disk.');
    } else {
      rawDb = new SQL.Database();
      console.log('New SQLite database created.');
    }

    const wrapped = {
      _isPg: false,

      async close() {
        save();
        if (rawDb) {
          rawDb.close();
        }
      },

      async exec(sql) {
        rawDb.run(sql);
        save();
      },

      prepare(sql) {
        return {
          async all(...params) {
            const flat = flattenParams(params);
            try {
              const stmt = rawDb.prepare(sql);
              if (flat.length) stmt.bind(flat);
              const rows = [];
              while (stmt.step()) {
                rows.push(stmt.getAsObject());
              }
              stmt.free();
              return rows;
            } catch (err) {
              throw err;
            }
          },

          async get(...params) {
            const flat = flattenParams(params);
            try {
              const stmt = rawDb.prepare(sql);
              if (flat.length) stmt.bind(flat);
              let row;
              if (stmt.step()) {
                row = stmt.getAsObject();
              }
              stmt.free();
              return row;
            } catch (err) {
              throw err;
            }
          },

          async run(...params) {
            const flat = flattenParams(params);
            try {
              rawDb.run(sql, flat);
              save();
              const info = rawDb.getRowsModified
                ? rawDb.getRowsModified()
                : 0;
              let lastId = 0;
              try {
                const idStmt = rawDb.prepare('SELECT last_insert_rowid() as id');
                if (idStmt.step()) {
                  lastId = idStmt.getAsObject().id;
                }
                idStmt.free();
              } catch (_) { /* ignore */ }
              return { changes: info, lastInsertRowid: lastId };
            } catch (err) {
              throw err;
            }
          },
        };
      },

      transaction(fn) {
        return async (...args) => {
          rawDb.run('BEGIN TRANSACTION');
          try {
            const result = await fn(wrapped, ...args);
            rawDb.run('COMMIT');
            save();
            return result;
          } catch (err) {
            rawDb.run('ROLLBACK');
            throw err;
          }
        };
      },
    };

    return { rawDb, wrapped, save };
  })();
}

// ============================================================================
// Shared Helpers
// ============================================================================

/** Flatten params so callers can do .run(a, b, c) or .run([a, b, c]). */
function flattenParams(params) {
  if (params.length === 0) return [];
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

// ============================================================================
// DDL — Table creation
// ============================================================================

const SQLITE_DDL = `
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry INTEGER,
    daily_sent INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 450,
    last_reset TEXT,
    status TEXT DEFAULT 'active',
    display_name TEXT DEFAULT '',
    type TEXT DEFAULT 'oauth',
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_pass TEXT,
    smtp_secure INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT NOT NULL,
    email TEXT NOT NULL,
    fields TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_plain TEXT,
    contact_list TEXT NOT NULL,
    delay_seconds INTEGER DEFAULT 30,
    start_time TEXT DEFAULT '08:00',
    end_time TEXT DEFAULT '22:00',
    status TEXT DEFAULT 'draft',
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    content_variations TEXT,
    content_mode TEXT DEFAULT 'single',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    recipient_email TEXT NOT NULL,
    account_id INTEGER,
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    scheduled_at TEXT,
    sent_at TEXT,
    error TEXT,
    fields TEXT,
    final_subject TEXT,
    final_body TEXT,
    opens_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    account_id INTEGER,
    recipient_email TEXT,
    status TEXT,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_plain TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    picture TEXT DEFAULT '',
    role TEXT DEFAULT 'admin',
    last_login TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

const PG_DDL = `
  CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry BIGINT,
    daily_sent INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 450,
    last_reset TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    display_name TEXT DEFAULT '',
    type TEXT DEFAULT 'oauth',
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_pass TEXT,
    smtp_secure INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    list_name TEXT NOT NULL,
    email TEXT NOT NULL,
    fields TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_plain TEXT,
    contact_list TEXT NOT NULL,
    delay_seconds INTEGER DEFAULT 30,
    start_time TEXT DEFAULT '08:00',
    end_time TEXT DEFAULT '22:00',
    status TEXT DEFAULT 'draft',
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    content_variations TEXT,
    content_mode TEXT DEFAULT 'single',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS queue (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    recipient_email TEXT NOT NULL,
    account_id INTEGER REFERENCES accounts(id),
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error TEXT,
    fields TEXT,
    final_subject TEXT,
    final_body TEXT,
    opens_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER,
    account_id INTEGER,
    recipient_email TEXT,
    status TEXT,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_plain TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    picture TEXT DEFAULT '',
    role TEXT DEFAULT 'admin',
    last_login TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

// ============================================================================
// Initialisation
// ============================================================================

ready = (async () => {
  const usePg = !!process.env.DATABASE_URL;

  // Performance indexes (idempotent — safe to run on every startup)
  const INDEX_DDL = `
    CREATE INDEX IF NOT EXISTS idx_queue_status_campaign ON queue(status, campaign_id);
    CREATE INDEX IF NOT EXISTS idx_queue_scheduled_at ON queue(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_contacts_list_name ON contacts(list_name);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
  `;

  if (usePg) {
    console.log('Connecting to PostgreSQL (Supabase)...');
    const adapter = createPgAdapter();
    await adapter.exec(PG_DDL);
    try {
      await adapter.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 450;");
    } catch (_) {}
    try {
      await adapter.exec("ALTER TABLE queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await adapter.exec(INDEX_DDL);
    } catch (_) {}
    console.log('PostgreSQL database initialised successfully.');
    return adapter;
  } else {
    console.log('Using local SQLite database...');
    const { wrapped } = await createSqliteAdapter();
    await wrapped.exec(SQLITE_DDL);
    try {
      await wrapped.exec("ALTER TABLE accounts ADD COLUMN daily_limit INTEGER DEFAULT 450;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN retry_count INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await wrapped.exec(INDEX_DDL);
    } catch (_) {}
    console.log('SQLite database initialised successfully.');
    return wrapped;
  }
})();

// Export
module.exports = {
  /** Resolves once the DB is ready. Returns the wrapped db object. */
  getDb: () => ready,
};
```

### 5.4 Server Entry (`server.js`)
Configures middleware (general and strict rate limiters), API routing, static React asset hosting, and cron worker bootstrap.

```javascript
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
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: [allowedOrigin, 'http://localhost:5173'],
  credentials: true
}));

// Request logger middleware
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

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

  server = app.listen(PORT, () => {
    logger.info(`Peak Xender server running on http://localhost:${PORT}`);
    logger.info(`API endpoints: http://localhost:${PORT}/api/health`);
  });

  // Start the background email scheduler
  require('./scheduler');
})();
```

### 5.5 Admin Session Login Route (`routes/auth.js`)
Configures Google OAuth authentication redirects and credentials extraction to issue JWT authorization session tokens for admins.

```javascript
/**
 * routes/auth.js — Google OAuth login + JWT session management.
 *
 * Endpoints:
 *   GET  /api/auth/google-url  → Generate Google OAuth consent URL for login
 *   GET  /api/auth/callback    → Exchange code for tokens, issue JWT
 *   GET  /api/auth/me          → Return current user info from JWT
 *   POST /api/auth/logout      → Clear session (client-side)
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { getDb } = require('../db');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'peakxender-dev-secret-change-me';
const JWT_EXPIRY = '7d';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

function getLoginOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Login callback is a DIFFERENT redirect URI from the accounts one
    process.env.GOOGLE_LOGIN_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
  );
}

/** Generate Google OAuth consent URL for admin login. */
router.get('/google-url', (_req, res) => {
  try {
    const oauth2 = getLoginOAuth2Client();
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** OAuth callback — exchange code, verify admin email, issue JWT. */
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided.' });

  try {
    const oauth2 = getLoginOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Fetch user info
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    const email = data.email;
    const name = data.name || email.split('@')[0];
    const picture = data.picture || '';

    // Check admin restriction
    if (ADMIN_EMAIL && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      // Redirect to frontend with error
      return res.redirect('/?auth_error=unauthorized');
    }

    // Upsert user in database
    const db = await getDb();
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (existing) {
      await db.prepare(
        "UPDATE users SET name = ?, picture = ?, last_login = datetime('now') WHERE email = ?"
      ).run(name, picture, email);
    } else {
      await db.prepare(
        'INSERT INTO users (email, name, picture, role) VALUES (?, ?, ?, ?)'
      ).run(email, name, picture, 'admin');
    }

    // Fetch the full user row for the JWT payload
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Redirect to frontend with token in query
    res.redirect(`/?token=${encodeURIComponent(token)}`);
  } catch (err) {
    logger.error({ err }, 'Auth callback error');
    res.status(500).json({ error: err.message });
  }
});

/** Return current user info from JWT. */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

/** Update current user's profile details. */
router.post('/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, picture } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const db = await getDb();
    await db.prepare(
      'UPDATE users SET name = ?, picture = ? WHERE id = ?'
    ).run(name, picture || '', decoded.id);

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get system settings. */
router.get('/settings', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const db = await getDb();
    const rows = await db.prepare('SELECT key, value FROM settings').all();
    
    const settingsMap = {};
    rows.forEach(r => {
      settingsMap[r.key] = r.value;
    });

    const responseSettings = {
      ADMIN_EMAIL: settingsMap['ADMIN_EMAIL'] || process.env.ADMIN_EMAIL || '',
      TRACKING_BASE_URL: settingsMap['TRACKING_BASE_URL'] || process.env.TRACKING_BASE_URL || 'http://localhost:3000',
      SCHEDULER_BATCH_SIZE: settingsMap['SCHEDULER_BATCH_SIZE'] || process.env.SCHEDULER_BATCH_SIZE || '10',
      DAILY_LIMIT_DEFAULT: settingsMap['DAILY_LIMIT_DEFAULT'] || '450',
    };

    res.json(responseSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update system settings. */
router.post('/settings', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const settings = req.body;
    const db = await getDb();

    const keys = ['ADMIN_EMAIL', 'TRACKING_BASE_URL', 'SCHEDULER_BATCH_SIZE', 'DAILY_LIMIT_DEFAULT'];
    
    for (const key of keys) {
      if (settings[key] !== undefined) {
        const existing = await db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
        if (existing) {
          await db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(settings[key]), key);
        } else {
          await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, String(settings[key]));
        }
      }
    }

    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Logout placeholder (JWT is stateless — client discards token). */
router.post('/logout', (_req, res) => {
  res.json({ success: true, message: 'Token cleared on client.' });
});

module.exports = router;
```

### 5.6 Connected Sender Accounts (`routes/accounts.js`)
Configures OAuth Client IDs, retrieves Gmail email info via `google.oauth2` userinfo APIs (avoiding permission issues), configures custom SMTP servers, handles token updates, and sends test messages.

```javascript
/**
 * routes/accounts.js — Gmail account management + OAuth2 flow.
 *
 * Endpoints:
 *   GET    /api/accounts           → List all connected accounts
 *   POST   /api/accounts/auth-url  → Get Google OAuth consent URL
 *   GET    /api/accounts/callback  → Handle OAuth callback
 *   DELETE /api/accounts/:id       → Remove an account
 *   POST   /api/accounts/:id/test  → Send a test email
 */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { getDb } = require('../db');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Refresh the access token for an account if it has expired.
 * Returns the (possibly refreshed) access_token.
 */
async function ensureFreshToken(account) {
  const now = Date.now();
  if (account.token_expiry && now < account.token_expiry - 60000) {
    return account.access_token; // Still valid
  }

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: account.refresh_token });
  const { credentials } = await oauth2.refreshAccessToken();

  const db = await getDb();
  await db.prepare(`
    UPDATE accounts
    SET access_token  = ?,
        token_expiry  = ?
    WHERE id = ?
  `).run(credentials.access_token, credentials.expiry_date, account.id);

  return credentials.access_token;
}

/**
 * Create a Nodemailer transport from an SMTP account row.
 */
function createSmtpTransport(account) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port || 587,
    secure: !!account.smtp_secure, // true = SSL/TLS (465), false = STARTTLS
    auth: {
      user: account.smtp_user,
      pass: account.smtp_pass,
    },
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** List all accounts. */
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const accounts = await db.prepare(`
      SELECT id, email, status, daily_sent, daily_limit, last_reset, display_name,
             type, smtp_host, smtp_port, smtp_secure, created_at
      FROM accounts
    `).all();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Generate Google OAuth consent URL. */
router.post('/auth-url', (_req, res) => {
  try {
    const oauth2 = getOAuth2Client();
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** OAuth callback — exchange code for tokens, save account. */
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided.' });

  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Fetch the email address
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    const email = data.email;

    const db = await getDb();
    const existing = await db.prepare('SELECT id FROM accounts WHERE email = ?').get(email);

    if (existing) {
      await db.prepare(`
        UPDATE accounts
        SET access_token  = ?,
            refresh_token = COALESCE(?, refresh_token),
            token_expiry  = ?,
            status        = 'active',
            type          = 'oauth'
        WHERE email = ?
      `).run(tokens.access_token, tokens.refresh_token, tokens.expiry_date, email);
    } else {
      await db.prepare(`
        INSERT INTO accounts (email, access_token, refresh_token, token_expiry, type)
        VALUES (?, ?, ?, ?, 'oauth')
      `).run(email, tokens.access_token, tokens.refresh_token, tokens.expiry_date);
    }

    // Redirect back to the frontend dashboard
    res.redirect('/?account_added=' + encodeURIComponent(email));
  } catch (err) {
    const logger = require('../logger');
    logger.error({ err: err.message }, 'OAuth callback error');
    res.redirect('/?account_error=' + encodeURIComponent(err.message));
  }
});

/** Connect a custom SMTP account. */
router.post('/smtp', async (req, res) => {
  const { email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, display_name } = req.body;

  if (!email || !smtp_host || !smtp_user || !smtp_pass) {
    return res.status(400).json({ error: 'Missing required SMTP fields (email, smtp_host, smtp_user, smtp_pass).' });
  }

  try {
    // Verify the connection before saving
    const transport = nodemailer.createTransport({
      host: smtp_host,
      port: smtp_port || 587,
      secure: !!smtp_secure,
      auth: { user: smtp_user, pass: smtp_pass },
    });

    await transport.verify();

    const db = await getDb();
    const existing = await db.prepare('SELECT id FROM accounts WHERE email = ?').get(email);

    if (existing) {
      await db.prepare(`
        UPDATE accounts
        SET type = 'smtp', smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?,
            smtp_secure = ?, display_name = COALESCE(?, display_name), status = 'active'
        WHERE email = ?
      `).run(smtp_host, smtp_port || 587, smtp_user, smtp_pass, smtp_secure ? 1 : 0, display_name || '', email);
    } else {
      await db.prepare(`
        INSERT INTO accounts (email, type, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, display_name)
        VALUES (?, 'smtp', ?, ?, ?, ?, ?, ?)
      `).run(email, smtp_host, smtp_port || 587, smtp_user, smtp_pass, smtp_secure ? 1 : 0, display_name || '');
    }

    res.json({ success: true, message: `SMTP account ${email} connected and verified.` });
  } catch (err) {
    res.status(400).json({ error: `SMTP verification failed: ${err.message}` });
  }
});

/** Delete an account. */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Pause an account. */
router.post('/:id/pause', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET status = 'paused' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Resume an account. */
router.post('/:id/resume', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET status = 'active' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Reset daily sent count. */
router.post('/:id/reset', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET daily_sent = 0, last_reset = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update display name. */
router.put('/:id/display-name', async (req, res) => {
  const { display_name } = req.body;
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET display_name = ? WHERE id = ?").run(display_name || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Send a test email from a specific account (supports both OAuth and SMTP). */
router.post('/:id/test', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Missing "to" field.' });

  try {
    const db = await getDb();
    const account = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found.' });

    if (account.type === 'smtp') {
      // Send via Nodemailer SMTP
      const transport = createSmtpTransport(account);
      await transport.sendMail({
        from: account.display_name
          ? `"${account.display_name}" <${account.email}>`
          : account.email,
        to,
        subject: 'Peak Xender Test',
        html: '<p>This is a test email from Peak Xender via your custom SMTP server.</p>',
      });
    } else {
      // Send via Gmail API (OAuth)
      const accessToken = await ensureFreshToken(account);
      const oauth2 = getOAuth2Client();
      oauth2.setCredentials({ access_token: accessToken });

      const gmail = google.gmail({ version: 'v1', auth: oauth2 });
      const raw = makeRawEmail(account.email, to, 'Peak Xender Test', 'This is a test email from Peak Xender.');
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    }

    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Build a base64url-encoded RFC 2822 message with optional extra headers. */
function makeRawEmail(from, to, subject, body, extraHeaders = {}) {
  const headerLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ];

  // Append any extra headers (e.g., List-Unsubscribe)
  for (const [key, value] of Object.entries(extraHeaders)) {
    headerLines.push(`${key}: ${value}`);
  }

  const msg = [...headerLines, '', body].join('\r\n');
  return Buffer.from(msg).toString('base64url');
}

// Export the helper for the scheduler
router.ensureFreshToken = ensureFreshToken;
router.makeRawEmail = makeRawEmail;
router.getOAuth2Client = getOAuth2Client;
router.createSmtpTransport = createSmtpTransport;

module.exports = router;
```

### 5.7 Campaigns (`routes/campaigns.js`)
Configures campaigns CRUD and triggers sending queue assembly using a round-robin connection rotation logic with randomly dispersed delivery intervals.

```javascript
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
const { personalise } = require('../scheduler');

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

    const result = await db.prepare(`
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

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  values.push(req.params.id);

  try {
    const db = await getDb();
    await db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...values);
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
      await txDb.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    });
    await deleteBoth();
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

    // Clear any existing queue items for this campaign
    await db.prepare('DELETE FROM queue WHERE campaign_id = ?').run(req.params.id);

    // Populate queue with round-robin account assignment
    const insertQueue = db.transaction(async (txDb) => {
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

        await txDb.prepare(`
          INSERT INTO queue (campaign_id, recipient_email, account_id, status, scheduled_at, fields)
          VALUES (?, ?, ?, 'pending', ?, ?)
        `).run(req.params.id, contact.email, accountId, scheduledAt.toISOString(), contact.fields || null);
      }

      // Update campaign status
      await txDb.prepare(`
        UPDATE campaigns
        SET status = 'sending', total_contacts = ?, sent_count = 0, failed_count = 0
        WHERE id = ?
      `).run(contacts.length, req.params.id);
    });

    await insertQueue();

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

    // If no contacts exist, return a mock preview list
    if (contacts.length === 0) {
      const mockContacts = [
        { email: 'john@example.com', fields: JSON.stringify({ first_name: 'John', store_name: 'John\'s Shop' }) },
        { email: 'jane@example.com', fields: JSON.stringify({ first_name: 'Jane', store_name: 'Jane\'s Boutique' }) }
      ];
      
      const previews = mockContacts.map((c, index) => {
        const acc = accounts[index % accounts.length] || defaultAccount;
        return {
          recipient_email: c.email,
          sender_email: acc.email,
          subject: personalise(campaign.subject, c.email, c.fields, acc.display_name),
          body_html: personalise(campaign.body_html, c.email, c.fields, acc.display_name)
        };
      });
      return res.json(previews);
    }

    const previews = contacts.map((c, index) => {
      const acc = accounts[index % accounts.length] || defaultAccount;
      return {
        recipient_email: c.email,
        sender_email: acc.email,
        subject: personalise(campaign.subject, c.email, c.fields, acc.display_name),
        body_html: personalise(campaign.body_html, c.email, c.fields, acc.display_name)
      };
    });

    res.json(previews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

### 5.8 Contacts (`routes/contacts.js`)
Handles CSV contact uploads, normalization of custom spreadsheet column headers (so they can be referenced as personalizing variables), list lookups, and deletions.

```javascript
/**
 * routes/contacts.js — Contact list management (CSV upload + CRUD).
 *
 * Endpoints:
 *   GET    /api/contacts/lists           → List all contact list names
 *   GET    /api/contacts/:listName       → Get contacts in a list
 *   POST   /api/contacts/upload          → Upload CSV of contacts
 *   POST   /api/contacts                 → Add a single contact
 *   DELETE /api/contacts/:listName       → Delete an entire list
 *   DELETE /api/contacts/:listName/:id   → Delete single contact
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDb } = require('../db');

// Multer: store uploads in memory (CSVs are small)
const upload = multer({ storage: multer.memoryStorage() });

/** List all distinct contact list names with counts. */
router.get('/lists', async (_req, res) => {
  try {
    const db = await getDb();
    const lists = await db.prepare(`
      SELECT list_name, COUNT(*) as count
      FROM contacts
      GROUP BY list_name
      ORDER BY list_name
    `).all();
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get all contacts in a specific list. */
router.get('/:listName', async (req, res) => {
  try {
    const db = await getDb();
    const contacts = await db.prepare(
      'SELECT * FROM contacts WHERE list_name = ? ORDER BY id'
    ).all(req.params.listName);

    const parsedContacts = contacts.map(c => {
      try {
        c.fields = c.fields ? JSON.parse(c.fields) : {};
      } catch (_) {
        c.fields = {};
      }
      return c;
    });

    res.json(parsedContacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Simple CSV parser helper respecting quoted commas */
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let cell = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(cell.trim().replace(/^["']|["']$/g, ''));
        cell = '';
      } else {
        cell += char;
      }
    }
    cells.push(cell.trim().replace(/^["']|["']$/g, ''));
    rows.push(cells);
  }
  return rows;
}

/** Normalize header to alphanumeric with underscores */
function normalizeHeaderKey(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Extract multiple emails and a single URL from cell value */
function extractEmailsAndUrlsFromCell(cellValue) {
  const trimmed = cellValue.trim();
  if (!trimmed) return { emails: [], url: '' };
  
  const emailMatches = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  let emailCandidates = Array.from(new Set(emailMatches.map(e => e.trim().toLowerCase())));
  
  if (emailCandidates.length === 0) {
    emailCandidates = trimmed.split(/[:;]/).map(e => e.trim().toLowerCase()).filter(Boolean);
  }
  
  const urlRegex = /(https?:\/\/[^\s;:]+)/i;
  const wwwRegex = /(www\.[^\s;:]+\.[^\s;:]+)/i;
  const urlMatch = trimmed.match(urlRegex) || trimmed.match(wwwRegex);
  let extractedUrl = urlMatch ? urlMatch[0].trim() : '';
  
  if (!extractedUrl) {
    const tokens = trimmed.split(/[\s;:•]+/);
    for (const token of tokens) {
      const t = token.trim();
      if (t.includes('.') && !t.includes('@') && t.length > 4 && !t.endsWith('.')) {
        if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(t)) {
          extractedUrl = t;
          break;
        }
      }
    }
  }
  return { emails: emailCandidates, url: extractedUrl };
}

/** Upload a CSV file of contacts. */
router.post('/upload', upload.single('file'), async (req, res) => {
  const listName = req.body.list_name;
  if (!listName) return res.status(400).json({ error: 'list_name is required.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    const db = await getDb();
    const csv = req.file.buffer.toString('utf-8');
    const rows = parseCSV(csv);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Empty CSV file.' });
    }

    const headers = rows[0];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isHeaderless = headers.some(cell => emailRegex.test(cell.trim()));

    let finalHeaders = [];
    let dataRows = [];

    if (isHeaderless) {
      dataRows = rows;
      finalHeaders = headers.map((cell, idx) => {
        if (emailRegex.test(cell.trim())) return 'email';
        return `column_${idx + 1}`;
      });
    } else {
      dataRows = rows.slice(1);
      finalHeaders = headers.map(h => normalizeHeaderKey(h));
    }

    const emailColIndex = finalHeaders.findIndex(h => h === 'email' || h.includes('email'));
    const safeEmailColIndex = emailColIndex >= 0 ? emailColIndex : 0;

    let added = 0;
    let skipped = 0;

    const insertBatch = db.transaction(async (txDb) => {
      for (const row of dataRows) {
        const emailCell = (row[safeEmailColIndex] || '').trim();
        if (!emailCell) {
          skipped++;
          continue;
        }

        const { emails, url } = extractEmailsAndUrlsFromCell(emailCell);
        if (emails.length === 0) {
          skipped++;
          continue;
        }

        // Build key-value fields object
        const fields = {};
        finalHeaders.forEach((header, idx) => {
          if (idx !== safeEmailColIndex) {
            fields[header] = row[idx] || '';
          }
        });

        if (url) {
          fields['store_url'] = url;
          if (!fields['store_name']) {
            fields['store_name'] = url;
          }
        }

        const fieldsJson = JSON.stringify(fields);

        for (const email of emails) {
          // Skip duplicates within the same list
          const existing = await txDb.prepare(
            'SELECT id FROM contacts WHERE list_name = ? AND email = ?'
          ).get(listName, email);

          if (existing) {
            skipped++;
            continue;
          }

          await txDb.prepare(
            'INSERT INTO contacts (list_name, email, fields) VALUES (?, ?, ?)'
          ).run(listName, email, fieldsJson);
          added++;
        }
      }
    });

    await insertBatch();

    res.json({
      success: true,
      added,
      skipped,
      total: added + skipped,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Add a single contact to a list. */
router.post('/', async (req, res) => {
  const { list_name, email } = req.body;
  if (!list_name || !email) {
    return res.status(400).json({ error: 'list_name and email are required.' });
  }

  try {
    const db = await getDb();
    const existing = await db.prepare(
      'SELECT id FROM contacts WHERE list_name = ? AND email = ?'
    ).get(list_name, email);

    if (existing) {
      return res.status(409).json({ error: 'Contact already exists in this list.' });
    }

    const result = await db.prepare(
      'INSERT INTO contacts (list_name, email) VALUES (?, ?)'
    ).run(list_name, email);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete an entire contact list. */
router.delete('/:listName', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.prepare('DELETE FROM contacts WHERE list_name = ?').run(req.params.listName);
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a single contact from a list. */
router.delete('/:listName/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare('DELETE FROM contacts WHERE id = ? AND list_name = ?')
      .run(req.params.id, req.params.listName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

### 5.9 Open & Link Redirection Click Tracker (`routes/tracking.js`)
Configures public click-tracking URL redirection and open-tracking transparent pixel image injection.

```javascript
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
const logger = require('../logger');

// Transparent 1x1 GIF tracking pixel
const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** Track Email Open. */
router.get('/open/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    await db.prepare('UPDATE queue SET opens_count = opens_count + 1 WHERE id = ?').run(id);
  } catch (err) {
    logger.error({ err, queueItemId: id }, 'Error registering open on queue item');
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

  // Prevent open redirect attacks — only allow http(s) URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).send('Invalid redirect URL. Only http and https URLs are allowed.');
  }

  try {
    const db = await getDb();
    await db.prepare('UPDATE queue SET clicks_count = clicks_count + 1 WHERE id = ?').run(id);
  } catch (err) {
    logger.error({ err, queueItemId: id, url }, 'Error registering click on queue item');
  }

  res.redirect(url);
});

module.exports = router;
```

### 5.10 Queue & Templates (`routes/queue.js` and `routes/templates.js`)
Handles templates CRUD and fetches items and aggregates from the delivery logs and sending queue tables.

#### Queue Router (`routes/queue.js`)
```javascript
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
      LEFT JOIN queue q ON l.campaign_id = q.campaign_id AND l.recipient_email = q.recipient_email
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
```

#### Templates Router (`routes/templates.js`)
```javascript
/**
 * routes/templates.js — Email template CRUD.
 *
 * Endpoints:
 *   GET    /api/templates      → List all templates
 *   GET    /api/templates/:id  → Get single template
 *   POST   /api/templates      → Create template
 *   PUT    /api/templates/:id  → Update template
 *   DELETE /api/templates/:id  → Delete template
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

/** List all templates. */
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const templates = await db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get single template. */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const template = await db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Not found.' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Create a template. */
router.post('/', async (req, res) => {
  const { name, subject, body_html, body_plain } = req.body;
  if (!name || !subject) {
    return res.status(400).json({ error: 'name and subject are required.' });
  }

  try {
    const db = await getDb();
    const result = await db.prepare(`
      INSERT INTO templates (name, subject, body_html, body_plain)
      VALUES (?, ?, ?, ?)
    `).run(name, subject, body_html || '', body_plain || '');
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update a template. */
router.put('/:id', async (req, res) => {
  const { name, subject, body_html, body_plain } = req.body;
  try {
    const db = await getDb();
    await db.prepare(`
      UPDATE templates SET name = ?, subject = ?, body_html = ?, body_plain = ?
      WHERE id = ?
    `).run(name, subject, body_html || '', body_plain || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a template. */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

---

## 6. Background Scheduler & Personalization

The scheduler (`scheduler.js`) runs a continuous background worker. It polls for pending items, runs spintax and merge fields checks, dynamically updates tracking urls and open tracking pixels, and sends emails through Google Client APIs or standard SMTP servers.

### 6.1 Spintax Personalizer (`execution/spintax.js`)
Performs recursive parsing on template strings to pick randomized spintax variations.

```javascript
/**
 * Deterministic spintax parser.
 * Handles nested spintax blocks: e.g. "{Hi|Hello {there|friend}}"
 */
function parseSpintax(text) {
  if (!text) return '';

  // Match the innermost spintax blocks first: curly braces containing a pipe |
  const regex = /\{([^{}]*\|[^{}]*)\}/;
  let match;
  let result = text;

  while ((match = result.match(regex))) {
    const options = match[1].split('|');
    const chosen = options[Math.floor(Math.random() * options.length)];
    result = result.substring(0, match.index) + chosen + result.substring(match.index + match[0].length);
  }

  return result;
}

module.exports = { parseSpintax };
```

### 6.2 Scheduler Service (`scheduler.js`)
Uses `node-cron` to execute checks, manage limits, apply personalization variables, update tracking, and perform dispatches.

```javascript
/**
 * scheduler.js — Background email worker.
 *
 * Runs every 30 seconds via node-cron.
 * Picks the next pending queue item, checks the sending window,
 * sends the email via Gmail API, and updates the queue/campaign status.
 *
 * Round-robin account rotation is pre-assigned at campaign launch time,
 * so this worker just processes each item with its assigned account.
 */

const cron = require('node-cron');
const { google } = require('googleapis');
const { getDb } = require('./db');
const logger = require('./logger');

// Import helpers from the accounts route
const {
  ensureFreshToken,
  makeRawEmail,
  getOAuth2Client,
  createSmtpTransport,
} = require('./routes/accounts');
const { parseSpintax } = require('./execution/spintax');

// ---------------------------------------------------------------------------
// Sending-window check
// ---------------------------------------------------------------------------

/**
 * Check if the current time is within the campaign's allowed sending window.
 */
function isWithinSendingWindow(campaign) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes;

  const [startH, startM] = (campaign.start_time || '08:00').split(':').map(Number);
  const [endH, endM] = (campaign.end_time || '22:00').split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentTime >= startMinutes && currentTime <= endMinutes;
}

// ---------------------------------------------------------------------------
// Content variation (spintax-like rotation)
// ---------------------------------------------------------------------------

/**
 * If campaign has content_variations, pick one based on the queue item index.
 * Returns { subject, body_html }.
 */
function getContent(campaign, queueItem) {
  if (campaign.content_mode !== 'rotation' || !campaign.content_variations) {
    return {
      subject: campaign.subject,
      body_html: campaign.body_html,
    };
  }

  try {
    const variations = JSON.parse(campaign.content_variations);
    if (!Array.isArray(variations) || variations.length === 0) {
      return { subject: campaign.subject, body_html: campaign.body_html };
    }
    const index = (queueItem.id - 1) % variations.length;
    const v = variations[index];
    return {
      subject: v.subject || campaign.subject,
      body_html: v.body_html || campaign.body_html,
    };
  } catch {
    return { subject: campaign.subject, body_html: campaign.body_html };
  }
}

/**
 * Simple template variable replacement.
 * Supports {{email}} and {{date}}.
 */
function personalise(text, recipient, fieldsStr, accountDisplayName) {
  if (!text) return text;

  // 1. Run Spintax resolution
  let result = parseSpintax(text);

  // 2. Parse fields JSON
  let fields = {};
  if (fieldsStr) {
    try {
      fields = typeof fieldsStr === 'string' ? JSON.parse(fieldsStr) : fieldsStr;
    } catch (_) {
      fields = {};
    }
  }

  // Get local part and domain part of email
  const [localPart, domainPart] = recipient.split('@');
  const pSname = domainPart ? domainPart.split('.')[0] : '';
  const displayName = fields.first_name || fields.name || localPart;

  // 3. Replace legacy brackets: {name}, {store}, {sname}, {brand}
  result = result
    .replace(/\{name\}/g, displayName)
    .replace(/\{store\}/g, fields.store_name || domainPart || '')
    .replace(/\{sname\}/g, pSname)
    .replace(/\{brand\}/g, accountDisplayName || '');

  // 4. Fallback date replacement
  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // 5. Run dynamic double curly brace {{variable}} replacements
  result = result.replace(/\{\{(\w+)\}\}/gi, (match, key) => {
    const normKey = key.trim().toLowerCase();
    
    // Check built-in or fallbacks
    if (normKey === 'email') return recipient;
    if (normKey === 'date') return now;
    if (normKey === 'name') return displayName;
    if (normKey === 'store' || normKey === 'store_name') return fields.store_name || domainPart || '';
    if (normKey === 'sname') return pSname;
    if (normKey === 'brand') return accountDisplayName || '';

    // Check custom fields
    if (fields && fields[normKey] !== undefined) {
      return fields[normKey];
    }
    if (fields && fields[key] !== undefined) {
      return fields[key];
    }
    return '';
  });

  return result;
}

/**
 * Parses the HTML email body, wraps outbound links in redirect tracking URLs,
 * and appends a hidden 1x1 image tracking pixel.
 */
function injectTracking(bodyHtml, queueItemId) {
  if (!bodyHtml) return bodyHtml;
  const baseUrl = process.env.TRACKING_BASE_URL || 'http://localhost:3000';

  // Match href="url" or href='url'
  let trackedBody = bodyHtml.replace(/href=(["'])([^"'\s>]+)\1/gi, (match, quote, url) => {
    // Skip anchor tags, email links, phone links, and existing track routes
    if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.includes('/api/track/')) {
      return match;
    }
    const wrappedUrl = `${baseUrl}/api/track/click/${queueItemId}?url=${encodeURIComponent(url)}`;
    return `href=${quote}${wrappedUrl}${quote}`;
  });

  // Inject open tracking pixel
  const pixelUrl = `${baseUrl}/api/track/open/${queueItemId}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;

  if (trackedBody.includes('</body>')) {
    trackedBody = trackedBody.replace('</body>', `${pixelTag}</body>`);
  } else {
    trackedBody += pixelTag;
  }

  return trackedBody;
}

// ---------------------------------------------------------------------------
// Send one email
// ---------------------------------------------------------------------------

async function sendEmail(account, to, subject, bodyHtml) {
  const fromAddr = account.display_name
    ? `"${account.display_name}" <${account.email}>`
    : account.email;

  // RFC 8058 List-Unsubscribe headers (required by Gmail for bulk senders)
  const unsubEmail = `unsubscribe+${to.replace('@', '=')}@${account.email.split('@')[1]}`;
  const unsubHeader = `<mailto:${unsubEmail}?subject=unsubscribe>`;

  if (account.type === 'smtp') {
    // Send via Nodemailer SMTP transport
    const transport = createSmtpTransport(account);
    await transport.sendMail({
      from: fromAddr,
      to,
      subject,
      html: bodyHtml,
      headers: {
        'List-Unsubscribe': unsubHeader,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  } else {
    // Send via Gmail API (OAuth)
    const accessToken = await ensureFreshToken(account);
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const raw = makeRawEmail(account.email, to, subject, bodyHtml, {
      'List-Unsubscribe': unsubHeader,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
  }
}

// ---------------------------------------------------------------------------
// Process one queue item
// ---------------------------------------------------------------------------

async function processNextItem() {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error({ err }, 'DB not ready');
    return;
  }

  const BATCH_SIZE = parseInt(process.env.SCHEDULER_BATCH_SIZE, 10) || 10;
  const nowIso = new Date().toISOString();

  // Find the next pending items whose scheduled time has passed
  const items = await db.prepare(`
    SELECT q.*, c.status as campaign_status,
           c.subject as c_subject, c.body_html as c_body_html,
           c.start_time, c.end_time,
           c.content_variations, c.content_mode
    FROM queue q
    JOIN campaigns c ON q.campaign_id = c.id
    WHERE q.status = 'pending'
      AND c.status = 'sending'
      AND q.scheduled_at <= ?
    ORDER BY q.scheduled_at ASC
    LIMIT ?
  `).all(nowIso, BATCH_SIZE);

  if (!items || items.length === 0) return; // Nothing to send

  const accountSentInBatch = {};

  for (const item of items) {
    // Check sending window
    if (!isWithinSendingWindow(item)) {
      continue; // Outside allowed hours, skip this one
    }

    // Get the assigned sender account
    const account = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(item.account_id);
    if (!account || account.status !== 'active') {
      // Mark as failed — no valid account
      await db.prepare("UPDATE queue SET status = 'failed', error = 'Account inactive or missing' WHERE id = ?")
        .run(item.id);
      await db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?')
        .run(item.campaign_id);
      await logEvent(db, item.campaign_id, item.account_id, item.recipient_email, 'failed', 'Account inactive or missing');
      continue;
    }

    // Check daily send limit (default limit is 450)
    const dailyLimit = account.daily_limit !== null && account.daily_limit !== undefined ? account.daily_limit : 450;
    const currentSent = account.daily_sent + (accountSentInBatch[account.id] || 0);
    if (currentSent >= dailyLimit) {
      logger.info({ email: account.email, dailyLimit, itemId: item.id }, 'Account daily limit hit. Rescheduling queue item to tomorrow');
      // Reschedule to tomorrow (add 1 day)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await db.prepare("UPDATE queue SET scheduled_at = ? WHERE id = ?").run(tomorrow.toISOString(), item.id);
      continue;
    }

    // Mark as sending
    await db.prepare("UPDATE queue SET status = 'sending' WHERE id = ?").run(item.id);
    accountSentInBatch[account.id] = (accountSentInBatch[account.id] || 0) + 1;

    try {
      // Get content (with variation support)
      const { subject, body_html } = getContent(item, item);
      const finalSubject = personalise(subject, item.recipient_email, item.fields, account.display_name);
      const personalisedBody = personalise(body_html, item.recipient_email, item.fields, account.display_name);
      const finalBody = injectTracking(personalisedBody, item.id);

      await sendEmail(account, item.recipient_email, finalSubject, finalBody);

      // Mark as sent
      await db.prepare("UPDATE queue SET status = 'sent', sent_at = ?, final_subject = ?, final_body = ? WHERE id = ?")
        .run(new Date().toISOString(), finalSubject, finalBody, item.id);
      await db.prepare('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?')
        .run(item.campaign_id);
      await db.prepare('UPDATE accounts SET daily_sent = daily_sent + 1 WHERE id = ?')
        .run(account.id);

      await logEvent(db, item.campaign_id, account.id, item.recipient_email, 'sent', 'OK');
      logger.info({ recipient: item.recipient_email, sender: account.email }, 'Email sent successfully');

      // Check if campaign is complete
      const remaining = await db.prepare(
        "SELECT COUNT(*) as c FROM queue WHERE campaign_id = ? AND status = 'pending'"
      ).get(item.campaign_id);

      if (remaining && remaining.c === 0) {
        await db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(item.campaign_id);
        logger.info({ campaignId: item.campaign_id }, 'Campaign completed');
      }
    } catch (err) {
      // Decrement the batch count for this account since it failed to send
      if (accountSentInBatch[account.id] > 0) {
        accountSentInBatch[account.id]--;
      }

      // Check retry_count for exponential backoff
      const currentRetryCount = item.retry_count || 0;
      if (currentRetryCount < 3) {
        const nextRetryCount = currentRetryCount + 1;
        // Exponential backoff minutes: 1st retry: 5 mins, 2nd: 15 mins, 3rd: 45 mins
        const backoffMinutes = Math.pow(3, nextRetryCount - 1) * 5;
        const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000);

        await db.prepare("UPDATE queue SET status = 'pending', retry_count = ?, scheduled_at = ?, error = ? WHERE id = ?")
          .run(nextRetryCount, nextAttempt.toISOString(), err.message, item.id);

        await logEvent(db, item.campaign_id, account.id, item.recipient_email, 'retry', `Attempt ${nextRetryCount} failed: ${err.message}. Retrying at ${nextAttempt.toISOString()}`);
        logger.warn({ err, recipient: item.recipient_email, attempt: nextRetryCount, backoffMinutes }, 'Temporary sending failure');
      } else {
        // Mark as failed permanently
        await db.prepare("UPDATE queue SET status = 'failed', error = ? WHERE id = ?")
          .run(err.message, item.id);
        await db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?')
          .run(item.campaign_id);
        await logEvent(db, item.campaign_id, account.id, item.recipient_email, 'failed', err.message);
        logger.error({ err, recipient: item.recipient_email }, 'Permanent sending failure');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Log helper
// ---------------------------------------------------------------------------

async function logEvent(db, campaignId, accountId, recipient, status, message) {
  try {
    await db.prepare(`
      INSERT INTO logs (campaign_id, account_id, recipient_email, status, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(campaignId, accountId, recipient, status, message);
  } catch (err) {
    logger.error({ err }, 'Log write error');
  }
}

// ---------------------------------------------------------------------------
// Startup: crash recovery + validation
// ---------------------------------------------------------------------------

(async () => {
  try {
    const db = await getDb();

    // Recover any queue items stuck in 'sending' from a previous crash
    const stuck = await db.prepare(
      "UPDATE queue SET status = 'pending' WHERE status = 'sending'"
    ).run();
    if (stuck.changes > 0) {
      logger.info({ count: stuck.changes }, 'Recovered stuck queue items from previous crash');
    }
  } catch (err) {
    logger.error({ err }, 'Startup recovery failed');
  }

  // Warn if TRACKING_BASE_URL is still localhost in non-dev environments
  const trackingUrl = process.env.TRACKING_BASE_URL || 'http://localhost:3000';
  if (trackingUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
    logger.warn('TRACKING_BASE_URL is set to localhost — tracking pixels will not work in production!');
  }
})();

// ---------------------------------------------------------------------------
// Cron: every 30 seconds
// ---------------------------------------------------------------------------

const sendTask = cron.schedule('*/30 * * * * *', async () => {
  try {
    await processNextItem();
  } catch (err) {
    logger.error({ err }, 'Unexpected error in cron send task');
  }
});

// Daily reset of account send counters at midnight
const resetTask = cron.schedule('0 0 * * *', async () => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET daily_sent = 0, last_reset = datetime('now')").run();
    logger.info('Daily send counters reset');
  } catch (err) {
    logger.error({ err }, 'Counter reset error');
  }
});

function stopScheduler() {
  sendTask.stop();
  resetTask.stop();
  logger.info('Email worker stopped');
}

logger.info('Email worker started (every 30s)');

module.exports = { processNextItem, personalise, stopScheduler };
```

---

## 7. Frontend API Client Integration

In the frontend Vite directory (`gfg-main`), create a type-safe client `src/api.ts` to manage server communication, state requests, and auth token headers injection.

```typescript
/**
 * api.ts — Type-safe API client for Peak Xender server connection.
 *
 * Automatically handles dev vs prod baseUrl selection, sets the security PIN
 * headers from sessionStorage, and processes JSON responses.
 */

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

export interface Account {
  id: number;
  email: string;
  status: 'active' | 'paused';
  daily_sent: number;
  last_reset: string | null;
  display_name: string;
  type: 'oauth' | 'smtp';
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: number | null;
  created_at: string;
}

export interface Contact {
  id: number;
  list_name: string;
  email: string;
  created_at: string;
}

export interface ContactListInfo {
  list_name: string;
  count: number;
}

export interface Campaign {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  body_plain: string;
  contact_list: string;
  delay_seconds: number;
  start_time: string;
  end_time: string;
  status: 'draft' | 'sending' | 'paused' | 'completed';
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  content_variations: string | null;
  content_mode: 'single' | 'rotation';
  created_at: string;
  queue_stats?: {
    pending?: number;
    sent?: number;
    failed?: number;
    sending?: number;
  };
  total_opens?: number;
  total_clicks?: number;
}

export interface QueueItem {
  id: number;
  campaign_id: number;
  recipient_email: string;
  account_id: number | null;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  scheduled_at: string;
  sent_at: string | null;
  error: string | null;
}

export interface QueueStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  sending: number;
}

export interface LogItem {
  id: number;
  campaign_id: number | null;
  account_id: number | null;
  recipient_email: string | null;
  status: string;
  message: string;
  created_at: string;
  sender_email?: string;
  campaign_name?: string;
  final_subject?: string;
  final_body?: string;
}

export interface Template {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  body_plain: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Base Fetch Wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  // Set default headers
  const headers = new Headers(options.headers || {});
  
  // Add JSON content type if sending body
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject JWT Bearer token from localStorage if present
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  
  if (!res.ok) {
    let errMsg = `API Error: ${res.statusText} (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody.message || errBody.error) {
        errMsg = errBody.message || errBody.error;
      }
    } catch {
      // Ignore parsing error
    }
    throw new Error(errMsg);
  }

  // Handle empty or redirect responses if needed
  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

export const api = {
  // Accounts
  getDashboardData: () => apiFetch<{
    stats: {
      today_sent: number;
      active_accounts: number;
      pending: number;
      active_campaigns: number;
      failed: number;
    };
    campaigns: Campaign[];
    queue: {
      id: number;
      recipient_email: string;
      campaign_name: string | null;
      account_email: string | null;
      status: string;
    }[];
  }>('/api/dashboard'),
  getAccounts: () => apiFetch<Account[]>('/api/accounts'),
  getAuthUrl: () => apiFetch<{ url: string }>('/api/accounts/auth-url', { method: 'POST' }),
  deleteAccount: (id: number) => apiFetch<{ success: boolean }>(`/api/accounts/${id}`, { method: 'DELETE' }),
  testAccount: (id: number, to: string) => apiFetch<{ success: boolean; message: string }>(`/api/accounts/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ to })
  }),
  resetAccount: (id: number) => apiFetch<{ success: boolean }>(`/api/accounts/${id}/reset`, { method: 'POST' }),
  pauseAccount: (id: number) => apiFetch<{ success: boolean }>(`/api/accounts/${id}/pause`, { method: 'POST' }),
  resumeAccount: (id: number) => apiFetch<{ success: boolean }>(`/api/accounts/${id}/resume`, { method: 'POST' }),
  updateDisplayName: (id: number, displayName: string) => apiFetch<{ success: boolean }>(`/api/accounts/${id}/display-name`, {
    method: 'PUT',
    body: JSON.stringify({ display_name: displayName })
  }),
  connectSmtp: (data: {
    email: string;
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_pass: string;
    smtp_secure: boolean;
    display_name?: string;
  }) => apiFetch<{ success: boolean; message: string }>('/api/accounts/smtp', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Campaigns
  getCampaigns: () => apiFetch<Campaign[]>('/api/campaigns'),
  getCampaign: (id: number) => apiFetch<Campaign>(`/api/campaigns/${id}`),
  createCampaign: (data: Partial<Campaign>) => apiFetch<{ success: boolean; id: number }>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateCampaign: (id: number, data: Partial<Campaign>) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteCampaign: (id: number) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}`, { method: 'DELETE' }),
  launchCampaign: (id: number) => apiFetch<{ success: boolean; message: string }>(`/api/campaigns/${id}/launch`, { method: 'POST' }),
  pauseCampaign: (id: number) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}/pause`, { method: 'POST' }),
  resumeCampaign: (id: number) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}/resume`, { method: 'POST' }),
  previewCampaign: (id: number, count?: number) => apiFetch<{
    subject: string;
    body_html: string;
    recipient_email: string;
    sender_email: string | null;
  }[]>(`/api/campaigns/${id}/preview${count ? `?count=${count}` : ''}`),

  // Contacts
  getContactLists: () => apiFetch<ContactListInfo[]>('/api/contacts/lists'),
  getContacts: (listName: string) => apiFetch<Contact[]>(`/api/contacts/${encodeURIComponent(listName)}`),
  uploadContacts: (listName: string, file: File) => {
    const formData = new FormData();
    formData.append('list_name', listName);
    formData.append('file', file);
    return apiFetch<{ success: boolean; added: number; skipped: number; total: number }>('/api/contacts/upload', {
      method: 'POST',
      body: formData
    });
  },
  addContact: (listName: string, email: string) => apiFetch<{ success: boolean; id: number }>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify({ list_name: listName, email })
  }),
  deleteContactList: (listName: string) => apiFetch<{ success: boolean; deleted: number }>(`/api/contacts/${encodeURIComponent(listName)}`, {
    method: 'DELETE'
  }),
  deleteContact: (listName: string, id: number) => apiFetch<{ success: boolean }>(`/api/contacts/${encodeURIComponent(listName)}/${id}`, {
    method: 'DELETE'
  }),

  // Queue & Logs
  getQueueItems: (campaignId: number, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiFetch<QueueItem[]>(`/api/queue/${campaignId}${query}`);
  },
  getQueueStats: (campaignId: number) => apiFetch<QueueStats>(`/api/queue/${campaignId}/stats`),
  getRecentLogs: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return apiFetch<LogItem[]>(`/api/queue/logs/recent${query}`);
  },

  // Templates
  getTemplates: () => apiFetch<Template[]>('/api/templates'),
  getTemplate: (id: number) => apiFetch<Template>(`/api/templates/${id}`),
  createTemplate: (data: Partial<Template>) => apiFetch<{ success: boolean; id: number }>('/api/templates', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTemplate: (id: number, data: Partial<Template>) => apiFetch<{ success: boolean }>(`/api/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteTemplate: (id: number) => apiFetch<{ success: boolean }>(`/api/templates/${id}`, { method: 'DELETE' }),

  // Auth
  getLoginUrl: () => apiFetch<{ url: string }>('/api/auth/google-url'),
  getCurrentUser: () => apiFetch<{ id: number; email: string; name: string; role: string; picture?: string }>('/api/auth/me'),
  updateProfile: (name: string, picture: string) => apiFetch<{ success: boolean; message: string }>('/api/auth/profile', {
    method: 'POST',
    body: JSON.stringify({ name, picture }),
  }),
  getSettings: () => apiFetch<{
    ADMIN_EMAIL: string;
    TRACKING_BASE_URL: string;
    SCHEDULER_BATCH_SIZE: string;
    DAILY_LIMIT_DEFAULT: string;
  }>('/api/auth/settings'),
  updateSettings: (settings: {
    ADMIN_EMAIL?: string;
    TRACKING_BASE_URL?: string;
    SCHEDULER_BATCH_SIZE?: string;
    DAILY_LIMIT_DEFAULT?: string;
  }) => apiFetch<{ success: boolean; message: string }>('/api/auth/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  }),
  logout: () => {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('access_pin');
    return Promise.resolve({ success: true });
  },
};
```

---

## 8. Deploying to Render & Supabase

Deploying MailFlow to **Render** (for server and React static pages) and **Supabase** (for the database) is straightforward.

### Step 8.1: Create a PostgreSQL DB on Supabase
1. Create a free account on [Supabase](https://supabase.com/).
2. Click **New Project** and configure your Database.
3. Once the database initializes, go to **Project Settings** > **Database**.
4. Copy the connection string under **URI** (make sure transaction pooler mode or direct is set correctly, and it has `sslmode=require` if required).

### Step 8.2: Connect Github & Deploy on Render
1. Sign in to [Render](https://render.com/).
2. Click **New** > **Web Service**.
3. Link your GitHub repository hosting the project.
4. Set the following Build settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run frontend:build`
   - **Start Command**: `npm start`
5. Click **Advanced** to add **Environment Variables**:
   - `DATABASE_URL`: *Paste your Supabase DB Connection String here*
   - `GOOGLE_CLIENT_ID`: *Your Google OAuth Client ID*
   - `GOOGLE_CLIENT_SECRET`: *Your Google OAuth Client Secret*
   - `GOOGLE_REDIRECT_URI`: `https://your-backend.onrender.com/api/accounts/callback`
   - `GOOGLE_LOGIN_REDIRECT_URI`: `https://your-backend.onrender.com/api/auth/callback`
   - `FRONTEND_ORIGIN`: `https://your-backend.onrender.com` (Render hosts static files inside the node service, so both share the same base URL)
   - `TRACKING_BASE_URL`: `https://your-backend.onrender.com`
   - `JWT_SECRET`: *Generate a strong secret key*
   - `ADMIN_EMAIL`: *The email address authorized to log in as administrator*
6. Click **Deploy Web Service**. Render will install packages, compile the Vite app, initialize database schemas, start the web server, and boot the background cron tasks.
