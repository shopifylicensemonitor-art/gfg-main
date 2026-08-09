/**
 * middleware/workspace.js — Workspace resolution & authorization.
 *
 * After requireAuth has set req.user, this middleware:
 *   1. resolveWorkspace() — determines the target workspace for the request
 *   2. authorizeWorkspaceMember() — confirms the user is a member
 *
 * Sets req.workspace = { id, name } on success.
 *
 * Flow:
 *   authenticateUser (requireAuth)
 *     → resolveWorkspace
 *       → authorizeWorkspaceMember
 *         → route handler
 */

const { getDb } = require('../db');

/**
 * Resolve which workspace this request targets.
 *
 * Priority:
 *   1. X-Workspace-Id header  (for multi-workspace users switching context)
 *   2. ?workspace_id query parameter
 *   3. The user's first/default workspace (single-workspace users)
 */
async function resolveWorkspace(req, res, next) {
  // Allow public access to OAuth callback
  if (req.path === '/callback' || req.path === '/microsoft/callback') {
    return next();
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized. User context is missing.' });
  }

  try {
    const db = await getDb();
    const userId = req.user.id;

    // Check explicit workspace selection
    const explicitWsId = req.headers['x-workspace-id'] || req.query.workspace_id;

    let workspace;

    if (explicitWsId) {
      // Verify user is a member of this workspace
      workspace = await db.prepare(`
        SELECT w.id, w.name
        FROM workspaces w
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE w.id = ? AND wm.user_id = ?
      `).get(Number(explicitWsId), userId);

      if (!workspace) {
        return res.status(403).json({ error: 'You do not have access to this workspace.' });
      }
    } else {
      // Default: fetch the user's first workspace
      workspace = await db.prepare(`
        SELECT w.id, w.name
        FROM workspaces w
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = ?
        ORDER BY w.id ASC
        LIMIT 1
      `).get(userId);

      if (!workspace) {
        return res.status(404).json({
          error: 'No workspace found. Please contact support.',
        });
      }
    }

    req.workspace = { id: workspace.id, name: workspace.name };
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Workspace resolution failed: ' + err.message });
  }
}

/**
 * Combined middleware: resolves workspace and authorizes in one step.
 * Use this on all protected business routes.
 */
function requireWorkspace(req, res, next) {
  return resolveWorkspace(req, res, next);
}

module.exports = { resolveWorkspace, requireWorkspace };
