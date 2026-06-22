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
    const lists = await db.prepare(`
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
    const contacts = await db.prepare(
      'SELECT * FROM contacts WHERE list_name = ? ORDER BY id'
    ).all(req.params.listName);

    const parsedContacts = contacts.map(c => {
      try {
        c.fields = c.fields ? JSON.parse(c.fields) : {};
      } catch (_) {
        c.fields = {};
      }
      return c;
    });

    res.json(parsedContacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Simple CSV parser helper respecting quoted commas */
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let cell = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(cell.trim().replace(/^["']|["']$/g, ''));
        cell = '';
      } else {
        cell += char;
      }
    }
    cells.push(cell.trim().replace(/^["']|["']$/g, ''));
    rows.push(cells);
  }
  return rows;
}

/** Normalize header to alphanumeric with underscores */
function normalizeHeaderKey(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Extract multiple emails and a single URL from cell value */
function extractEmailsAndUrlsFromCell(cellValue) {
  const trimmed = cellValue.trim();
  if (!trimmed) return { emails: [], url: '' };
  
  const emailMatches = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  let emailCandidates = Array.from(new Set(emailMatches.map(e => e.trim().toLowerCase())));
  
  if (emailCandidates.length === 0) {
    emailCandidates = trimmed.split(/[:;]/).map(e => e.trim().toLowerCase()).filter(Boolean);
  }
  
  const urlRegex = /(https?:\/\/[^\s;:]+)/i;
  const wwwRegex = /(www\.[^\s;:]+\.[^\s;:]+)/i;
  const urlMatch = trimmed.match(urlRegex) || trimmed.match(wwwRegex);
  let extractedUrl = urlMatch ? urlMatch[0].trim() : '';
  
  if (!extractedUrl) {
    const tokens = trimmed.split(/[\s;:•]+/);
    for (const token of tokens) {
      const t = token.trim();
      if (t.includes('.') && !t.includes('@') && t.length > 4 && !t.endsWith('.')) {
        if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(t)) {
          extractedUrl = t;
          break;
        }
      }
    }
  }
  return { emails: emailCandidates, url: extractedUrl };
}

/** Upload a CSV file of contacts. */
router.post('/upload', upload.single('file'), async (req, res) => {
  const listName = req.body.list_name;
  if (!listName) return res.status(400).json({ error: 'list_name is required.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    const db = await getDb();
    const csv = req.file.buffer.toString('utf-8');
    const rows = parseCSV(csv);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Empty CSV file.' });
    }

    const headers = rows[0];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isHeaderless = headers.some(cell => emailRegex.test(cell.trim()));

    let finalHeaders = [];
    let dataRows = [];

    if (isHeaderless) {
      dataRows = rows;
      finalHeaders = headers.map((cell, idx) => {
        if (emailRegex.test(cell.trim())) return 'email';
        return `column_${idx + 1}`;
      });
    } else {
      dataRows = rows.slice(1);
      finalHeaders = headers.map(h => normalizeHeaderKey(h));
    }

    const emailColIndex = finalHeaders.findIndex(h => h === 'email' || h.includes('email'));
    const safeEmailColIndex = emailColIndex >= 0 ? emailColIndex : 0;

    let added = 0;
    let skipped = 0;

    const insertBatch = db.transaction(async (txDb) => {
      for (const row of dataRows) {
        const emailCell = (row[safeEmailColIndex] || '').trim();
        if (!emailCell) {
          skipped++;
          continue;
        }

        const { emails, url } = extractEmailsAndUrlsFromCell(emailCell);
        if (emails.length === 0) {
          skipped++;
          continue;
        }

        // Build key-value fields object
        const fields = {};
        finalHeaders.forEach((header, idx) => {
          if (idx !== safeEmailColIndex) {
            fields[header] = row[idx] || '';
          }
        });

        if (url) {
          fields['store_url'] = url;
          if (!fields['store_name']) {
            fields['store_name'] = url;
          }
        }

        const fieldsJson = JSON.stringify(fields);

        for (const email of emails) {
          // Skip duplicates within the same list
          const existing = await txDb.prepare(
            'SELECT id FROM contacts WHERE list_name = ? AND email = ?'
          ).get(listName, email);

          if (existing) {
            skipped++;
            continue;
          }

          await txDb.prepare(
            'INSERT INTO contacts (list_name, email, fields) VALUES (?, ?, ?)'
          ).run(listName, email, fieldsJson);
          added++;
        }
      }
    });

    await insertBatch();

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
    const existing = await db.prepare(
      'SELECT id FROM contacts WHERE list_name = ? AND email = ?'
    ).get(list_name, email);

    if (existing) {
      return res.status(409).json({ error: 'Contact already exists in this list.' });
    }

    const result = await db.prepare(
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
    const result = await db.prepare('DELETE FROM contacts WHERE list_name = ?').run(req.params.listName);
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a single contact from a list. */
router.delete('/:listName/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare('DELETE FROM contacts WHERE id = ? AND list_name = ?')
      .run(req.params.id, req.params.listName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
