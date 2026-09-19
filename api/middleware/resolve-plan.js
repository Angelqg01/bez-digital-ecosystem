'use strict';

/**
 * Resuelve el plan contratado de la api-key y deja sus derechos en la petición.
 *
 * Extraído de routes/mcp-gateway.js para que el MCP y la capa transaccional
 * lean el plan de la misma forma: dos copias acabarían divergiendo, y aquí
 * divergir es que un sitio conceda límites de enterprise a un starter.
 *
 * Si la consulta falla se cae al plan MÁS RESTRICTIVO: una base que no responde
 * no es motivo para regalar el catálogo ni los límites de enterprise.
 */

const { query } = require('../db/pool');
const { getEntitlements, PLAN_POR_DEFECTO } = require('../config/plan-entitlements');
const logger = require('../utils/logger');

async function resolverPlan(req, _res, next) {
    let plan = PLAN_POR_DEFECTO;
    if (req.registeredApp?.id) {
        try {
            const { rows } = await query(
                `SELECT plan_id FROM gateway_subscriptions
                  WHERE app_id = $1 AND status = 'active' LIMIT 1`,
                [req.registeredApp.id]
            );
            if (rows.length > 0 && rows[0].plan_id) plan = rows[0].plan_id;
        } catch (err) {
            logger.warn({ appId: req.registeredApp.id, error: err.message },
                'No se pudo resolver el plan; se aplica el más restrictivo');
        }
    }
    req.plan = plan;
    req.entitlements = getEntitlements(plan);
    next();
}

module.exports = { resolverPlan };
