/**
 * scripts/migrate_add_password_hash.js
 * 
 * Adds password_hash column to users table for email/password authentication.
 * Safe to run multiple times (uses ALTER TABLE IF NOT EXISTS).
 */

require('dotenv').config();

async function migrate() {
  const { getDb } = require('../db');
  
  try {
    const db = await getDb();
    
    console.log('Adding password_hash column to users table...');
    
    // Add password_hash column if it doesn't exist
    if (db._isPg) {
      // PostgreSQL
      await db.exec(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash TEXT
      `);
      console.log('✓ PostgreSQL: password_hash column added');
    } else {
      // SQLite - try using exec for DDL
      try {
        await db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
        console.log('✓ SQLite: password_hash column added via exec');
      } catch (err) {
        if (err.message && (err.message.includes('duplicate column') || err.message.includes('column password_hash already exists'))) {
          console.log('✓ SQLite: password_hash column already exists');
        } else {
          console.error('Error details:', err.message);
          // Try prepare as fallback
          try {
            await db.prepare(`ALTER TABLE users ADD COLUMN password_hash TEXT`).run();
            console.log('✓ SQLite: password_hash column added via prepare');
          } catch (err2) {
            if (err2.message && err2.message.includes('duplicate column')) {
              console.log('✓ SQLite: password_hash column already exists');
            } else {
              throw err2;
            }
          }
        }
      }
    }
    
    console.log('Migration completed successfully!');
    
    // Verify the column exists
    const schema = await db.prepare("PRAGMA table_info(users)").all();
    const hasPasswordHash = schema.some(col => col.name === 'password_hash');
    if (hasPasswordHash) {
      console.log('✓ Verification: password_hash column confirmed in schema');
    } else {
      console.log('⚠ Warning: password_hash column not found in schema after migration');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

migrate();
