/**
 * middleware/auth.js — DEPRECATED.
 *
 * Legacy PIN-based authentication has been removed.
 * All authentication now goes through middleware/session.js (JWT via cookie or Bearer).
 *
 * This file re-exports requireAuth from session.js for backward compatibility
 * in case any code still imports from this path.
 */

const { requireAuth } = require('./session');

// Alias: the old requirePin is now requireAuth (JWT-based).
module.exports = { requirePin: requireAuth, requireAuth };
