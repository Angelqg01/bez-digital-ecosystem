/**
 * gateway-metering.js — Medición de uso API-SDK para el plan Starter
 * (pago por uso).
 *
 * Solo las apps con plan Starter facturan por llamada; el resto (Creator
 * Pro/Business/Enterprise VIP) ya paga cuota fija y no se mide aquí.
 *
 * Se engancha DESPUÉS de authenticateGateway (necesita req.registeredApp) y
 * ANTES del handler de la ruta. Reporta en res.on('finish') para no añadir
 * latencia a la respuesta real, y solo cuenta peticiones 2xx — un 4xx/5xx
 * no debe facturarse como uso.
 *
 * Cachea el plan de cada app 60s para no consultar gateway_subscriptions en
 * cada request.
 */

'use strict';

const { query } = require('../db/pool');
const { recordUsage } = require('../services/usageBilling');

const PLAN_CACHE_TTL_MS = 60_000;
const planCache = new Map(); // appId -> { plan, expiresAt }

async function isStarterApp(appId) {
    const cached = planCache.get(appId);
    if (cached && cached.expiresAt > Date.now()) return cached.plan === 'starter';

    let plan = 'starter'; // sin fila en gateway_subscriptions => Starter (default)
    try {
        const { rows } = await query(
            'SELECT plan_id FROM gateway_subscriptions WHERE app_id = $1',
            [appId]
        );
        if (rows.length > 0) plan = rows[0].plan_id;
    } catch (e) {
        // Fail-open: si la DB falla, no facturamos por incertidumbre.
        return false;
    }

    planCache.set(appId, { plan, expiresAt: Date.now() + PLAN_CACHE_TTL_MS });
    return plan === 'starter';
}

/**
 * @param {string} action — clave de coste de cómputo en usage-pricing.js
 *   ('api_call' | 'ai_action' | 'oracle_query' | 'onchain_relay' | ...)
 */
function meterUsage(action = 'api_call') {
    return (req, res, next) => {
        // req.registeredApp aún puede no existir aquí: este middleware puede
        // correr ANTES de authenticateGateway en la cadena de la ruta (p.ej.
        // cuando se registra como router.use() global). Por eso se lee
        // perezosamente dentro de res.on('finish'), cuando la petición ya
        // ha pasado por completo por el auth y el handler de la ruta.
        res.on('finish', () => {
            const app = req.registeredApp;
            if (!app) return; // SSO, internal-key, checkout público, etc.
            if (res.statusCode >= 400) return; // no facturar errores
            isStarterApp(app.id)
                .then((isStarter) => {
                    if (!isStarter) return;
                    return recordUsage(app.id, { action, ref: req.id || undefined });
                })
                .catch((e) => {
                    // Nunca debe tumbar el request — el ledger local en
                    // usageBilling.js ya guarda el intento para reconciliar.
                    console.error('[gateway-metering] recordUsage failed:', e.message);
                });
        });

        next();
    };
}

module.exports = {
    meterUsage,
    // Solo para tests — el cache de 60s en memoria no debe sobrevivir entre casos.
    _clearPlanCacheForTests: () => planCache.clear(),
};
