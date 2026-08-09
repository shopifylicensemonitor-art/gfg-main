/**
 * routes/auth.js — Google OAuth login + JWT session management.
 *
 * Endpoints:
 *   GET  /api/auth/google-url  → Generate Google OAuth consent URL for login
 *   GET  /api/auth/callback    → Exchange code for tokens, issue JWT via HttpOnly cookie
 *   GET  /api/auth/me          → Return current user info from session
 *   POST /api/auth/logout      → Clear session cookie
 *   POST /api/auth/profile     → Update user profile
 *   GET  /api/auth/settings    → Get workspace settings
 *   POST /api/auth/settings    → Update workspace settings
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { getDb } = require('../db');
const logger = require('../logger');
const { requireAuth, COOKIE_NAME } = require('../middleware/session');

const JWT_SECRET = process.env.JWT_SECRET || null;
const JWT_EXPIRY = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function getJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured to issue and verify JWTs.');
  }
  return JWT_SECRET;
}

function getLoginOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_LOGIN_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
  );
}

/**
 * Helper: Set the JWT as an HttpOnly cookie on the response.
 */
function setSessionCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
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

/** OAuth callback — exchange code, verify email, create/update user, issue session cookie. */
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

    // Check admin restriction (optional)
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
    if (ADMIN_EMAIL && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      const frontendUrl = process.env.FRONTEND_ORIGIN || '';
      return res.redirect(frontendUrl + '/?auth_error=unauthorized');
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

    // Ensure user has a default workspace
    const memberRow = await db.prepare(
      'SELECT workspace_id FROM workspace_members WHERE user_id = ?'
    ).get(user.id);

    if (!memberRow) {
      // Create a default workspace for this user
      const wsResult = await db.prepare(
        'INSERT INTO workspaces (name) VALUES (?)'
      ).run(`${user.name || 'My'}'s Workspace`);

      const workspaceId = wsResult.lastInsertRowid;
      await db.prepare(
        'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
      ).run(workspaceId, user.id, 'admin');
    }

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      getJwtSecret(),
      { expiresIn: JWT_EXPIRY }
    );

    // Set HttpOnly cookie — do NOT put token in the URL
    setSessionCookie(res, token);

    // Redirect to frontend (no token in URL)
    const frontendUrl = process.env.FRONTEND_ORIGIN || '';
    res.redirect(frontendUrl + '/?auth_success=true');
  } catch (err) {
    logger.error({ err }, 'Auth callback error');
    res.status(500).json({ error: err.message });
  }
});

/** Return current user info from session (cookie or Bearer). */
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

/** Update current user's profile details. */
router.post('/profile', requireAuth, async (req, res) => {
  try {
    const { name, picture } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const db = await getDb();
    await db.prepare(
      'UPDATE users SET name = ?, picture = ? WHERE id = ?'
    ).run(name, picture || '', req.user.id);

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Get workspace settings (requires auth + workspace). */
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const db = await getDb();

    // Resolve user's default workspace for settings
    const memberRow = await db.prepare(
      'SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY workspace_id ASC LIMIT 1'
    ).get(req.user.id);

    const wsId = memberRow ? memberRow.workspace_id : null;

    let rows = [];
    if (wsId) {
      rows = await db.prepare('SELECT key, value FROM settings WHERE workspace_id = ?').all(wsId);
    }

    const settingsMap = {};
    rows.forEach(r => {
      settingsMap[r.key] = r.value;
    });

    const responseSettings = {
      ADMIN_EMAIL: settingsMap['ADMIN_EMAIL'] || process.env.ADMIN_EMAIL || '',
      TRACKING_BASE_URL: settingsMap['TRACKING_BASE_URL'] || process.env.TRACKING_BASE_URL || 'http://localhost:3000',
      SCHEDULER_BATCH_SIZE: settingsMap['SCHEDULER_BATCH_SIZE'] || process.env.SCHEDULER_BATCH_SIZE || '10',
      DAILY_LIMIT_DEFAULT: settingsMap['DAILY_LIMIT_DEFAULT'] || '450',
      SCHEDULER_ENABLED: (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') ? 'true' : 'false',
    };

    res.json(responseSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update workspace settings. */
router.post('/settings', requireAuth, async (req, res) => {
  try {
    const settings = req.body;
    const db = await getDb();

    // Resolve user's default workspace
    const memberRow = await db.prepare(
      'SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY workspace_id ASC LIMIT 1'
    ).get(req.user.id);

    if (!memberRow) {
      return res.status(404).json({ error: 'No workspace found.' });
    }

    const wsId = memberRow.workspace_id;
    const keys = ['ADMIN_EMAIL', 'TRACKING_BASE_URL', 'SCHEDULER_BATCH_SIZE', 'DAILY_LIMIT_DEFAULT'];

    for (const key of keys) {
      if (settings[key] !== undefined) {
        const existing = await db.prepare('SELECT key FROM settings WHERE workspace_id = ? AND key = ?').get(wsId, key);
        if (existing) {
          await db.prepare('UPDATE settings SET value = ? WHERE workspace_id = ? AND key = ?').run(String(settings[key]), wsId, key);
        } else {
          await db.prepare('INSERT INTO settings (workspace_id, key, value) VALUES (?, ?, ?)').run(wsId, key, String(settings[key]));
        }
      }
    }

    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Logout — clear session cookie. */
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true, message: 'Session cleared.' });
});

/**
 * GET /api/auth/plan — Return workspace plan and active entitlements.
 * Requires auth + workspace.
 */
router.get('/plan', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const wsId = req.workspace ? req.workspace.id : null;

    if (!wsId) {
      return res.status(400).json({ error: 'Workspace context required.' });
    }

    // Get workspace plan
    const ws = await db.prepare('SELECT plan FROM workspaces WHERE id = ?').get(wsId);
    const plan = ws ? (ws.plan || 'free') : 'free';

    // Get all entitlements for this workspace
    const rows = await db.prepare(
      "SELECT key, value FROM entitlements WHERE workspace_id = ?"
    ).all(wsId);

    const entitlements = {};
    if (Array.isArray(rows)) {
      for (const row of rows) {
        entitlements[row.key] = row.value;
      }
    }

    res.json({ plan, entitlements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
