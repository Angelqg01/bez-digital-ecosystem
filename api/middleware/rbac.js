/**
 * RBAC compatibility middleware.
 * Re-exports the role checker from the central security middleware.
 */
const { requireRole, requireOrgRole } = require('./security');

module.exports = { requireRole, requireOrgRole };
