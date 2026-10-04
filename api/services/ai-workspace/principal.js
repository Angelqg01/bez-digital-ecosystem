'use strict';

/**
 * Principal del chat a partir de la sesión de la api (JWT de authenticateToken),
 * nunca del body. Tenant = organización activa del usuario ('org:<uuid>'; si no
 * tiene, 'user:<id>'); plan = el plan activo más alto de las apps de esa
 * organización (gateway_subscriptions) y appId la app que lo paga; roles = rol de plataforma + rol en la
 * organización con prefijo ORG_ (un owner de su organización NO es admin de la
 * plataforma: no puede publicar conocimiento global).
 */
const RANGO = { enterprise_vip: 4, business: 3, creator_pro: 2, starter: 1 };
const CACHE_MS = 60_000;
const cache = new Map();

async function resolverPrincipal(user, { query = require('../../db/pool').query, now = Date.now } = {}) {
    if (!user) return null;
    const userId = String(user.userId || user.id || '');
    if (!userId) return null;

    const hit = cache.get(userId);
    if (hit && hit.exp > now()) return hit.principal;

    const roles = ['USER'];
    if (String(user.role || '').toLowerCase() === 'admin') roles.push('ADMIN');

    let tenantId = `user:${userId}`;
    // Sin suscripción activa no hay plan que pague el chat: plan 'none', appId null.
    let plan = 'none';
    let appId = null;
    try {
        const { rows } = await query(
            `SELECT m.organization_id, m.role, s.plan_id AS plan, s.app_id
               FROM organization_members m
               JOIN organizations o ON o.id = m.organization_id
               LEFT JOIN LATERAL (
                    SELECT gs.plan_id, gs.app_id::text AS app_id FROM app_registry a
                      JOIN gateway_subscriptions gs ON gs.app_id = a.id AND gs.status = 'active'
                     WHERE a.enterprise_id = o.legacy_enterprise_id AND a.is_active = TRUE
                     ORDER BY CASE gs.plan_id WHEN 'enterprise_vip' THEN 4 WHEN 'business' THEN 3
                                              WHEN 'creator_pro' THEN 2 ELSE 1 END DESC, gs.app_id
                     LIMIT 1) s ON TRUE
              WHERE m.user_id::text = $1 AND m.status = 'active'
              ORDER BY (m.role = 'owner') DESC, m.created_at
              LIMIT 1`,
            [userId]
        );
        if (rows[0]) {
            tenantId = `org:${rows[0].organization_id}`;
            roles.push(`ORG_${String(rows[0].role).toUpperCase()}`);
            if (rows[0].plan && RANGO[rows[0].plan] && rows[0].app_id) {
                plan = rows[0].plan;
                appId = String(rows[0].app_id);
            }
        }
    } catch (_) {
        // Sin organización resoluble: el usuario trabaja en su propio tenant, sin plan.
    }

    // appId = la app cuya suscripción paga el chat (la de plan más alto de la organización).
    const principal = { userId, tenantId, roles, plan, appId };
    cache.set(userId, { principal, exp: now() + CACHE_MS });
    if (cache.size > 5000) cache.delete(cache.keys().next().value);
    return principal;
}

module.exports = { resolverPrincipal, _cache: cache };
