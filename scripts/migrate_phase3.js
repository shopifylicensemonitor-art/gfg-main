require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DEFAULT_PLAN_ENTITLEMENTS = {
  free: {
    'automation.enabled': 'false',
    'connected_mailboxes.max': '0',
    'manual_send.daily_limit': '50',
    'tracking.enabled': 'false',
    'reply_detection.enabled': 'false',
  },
  starter: {
    'automation.enabled': 'true',
    'connected_mailboxes.max': '1',
    'manual_send.daily_limit': '500',
    'tracking.enabled': 'true',
    'reply_detection.enabled': 'false',
  },
  pro: {
    'automation.enabled': 'true',
    'connected_mailboxes.max': '5',
    'manual_send.daily_limit': '2000',
    'tracking.enabled': 'true',
    'reply_detection.enabled': 'true',
  },
  business: {
    'automation.enabled': 'true',
    'connected_mailboxes.max': '999',
    'manual_send.daily_limit': '10000',
    'tracking.enabled': 'true',
    'reply_detection.enabled': 'true',
  },
};

const migrate = async () => {
  console.log('Connecting to database for Phase 3 migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Adding plan column to workspaces...');
    await client.query(`
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
    `);

    console.log('Creating entitlements & manual_send_logs tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS entitlements (
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (workspace_id, key)
      );

      CREATE TABLE IF NOT EXISTS manual_send_logs (
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        sent_date DATE DEFAULT CURRENT_DATE,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (workspace_id, user_id, sent_date)
      );

      ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
      ALTER TABLE manual_send_logs ENABLE ROW LEVEL SECURITY;
    `);

    console.log('Seeding entitlements for existing workspaces...');
    const { rows: workspaces } = await client.query('SELECT id, plan FROM workspaces');

    for (const ws of workspaces) {
      const plan = ws.plan || 'free';
      const map = DEFAULT_PLAN_ENTITLEMENTS[plan] || DEFAULT_PLAN_ENTITLEMENTS.free;

      for (const [key, value] of Object.entries(map)) {
        await client.query(`
          INSERT INTO entitlements (workspace_id, key, value)
          VALUES ($1, $2, $3)
          ON CONFLICT (workspace_id, key) DO NOTHING
        `, [ws.id, key, value]);
      }
    }

    await client.query('COMMIT');
    console.log('Phase 3 database migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Phase 3 migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
