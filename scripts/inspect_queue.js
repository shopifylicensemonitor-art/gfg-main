const { getDb } = require('../db');

(async () => {
  let db;
  try {
    db = await getDb();
    const pending = await db.prepare("SELECT COUNT(*) as count FROM queue WHERE status IN ('pending', 'sending')").get();
    const campaigns = await db.prepare('SELECT id, name, status, sent_count, failed_count, total_contacts FROM campaigns ORDER BY id DESC LIMIT 5').all();
    console.log(JSON.stringify({ pending, campaigns }, null, 2));
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (db && typeof db.close === 'function') {
      await db.close();
    }
  }
})();