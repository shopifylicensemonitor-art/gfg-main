require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const migrate = async () => {
  console.log('Connecting to database for Phase 2 migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Adding worker locking & retry columns to queue table...');
    await client.query(`
      ALTER TABLE queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
      ALTER TABLE queue ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
      ALTER TABLE queue ADD COLUMN IF NOT EXISTS locked_by TEXT;
      ALTER TABLE queue ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
      ALTER TABLE queue ADD COLUMN IF NOT EXISTS last_error TEXT;
      ALTER TABLE queue ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
    `);

    console.log('Creating worker_heartbeats table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS worker_heartbeats (
        worker_id TEXT PRIMARY KEY,
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        status TEXT DEFAULT 'active',
        jobs_processed INTEGER DEFAULT 0
      );
      ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;
    `);

    console.log('Creating queue claiming index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_queue_claim ON queue(status, scheduled_at, next_attempt_at);
    `);

    await client.query('COMMIT');
    console.log('Phase 2 database migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Phase 2 migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
