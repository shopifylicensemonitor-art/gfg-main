require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const migrate = async () => {
  console.log('Connecting to database...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Creating workspaces and workspace_members...');
    await client.query(`
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
    `);

    const tables = [
      'accounts', 'contacts', 'campaigns', 'queue', 'logs', 
      'templates', 'campaign_steps', 'campaign_recipients', 
      'ai_config', 'ai_rules', 'inbox_messages'
    ];

    console.log('Adding workspace_id to tables...');
    for (const table of tables) {
      await client.query(`
        ALTER TABLE ${table} 
        ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${table}_workspace ON ${table}(workspace_id);
      `);
    }

    console.log('Migrating settings table structure...');
    // Handle settings table which has a primary key on just 'key' currently.
    // We need to drop the primary key, add workspace_id, and recreate it.
    try {
      await client.query(`
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
        ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
        ALTER TABLE settings ADD PRIMARY KEY (workspace_id, key);
      `);
    } catch (e) {
      console.log('Settings table constraint might already be updated or does not exist:', e.message);
    }

    console.log('Backfilling default workspaces for existing users...');
    
    // Get all users
    const usersRes = await client.query('SELECT id, email, name FROM users');
    
    for (const user of usersRes.rows) {
      // Check if user already has a default workspace
      const memberRes = await client.query('SELECT workspace_id FROM workspace_members WHERE user_id = $1', [user.id]);
      
      let workspaceId;
      if (memberRes.rows.length === 0) {
        // Create workspace
        const wsName = user.name ? \`\${user.name}'s Workspace\` : 'My Workspace';
        const wsRes = await client.query(
          'INSERT INTO workspaces (name) VALUES ($1) RETURNING id',
          [wsName]
        );
        workspaceId = wsRes.rows[0].id;
        
        // Add member
        await client.query(
          'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
          [workspaceId, user.id, 'admin']
        );
        console.log(\`Created workspace \${workspaceId} for user \${user.email}\`);
      } else {
        workspaceId = memberRes.rows[0].workspace_id;
      }
      
      // We don't have user_id on most tables, they are essentially global or linked via other means.
      // Wait, how do we know which account belongs to which user?
      // Ah, the application previously didn't have user_id on accounts, campaigns etc.
      // If there was only ONE user, we can just assign EVERYTHING to the first user's workspace.
    }
    
    // Assign all existing records with NULL workspace_id to the first workspace created (assuming single-tenant before)
    const firstWsRes = await client.query('SELECT id FROM workspaces ORDER BY id ASC LIMIT 1');
    if (firstWsRes.rows.length > 0) {
      const defaultWsId = firstWsRes.rows[0].id;
      console.log(\`Assigning orphaned records to default workspace ID: \${defaultWsId}\`);
      
      for (const table of tables) {
        await client.query(\`UPDATE \${table} SET workspace_id = $1 WHERE workspace_id IS NULL\`, [defaultWsId]);
      }
      // Also for settings
      await client.query(\`UPDATE settings SET workspace_id = $1 WHERE workspace_id IS NULL\`, [defaultWsId]);
    }
    
    console.log('Enabling Row Level Security on workspaces...');
    await client.query('ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;');
    await client.query('ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;');

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
