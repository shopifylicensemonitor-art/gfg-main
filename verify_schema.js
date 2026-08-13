const { getDb } = require('./db');

(async () => {
  try {
    const db = await getDb();
    const schema = await db.prepare("PRAGMA table_info(users)").all();
    console.log('\n✓ Users table schema:');
    schema.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}`);
    });
    
    if (schema.some(col => col.name === 'password_hash')) {
      console.log('\n✓ password_hash column exists!');
    } else {
      console.log('\n✗ password_hash column NOT found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
