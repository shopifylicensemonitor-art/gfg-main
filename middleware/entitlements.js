/**
 * middleware/entitlements.js — Entitlements & Plan Limit Verification Middleware.
 *
 * Enforces tier restrictions based on workspace plan settings:
 *   - Free: Manual send cap, no automation, no reply detection
 *   - Starter: 1 connected mailbox, automated campaigns, tracking
 *   - Pro: 5 connected mailboxes, automated campaigns, tracking, reply detection
 *   - Business: Unlimited mailboxes, custom limits
 */

const { getDb } = require('../db');

const DEFAULT_PLAN_ENTITLEMENTS = {
  free: {
    'automation.enabled': 'false',
    'connected_mailboxes.max': '0',
    'manual_send.daily_limit': '50',
    'tracking.enabled': 'false',
    'reply_detection.enabled': 'false',
  },
  starter: {
    'automation.enabled': 'true',
    'connected_mailboxes.max': '1',
    'manual_send.daily_limit': '500',
    'tracking.enabled': 'true',
    'reply_detection.enabled': 'false',
  },
  pro: {
    'automation.enabled': 'true',
    'connected_mailboxes.max': '5',
    'manual_send.daily_limit': '2000',
    'tracking.enabled': 'true',
    'reply_detection.enabled': 'true',
  },
  business: {
    'automation.enabled': 'true',
    'connected_mailboxes.max': '999',
    'manual_send.daily_limit': '10000',
    'tracking.enabled': 'true',
    'reply_detection.enabled': 'true',
  },
};

/**
 * Fetch an entitlement value for a given workspace and feature key.
 */
async function getEntitlementValue(workspaceId, key) {
  try {
    const db = await getDb();

    // 1. Check direct override in entitlements table
    const row = await db.prepare('SELECT value FROM entitlements WHERE workspace_id = ? AND key = ?').get(workspaceId, key);
    if (row && row.value !== undefined && row.value !== null) {
      return row.value;
    }

    // 2. Fallback to workspace plan defaults
    const ws = await db.prepare('SELECT plan FROM workspaces WHERE id = ?').get(workspaceId);
    const plan = ws ? (ws.plan || 'free') : 'free';
    const planDefaults = DEFAULT_PLAN_ENTITLEMENTS[plan] || DEFAULT_PLAN_ENTITLEMENTS.free;

    return planDefaults[key] !== undefined ? planDefaults[key] : 'false';
  } catch (_) {
    return 'false';
  }
}

/**
 * Middleware factory requiring a boolean feature flag to be enabled.
 */
function requireEntitlement(key) {
  return async (req, res, next) => {
    if (!req.workspace || !req.workspace.id) {
      return res.status(401).json({ error: 'Workspace context missing.' });
    }

    const value = await getEntitlementValue(req.workspace.id, key);
    if (value === 'true' || value === '1') {
      return next();
    }

    return res.status(403).json({
      error: `Plan entitlement restricted. Feature '${key}' is not enabled on your current plan. Please upgrade to unlock this feature.`,
      code: 'ENTITLEMENT_RESTRICTED',
      feature: key,
    });
  };
}

/**
 * Verify whether a numeric count is within the workspace's entitlement limit.
 */
async function verifyLimit(workspaceId, limitKey, currentCount) {
  const rawValue = await getEntitlementValue(workspaceId, limitKey);
  const maxLimit = parseInt(rawValue, 10);

  if (isNaN(maxLimit)) return false;
  return currentCount < maxLimit;
}

module.exports = {
  getEntitlementValue,
  requireEntitlement,
  verifyLimit,
  DEFAULT_PLAN_ENTITLEMENTS,
};
