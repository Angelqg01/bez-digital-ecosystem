/**
 * operant-services.js — Catálogo de servicios de OPERANT como SubApp de BeZhas.
 *
 * OPERANT (Gestión Empresarial Autónoma) expone sus 10 departamentos de agentes
 * IA a través del Gateway de BeZhas. Este archivo es la ÚNICA fuente de verdad
 * de tres cosas:
 *
 *   1. QUÉ servicios (departamentos + capacidades on-chain) desbloquea cada
 *      plan de suscripción de `config/plans.js`.
 *   2. CUÁNTO cuesta realmente cada tarea (Claude + cómputo BeZhas) y cuánto se
 *      factura (mismo margen y misma unidad de crédito que `usage-pricing.js`).
 *   3. CUÁNTO se incluye en la cuota del plan y qué pasa al pasarse (overage
 *      facturado por créditos al mismo precio del pago por uso).
 *
 * ── Modelo de coste ────────────────────────────────────────────────────────
 * Una "tarea OPERANT" no es una llamada al LLM: es una orquestación
 * (manager enruta → N especialistas ejecutan → guardarraíles + auditoría).
 * El perfil observado de tokens es el de `TASK_TOKEN_PROFILE`: manager +2
 * especialistas ≈ 15k tokens de entrada / 3k de salida. Los departamentos
 * `frontier` (venta, marketing, fundraising) corren en Opus porque su salida
 * va a un cliente real; el resto en Sonnet.
 *
 * El coste se calcula SIEMPRE con `usage-pricing.calculateCallCost`, así que
 * si Anthropic cambia precios solo hay que tocar aquel archivo.
 *
 * ── Por qué cuotas propias y no las `aiActions` del plan ───────────────────
 * `plans.js` da una bolsa de acciones IA para TODO el ecosistema. Si OPERANT
 * pudiera vaciarla, una empresa que solo use OPERANT dejaría a cero al resto
 * de SubApps y el margen del plan se iría al suelo (una tarea frontier cuesta
 * ~3 acciones IA). Por eso OPERANT tiene su propia cuota mensual, dimensionada
 * para dejar ≥50% de margen bruto en consumo máximo (ver MARGIN_NOTES).
 */

'use strict';

const { calculateCallCost, EUR_PER_CREDIT } = require('./usage-pricing');

// ─────────────────────────────────────────────────────────────────────────────
//  PERFIL DE COSTE DE UNA TAREA
// ─────────────────────────────────────────────────────────────────────────────

/** Tokens de una tarea típica: 1 manager + 2 especialistas + recuperación de memoria. */
const TASK_TOKEN_PROFILE = Object.freeze({
    inputTokens: 15_000,
    outputTokens: 3_000,
    specialists: 2,
});

/** Tokens de UN especialista extra por encima del perfil base. */
const SPECIALIST_TOKEN_PROFILE = Object.freeze({
    inputTokens: 6_000,
    outputTokens: 1_200,
});

/**
 * Tier de modelo por departamento. `frontier` = la salida la lee un cliente
 * (propuestas, copy, inversores) → Opus. `mid` = trabajo interno → Sonnet.
 * Espejo de `operant-saas/config/departments.json`.
 */
const TIER_MODEL = Object.freeze({
    frontier: 'claude-opus-4-8',
    mid: 'claude-sonnet-5',
    light: 'claude-haiku-4-5',
});

/**
 * Cuántas "acciones IA" del plan consume una tarea de cada tier. Es el número
 * real de llamadas al LLM que dispara la orquestación (manager + especialistas).
 */
const TIER_AI_ACTIONS = Object.freeze({ frontier: 3, mid: 2, light: 1 });

// ─────────────────────────────────────────────────────────────────────────────
//  DEPARTAMENTOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los 10 departamentos de OPERANT. `redLines` marca los que pueden disparar
 * una línea roja (movimiento de activos, dato personal, compromiso legal) y
 * por tanto exigen HITL sí o sí, independientemente del plan.
 */
const DEPARTMENTS = Object.freeze([
    { id: 'sales', label: 'Ventas', tier: 'frontier', redLines: false,
      services: ['Prospección y scoring de leads', 'Secuencias de outreach', 'Negociación asistida', 'Propuestas comerciales'] },
    { id: 'support', label: 'Soporte', tier: 'mid', redLines: false,
      services: ['Triaje de tickets', 'Base de conocimiento', 'Resolución automática', 'Escalado + CSAT'] },
    { id: 'marketing', label: 'Marketing', tier: 'frontier', redLines: false,
      services: ['Contenido y copy', 'SEO', 'Cola social con aprobación', 'Tests A/B'] },
    { id: 'finance', label: 'Finanzas', tier: 'mid', redLines: true,
      services: ['Facturación y cobros', 'Previsión de tesorería', 'Categorización de gasto', 'Conciliación bancaria', 'Desembolso en $BEZ'] },
    { id: 'hr', label: 'RRHH', tier: 'mid', redLines: true,
      services: ['Cribado de CV (con redacción PII)', 'Agenda de entrevistas', 'Onboarding', 'Asesoría laboral'] },
    { id: 'operations', label: 'Operaciones', tier: 'mid', redLines: false,
      services: ['Coordinación de proyectos', 'Compras', 'Reposición de inventario', 'Informes operativos'] },
    { id: 'legal', label: 'Legal / Compliance', tier: 'mid', redLines: true,
      services: ['Revisión de contratos', 'Asesoría regulatoria (MiCA, DAC8, GDPR)', 'Checklist DPIA', 'Screening de sanciones'] },
    { id: 'blockchain', label: 'Blockchain Ops', tier: 'mid', redLines: true,
      services: ['Monitor on-chain', 'Optimizador de gas', 'Vigilancia de slashing', 'Comprobación de compliance on-chain'] },
    { id: 'treasury', label: 'Tesorería', tier: 'mid', redLines: true,
      services: ['Runway y escenarios', 'Gestión de tokenomics', 'Matemática de vesting', 'Gestión de liquidez'] },
    { id: 'fundraising', label: 'Fundraising', tier: 'frontier', redLines: true,
      services: ['Scoring de inversores', 'Outreach a fondos', 'Cap table', 'Data room y due diligence'] },
]);

const DEPARTMENT_BY_ID = Object.freeze(
    Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d]))
);

// ─────────────────────────────────────────────────────────────────────────────
//  MATRIZ DE PLANES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Niveles de autonomía. Determina cuándo un agente puede actuar sin humano.
 *   draft      — nunca envía; todo queda como borrador para aprobación.
 *   assisted   — envía lo de riesgo bajo; el resto pasa por HITL.
 *   autonomous — envía salvo línea roja (activos, PII, compromiso legal).
 *   governed   — autónomo + políticas votadas en la DAO y aprobaciones on-chain.
 */
const AUTONOMY_LEVELS = Object.freeze(['draft', 'assisted', 'autonomous', 'governed']);

/**
 * Frecuencia de anclaje de la cadena de auditoría en BeZhas L2.
 * Nunca es "una tx por tarea": siempre es la raíz merkle de un lote (una sola
 * tx), porque anclar tarea a tarea multiplicaría el gas sin añadir garantía.
 */
const ANCHOR_MODES = Object.freeze({
    none:       { label: 'Sin anclaje on-chain', batchMinutes: null, txPerMonth: 0 },
    weekly:     { label: 'Anclaje semanal',      batchMinutes: 10_080, txPerMonth: 4 },
    daily:      { label: 'Anclaje diario',       batchMinutes: 1_440,  txPerMonth: 30 },
    continuous: { label: 'Anclaje continuo (lotes de 5 min)', batchMinutes: 5, txPerMonth: 8_640 },
});

/**
 * Qué desbloquea cada plan de `config/plans.js`.
 *
 *   departments      — departamentos activables.
 *   includedTasks    — tareas/mes incluidas en la cuota (null = sin límite duro).
 *   frontierCap      — tope de tareas frontier dentro de esa cuota (null = sin tope).
 *   maxConcurrent    — tareas simultáneas por tenant.
 *   rpm              — peticiones/minuto contra la SubApp.
 *   autonomy         — nivel máximo de autonomía permitido.
 *   anchor           — modo de anclaje de la auditoría.
 *   onchain          — capacidades tokenizadas (ver ONCHAIN_FEATURES).
 *   overage          — qué pasa al agotar la cuota.
 */
const PLAN_MATRIX = Object.freeze({
    starter: {
        planId: 'starter',
        departments: ['sales', 'support'],
        includedTasks: 0,               // pago por uso puro (15 días de prueba)
        frontierCap: null,
        maxConcurrent: 1,
        rpm: 60,
        autonomy: 'draft',
        anchor: 'none',
        onchain: ['auditChainLocal'],
        overage: 'payg',
        retentionDays: 30,
    },
    creator_pro: {
        planId: 'creator_pro',
        departments: ['sales', 'support', 'marketing', 'finance'],
        includedTasks: 300,
        frontierCap: 100,
        maxConcurrent: 3,
        rpm: 300,
        autonomy: 'assisted',
        anchor: 'weekly',
        onchain: ['auditChainLocal', 'auditAnchor', 'bezRewards'],
        overage: 'payg',
        retentionDays: 180,
    },
    business: {
        planId: 'business',
        departments: ['sales', 'support', 'marketing', 'finance', 'hr', 'operations', 'legal', 'blockchain'],
        includedTasks: 2_000,
        frontierCap: 600,
        maxConcurrent: 8,
        rpm: 1_200,
        autonomy: 'autonomous',
        onchain: ['auditChainLocal', 'auditAnchor', 'bezRewards', 'bezSettlement', 'nftCertificates', 'onchainHitl'],
        anchor: 'daily',
        overage: 'payg',
        retentionDays: 730,
    },
    enterprise_vip: {
        planId: 'enterprise_vip',
        departments: DEPARTMENTS.map((d) => d.id),
        // Uso razonable; por encima, pago por uso. 9.000 y no 10.000 porque el
        // anclaje continuo (8.640 tx/mes) añade ~104 EUR/mes de cómputo: con
        // 10.000 tareas el margen bruto del plan caía por debajo del 50%.
        includedTasks: 9_000,
        frontierCap: 3_000,
        maxConcurrent: 25,
        rpm: 6_000,
        autonomy: 'governed',
        anchor: 'continuous',
        onchain: ['auditChainLocal', 'auditAnchor', 'bezRewards', 'bezSettlement',
                  'nftCertificates', 'onchainHitl', 'daoPolicies', 'dedicatedEdgeNode'],
        overage: 'payg',
        retentionDays: 2_555,           // 7 años (conservación mercantil española)
    },
});

/** Descripción de cada capacidad on-chain, para el catálogo público. */
const ONCHAIN_FEATURES = Object.freeze({
    auditChainLocal:   'Registro de auditoría encadenado por hash (SHA-256), verificable off-chain.',
    auditAnchor:       'Raíz merkle de la auditoría anclada en BeZhas L2: prueba inmutable ante due diligence.',
    bezRewards:        'El consumo de OPERANT acumula staking en $BEZ al APY del plan.',
    bezSettlement:     'Pago de proveedores/colaboradores en $BEZ desde la wallet de dispersión (siempre con HITL).',
    nftCertificates:   'Entregables y cierres de auditoría emitidos como NFT verificable (BeZhasCore).',
    onchainHitl:       'Las aprobaciones humanas quedan firmadas y registradas on-chain.',
    daoPolicies:       'Las políticas de los agentes se cambian por votación en BeZhasDAO.',
    dedicatedEdgeNode: 'Edge Node dedicado: inferencia y datos dentro de la infraestructura del cliente.',
});

// ─────────────────────────────────────────────────────────────────────────────
//  CÁLCULO DE COSTE
// ─────────────────────────────────────────────────────────────────────────────

const round4 = (n) => Math.round(n * 1e4) / 1e4;

/**
 * Coste y precio de una tarea de un departamento.
 *
 * @param {string} departmentId
 * @param {{specialists?:number, inputTokens?:number, outputTokens?:number}} [opts]
 *   `specialists` por encima de TASK_TOKEN_PROFILE.specialists suma el perfil
 *   de especialista extra. `inputTokens`/`outputTokens` permiten medir el
 *   consumo REAL cuando OPERANT lo reporta tras ejecutar (preferible siempre).
 * @returns {{department:string, tier:string, model:string, aiActions:number,
 *            inputTokens:number, outputTokens:number, claudeCostEUR:number,
 *            computeCostEUR:number, rawCostEUR:number, billableEUR:number,
 *            credits:number}}
 */
function estimateTaskCost(departmentId, opts = {}) {
    const dept = DEPARTMENT_BY_ID[departmentId];
    if (!dept) {
        const err = new Error(`Unknown OPERANT department: ${departmentId}`);
        err.code = 'UNKNOWN_DEPARTMENT';
        throw err;
    }

    const extraSpecialists = Math.max(
        0,
        (opts.specialists ?? TASK_TOKEN_PROFILE.specialists) - TASK_TOKEN_PROFILE.specialists
    );

    // Tokens reales si OPERANT los reporta; si no, el perfil estimado.
    const inputTokens = opts.inputTokens ??
        (TASK_TOKEN_PROFILE.inputTokens + extraSpecialists * SPECIALIST_TOKEN_PROFILE.inputTokens);
    const outputTokens = opts.outputTokens ??
        (TASK_TOKEN_PROFILE.outputTokens + extraSpecialists * SPECIALIST_TOKEN_PROFILE.outputTokens);

    const cost = calculateCallCost({
        model: TIER_MODEL[dept.tier],
        inputTokens,
        outputTokens,
        action: extraSpecialists > 0 ? 'operant_task' : 'operant_task',
    });

    // Cada especialista extra añade su propio coste de cómputo (no solo tokens).
    const extraCompute = extraSpecialists > 0
        ? calculateCallCost({ inputTokens: 0, outputTokens: 0, action: 'operant_specialist' })
        : null;

    const rawCostEUR = round4(cost.rawCostEUR + (extraCompute ? extraCompute.rawCostEUR * extraSpecialists : 0));
    const billableEUR = round4(rawCostEUR * (1 + cost.margin));

    return {
        department: dept.id,
        tier: dept.tier,
        model: TIER_MODEL[dept.tier],
        aiActions: TIER_AI_ACTIONS[dept.tier] + extraSpecialists,
        inputTokens,
        outputTokens,
        claudeCostEUR: cost.claudeCostEUR,
        computeCostEUR: round4(rawCostEUR - cost.claudeCostEUR),
        rawCostEUR,
        margin: cost.margin,
        billableEUR,
        credits: Math.max(1, Math.ceil(billableEUR / EUR_PER_CREDIT)),
        eurPerCredit: EUR_PER_CREDIT,
    };
}

/** Precio de referencia por tarea de cada tier (para la tarifa pública del PAYG). */
function priceCard() {
    return Object.entries(TIER_MODEL).reduce((acc, [tier]) => {
        const sample = DEPARTMENTS.find((d) => d.tier === tier);
        if (!sample) return acc;
        const c = estimateTaskCost(sample.id);
        acc[tier] = {
            model: TIER_MODEL[tier],
            aiActions: TIER_AI_ACTIONS[tier],
            rawCostEUR: c.rawCostEUR,
            pricePerTaskEUR: c.billableEUR,
            credits: c.credits,
        };
        return acc;
    }, {});
}

/**
 * Coste mensual máximo de un plan si el cliente agota su cuota en el peor mix
 * posible (todo frontier hasta el tope, el resto mid). Es la cifra que sostiene
 * el dimensionado de `includedTasks`: se usa en los tests para que un cambio de
 * cuota o de precio de Anthropic no rompa el margen sin que salte una alarma.
 */
function worstCaseMonthlyCost(planId) {
    const plan = PLAN_MATRIX[planId];
    if (!plan) throw new Error(`Unknown plan: ${planId}`);
    const included = plan.includedTasks || 0;
    const frontierTasks = Math.min(plan.frontierCap ?? included, included);
    const midTasks = included - frontierTasks;

    const frontierSample = DEPARTMENTS.find((d) => d.tier === 'frontier' && plan.departments.includes(d.id));
    const midSample = DEPARTMENTS.find((d) => d.tier === 'mid' && plan.departments.includes(d.id));

    const fCost = frontierSample ? estimateTaskCost(frontierSample.id).rawCostEUR : 0;
    const mCost = midSample ? estimateTaskCost(midSample.id).rawCostEUR : 0;

    const anchorTx = ANCHOR_MODES[plan.anchor].txPerMonth;
    const anchorCost = anchorTx
        ? round4(anchorTx * calculateCallCost({ action: 'operant_anchor' }).rawCostEUR)
        : 0;

    return {
        planId,
        includedTasks: included,
        frontierTasks,
        midTasks,
        taskCostEUR: round4(frontierTasks * fCost + midTasks * mCost),
        anchorCostEUR: anchorCost,
        totalCostEUR: round4(frontierTasks * fCost + midTasks * mCost + anchorCost),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ENTITLEMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qué puede hacer una app con este plan. `addons` son las SubApps activadas:
 * si `operant` no está entre ellas, `enabled` es false y el resto es informativo
 * (sirve para pintar el upsell sin una segunda llamada).
 */
function resolveEntitlements(planId, addons = []) {
    const plan = PLAN_MATRIX[planId] || PLAN_MATRIX.starter;
    const enabled = Array.isArray(addons) && addons.includes('operant');
    return {
        subapp: 'operant',
        enabled,
        planId: plan.planId,
        departments: plan.departments,
        includedTasks: plan.includedTasks,
        frontierCap: plan.frontierCap,
        maxConcurrent: plan.maxConcurrent,
        rpm: plan.rpm,
        autonomy: plan.autonomy,
        anchor: { mode: plan.anchor, ...ANCHOR_MODES[plan.anchor] },
        onchain: plan.onchain.map((f) => ({ id: f, description: ONCHAIN_FEATURES[f] })),
        overage: plan.overage,
        retentionDays: plan.retentionDays,
    };
}

/** ¿Puede este plan usar este departamento? */
function planAllowsDepartment(planId, departmentId) {
    const plan = PLAN_MATRIX[planId] || PLAN_MATRIX.starter;
    return plan.departments.includes(departmentId);
}

/** Catálogo público: qué ofrece OPERANT y a qué precio, plan a plan. */
function describeCatalog() {
    return {
        subapp: 'operant',
        label: 'OPERANT — Gestión Empresarial Autónoma',
        departments: DEPARTMENTS.map((d) => ({
            id: d.id, label: d.label, tier: d.tier,
            requiresHitl: d.redLines, services: d.services,
            aiActionsPerTask: TIER_AI_ACTIONS[d.tier],
            plans: Object.values(PLAN_MATRIX).filter((p) => p.departments.includes(d.id)).map((p) => p.planId),
        })),
        plans: Object.values(PLAN_MATRIX).map((p) => ({
            planId: p.planId,
            departments: p.departments,
            includedTasks: p.includedTasks,
            frontierCap: p.frontierCap,
            maxConcurrent: p.maxConcurrent,
            rpm: p.rpm,
            autonomy: p.autonomy,
            anchor: { mode: p.anchor, ...ANCHOR_MODES[p.anchor] },
            onchain: p.onchain,
            overage: p.overage,
            retentionDays: p.retentionDays,
            worstCaseCostEUR: worstCaseMonthlyCost(p.planId).totalCostEUR,
        })),
        pricing: {
            model: 'cost-plus',
            marginNote: 'Precio = (coste Claude + cómputo BeZhas) × 1,25. 1 crédito = 0,001 EUR.',
            eurPerCredit: EUR_PER_CREDIT,
            perTier: priceCard(),
            overage: 'Al agotar la cuota incluida, cada tarea se factura por créditos al precio del pago por uso.',
        },
        onchainFeatures: ONCHAIN_FEATURES,
        autonomyLevels: AUTONOMY_LEVELS,
    };
}

module.exports = {
    DEPARTMENTS,
    DEPARTMENT_BY_ID,
    TIER_MODEL,
    TIER_AI_ACTIONS,
    TASK_TOKEN_PROFILE,
    SPECIALIST_TOKEN_PROFILE,
    PLAN_MATRIX,
    ANCHOR_MODES,
    ONCHAIN_FEATURES,
    AUTONOMY_LEVELS,
    estimateTaskCost,
    worstCaseMonthlyCost,
    priceCard,
    resolveEntitlements,
    planAllowsDepartment,
    describeCatalog,
};
