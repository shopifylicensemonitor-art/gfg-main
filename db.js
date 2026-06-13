/**
 * db.js — SQLite database connector using sql.js (pure JS/WASM).
 *
 * Wraps sql.js with a better-sqlite3-compatible API so the rest of the
 * codebase can call db.prepare(sql).all() / .get() / .run() as usual.
 * The database file is persisted to disk on every write operation.
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'mailflow.db');

let db = null;       // sql.js Database instance
let ready = null;    // Promise that resolves when the DB is initialised

/**
 * Persist the in-memory database to disk.
 */
function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Wrap a sql.js Database so callers can use:
 *   db.prepare(sql).all(…params)   → [{ col: val, … }, …]
 *   db.prepare(sql).get(…params)   → { col: val, … } | undefined
 *   db.prepare(sql).run(…params)   → { changes, lastInsertRowid }
 *   db.exec(sql)                   → void  (DDL / multi-statement)
 *   db.transaction(fn)             → fn    (simple wrapper)
 */
function wrapDatabase(raw) {
  const wrapped = {
    /** Run raw SQL (DDL, multi-statement). */
    exec(sql) {
      raw.run(sql);
      save();
    },

    /** Return a "prepared statement" object with .all / .get / .run. */
    prepare(sql) {
      return {
        all(...params) {
          const flat = flattenParams(params);
          try {
            const stmt = raw.prepare(sql);
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

        get(...params) {
          const flat = flattenParams(params);
          try {
            const stmt = raw.prepare(sql);
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

        run(...params) {
          const flat = flattenParams(params);
          try {
            raw.run(sql, flat);
            save();
            // Emulate better-sqlite3's RunResult
            const info = raw.getRowsModified
              ? raw.getRowsModified()
              : 0;
            // sql.js doesn't expose last_insert_rowid directly through
            // getRowsModified, so we query it manually.
            let lastId = 0;
            try {
              const idStmt = raw.prepare('SELECT last_insert_rowid() as id');
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

    /**
     * Wrap a function in a BEGIN / COMMIT transaction.
     * Returns a callable that executes the function.
     */
    transaction(fn) {
      return (...args) => {
        raw.run('BEGIN TRANSACTION');
        try {
          const result = fn(...args);
          raw.run('COMMIT');
          save();
          return result;
        } catch (err) {
          raw.run('ROLLBACK');
          throw err;
        }
      };
    },
  };

  return wrapped;
}

/** Flatten params so callers can do .run(a, b, c) or .run([a, b, c]). */
function flattenParams(params) {
  if (params.length === 0) return [];
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

ready = (async () => {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('Database loaded from disk.');
  } else {
    db = new SQL.Database();
    console.log('New database created.');
  }

  // Create tables (idempotent)
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry INTEGER,
      daily_sent INTEGER DEFAULT 0,
      last_reset TEXT,
      status TEXT DEFAULT 'active',
      display_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_name TEXT NOT NULL,
      email TEXT NOT NULL,
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
      scheduled_at TEXT,
      sent_at TEXT,
      error TEXT,
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
  `);

  // -------------------------------------------------------------------------
  // Migrations — add columns idempotently (ALTER TABLE fails if col exists)
  // -------------------------------------------------------------------------
  const migrations = [
    // SMTP account support
    "ALTER TABLE accounts ADD COLUMN type TEXT DEFAULT 'oauth'",
    "ALTER TABLE accounts ADD COLUMN smtp_host TEXT",
    "ALTER TABLE accounts ADD COLUMN smtp_port INTEGER",
    "ALTER TABLE accounts ADD COLUMN smtp_user TEXT",
    "ALTER TABLE accounts ADD COLUMN smtp_pass TEXT",
    "ALTER TABLE accounts ADD COLUMN smtp_secure INTEGER DEFAULT 1",
    // Open & click tracking on queue items
    "ALTER TABLE queue ADD COLUMN opens_count INTEGER DEFAULT 0",
    "ALTER TABLE queue ADD COLUMN clicks_count INTEGER DEFAULT 0",
  ];

  for (const sql of migrations) {
    try {
      db.run(sql);
    } catch (_) {
      // Column already exists — ignore
    }
  }

  save();
  console.log('Database initialised successfully.');

  return wrapDatabase(db);
})();

// Export a proxy that waits for initialisation, then forwards calls.
module.exports = {
  /** Resolves once the DB is ready. Returns the wrapped db object. */
  getDb: () => ready,
};
