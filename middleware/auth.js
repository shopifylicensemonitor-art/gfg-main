/**
 * middleware/auth.js — Simple PIN-based authentication.
 *
 * Checks for ?pin= query parameter or X-Access-Pin header.
 * This keeps the dashboard private without a full auth system.
 */

function requirePin(req, res, next) {
  const pin = process.env.ACCESS_PIN;

  // If no PIN is configured, skip authentication
  if (!pin) return next();

  const provided = req.query.pin || req.headers['x-access-pin'];

  if (provided === pin) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Provide ?pin= query parameter or X-Access-Pin header.',
  });
}

module.exports = { requirePin };
