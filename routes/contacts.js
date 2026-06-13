/**
 * routes/contacts.js — Contact list management (CSV upload + CRUD).
 *
 * Endpoints:
 *   GET    /api/contacts/lists           → List all contact list names
 *   GET    /api/contacts/:listName       → Get contacts in a list
 *   POST   /api/contacts/upload          → Upload CSV of contacts
 *   POST   /api/contacts                 → Add a single contact
 *   DELETE /api/contacts/:listName       → Delete an entire list
 *   DELETE /api/contacts/:listName/:id   → Delete single contact
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDb } = require('../db');

// Multer: store uploads in memory (CSVs are small)
const upload = multer({ storage: multer.memoryStorage() });

/** List all distinct contact list names with counts. */
router.get('/lists', async (_req, res) => {
  try {
    const db = await getDb();
    const lists = db.prepare(`
      SELECT list_name, COUNT(*) as count
      FROM contacts
      GROUP BY list_name
      ORDER BY list_name
    `).all();
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get all contacts in a specific list. */
router.get('/:listName', async (req, res) => {
  try {
    const db = await getDb();
    const contacts = db.prepare(
      'SELECT * FROM contacts WHERE list_name = ? ORDER BY id'
    ).all(req.params.listName);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Upload a CSV file of contacts. */
router.post('/upload', upload.single('file'), async (req, res) => {
  const listName = req.body.list_name;
  if (!listName) return res.status(400).json({ error: 'list_name is required.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    const db = await getDb();
    const csv = req.file.buffer.toString('utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());

    // Find the email column (handle headers)
    let emailColIndex = 0;
    const header = lines[0].toLowerCase();
    if (header.includes('email')) {
      const cols = lines[0].split(',');
      emailColIndex = cols.findIndex(c => c.trim().toLowerCase().includes('email'));
      lines.shift(); // Remove header row
    }

    let added = 0;
    let skipped = 0;

    const insertBatch = db.transaction(() => {
      for (const line of lines) {
        const cols = line.split(',');
        const email = (cols[emailColIndex] || '').trim().replace(/"/g, '');

        if (!email || !email.includes('@')) {
          skipped++;
          continue;
        }

        // Skip duplicates within the same list
        const existing = db.prepare(
          'SELECT id FROM contacts WHERE list_name = ? AND email = ?'
        ).get(listName, email);

        if (existing) {
          skipped++;
          continue;
        }

        db.prepare(
          'INSERT INTO contacts (list_name, email) VALUES (?, ?)'
        ).run(listName, email);
        added++;
      }
    });

    insertBatch();

    res.json({
      success: true,
      added,
      skipped,
      total: added + skipped,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Add a single contact to a list. */
router.post('/', async (req, res) => {
  const { list_name, email } = req.body;
  if (!list_name || !email) {
    return res.status(400).json({ error: 'list_name and email are required.' });
  }

  try {
    const db = await getDb();
    const existing = db.prepare(
      'SELECT id FROM contacts WHERE list_name = ? AND email = ?'
    ).get(list_name, email);

    if (existing) {
      return res.status(409).json({ error: 'Contact already exists in this list.' });
    }

    const result = db.prepare(
      'INSERT INTO contacts (list_name, email) VALUES (?, ?)'
    ).run(list_name, email);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete an entire contact list. */
router.delete('/:listName', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.prepare('DELETE FROM contacts WHERE list_name = ?').run(req.params.listName);
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a single contact from a list. */
router.delete('/:listName/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM contacts WHERE id = ? AND list_name = ?')
      .run(req.params.id, req.params.listName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
