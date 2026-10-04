'use strict';

/**
 * Cobro del chat de la plataforma al plan del cliente.
 *
 * Cada mensaje con IA lo paga la suscripción de la organización del usuario
 * (principal.appId, la app de plan más alto):
 *
 *   Creator Pro / Business / Enterprise VIP → consume 1 acción de IA de la cuota
 *     mensual del plan (config/plans.js: aiActions; null = ilimitadas). El coste
 *     real (tokens + cómputo) queda en gateway_usage_ledger para auditoría.
 *   Starter (pago por uso) → además se factura por su coste real + 25 %
 *     (config/usage-pricing.js) en créditos al medidor de Stripe; aiActions
 *     hace de tope mensual de gasto.
 *   Sin plan → 402 PLAN_REQUIRED. Cuota agotada → 402 QUOTA_EXCEEDED.
 *
 * Flujo por mensaje: reservar() ANTES de llamar al modelo (cuenta la cuota con
 * un candado por app, así dos mensajes simultáneos no se pasan del límite) →
 * liquidar() con los tokens reales → o anular() si no se generó nada.
 * Periodo = mes natural (UTC), igual que GET /subscription/usage del gateway.
 */
const { getPlan } = require('../../config/plans');
const { calculateCallCost } = require('../../config/usage-pricing');
const logger = require('../../utils/logger');

const ACCION = 'ai_chat';

class ChatBillingError extends Error {
    constructor(message, code, extra = {}) {
        super(message);
        this.status = 402;
        this.code = code;
        Object.assign(this, extra);
    }
}

const limiteDe = (plan) => {
    const p = getPlan(plan);
    if (!p) return 0;
    return p.aiActions === null || p.aiActions === undefined ? Infinity : Number(p.aiActions);
};

const esAdmin = (principal) => principal.roles.includes('ADMIN') || principal.roles.includes('SUPER_ADMIN');

function sinPlan() {
    return new ChatBillingError('Necesitas un plan para usar BeZhas AI. El plan Starter es de pago por uso y tiene 15 días de prueba.', 'PLAN_REQUIRED', { upgradeActionId: 'subscribe_plans' });
}
function cuotaAgotada(plan, limite) {
    return new ChatBillingError(`Has usado las ${limite} acciones de IA de tu plan este mes. Mejora tu plan para seguir.`, 'QUOTA_EXCEEDED', { upgradeActionId: 'subscribe_plans', plan, limit: limite });
}

/**
 * @param {object} deps
 * @param {{query: Function, getClient: Function}} [deps.db]
 * @param {(appId: string, credits: number, ref: string) => Promise<{reported: boolean}>} [deps.reportar]
 */
function crearFacturacionChat({ db = null, reportar = null } = {}) {
    const memoria = !db;
    const filas = new Map(); // solo en memoria (tests)
    let seq = 0;
    const reportarCreditos = reportar || ((...a) => require('../usageBilling').reportarCreditos(...a));

    const inicioMes = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };

    async function usadas(appId) {
        if (memoria) return [...filas.values()].filter((f) => f.appId === appId && f.at >= inicioMes()).length;
        const { rows } = await db.query(
            `SELECT COUNT(*)::int AS n FROM gateway_usage_ledger
              WHERE app_id = $1 AND action = '${ACCION}' AND created_at >= date_trunc('month', NOW())`,
            [appId]
        );
        return rows[0].n;
    }

    /** Reserva el mensaje contra la cuota del plan. Lanza ChatBillingError (402) si no procede. */
    async function reservar(principal) {
        if (!principal.appId) {
            // El equipo de BeZhas (admin de plataforma) puede usarlo sin plan; queda en el log.
            if (esAdmin(principal)) { logger.info({ userId: principal.userId }, 'chat de admin sin plan: uso interno'); return { interno: true }; }
            throw sinPlan();
        }
        const limite = limiteDe(principal.plan);
        if (limite <= 0) throw sinPlan();
        const meta = { estado: 'reservada', userId: principal.userId, plan: principal.plan };

        if (memoria) {
            const n = await usadas(principal.appId);
            if (n >= limite) throw cuotaAgotada(principal.plan, limite);
            const id = ++seq;
            filas.set(id, { id, appId: principal.appId, at: Date.now(), credits: 0, meta });
            return { id, appId: principal.appId, plan: principal.plan, used: n + 1, limit: limite };
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            // Candado por app hasta el COMMIT: el recuento y la reserva son atómicos.
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`ai_chat:${principal.appId}`]);
            let n = 0;
            if (Number.isFinite(limite)) {
                const { rows } = await client.query(
                    `SELECT COUNT(*)::int AS n FROM gateway_usage_ledger
                      WHERE app_id = $1 AND action = '${ACCION}' AND created_at >= date_trunc('month', NOW())`,
                    [principal.appId]
                );
                n = rows[0].n;
                if (n >= limite) { await client.query('ROLLBACK'); throw cuotaAgotada(principal.plan, limite); }
            }
            const { rows } = await client.query(
                `INSERT INTO gateway_usage_ledger (app_id, action, credits, billable_eur, raw_cost_eur, meta)
                 VALUES ($1, '${ACCION}', 0, 0, 0, $2::jsonb) RETURNING id`,
                [principal.appId, JSON.stringify(meta)]
            );
            await client.query('COMMIT');
            return { id: rows[0].id, appId: principal.appId, plan: principal.plan, used: n + 1, limit: limite };
        } catch (err) {
            if (!(err instanceof ChatBillingError)) await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    /** Liquida con los tokens reales. Starter: además lo factura en Stripe. */
    async function liquidar(reserva, { model, inputTokens = 0, outputTokens = 0, provider } = {}) {
        if (!reserva || reserva.interno) return null;
        const coste = calculateCallCost({ model, inputTokens, outputTokens, action: ACCION });
        const meta = { estado: 'liquidada', model, provider, inputTokens, outputTokens };

        if (memoria) {
            const f = filas.get(reserva.id);
            if (f) Object.assign(f, { credits: coste.credits, billableEUR: coste.billableEUR, meta: { ...f.meta, ...meta } });
        } else {
            await db.query(
                `UPDATE gateway_usage_ledger
                    SET credits = $2, billable_eur = $3, raw_cost_eur = $4, meta = meta || $5::jsonb
                  WHERE id = $1`,
                [reserva.id, coste.credits, coste.billableEUR, coste.rawCostEUR, JSON.stringify(meta)]
            );
        }

        let facturado = false;
        if (reserva.plan === 'starter') {
            const r = await reportarCreditos(reserva.appId, coste.credits, `ai_chat:${reserva.id}`).catch((e) => ({ reported: false, reason: e.message }));
            facturado = !!r.reported;
            if (facturado && !memoria) await db.query('UPDATE gateway_usage_ledger SET reported_at = NOW() WHERE id = $1', [reserva.id]).catch(() => {});
        }
        return {
            credits: coste.credits, billableEUR: coste.billableEUR, payg: reserva.plan === 'starter', facturado,
            used: reserva.used, limit: Number.isFinite(reserva.limit) ? reserva.limit : null,
        };
    }

    /** Si no se generó nada, el mensaje no cuenta. */
    async function anular(reserva) {
        if (!reserva || reserva.interno) return;
        if (memoria) { filas.delete(reserva.id); return; }
        await db.query(`DELETE FROM gateway_usage_ledger WHERE id = $1 AND action = '${ACCION}'`, [reserva.id]);
    }

    /** Consumo del mes para mostrarlo en el chat. */
    async function consumo(principal) {
        if (!principal.appId) return { plan: principal.plan, used: 0, limit: 0 };
        const limite = limiteDe(principal.plan);
        return { plan: principal.plan, used: await usadas(principal.appId), limit: Number.isFinite(limite) ? limite : null };
    }

    return { reservar, liquidar, anular, consumo, _filas: filas };
}

function crearFacturacionChatPorDefecto() {
    if (process.env.KNOWLEDGE_STORE === 'memory') return crearFacturacionChat();
    return crearFacturacionChat({ db: require('../../db/pool') });
}

module.exports = { crearFacturacionChat, crearFacturacionChatPorDefecto, ChatBillingError, ACCION };
