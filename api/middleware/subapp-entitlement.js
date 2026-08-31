/**
 * subapp-entitlement.js — Puerta de entitlements por SubApp.
 *
 * El Gateway ya sabe qué plan tiene cada app registrada y qué SubApps ha
 * activado (`gateway_subscriptions`), pero hasta ahora ese contrato solo se
 * comprobaba en el SDK (@bezhas/connect, service.js). Comprobarlo SOLO en el
 * cliente no es una puerta: es una sugerencia — quien llame a la API con curl
 * se la salta entera.
 *
 * Este middleware es la comprobación del lado servidor. Debe ir DESPUÉS de
 * `authenticateGateway` (necesita `req.registeredApp`) y deja en
 * `req.subscription` el plan y los addons, para que la ruta no tenga que
 * volver a consultarlos.
 *
 * Fail-closed a propósito: si la consulta a la base de datos falla no se puede
 * afirmar que la app tenga derecho a la SubApp, y dar acceso "por si acaso"
 * sería regalar el servicio de pago ante cualquier incidencia de DB.
 */

'use strict';

const { query } = require('../db/pool');
const { CORE_SUBAPPS } = require('../config/plans');
const logger = require('pino')({ level: 'info', name: 'subapp-entitlement' });

const CACHE_TTL_MS = 30_000;
const cache = new Map(); // appId -> { sub, expiresAt }

/** Suscripción de una app (plan + addons). Sin fila => Starter sin addons. */
async function loadSubscription(appId) {
    const cached = cache.get(appId);
    if (cached && cached.expiresAt > Date.now()) return cached.sub;

    const { rows } = await query(
        'SELECT plan_id, subapps, status FROM gateway_subscriptions WHERE app_id = $1',
        [appId]
    );
    const row = rows[0];
    const sub = row
        ? {
            plan: row.plan_id,
            addons: Array.isArray(row.subapps) ? row.subapps : [],
            status: row.status,
        }
        : { plan: 'starter', addons: [], status: 'active' };

    cache.set(appId, { sub, expiresAt: Date.now() + CACHE_TTL_MS });
    return sub;
}

/**
 * Exige que la app llamante tenga activada la SubApp `subapp`.
 * @param {string} subapp
 */
function requireSubApp(subapp) {
    return async (req, res, next) => {
        if (!req.registeredApp) {
            return res.status(401).json({
                error: `Las rutas de "${subapp}" requieren autenticación por API key (x-api-key)`,
            });
        }

        try {
            const sub = await loadSubscription(req.registeredApp.id);

            if (sub.status !== 'active') {
                return res.status(402).json({
                    error: 'La suscripción no está activa',
                    status: sub.status,
                    subapp,
                });
            }

            const active = new Set([...CORE_SUBAPPS, ...sub.addons]);
            if (!active.has(subapp)) {
                return res.status(403).json({
                    error: `La SubApp "${subapp}" no está activada en esta suscripción`,
                    code: 'SUBAPP_NOT_ACTIVATED',
                    plan: sub.plan,
                    active: [...active],
                    activate: 'POST /api/gateway/v1/subscription/activate',
                });
            }

            req.subscription = sub;
            next();
        } catch (error) {
            // Fail-closed: sin poder verificar el derecho, no se sirve.
            logger.error({ error: error.message, subapp }, 'Entitlement check failed');
            return res.status(503).json({ error: 'No se pudo verificar la suscripción' });
        }
    };
}

module.exports = {
    requireSubApp,
    loadSubscription,
    _clearCacheForTests: () => cache.clear(),
};
