'use strict';

/**
 * Límites del plan en el gateway REST: llamadas por minuto por api-key y cupo
 * mensual de acciones de IA.
 *
 * Hasta ahora el REST sólo tenía el limitador global por IP (config/rateLimit.js):
 * un Starter y un Enterprise tenían el mismo techo, y el cupo `aiActions` se
 * anunciaba sin aplicarse en ninguna parte. El MCP ya limitaba por plan; esto
 * iguala el REST con los mismos números (plan-entitlements.js: apiPorMinuto),
 * en un contador separado para que el uso de uno no gaste el del otro.
 *
 * Uso: en lugar de `authenticateGateway`, las rutas montan `autenticarConPlan`
 * (un array de middlewares: autenticar → plan → límite/minuto → cupo), o
 * `autenticarSinCupo` las de gestión de la cuenta.
 *
 * Sin api-key (JWT de usuario de la plataforma) no se aplica ni el límite ni el
 * cupo: ese camino lo cubren el limitador global y el plan de su organización
 * en el chat. Las claves internas (scope `admin`) tampoco gastan cupo.
 */

const rateLimit = require('express-rate-limit');
const { authenticateGateway } = require('./gateway-auth');
const { resolverPlan } = require('./resolve-plan');
const { SharedRateLimitStore } = require('../utils/sharedRateLimitStore');
const { cupoAcciones, AiQuotaError } = require('../services/aiActionQuota');
const logger = require('../utils/logger');

const LECTURAS = new Set(['GET', 'HEAD', 'OPTIONS']);
const esInterna = (app) => Array.isArray(app?.scopes) && app.scopes.includes('admin');

/**
 * Por api-key (id de la app, nunca la clave en claro: el contador vive en Redis),
 * con el techo de su plan, y compartido entre instancias de Cloud Run.
 */
const limitePorMinutoApi = rateLimit({
    windowMs: 60 * 1000,
    max: (req) => req.entitlements?.limites?.apiPorMinuto || 30,
    keyGenerator: (req) => `app:${req.registeredApp.id}`,
    skip: (req) => !req.registeredApp || esInterna(req.registeredApp),
    store: new SharedRateLimitStore({ prefix: 'rl:gw-api' }),
    message: (req) => ({
        error: `Has superado las ${req.entitlements?.limites?.apiPorMinuto || 30} llamadas por minuto de tu plan.`,
        code: 'PLAN_RATE_LIMIT',
        plan: req.plan,
    }),
    standardHeaders: true,
    legacyHeaders: false,
});

/** Respuesta 402 común al REST. El MCP la da como resultado de herramienta. */
function cuerpoCupoAgotado(err) {
    return {
        error: err.message, code: err.code, plan: err.plan,
        limit: err.limit, used: err.used, resetsAt: err.resetsAt, upgradeActionId: err.upgradeActionId,
    };
}

/**
 * Cupo mensual: cada escritura (POST/PUT/PATCH/DELETE) gasta una acción antes de
 * ejecutarse; si la respuesta acaba en 4xx/5xx, se devuelve. Las lecturas no gastan.
 */
async function cupoMensual(req, res, next) {
    const app = req.registeredApp;
    if (!app || LECTURAS.has(req.method) || esInterna(app)) return next();

    let reserva;
    try {
        reserva = await cupoAcciones().reservar({ app, plan: req.plan });
    } catch (err) {
        if (err instanceof AiQuotaError) {
            logger.info({ appId: app.id, plan: req.plan, limit: err.limit }, 'Cupo mensual de acciones de IA agotado');
            return res.status(402).json(cuerpoCupoAgotado(err));
        }
        // Sin poder comprobar el cupo no se ejecuta la escritura: dejarla pasar
        // sería servir gratis justo cuando no se puede contar.
        logger.error({ appId: app.id, error: err.message }, 'No se pudo comprobar el cupo de acciones de IA');
        return res.status(503).json({ error: 'No se pudo comprobar el cupo de tu plan. Inténtalo de nuevo.', code: 'QUOTA_UNAVAILABLE' });
    }

    if (reserva?.limit !== undefined) {
        res.setHeader('X-AI-Actions-Limit', reserva.limit === null ? 'unlimited' : String(reserva.limit));
        res.setHeader('X-AI-Actions-Used', String(reserva.used));
    }
    res.on('finish', () => {
        if (res.statusCode >= 400) {
            cupoAcciones().anular(reserva).catch((err) => logger.warn({ appId: app.id, error: err.message }, 'No se pudo devolver la acción de IA'));
        }
    });
    next();
}

const autenticarConPlan = [authenticateGateway, resolverPlan, limitePorMinutoApi, cupoMensual];

/**
 * Para la gestión de la propia cuenta (suscripción, webhooks, privacidad): límite por
 * minuto sí, cupo no. Gestionar la cuenta no es una acción de IA, y un cliente con el
 * cupo agotado tiene que poder seguir ampliando su plan.
 */
const autenticarSinCupo = [authenticateGateway, resolverPlan, limitePorMinutoApi];

module.exports = { autenticarConPlan, autenticarSinCupo, limitePorMinutoApi, cupoMensual, cuerpoCupoAgotado };
