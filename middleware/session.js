/**
 * middleware/session.js — JWT session verification middleware.
 *
 * Checks for Bearer token in Authorization header.
 * Falls back to PIN auth if no JWT is configured (backward compatible).
 */

const jwt = require('jsonwebtoken');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'peakxender-dev-secret-change-me';

/**
 * Middleware that accepts EITHER a valid JWT Bearer token
 * OR the legacy PIN-based auth. This ensures backward compatibility
 * while enabling the new auth flow.
 */
function requireAuth(req, res, next) {
  // Allow public access to OAuth callback and auth-url generation
  if (req.path === '/callback' || req.path === '/auth-url') {
    return next();
  }

  // Try JWT Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (_) {
      // Token is invalid or expired; fall through to check PIN fallback below
    }
  }

  // Allow a simple PIN fallback for local/dev usage. The PIN can be provided
  // either via ?pin= query parameter or the `X-Access-Pin` header. This keeps
  // the app usable without full OAuth during local development.
  const configuredPin = process.env.ACCESS_PIN;
  const providedPin = (req.query && req.query.pin) || req.headers['x-access-pin'];

  // Debug logging to help trace local dev auth issues (do not log PINs in prod)
  if (process.env.NODE_ENV !== 'production') {
    try {
      logger.debug({ configuredPin: !!configuredPin, providedPin: providedPin ? '[REDACTED]' : null }, 'PIN auth check');
    } catch (_) { /* ignore logging failures */ }
  }

  if (configuredPin && providedPin && String(providedPin) === String(configuredPin)) {
    // Mark a minimal user context so downstream handlers can rely on `req.user`.
    req.user = { id: 'pin', email: 'local-pin', role: 'admin' };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized. Provide a valid JWT token.' });
}

module.exports = { requireAuth };
