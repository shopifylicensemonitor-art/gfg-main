/**
 * routes/templates.js — Email template CRUD.
 *
 * Endpoints:
 *   GET    /api/templates      → List all templates
 *   GET    /api/templates/:id  → Get single template
 *   POST   /api/templates      → Create template
 *   PUT    /api/templates/:id  → Update template
 *   DELETE /api/templates/:id  → Delete template
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

/** List all templates. */
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const templates = db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get single template. */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Not found.' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Create a template. */
router.post('/', async (req, res) => {
  const { name, subject, body_html, body_plain } = req.body;
  if (!name || !subject) {
    return res.status(400).json({ error: 'name and subject are required.' });
  }

  try {
    const db = await getDb();
    const result = db.prepare(`
      INSERT INTO templates (name, subject, body_html, body_plain)
      VALUES (?, ?, ?, ?)
    `).run(name, subject, body_html || '', body_plain || '');
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update a template. */
router.put('/:id', async (req, res) => {
  const { name, subject, body_html, body_plain } = req.body;
  try {
    const db = await getDb();
    db.prepare(`
      UPDATE templates SET name = ?, subject = ?, body_html = ?, body_plain = ?
      WHERE id = ?
    `).run(name, subject, body_html || '', body_plain || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a template. */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
