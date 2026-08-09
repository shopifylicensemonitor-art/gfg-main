/**
 * routes/templates.js — Email template CRUD.
 *
 * Endpoints:
 *   GET    /api/templates      → List all templates (workspace-scoped)
 *   GET    /api/templates/:id  → Get single template (workspace-scoped)
 *   POST   /api/templates      → Create template
 *   PUT    /api/templates/:id  → Update template
 *   DELETE /api/templates/:id  → Delete template
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

/** List all templates. */
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const templates = await db.prepare('SELECT * FROM templates WHERE workspace_id = ? ORDER BY created_at DESC').all(req.workspace.id);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get single template. */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const template = await db.prepare('SELECT * FROM templates WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspace.id);
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
    const result = await db.prepare(`
      INSERT INTO templates (workspace_id, name, subject, body_html, body_plain)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.workspace.id, name, subject, body_html || '', body_plain || '');
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
    await db.prepare(`
      UPDATE templates SET name = ?, subject = ?, body_html = ?, body_plain = ?
      WHERE id = ? AND workspace_id = ?
    `).run(name, subject, body_html || '', body_plain || '', req.params.id, req.workspace.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a template. */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare('DELETE FROM templates WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspace.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
