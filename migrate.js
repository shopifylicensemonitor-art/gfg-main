/**
 * migrate.js — One-time script to create MailFlow tables on Supabase PostgreSQL.
 * Run with: node migrate.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DDL = `
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
    send_order TEXT DEFAULT 'series',
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
    queue_id INTEGER,
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

  CREATE TABLE IF NOT EXISTS device_states (
    device_id TEXT PRIMARY KEY,
    ip_address TEXT,
    state_data TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Performance indexes
  CREATE INDEX IF NOT EXISTS idx_queue_status_campaign ON queue(status, campaign_id);
  CREATE INDEX IF NOT EXISTS idx_queue_scheduled_at ON queue(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_contacts_list_name ON contacts(list_name);
  CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
`;

(async () => {
  console.log('Connecting to Supabase PostgreSQL...');
  console.log('Host:', process.env.DATABASE_URL.split('@')[1].split('/')[0]);
  
  try {
    const client = await pool.connect();
    console.log('Connected successfully!');
    
    console.log('Creating tables...');
    await client.query(DDL);
    console.log('All tables created successfully!');
    
    // Verify tables exist
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\nTables in database:');
    result.rows.forEach(row => console.log('  ✓', row.table_name));
    
    client.release();
    await pool.end();
    console.log('\nDatabase migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
