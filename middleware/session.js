/**
 * middleware/session.js — JWT session verification middleware.
 *
 * Reads the JWT from:
 *   1. HttpOnly cookie named `session_token`  (preferred — browser sessions)
 *   2. Authorization: Bearer <token>  header   (API clients / mobile)
 *
 * PIN authentication has been removed entirely.
 */

const jwt = require('jsonwebtoken');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'peakxender-dev-secret-change-me';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || JWT_SECRET;
const COOKIE_NAME = 'session_token';

/**
 * Middleware that verifies a valid JWT session.
 * Supports both Supabase JWTs and app-issued JWTs.
 * Sets req.user = { id, email, name, role } on success.
 */
function requireAuth(req, res, next) {
  if (req.path === '/callback' || req.path === '/microsoft/callback' || req.path === '/auth-url' || req.path === '/microsoft-url' || req.path === '/signup' || req.path === '/signin' || req.path === '/google-url') {
    return next();
  }

  let token = req.cookies && req.cookies[COOKIE_NAME];

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. No session token provided.' });
  }

  try {
    let decoded;

    try {
      decoded = jwt.verify(token, SUPABASE_JWT_SECRET, {
        algorithms: ['HS256', 'RS256'],
        ignoreExpiration: false,
      });
    } catch (supabaseErr) {
      decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
        ignoreExpiration: false,
      });
    }

    req.user = {
      id: decoded.sub || decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || decoded.user_role,
      name: decoded.name,
    };

    return next();
  } catch (err) {
    logger.warn({ err: err.message }, 'JWT verification failed');
    return res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
  }
}

/**
 * Backward-compatible default workspace resolver.
 * It is retained for legacy compatibility but should not be required by the
 * migrated RLS-based routes. The modern flow puts the tenant UUID on req.userId.
 */
async function requireWorkspace(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  try {
    const { getDb } = require('../db');
    const db = await getDb();

    const memberRow = await db
      .prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY workspace_id ASC LIMIT 1')
      .get(req.user.id);

    if (!memberRow) {
      return res.status(403).json({ error: 'User is not a member of any workspace.' });
    }

    const workspace = await db
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(memberRow.workspace_id);

    if (!workspace) {
      return res.status(403).json({ error: 'Workspace not found.' });
    }

    req.workspace = workspace;
    next();
  } catch (err) {
    logger.error({ err }, 'Error resolving workspace');
    res.status(500).json({ error: err.message });
  }
}

module.exports = { requireAuth, requireWorkspace, COOKIE_NAME };
