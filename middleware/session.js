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

const JWT_SECRET = process.env.JWT_SECRET || null;
const COOKIE_NAME = 'session_token';

/**
 * Middleware that verifies a valid JWT session.
 * Sets req.user = { id, email, name, role } on success.
 */
function requireAuth(req, res, next) {
  // Allow public access to OAuth callback and auth-url generation
  if (req.path === '/callback' || req.path === '/microsoft/callback' || req.path === '/auth-url' || req.path === '/microsoft-url') {
    return next();
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET is not set.' });
  }

  // 1. Try HttpOnly cookie
  let token = req.cookies && req.cookies[COOKIE_NAME];

  // 2. Fallback to Authorization Bearer header (for API clients)
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
  }
}

module.exports = { requireAuth, COOKIE_NAME };
