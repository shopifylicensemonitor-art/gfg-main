/**
 * routes/auth.js — Google OAuth login + JWT session management.
 *
 * Endpoints:
 *   GET  /api/auth/google-url  → Generate Google OAuth consent URL for login
 *   GET  /api/auth/callback    → Exchange code for tokens, issue JWT
 *   GET  /api/auth/me          → Return current user info from JWT
 *   POST /api/auth/logout      → Clear session (client-side)
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { getDb } = require('../db');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'peakxender-dev-secret-change-me';
const JWT_EXPIRY = '7d';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

function getLoginOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Login callback is a DIFFERENT redirect URI from the accounts one
    process.env.GOOGLE_LOGIN_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
  );
}

/** Generate Google OAuth consent URL for admin login. */
router.get('/google-url', (_req, res) => {
  try {
    const oauth2 = getLoginOAuth2Client();
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** OAuth callback — exchange code, verify admin email, issue JWT. */
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided.' });

  try {
    const oauth2 = getLoginOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Fetch user info
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    const email = data.email;
    const name = data.name || email.split('@')[0];
    const picture = data.picture || '';

    // Check admin restriction
    if (ADMIN_EMAIL && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      // Redirect to frontend with error
      return res.redirect('/?auth_error=unauthorized');
    }

    // Upsert user in database
    const db = await getDb();
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (existing) {
      await db.prepare(
        "UPDATE users SET name = ?, picture = ?, last_login = datetime('now') WHERE email = ?"
      ).run(name, picture, email);
    } else {
      await db.prepare(
        'INSERT INTO users (email, name, picture, role) VALUES (?, ?, ?, ?)'
      ).run(email, name, picture, 'admin');
    }

    // Fetch the full user row for the JWT payload
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Redirect to frontend with token in query
    res.redirect(`/?token=${encodeURIComponent(token)}`);
  } catch (err) {
    logger.error({ err }, 'Auth callback error');
    res.status(500).json({ error: err.message });
  }
});

/** Return current user info from JWT. */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

/** Update current user's profile details. */
router.post('/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, picture } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const db = await getDb();
    await db.prepare(
      'UPDATE users SET name = ?, picture = ? WHERE id = ?'
    ).run(name, picture || '', decoded.id);

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get system settings. */
router.get('/settings', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const db = await getDb();
    const rows = await db.prepare('SELECT key, value FROM settings').all();
    
    const settingsMap = {};
    rows.forEach(r => {
      settingsMap[r.key] = r.value;
    });

    const responseSettings = {
      ADMIN_EMAIL: settingsMap['ADMIN_EMAIL'] || process.env.ADMIN_EMAIL || '',
      TRACKING_BASE_URL: settingsMap['TRACKING_BASE_URL'] || process.env.TRACKING_BASE_URL || 'http://localhost:3000',
      SCHEDULER_BATCH_SIZE: settingsMap['SCHEDULER_BATCH_SIZE'] || process.env.SCHEDULER_BATCH_SIZE || '10',
      DAILY_LIMIT_DEFAULT: settingsMap['DAILY_LIMIT_DEFAULT'] || '450',
    };

    res.json(responseSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update system settings. */
router.post('/settings', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const settings = req.body;
    const db = await getDb();

    const keys = ['ADMIN_EMAIL', 'TRACKING_BASE_URL', 'SCHEDULER_BATCH_SIZE', 'DAILY_LIMIT_DEFAULT'];
    
    for (const key of keys) {
      if (settings[key] !== undefined) {
        const existing = await db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
        if (existing) {
          await db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(settings[key]), key);
        } else {
          await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, String(settings[key]));
        }
      }
    }

    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Logout placeholder (JWT is stateless — client discards token). */
router.post('/logout', (_req, res) => {
  res.json({ success: true, message: 'Token cleared on client.' });
});

module.exports = router;
