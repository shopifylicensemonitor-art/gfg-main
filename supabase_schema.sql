-- ============================================================================
-- Peak Xender — Complete Supabase PostgreSQL Schema
-- ============================================================================
-- ============================================================================
-- Safe to run multiple times (fully idempotent with IF NOT EXISTS).
-- Copy this entire script and paste it into the Supabase SQL Editor, then Run.
-- ============================================================================

-- ── 0. workspaces & workspace_members ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- ── 1. accounts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
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

-- ── 2. contacts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  list_name TEXT NOT NULL,
  email TEXT NOT NULL,
  fields TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. campaigns ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
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

-- ── 4. queue ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
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
  clicks_count INTEGER DEFAULT 0,
  step_number INTEGER DEFAULT 1,
  campaign_step_id INTEGER,
  attempts INTEGER DEFAULT 0,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  provider_message_id TEXT
);

-- ── 5. logs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id INTEGER,
  account_id INTEGER,
  recipient_email TEXT,
  status TEXT,
  message TEXT,
  queue_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. templates ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_plain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT '',
  picture TEXT DEFAULT '',
  role TEXT DEFAULT 'admin',
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT,
  value TEXT,
  PRIMARY KEY (workspace_id, key)
);

-- ── 9. campaign_steps ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_steps (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_plain TEXT,
  delay_seconds INTEGER DEFAULT 86400,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. campaign_recipients ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  current_step INTEGER DEFAULT 1,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (campaign_id, recipient_email)
);

-- ── 11. device_states ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_states (
  device_id TEXT PRIMARY KEY,
  ip_address TEXT,
  state_data TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. ai_config ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_config (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openrouter',
  api_key_encrypted TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT 'https://openrouter.ai/api/v1',
  model TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. ai_rules ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_rules (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 14. inbox_messages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_messages (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id INTEGER,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  sentiment TEXT DEFAULT 'neutral',
  is_read INTEGER DEFAULT 0,
  message_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 15. worker_heartbeats ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  jobs_processed INTEGER DEFAULT 0
);

-- ── 16. entitlements ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entitlements (
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (workspace_id, key)
);

-- ── 17. manual_send_logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_send_logs (
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  sent_date DATE DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (workspace_id, user_id, sent_date)
);


-- ============================================================================
-- Safe Column Migrations (ADD COLUMN IF NOT EXISTS)
-- ============================================================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 450;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_host TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_port INTEGER;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_user TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_pass TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_secure INTEGER DEFAULT 1;

ALTER TABLE queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS step_number INTEGER DEFAULT 1;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS campaign_step_id INTEGER;

ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_message_id ON inbox_messages(message_id);

ALTER TABLE queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

ALTER TABLE logs ADD COLUMN IF NOT EXISTS queue_id INTEGER;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE campaign_steps ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE ai_rules ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
-- settings table primary key change logic is complex in ALTER, handled via migration script instead if needed.

-- ============================================================================
-- Performance Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_queue_status_campaign ON queue(status, campaign_id);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled_at ON queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_contacts_list_name ON contacts(list_name);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_recipient ON inbox_messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_inbox_created_at ON inbox_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_queue_recipient ON queue(recipient_email);

CREATE INDEX IF NOT EXISTS idx_accounts_workspace ON accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_queue_workspace ON queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_logs_workspace ON logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_templates_workspace ON templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_workspace ON inbox_messages(workspace_id);

CREATE INDEX IF NOT EXISTS idx_queue_claim ON queue(status, scheduled_at, next_attempt_at);


-- ============================================================================
-- Enable Row Level Security (tables accessible via service_role key from backend)
-- ============================================================================
-- RLS is enabled but no restrictive policies are added, since the Express
-- backend connects with the service_role key which bypasses RLS.
-- This prevents accidental direct access from the Supabase client SDK.

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Done! All 14 tables created with indexes and RLS enabled.
-- ============================================================================
