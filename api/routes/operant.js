/**
 * routes/operant.js — OPERANT como SubApp del ecosistema BeZhas.
 *
 * OPERANT es la plataforma de gestión empresarial autónoma: 10 departamentos de
 * agentes IA (ventas, soporte, marketing, finanzas, RRHH, operaciones, legal,
 * blockchain ops, tesorería, fundraising) con guardarraíles, aprobaciones
 * humanas y una cadena de auditoría encadenada por hash.
 *
 * Esta ruta es su superficie comercial dentro de BeZhas. El reparto de
 * responsabilidades es deliberado:
 *
 *   BeZhas (aquí)   → identidad de la app, entitlements del plan, cuota,
 *                     medición, facturación y anclaje on-chain de la auditoría.
 *   OPERANT (allí)  → ejecutar los agentes.
 *
 * Ningún cliente habla directamente con OPERANT: se autentica contra el Gateway
 * con su api-key de siempre y es BeZhas quien decide si tiene derecho, cuánto
 * cuesta y lo apunta.
 *
 * Endpoints:
 *   GET  /api/operant/catalog                 — Catálogo y tarifas (público)
 *   GET  /api/operant/health                  — Estado del runtime
 *   GET  /api/operant/entitlements            — Qué desbloquea el plan de la app
 *   GET  /api/operant/departments             — Departamentos disponibles
 *   POST /api/operant/tenants/provision       — Alta/reconfiguración del tenant
 *   GET  /api/operant/tenants/me              — Tenant de la app llamante
 *   POST /api/operant/tasks                   — Lanza una tarea a un departamento
 *   GET  /api/operant/tasks/:taskId           — Estado y traza de una tarea
 *   GET  /api/operant/approvals               — Cola HITL
 *   POST /api/operant/approvals/:approvalId   — Aprueba o rechaza
 *   GET  /api/operant/usage                   — Cuota, overage y coste del ciclo
 *   POST /api/operant/audit/anchor            — Ancla el tramo pendiente en L2
 *   GET  /api/operant/audit/verify            — Integridad de la cadena
 *   GET  /api/operant/audit/proof/:auditHash  — Prueba de inclusión on-chain
 */

'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');

const { authenticateGateway } = require('../middleware/gateway-auth');
const { requireSubApp } = require('../middleware/subapp-entitlement');
const { meterUsage } = require('../middleware/gateway-metering');
const { query } = require('../db/pool');
const operant = require('../services/operantBridge');
const operantUsage = require('../services/operantUsage');
const operantAnchor = require('../services/operantAnchor');
const {
    describeCatalog, resolveEntitlements, planAllowsDepartment,
    PLAN_MATRIX, DEPARTMENTS, DEPARTMENT_BY_ID, estimateTaskCost,
} = require('../config/operant-services');
const logger = require('pino')({ level: 'info', name: 'operant' });

const router = Router();

// Toda la SubApp se mide como llamada API estándar; las tareas suman aparte su
// propio coste (operantUsage.recordTask), que es donde está el gasto real.
router.use(meterUsage('api_call'));

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Parámetros inválidos', details: errors.array() });
        return false;
    }
    return true;
}

/** Traduce un error del puente a una respuesta HTTP honesta. */
function sendBridgeError(res, err, fallback) {
    if (err.code === 'OPERANT_UNAVAILABLE') {
        return res.status(503).json({ error: err.message, code: err.code, circuit: operant.circuitState() });
    }
    if (err.code === 'OPERANT_ERROR') {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.body });
    }
    logger.error({ error: err.message }, fallback);
    return res.status(500).json({ error: fallback });
}

/** Tenant de OPERANT vinculado a la app llamante. */
async function loadTenant(appId) {
    const { rows } = await query(
        `SELECT tenant_id, plan_id, departments, autonomy, anchor_mode, wallet_address, status
           FROM operant_tenants WHERE app_id = $1`,
        [appId]
    );
    return rows[0] || null;
}

/** Middleware: exige que la app ya tenga tenant aprovisionado. */
async function requireTenant(req, res, next) {
    try {
        const tenant = await loadTenant(req.registeredApp.id);
        if (!tenant) {
            return res.status(409).json({
                error: 'Esta app todavía no tiene un tenant de OPERANT',
                code: 'TENANT_NOT_PROVISIONED',
                provision: 'POST /api/operant/tenants/provision',
            });
        }
        if (tenant.status !== 'active') {
            return res.status(402).json({ error: `Tenant ${tenant.status}`, code: 'TENANT_INACTIVE' });
        }
        req.operantTenant = tenant;
        next();
    } catch (error) {
        logger.error({ error: error.message }, 'No se pudo cargar el tenant');
        res.status(500).json({ error: 'No se pudo cargar el tenant de OPERANT' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CATÁLOGO Y ESTADO — sin entitlement (es la vitrina; también sirve el upsell)
// ═══════════════════════════════════════════════════════════════════════════

/** GET /catalog — qué ofrece OPERANT, por plan, y a qué precio. Público. */
router.get('/catalog', (_req, res) => {
    res.json({ success: true, ...describeCatalog() });
});

/** GET /health — ¿responde el runtime de agentes? */
router.get('/health', async (_req, res) => {
    const h = await operant.health();
    res.status(h.available ? 200 : 503).json({ success: h.available, subapp: 'operant', ...h });
});

/**
 * GET /entitlements — qué desbloquea el plan de ESTA app.
 * A propósito no está gateado: una app sin OPERANT activado necesita poder
 * consultar qué le daría activarlo sin recibir un 403 opaco.
 */
router.get('/entitlements', authenticateGateway, async (req, res) => {
    if (!req.registeredApp) {
        return res.status(401).json({ error: 'Requiere autenticación por API key (x-api-key)' });
    }
    try {
        const { loadSubscription } = require('../middleware/subapp-entitlement');
        const sub = await loadSubscription(req.registeredApp.id);
        const ent = resolveEntitlements(sub.plan, sub.addons);
        const tenant = await loadTenant(req.registeredApp.id);
        res.json({
            success: true,
            ...ent,
            provisioned: Boolean(tenant),
            tenantId: tenant?.tenant_id || null,
            activate: ent.enabled ? null : 'POST /api/gateway/v1/subscription/activate {"subapp":"operant"}',
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Entitlements de OPERANT');
        res.status(500).json({ error: 'No se pudieron resolver los entitlements' });
    }
});

/** GET /departments — departamentos que el plan de la app puede usar. */
router.get('/departments', authenticateGateway, requireSubApp('operant'), (req, res) => {
    const plan = PLAN_MATRIX[req.subscription.plan] || PLAN_MATRIX.starter;
    res.json({
        success: true,
        planId: plan.planId,
        departments: DEPARTMENTS.map((d) => ({
            id: d.id,
            label: d.label,
            tier: d.tier,
            services: d.services,
            requiresHitl: d.redLines,
            available: plan.departments.includes(d.id),
            pricePerTaskEUR: estimateTaskCost(d.id).billableEUR,
            aiActionsPerTask: estimateTaskCost(d.id).aiActions,
        })),
    });
});

// ═══════════════════════════════════════════════════════════════════════════
//  TENANT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /tenants/provision — crea (o reconfigura) el tenant de esta app en
 * OPERANT con los límites de su plan. Idempotente.
 *
 * Los límites NO los elige el cliente: se derivan del plan. Aceptar
 * `maxConcurrent` del body sería dejar que cualquiera se auto-asigne el
 * throughput de Enterprise.
 */
router.post('/tenants/provision', authenticateGateway, requireSubApp('operant'), [
    body('departments').optional().isArray(),
    body('walletAddress').optional().isEthereumAddress(),
    body('businessId').optional().isString(),
], async (req, res) => {
    if (!validate(req, res)) return;

    const planId = req.subscription.plan;
    const plan = PLAN_MATRIX[planId] || PLAN_MATRIX.starter;

    // Departamentos pedidos ∩ permitidos por el plan. Pedir uno fuera del plan
    // es un error explícito, no un recorte silencioso: el cliente cree que lo
    // ha contratado y merece saber que no.
    const requested = req.body.departments || plan.departments;
    const notAllowed = requested.filter((d) => !plan.departments.includes(d));
    if (notAllowed.length > 0) {
        return res.status(403).json({
            error: `El plan ${planId} no incluye: ${notAllowed.join(', ')}`,
            code: 'DEPARTMENT_NOT_IN_PLAN',
            available: plan.departments,
            upgradeTo: Object.values(PLAN_MATRIX)
                .filter((p) => notAllowed.every((d) => p.departments.includes(d)))
                .map((p) => p.planId),
        });
    }
    const unknown = requested.filter((d) => !DEPARTMENT_BY_ID[d]);
    if (unknown.length > 0) {
        return res.status(400).json({ error: `Departamentos desconocidos: ${unknown.join(', ')}` });
    }

    // OPERANT valida el tenantId contra /^[a-z0-9][a-z0-9-]{1,38}$/: ni guion
    // bajo ni mayúsculas, máximo 39 caracteres. El UUID de la app sin guiones
    // recortado a 24 hex (96 bits) cabe y sigue siendo único.
    const tenantId = `bez-${String(req.registeredApp.id).replace(/-/g, '').toLowerCase().slice(0, 24)}`;
    const limits = {
        maxConcurrentTasks: plan.maxConcurrent,
        maxRequestsPerMinute: plan.rpm,
        maxAgentCallsMonth: plan.includedTasks === null ? null : plan.includedTasks * 3,
        autonomy: plan.autonomy,
        retentionDays: plan.retentionDays,
    };

    try {
        const remote = await operant.provisionTenant({
            tenantId, planId, departments: requested, limits,
            businessId: req.body.businessId,
        });

        await query(
            `INSERT INTO operant_tenants
               (app_id, tenant_id, plan_id, departments, autonomy, anchor_mode, wallet_address)
             VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
             ON CONFLICT (app_id) DO UPDATE
               SET plan_id = EXCLUDED.plan_id, departments = EXCLUDED.departments,
                   autonomy = EXCLUDED.autonomy, anchor_mode = EXCLUDED.anchor_mode,
                   wallet_address = COALESCE(EXCLUDED.wallet_address, operant_tenants.wallet_address),
                   status = 'active', updated_at = NOW()`,
            [req.registeredApp.id, tenantId, planId, JSON.stringify(requested),
             plan.autonomy, plan.anchor, req.body.walletAddress || null]
        );

        res.json({
            success: true,
            tenantId,
            planId,
            departments: requested,
            limits,
            anchor: plan.anchor,
            onchain: plan.onchain,
            runtime: remote,
        });
    } catch (error) {
        sendBridgeError(res, error, 'No se pudo aprovisionar el tenant de OPERANT');
    }
});

/** GET /tenants/me — configuración actual del tenant de esta app. */
router.get('/tenants/me', authenticateGateway, requireSubApp('operant'), requireTenant, async (req, res) => {
    const t = req.operantTenant;
    res.json({
        success: true,
        tenantId: t.tenant_id,
        planId: t.plan_id,
        departments: t.departments,
        autonomy: t.autonomy,
        anchorMode: t.anchor_mode,
        walletAddress: t.wallet_address,
        status: t.status,
    });
});

// ═══════════════════════════════════════════════════════════════════════════
//  TAREAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /tasks — lanza una tarea a un departamento.
 *
 * Orden deliberado: entitlement → departamento en plan → CUOTA → ejecutar.
 * La cuota se comprueba antes de despachar porque una tarea puede tardar
 * decenas de segundos de cómputo real; descubrir después que no se puede
 * cobrar sería regalar ese cómputo.
 */
router.post('/tasks', authenticateGateway, requireSubApp('operant'), requireTenant, [
    body('department').isString().notEmpty(),
    body('input').isString().notEmpty().isLength({ max: 20_000 }),
    body('context').optional().isObject(),
    body('async').optional().isBoolean(),
], async (req, res) => {
    if (!validate(req, res)) return;

    const { department, input, context } = req.body;
    const planId = req.subscription.plan;
    const appId = req.registeredApp.id;
    const tenantId = req.operantTenant.tenant_id;

    if (!DEPARTMENT_BY_ID[department]) {
        return res.status(400).json({ error: `Departamento desconocido: ${department}`,
            departments: DEPARTMENTS.map((d) => d.id) });
    }
    if (!planAllowsDepartment(planId, department)) {
        return res.status(403).json({
            error: `El plan ${planId} no incluye el departamento "${department}"`,
            code: 'DEPARTMENT_NOT_IN_PLAN',
            available: (PLAN_MATRIX[planId] || PLAN_MATRIX.starter).departments,
        });
    }

    let quota;
    try {
        quota = await operantUsage.checkQuota({ appId, planId, department });
    } catch (error) {
        logger.error({ error: error.message }, 'Comprobación de cuota fallida');
        return res.status(503).json({ error: 'No se pudo comprobar la cuota' });
    }
    if (!quota.allowed) {
        return res.status(402).json({
            error: quota.reason, code: quota.code,
            used: quota.used, included: quota.included, activate: quota.activate,
            estimatedCostEUR: estimateTaskCost(department).billableEUR,
        });
    }

    try {
        const result = await operant.dispatchTask({
            tenantId, department, input, context,
            autonomy: req.operantTenant.autonomy,
            async: req.body.async === true,
        });

        // Se apunta con los tokens REALES si OPERANT los reporta; si no, con el
        // perfil estimado del catálogo (que es el suelo, nunca por debajo del coste).
        const cost = await operantUsage.recordTask({
            appId, tenantId, planId, department,
            taskId: result.taskId || result.id,
            billedAs: quota.billedAs,
            status: result.status || 'completed',
            auditHash: result.auditHash,
            usage: result.usage,
        });

        res.json({
            success: true,
            taskId: result.taskId || result.id,
            department,
            status: result.status,
            output: result.output,
            requiresApproval: result.requiresApproval || false,
            approvalId: result.approvalId || null,
            auditHash: result.auditHash || null,
            billing: {
                billedAs: quota.billedAs,
                credits: cost.credits,
                billableEUR: cost.billableEUR,
                aiActions: cost.aiActions,
                model: cost.model,
                basis: cost.measured ? 'medido' : 'estimado',
                remainingTasks: quota.billedAs === 'quota' ? Math.max(0, (quota.remaining || 1) - 1) : 0,
            },
        });
    } catch (error) {
        sendBridgeError(res, error, 'No se pudo ejecutar la tarea');
    }
});

/** GET /tasks/:taskId — estado y traza. */
router.get('/tasks/:taskId', authenticateGateway, requireSubApp('operant'), requireTenant, [
    param('taskId').isString().notEmpty(),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const remote = await operant.getTask({ tenantId: req.operantTenant.tenant_id, taskId: req.params.taskId });
        const { rows } = await query(
            `SELECT department, tier, model, credits, billable_eur, billed_as, audit_hash, created_at
               FROM operant_tasks WHERE app_id = $1 AND task_id = $2`,
            [req.registeredApp.id, req.params.taskId]
        );
        res.json({ success: true, ...remote, billing: rows[0] || null });
    } catch (error) {
        sendBridgeError(res, error, 'No se pudo leer la tarea');
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  APROBACIONES HUMANAS (HITL)
// ═══════════════════════════════════════════════════════════════════════════

/** GET /approvals — cola de aprobaciones pendientes. */
router.get('/approvals', authenticateGateway, requireSubApp('operant'), requireTenant, async (req, res) => {
    try {
        const remote = await operant.listApprovals({ tenantId: req.operantTenant.tenant_id });
        res.json({ success: true, ...remote });
    } catch (error) {
        sendBridgeError(res, error, 'No se pudo leer la cola de aprobaciones');
    }
});

/**
 * POST /approvals/:approvalId — resuelve una aprobación.
 * Con `onchainHitl` en el plan, la decisión entra en la cadena de auditoría y
 * queda cubierta por el siguiente anclaje merkle.
 */
router.post('/approvals/:approvalId', authenticateGateway, requireSubApp('operant'), requireTenant, [
    param('approvalId').isString().notEmpty(),
    body('decision').isIn(['approve', 'reject']),
    body('reason').optional().isString().isLength({ max: 2_000 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const remote = await operant.resolveApproval({
            tenantId: req.operantTenant.tenant_id,
            approvalId: req.params.approvalId,
            decision: req.body.decision,
            reason: req.body.reason,
            approver: req.user?.address || req.registeredApp.name,
        });
        res.json({ success: true, ...remote });
    } catch (error) {
        sendBridgeError(res, error, 'No se pudo resolver la aprobación');
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  CONSUMO
// ═══════════════════════════════════════════════════════════════════════════

/** GET /usage — cuota, overage y coste del ciclo. */
router.get('/usage', authenticateGateway, requireSubApp('operant'), async (req, res) => {
    try {
        const summary = await operantUsage.usageSummary({
            appId: req.registeredApp.id,
            planId: req.subscription.plan,
        });
        res.json({ success: true, ...summary });
    } catch (error) {
        logger.error({ error: error.message }, 'Resumen de consumo');
        res.status(500).json({ error: 'No se pudo calcular el consumo' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  AUDITORÍA ON-CHAIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /audit/anchor — ancla en L2 la raíz merkle del tramo pendiente.
 * Solo para planes con anclaje (`auditAnchor` en las capacidades del plan):
 * en Starter la cadena de auditoría existe, pero no se notariza.
 */
router.post('/audit/anchor', authenticateGateway, requireSubApp('operant'), requireTenant, async (req, res) => {
    const plan = PLAN_MATRIX[req.subscription.plan] || PLAN_MATRIX.starter;
    if (!plan.onchain.includes('auditAnchor')) {
        return res.status(403).json({
            error: `El plan ${plan.planId} no incluye anclaje on-chain de la auditoría`,
            code: 'ANCHOR_NOT_IN_PLAN',
            upgradeTo: Object.values(PLAN_MATRIX).filter((p) => p.onchain.includes('auditAnchor')).map((p) => p.planId),
        });
    }

    try {
        const result = await operantAnchor.anchorTenant({
            appId: req.registeredApp.id,
            tenantId: req.operantTenant.tenant_id,
        });
        res.json({ success: true, mode: plan.anchor, ...result });
    } catch (error) {
        sendBridgeError(res, error, 'No se pudo anclar la auditoría');
    }
});

/**
 * GET /audit/verify — integridad de la cadena de auditoría + últimas anclas.
 * Es la respuesta que se enseña en una due diligence: la cadena cuadra Y su
 * raíz está en una cadena pública con fecha.
 */
router.get('/audit/verify', authenticateGateway, requireSubApp('operant'), requireTenant, async (req, res) => {
    try {
        const chain = await operant.auditVerify({ tenantId: req.operantTenant.tenant_id });
        const { rows: anchors } = await query(
            `SELECT merkle_root, leaf_count, period_start, period_end, tx_hash, chain_id, anchored_at
               FROM operant_audit_anchors WHERE tenant_id = $1
              ORDER BY id DESC LIMIT 10`,
            [req.operantTenant.tenant_id]
        );
        res.json({
            success: true,
            chain,
            anchors,
            anchorKey: operantAnchor.anchorKey(req.operantTenant.tenant_id),
            contract: operantAnchor.getAnchorAddress(),
        });
    } catch (error) {
        sendBridgeError(res, error, 'No se pudo verificar la auditoría');
    }
});

/** GET /audit/proof/:auditHash — prueba de inclusión de un registro concreto. */
router.get('/audit/proof/:auditHash', authenticateGateway, requireSubApp('operant'), requireTenant, [
    param('auditHash').matches(/^(0x)?[0-9a-fA-F]{64}$/),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const proof = await operantAnchor.proveRecord({
            tenantId: req.operantTenant.tenant_id,
            auditHash: req.params.auditHash,
        });
        res.status(proof.found ? 200 : 404).json({ success: proof.valid, ...proof });
    } catch (error) {
        if (error.status === 404) return res.status(404).json({ error: error.message });
        sendBridgeError(res, error, 'No se pudo construir la prueba de inclusión');
    }
});

module.exports = router;
