'use strict';

/**
 * Cupo mensual de acciones de IA del plan (config/plans.js: aiActions; null = ilimitadas).
 *
 * Qué cuenta como acción:
 *   · cada tools/call del MCP que termina bien, salvo las herramientas `gratuita`
 *     (estimar el coste, buscar en la documentación);
 *   · cada escritura del gateway REST (POST/PUT/PATCH/DELETE) que termina en 2xx/3xx.
 * Las lecturas REST no gastan cupo: con 600 llamadas por minuto, un Business que contara
 * cada consulta agotaría sus 15.000 acciones en 25 minutos. A esas las frena el límite
 * por minuto (middleware/plan-limits.js).
 *
 * El cupo es UNO por app y mes, compartido con el chat de la plataforma: el chat cuenta
 * sus mensajes en gateway_usage_ledger (action = 'ai_chat') y el REST/MCP en
 * ai_action_usage (migración 074). Los dos reservan bajo el mismo candado, así que entre
 * los dos no se pasan del límite aunque lleguen a la vez.
 *
 * Flujo: reservar() ANTES de ejecutar → anular() si la acción no se llegó a hacer
 * (error, denegación de la política). Igual que el chat y que la medición del Starter:
 * lo que falla no cuenta. Periodo = mes natural, el mismo date_trunc('month', NOW()).
 */

const { getPlan } = require('../config/plans');

/** Clave del candado de cupo. La usa también services/ai-workspace/billing.js. */
const clave = (appId) => `ai_quota:${appId}`;

/** Lo ya gastado este mes por la app, sumando chat y REST/MCP. $1 = app_id. */
const SQL_USADAS = `
    SELECT (SELECT COUNT(*) FROM gateway_usage_ledger
             WHERE app_id = $1 AND action = 'ai_chat' AND created_at >= date_trunc('month', NOW()))
         + COALESCE((SELECT used FROM ai_action_usage
                      WHERE app_id = $1 AND period = date_trunc('month', NOW())::date), 0) AS n`;

class AiQuotaError extends Error {
    constructor({ plan, limit, used }) {
        super(`Has usado las ${limit} acciones de IA de tu plan este mes. Mejora tu plan para seguir.`);
        this.name = 'AiQuotaError';
        this.status = 402;
        this.code = 'QUOTA_EXCEEDED';
        this.plan = plan;
        this.limit = limit;
        this.used = used;
        this.resetsAt = inicioMesSiguiente().toISOString();
        this.upgradeActionId = 'subscribe_plans';
    }
}

function inicioMesSiguiente(ahora = new Date()) {
    return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
}

/** Infinity = ilimitado. Un plan desconocido no tiene cupo (0): negar, no regalar. */
function limiteDe(planId) {
    const p = getPlan(planId);
    if (!p) return 0;
    return p.aiActions === null || p.aiActions === undefined ? Infinity : Number(p.aiActions);
}

/** Claves internas de BeZhas (scope admin): no consumen cupo de ningún plan. */
const esInterna = (app) => Array.isArray(app?.scopes) && app.scopes.includes('admin');

/**
 * @param {object} [deps]
 * @param {{query: Function, getClient: Function}} [deps.db]  sin db: contador en memoria (tests)
 */
function crearCupoAcciones({ db = null } = {}) {
    const memoria = new Map(); // `${appId}|${YYYY-MM}` → usadas
    const mes = () => new Date().toISOString().slice(0, 7);

    async function usadas(appId) {
        if (!db) return memoria.get(`${appId}|${mes()}`) || 0;
        const { rows } = await db.query(SQL_USADAS, [appId]);
        return Number(rows[0]?.n) || 0;
    }

    /**
     * Reserva una acción. Lanza AiQuotaError (402) si el cupo está agotado.
     * @returns {Promise<{appId:string, plan:string, used:number, limit:number|null}|{interna:true}>}
     */
    async function reservar({ app, plan }) {
        if (!app?.id || esInterna(app)) return { interna: true };
        const limite = limiteDe(plan);

        if (!db) {
            const k = `${app.id}|${mes()}`;
            const n = memoria.get(k) || 0;
            if (n >= limite) throw new AiQuotaError({ plan, limit: limite, used: n });
            memoria.set(k, n + 1);
            return { appId: app.id, plan, used: n + 1, limit: Number.isFinite(limite) ? limite : null };
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            let n = 0;
            if (Number.isFinite(limite)) {
                // Candado por app hasta el COMMIT: recuento y reserva son atómicos, también
                // frente a un mensaje del chat que llegue a la vez.
                await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [clave(app.id)]);
                const { rows } = await client.query(SQL_USADAS, [app.id]);
                n = Number(rows[0]?.n) || 0;
                if (n >= limite) {
                    await client.query('ROLLBACK');
                    throw new AiQuotaError({ plan, limit: limite, used: n });
                }
            }
            await client.query(
                `INSERT INTO ai_action_usage (app_id, period, used)
                 VALUES ($1, date_trunc('month', NOW())::date, 1)
                 ON CONFLICT (app_id, period) DO UPDATE
                    SET used = ai_action_usage.used + 1, updated_at = NOW()`,
                [app.id]
            );
            await client.query('COMMIT');
            return { appId: app.id, plan, used: n + 1, limit: Number.isFinite(limite) ? limite : null };
        } catch (err) {
            if (!(err instanceof AiQuotaError)) await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    /** Devuelve la acción si no se llegó a hacer. Idempotente: anular dos veces no resta dos. */
    async function anular(reserva) {
        if (!reserva || reserva.interna || reserva.anulada) return;
        reserva.anulada = true;
        if (!db) {
            const k = `${reserva.appId}|${mes()}`;
            memoria.set(k, Math.max(0, (memoria.get(k) || 0) - 1));
            return;
        }
        await db.query(
            `UPDATE ai_action_usage SET used = GREATEST(used - 1, 0), updated_at = NOW()
              WHERE app_id = $1 AND period = date_trunc('month', NOW())::date`,
            [reserva.appId]
        );
    }

    /** Consumo del mes para mostrarlo (/subscription/usage, bezhas_subscription). */
    async function consumo({ app, plan }) {
        const limite = limiteDe(plan);
        return {
            used: app?.id ? await usadas(app.id) : 0,
            limit: Number.isFinite(limite) ? limite : null,
            resetsAt: inicioMesSiguiente().toISOString(),
        };
    }

    return { reservar, anular, consumo, usadas };
}

let porDefecto = null;
/** Instancia de la app: Postgres, salvo en tests con KNOWLEDGE_STORE=memory (como el chat). */
function cupoAcciones() {
    if (!porDefecto) {
        porDefecto = process.env.KNOWLEDGE_STORE === 'memory'
            ? crearCupoAcciones()
            : crearCupoAcciones({ db: require('../db/pool') });
    }
    return porDefecto;
}

module.exports = {
    crearCupoAcciones, cupoAcciones, AiQuotaError, limiteDe, clave, SQL_USADAS,
    _resetForTests: () => { porDefecto = null; },
};
