/**
 * middleware/tenant.js — Supabase UUID extraction for RLS
 *
 * For Supabase integration:
 * - auth.uid() returns a UUID from the authenticated user
 * - req.user.id contains this UUID from the JWT 'sub' claim
 * - Pass it through as req.userId for all database queries
 * - RLS policies enforce isolation at database level
 */

const logger = require('../logger');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

async function attachTenant(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'User context missing.',
        message: 'User must be authenticated before accessing tenant resources.'
      });
    }

    const userId = req.user.id;

    if (!isValidUUID(userId)) {
      logger.warn(
        { userId, userIdType: typeof userId },
        'Invalid user ID format - expected UUID'
      );
      return res.status(401).json({
        error: 'Invalid user ID format.',
        message: 'User ID must be a valid UUID from Supabase.'
      });
    }

    req.userId = userId;

    if (process.env.DEBUG_AUTH === 'true') {
      logger.info({ userId: req.userId.substring(0, 8) + '...' }, 'Tenant UUID attached');
    }

    next();
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Failed to attach tenant');
    res.status(500).json({
      error: 'Could not resolve user context.',
      message: 'An error occurred while validating your session.'
    });
  }
}

function getUserIdFromToken(jwtPayload) {
  if (!jwtPayload || !jwtPayload.sub) {
    return null;
  }
  const id = jwtPayload.sub;
  return isValidUUID(id) ? id : null;
}

module.exports = { attachTenant, isValidUUID, getUserIdFromToken };
