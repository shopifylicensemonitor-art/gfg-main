const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function clearDbCache() {
  delete require.cache[require.resolve('../db')];
}

test('falls back to SQLite when the configured PostgreSQL URL is invalid', async () => {
  process.env.DATABASE_URL = 'postgresql://invalid-host.example.com:5432/db';
  process.env.USE_SQLITE = 'false';
  clearDbCache();

  const db = require('../db');
  const adapter = await db.getDb();

  assert.ok(adapter, 'database adapter should be initialised');
  assert.equal(adapter._isPg, false, 'adapter should fall back to SQLite when PostgreSQL is unavailable');
});
