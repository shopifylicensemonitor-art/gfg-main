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
  const dbUrl = process.env.DATABASE_URL || '';
  const isSupabase = dbUrl.includes('supabase') || dbUrl.includes('pooler');
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isSupabase || dbUrl.includes('sslmode=') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 10,
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

  /** Append RETURNING id to INSERT statements so lastInsertRowid works */
  function appendReturning(sql) {
    const trimmed = sql.trim();
    // Do NOT append RETURNING id to tables that do not have an `id` column
    if (
      /^INSERT\s/i.test(trimmed) &&
      !/RETURNING\s/i.test(trimmed) &&
      !/INSERT\s+INTO\s+(campaign_recipients|settings|device_states)\b/i.test(trimmed)
    ) {
      return trimmed.replace(/;?\s*$/, ' RETURNING id');
    }
    return sql;
  }

  /** Full SQL conversion pipeline */
  function convertSql(sql) {
    return appendReturning(convertDatetime(convertPlaceholders(sql)));
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
          let result;
          try {
            result = await pool.query(pgSql, flat);
          } catch (err) {
            if (err.message && err.message.includes('column "id" does not exist')) {
              const fallbackSql = pgSql.replace(/\s+RETURNING\s+id/gi, '');
              result = await pool.query(fallbackSql, flat);
            } else {
              throw err;
            }
          }
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
                let result;
                try {
                  result = await client.query(pgSql, flat);
                } catch (err) {
                  if (err.message && err.message.includes('column "id" does not exist')) {
                    const fallbackSql = pgSql.replace(/\s+RETURNING\s+id/gi, '');
                    result = await client.query(fallbackSql, flat);
                  } else {
                    throw err;
                  }
                }
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
  const os = require('os');

  const isServerless = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
  const DB_PATH = isServerless 
    ? path.join(os.tmpdir(), 'mailflow.db') 
    : path.join(__dirname, 'mailflow.db');
  let rawDb = null;

  // Debounced async save to avoid blocking the event loop on every write.
  let saveTimer = null;
  let saveInProgress = null;

  async function doSave() {
    if (!rawDb) return;
    try {
      const data = rawDb.export();
      saveInProgress = fs.promises.writeFile(DB_PATH, Buffer.from(data));
      await saveInProgress;
    } catch (err) {
      console.warn('SQLite disk save skipped (read-only filesystem or serverless context):', err.message);
    } finally {
      saveInProgress = null;
    }
  }

  function scheduleSave(delay = 1000) {
    if (!rawDb) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      // fire and forget, errors logged
      doSave().catch((err) => console.error('SQLite async save error', err));
      saveTimer = null;
    }, delay);
  }

  async function flushSave() {
    if (!rawDb) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      // ensure one final save
      await doSave();
    }
    if (saveInProgress) {
      await saveInProgress;
    }
  }

  return (async () => {
    const SQL = await initSqlJs({
      locateFile: file => {
        const candidatePaths = [
          path.join(__dirname, file),
          path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
          path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
          path.join(process.cwd(), 'gfg-main', 'node_modules', 'sql.js', 'dist', file)
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) return p;
        }
        return file;
      }
    });

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
          await flushSave();
          if (rawDb) {
            rawDb.close();
          }
        },

      async exec(sql) {
        rawDb.run(sql);
        scheduleSave();
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
              scheduleSave();
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
            scheduleSave();
            return result;
          } catch (err) {
            rawDb.run('ROLLBACK');
            throw err;
          }
        };
      },
    };

    // Expose flushSave as `save` for compatibility (returns a Promise)
    return { rawDb, wrapped, save: flushSave };
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
    send_order TEXT DEFAULT 'series',
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
    queue_id INTEGER,
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

  CREATE TABLE IF NOT EXISTS campaign_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_plain TEXT,
    delay_seconds INTEGER DEFAULT 86400,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS campaign_recipients (
    campaign_id INTEGER NOT NULL,
    recipient_email TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    current_step INTEGER DEFAULT 1,
    last_sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (campaign_id, recipient_email),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS device_states (
    device_id TEXT PRIMARY KEY,
    ip_address TEXT,
    state_data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL DEFAULT 'openrouter',
    api_key_encrypted TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT 'https://openrouter.ai/api/v1',
    model TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inbox_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    sender_email TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    sentiment TEXT DEFAULT 'neutral',
    is_read INTEGER DEFAULT 0,
    message_id TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
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
    imap_host TEXT,
    imap_port INTEGER,
    imap_user TEXT,
    imap_pass TEXT,
    imap_secure INTEGER DEFAULT 1,
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
    queue_id INTEGER,
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

  CREATE TABLE IF NOT EXISTS campaign_steps (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_plain TEXT,
    delay_seconds INTEGER DEFAULT 86400,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS campaign_recipients (
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    current_step INTEGER DEFAULT 1,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (campaign_id, recipient_email)
  );

  CREATE TABLE IF NOT EXISTS device_states (
    device_id TEXT PRIMARY KEY,
    ip_address TEXT,
    state_data TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ai_config (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'openrouter',
    api_key_encrypted TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT 'https://openrouter.ai/api/v1',
    model TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ai_rules (
    id SERIAL PRIMARY KEY,
    rule_type TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS inbox_messages (
    id SERIAL PRIMARY KEY,
    account_id INTEGER,
    sender_email TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    sentiment TEXT DEFAULT 'neutral',
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

// ============================================================================
// Initialisation
// ============================================================================

ready = (async () => {
  const forceSqlite = process.env.USE_SQLITE === 'true';
  const hasPgUrl = !!process.env.DATABASE_URL;
  const usePg = !forceSqlite && hasPgUrl;

  // Performance indexes (idempotent — safe to run on every startup)
  const INDEX_DDL = `
    CREATE INDEX IF NOT EXISTS idx_queue_status_campaign ON queue(status, campaign_id);
    CREATE INDEX IF NOT EXISTS idx_queue_scheduled_at ON queue(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_contacts_list_name ON contacts(list_name);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_inbox_recipient ON inbox_messages(recipient_email);
    CREATE INDEX IF NOT EXISTS idx_inbox_created_at ON inbox_messages(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_message_id ON inbox_messages(message_id);
  `;

  if (usePg) {
    console.log('Connecting to PostgreSQL (Supabase)...');
    const adapter = createPgAdapter();
    try {
      await adapter.exec(PG_DDL);
      try {
        await adapter.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 450;");
      } catch (_) {}
      try {
        await adapter.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_host TEXT;");
        await adapter.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_port INTEGER;");
        await adapter.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_user TEXT;");
        await adapter.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_pass TEXT;");
        await adapter.exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_secure INTEGER DEFAULT 1;");
      } catch (_) {}
      try {
        await adapter.exec("ALTER TABLE queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;");
      } catch (_) {}
      try {
        await adapter.exec("ALTER TABLE queue ADD COLUMN IF NOT EXISTS step_number INTEGER DEFAULT 1;");
      } catch (_) {}
      try {
        await adapter.exec("ALTER TABLE queue ADD COLUMN IF NOT EXISTS campaign_step_id INTEGER;");
      } catch (_) {}
      try {
        await adapter.exec("ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS message_id TEXT;");
      } catch (_) {}
      try {
        await adapter.exec("DELETE FROM inbox_messages WHERE id NOT IN (SELECT MIN(id) FROM inbox_messages GROUP BY message_id) AND message_id IS NOT NULL;");
      } catch (_) {}
      try {
        await adapter.exec(INDEX_DDL);
      } catch (_) {}
      console.log('PostgreSQL database initialised successfully.');
      return adapter;
    } catch (err) {
      console.warn('PostgreSQL unavailable, falling back to SQLite:', err.message);
    }
  }

  // Fallback to SQLite if Postgres is disabled, unavailable, or misconfigured.
  {
    console.log('Using local SQLite database...');
    const { wrapped } = await createSqliteAdapter();
    await wrapped.exec(SQLITE_DDL);
    try {
      await wrapped.exec("ALTER TABLE accounts ADD COLUMN daily_limit INTEGER DEFAULT 450;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE contacts ADD COLUMN fields TEXT;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaign_recipients ADD COLUMN status TEXT DEFAULT 'active';");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaign_recipients ADD COLUMN current_step INTEGER DEFAULT 1;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaign_recipients ADD COLUMN last_sent_at TEXT;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaigns ADD COLUMN total_contacts INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaigns ADD COLUMN sent_count INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaigns ADD COLUMN failed_count INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaigns ADD COLUMN content_variations TEXT;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaigns ADD COLUMN content_mode TEXT DEFAULT 'single';");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaigns ADD COLUMN send_order TEXT DEFAULT 'series';");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS message_id TEXT;");
    } catch (_) {}
    try {
      await wrapped.exec("DELETE FROM inbox_messages WHERE rowid NOT IN (SELECT MIN(rowid) FROM inbox_messages GROUP BY message_id) AND message_id IS NOT NULL;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE campaigns ADD COLUMN body_plain TEXT;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN fields TEXT;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN final_subject TEXT;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN final_body TEXT;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN retry_count INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN step_number INTEGER DEFAULT 1;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN campaign_step_id INTEGER;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN opens_count INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE queue ADD COLUMN clicks_count INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await wrapped.exec("ALTER TABLE logs ADD COLUMN queue_id INTEGER;");
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
