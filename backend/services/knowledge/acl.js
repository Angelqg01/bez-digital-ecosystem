/**
 * Control de acceso del Knowledge Plane.
 *
 * El `principal` SIEMPRE se construye en servidor a partir de la sesión
 * autenticada (nunca desde el body de la petición).
 */

const CLASSIFICATIONS = Object.freeze({
    PUBLIC: 'PUBLIC',
    INTERNAL: 'INTERNAL',
    TENANT_CONFIDENTIAL: 'TENANT_CONFIDENTIAL',
    RESTRICTED: 'RESTRICTED',
    SECRET: 'SECRET',
});

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

function normalizeRoles(raw) {
    let roles = raw;
    if (typeof roles === 'string') {
        try { roles = JSON.parse(roles); } catch (_) { roles = [roles]; }
    }
    if (!Array.isArray(roles)) roles = roles ? [roles] : [];
    return roles.map((r) => String(r).toUpperCase());
}

/** Construye el principal a partir de req.user (pg User o mock de desarrollo). */
function principalFromUser(user) {
    if (!user) return null;
    const id = String(user.id || user._id || user.walletAddress || '');
    if (!id) return null;
    const roles = normalizeRoles(user.roles || user.role);
    if (!roles.includes('USER')) roles.push('USER');
    const tenantId = String(user.tenantId || user.organizationId || `user:${id}`);
    const plan = String(user.subscription || user.vipTier || 'free').toLowerCase();
    return { userId: id, tenantId, roles, plan };
}

function isAdmin(principal) {
    return !!principal && principal.roles.some((r) => ADMIN_ROLES.includes(r));
}

/**
 * ¿Puede el principal leer este documento/chunk?
 * Se evalúa antes de recuperar y de nuevo antes de entregar el contexto.
 */
function canAccess(principal, meta, now = Date.now()) {
    if (!principal || !meta) return false;
    if (meta.status && meta.status !== 'published') return false;

    const cls = meta.classification;
    if (!cls || cls === CLASSIFICATIONS.SECRET) return false; // SECRET nunca recuperable

    if (meta.valid_from && Date.parse(meta.valid_from) > now) return false;
    if (meta.valid_to && Date.parse(meta.valid_to) < now) return false;

    if (Array.isArray(meta.allowed_plans) && meta.allowed_plans.length > 0) {
        const plans = meta.allowed_plans.map((p) => String(p).toLowerCase());
        if (!plans.includes(principal.plan) && !isAdmin(principal)) return false;
    }

    // Conocimiento global: solo PUBLIC.
    if (!meta.tenant_id) return cls === CLASSIFICATIONS.PUBLIC;

    // Conocimiento privado: mismo tenant, siempre.
    if (meta.tenant_id !== principal.tenantId) return false;

    if (cls === CLASSIFICATIONS.PUBLIC || cls === CLASSIFICATIONS.INTERNAL) return true;

    // TENANT_CONFIDENTIAL / RESTRICTED: requieren rol permitido (o admin del tenant).
    const allowed = normalizeRoles(meta.allowed_roles);
    if (cls === CLASSIFICATIONS.RESTRICTED && allowed.length === 0) return isAdmin(principal);
    if (allowed.length === 0) return true;
    return principal.roles.some((r) => allowed.includes(r)) || isAdmin(principal);
}

module.exports = { CLASSIFICATIONS, principalFromUser, canAccess, isAdmin, normalizeRoles };
