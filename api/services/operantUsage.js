/**
 * operantUsage — cuota, overage y facturación del consumo de OPERANT.
 *
 * ── El reparto ──────────────────────────────────────────────────────────────
 * Cada plan incluye N tareas al mes (`operant-services.PLAN_MATRIX`). Dentro de
 * la cuota, la tarea ya está pagada por la cuota fija. Por encima, se factura
 * por créditos al mismo precio del pago por uso (coste real × 1,25), que es el
 * mismo modelo del plan Starter — así el cliente nunca ve dos tarifas distintas
 * por el mismo trabajo.
 *
 * ── Dónde queda registrado ──────────────────────────────────────────────────
 *   operant_tasks         → detalle por tarea (lo que el cliente ve desglosado)
 *   gateway_usage_ledger  → ledger de facturación común a todo el Gateway
 *                           (vía usageBilling.recordUsage, que además reporta
 *                           al medidor de Stripe en el plan Starter)
 *
 * ── Por qué NO se cobra el overage en silencio ──────────────────────────────
 * Reportar consumo a Stripe exige que la app tenga un customer con el precio
 * medido asociado. Si no lo tiene, cobrar es imposible y regalar el cómputo es
 * una fuga: `checkQuota` devuelve entonces `blocked` y la ruta responde 402
 * diciendo exactamente qué hay que activar. Nunca se crea una suscripción de
 * pago por la espalda del cliente.
 */

'use strict';

const { query } = require('../db/pool');
const { recordUsage, METER_EVENT_NAME } = require('./usageBilling');
const { estimateTaskCost, PLAN_MATRIX, DEPARTMENT_BY_ID } = require('../config/operant-services');
const logger = require('pino')({ level: 'info', name: 'operant-usage' });

let _stripe = null;
function getStripe() {
    if (_stripe) return _stripe;
    if (!process.env.STRIPE_SECRET_KEY) return null;
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return _stripe;
}

/** Consumo del ciclo actual (mes natural) de una app. */
async function currentPeriodUsage(appId) {
    const { rows } = await query(
        `SELECT COUNT(*)::int AS tasks,
                COUNT(*) FILTER (WHERE tier = 'frontier')::int AS frontier_tasks,
                COUNT(*) FILTER (WHERE billed_as = 'payg')::int AS payg_tasks,
                COALESCE(SUM(credits), 0)::int AS credits,
                COALESCE(SUM(credits) FILTER (WHERE billed_as = 'payg'), 0)::int AS payg_credits,
                COALESCE(SUM(billable_eur) FILTER (WHERE billed_as = 'payg'), 0)::numeric AS payg_eur,
                COALESCE(SUM(raw_cost_eur), 0)::numeric AS raw_cost_eur,
                COALESCE(SUM(ai_actions), 0)::int AS ai_actions
           FROM operant_tasks
          WHERE app_id = $1 AND created_at >= date_trunc('month', NOW())`,
        [appId]
    );
    const u = rows[0];
    return {
        tasks: u.tasks,
        frontierTasks: u.frontier_tasks,
        paygTasks: u.payg_tasks,
        credits: u.credits,
        paygCredits: u.payg_credits,
        paygEUR: Number(u.payg_eur),
        rawCostEUR: Number(u.raw_cost_eur),
        aiActions: u.ai_actions,
    };
}

/** ¿Tiene la app un customer de Stripe al que poder facturar el overage? */
async function stripeCustomerOf(appId) {
    const { rows } = await query(
        `SELECT stripe_customer_id FROM gateway_subscriptions
          WHERE app_id = $1 AND status = 'active'`,
        [appId]
    ).catch(() => ({ rows: [] }));
    return rows[0]?.stripe_customer_id || null;
}

/**
 * ¿Puede ejecutarse una tarea más? Resuelve cuota vs overage ANTES de gastar
 * cómputo — no tiene sentido ejecutar agentes durante 20 segundos para después
 * descubrir que no se puede cobrar.
 *
 * @returns {{allowed:boolean, billedAs:'quota'|'payg', reason?:string,
 *            used:number, included:number|null, remaining:number|null}}
 */
async function checkQuota({ appId, planId, department }) {
    const plan = PLAN_MATRIX[planId] || PLAN_MATRIX.starter;
    const dept = DEPARTMENT_BY_ID[department];
    const usage = await currentPeriodUsage(appId);

    const included = plan.includedTasks;
    const remaining = included === null ? null : Math.max(0, included - usage.tasks);

    // Tope de tareas frontier dentro de la cuota: una tarea frontier cuesta un
    // 55% más que una mid, así que la cuota no puede ser indiferente al mix.
    const frontierExhausted = dept?.tier === 'frontier' &&
        plan.frontierCap !== null && usage.frontierTasks >= plan.frontierCap;

    const withinQuota = included !== null && included > 0 && remaining > 0 && !frontierExhausted;
    if (withinQuota) {
        return { allowed: true, billedAs: 'quota', used: usage.tasks, included, remaining };
    }

    // Fuera de cuota → pago por uso. El plan Starter ya nace así.
    if (planId === 'starter') {
        return { allowed: true, billedAs: 'payg', used: usage.tasks, included, remaining };
    }

    const customerId = await stripeCustomerOf(appId);
    if (!customerId) {
        return {
            allowed: false,
            billedAs: 'payg',
            reason: frontierExhausted
                ? `Agotado el tope de ${plan.frontierCap} tareas frontier del plan ${planId}. Para seguir hace falta activar el pago por uso.`
                : `Agotadas las ${included} tareas incluidas en el plan ${planId}. Para seguir hace falta activar el pago por uso.`,
            code: 'QUOTA_EXHAUSTED',
            used: usage.tasks, included, remaining: 0,
            activate: 'POST /api/gateway/v1/subscription/starter/subscribe (habilita el medidor de consumo)',
        };
    }

    return { allowed: true, billedAs: 'payg', used: usage.tasks, included, remaining: 0, customerId };
}

/**
 * Registra una tarea ejecutada: detalle, ledger de facturación y — si es
 * overage de un plan de pago — evento en el medidor de Stripe.
 *
 * @param {{appId:string, tenantId:string, taskId:string, department:string,
 *          planId:string, billedAs:'quota'|'payg', status?:string,
 *          auditHash?:string, usage?:{inputTokens:number, outputTokens:number, specialists:number}}} args
 */
async function recordTask(args) {
    const { appId, tenantId, taskId, department, planId, billedAs, status = 'completed', auditHash } = args;
    const reported = args.usage || {};

    // Los tokens reportados solo se usan si OPERANT los pudo atribuir a ESTA
    // tarea (`attribution: 'exact'`). Mide el consumo por tenant, no por tarea,
    // así que con varias tareas en paralelo el delta mezcla trabajos ajenos y
    // llega marcado como 'shared'. Facturar sobre ese número sería cobrar
    // ruido: se cae al perfil estimado del catálogo, que es el suelo del coste.
    const measured = reported.attribution === 'exact' &&
        (reported.inputTokens > 0 || reported.outputTokens > 0);

    const cost = estimateTaskCost(department, {
        inputTokens: measured ? reported.inputTokens : undefined,
        outputTokens: measured ? reported.outputTokens : undefined,
        // El número de especialistas sí es fiable aunque los tokens no lo sean:
        // sale de contar las llamadas de esta tarea, no de un acumulador compartido.
        specialists: reported.specialists,
    });

    await query(
        `INSERT INTO operant_tasks
           (app_id, tenant_id, task_id, department, tier, model, input_tokens, output_tokens,
            ai_actions, credits, billable_eur, raw_cost_eur, billed_as, status, audit_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (app_id, task_id) DO NOTHING`,
        [appId, tenantId, taskId, department, cost.tier, cost.model,
         cost.inputTokens, cost.outputTokens, cost.aiActions, cost.credits,
         cost.billableEUR, cost.rawCostEUR, billedAs,
         // Queda escrito si el coste salió de tokens medidos o del perfil
         // estimado: sin eso, una reclamación de factura no se puede resolver
         // mirando la fila.
         measured ? status : `${status}:estimated`,
         auditHash ? String(auditHash).replace(/^0x/, '') : null]
    );

    // Ledger común del Gateway (auditoría + medidor de Stripe en Starter).
    await recordUsage(appId, {
        model: cost.model,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        action: 'operant_task',
        ref: `operant:${taskId}`,
    }).catch((e) => logger.error({ taskId, error: e.message }, 'No se pudo registrar el uso en el ledger'));

    // Overage de un plan de pago: `recordUsage` no lo reporta (solo mide
    // Starter), así que se manda aquí — al MISMO medidor, para que el cliente
    // vea una sola línea de consumo en su factura.
    if (billedAs === 'payg' && planId !== 'starter') {
        await reportOverage({ appId, taskId, credits: cost.credits });
    }

    return { ...cost, measured };
}

async function reportOverage({ appId, taskId, credits }) {
    const stripe = getStripe();
    if (!stripe) return { reported: false, reason: 'stripe_no_configurado' };
    const customerId = await stripeCustomerOf(appId);
    if (!customerId) return { reported: false, reason: 'sin_customer' };
    try {
        await stripe.billing.meterEvents.create({
            event_name: METER_EVENT_NAME,
            payload: { stripe_customer_id: customerId, value: String(credits) },
            identifier: `${appId}:operant:${taskId}`,
        });
        return { reported: true };
    } catch (e) {
        // El ledger ya guarda la tarea como 'payg': la conciliación posterior
        // la recupera. No romper la respuesta al cliente por esto.
        logger.error({ appId, taskId, error: e.message }, 'Overage no reportado a Stripe (queda en el ledger)');
        return { reported: false, reason: e.message };
    }
}

/** Resumen para el panel del cliente: cuota, overage y coste. */
async function usageSummary({ appId, planId }) {
    const plan = PLAN_MATRIX[planId] || PLAN_MATRIX.starter;
    const usage = await currentPeriodUsage(appId);
    const included = plan.includedTasks;

    const { rows: byDept } = await query(
        `SELECT department, COUNT(*)::int AS tasks, COALESCE(SUM(credits),0)::int AS credits
           FROM operant_tasks
          WHERE app_id = $1 AND created_at >= date_trunc('month', NOW())
          GROUP BY department ORDER BY tasks DESC`,
        [appId]
    );

    return {
        period: 'mes_en_curso',
        planId: plan.planId,
        quota: {
            includedTasks: included,
            usedTasks: usage.tasks,
            remainingTasks: included === null ? null : Math.max(0, included - usage.tasks),
            frontierCap: plan.frontierCap,
            frontierUsed: usage.frontierTasks,
        },
        overage: {
            tasks: usage.paygTasks,
            credits: usage.paygCredits,
            eur: Number(usage.paygEUR.toFixed(4)),
        },
        totals: {
            tasks: usage.tasks,
            credits: usage.credits,
            aiActions: usage.aiActions,
            underlyingCostEUR: Number(usage.rawCostEUR.toFixed(4)),
        },
        byDepartment: byDept,
    };
}

module.exports = {
    currentPeriodUsage,
    checkQuota,
    recordTask,
    usageSummary,
};
