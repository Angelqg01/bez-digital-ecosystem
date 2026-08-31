'use strict';

const { Router } = require('express');
const crypto = require('node:crypto');
const { signup } = require('../platform/onboarding');
const { selectBatch, rootOf } = require('../platform/auditMerkle');

/**
 * bridge/router — superficie que consume el Gateway de BeZhas.
 *
 * ── Quién habla con quién ───────────────────────────────────────────────────
 * El cliente final NUNCA llama aquí. Se autentica contra BeZhas con su api-key
 * del Gateway; BeZhas comprueba plan, entitlements y cuota, y solo entonces
 * llama a estos endpoints con la clave interna. Es decir: estas rutas confían
 * en que quien llama ya ha hecho el control de acceso, y por eso están detrás
 * de `INTERNAL_API_KEY` y de nada más. Exponerlas a internet sin ese candado
 * sería regalar el runtime entero.
 *
 * ── Por qué no reutiliza `/tenants/:id/*` ───────────────────────────────────
 * Las rutas públicas de OPERANT son para un despliegue autónomo: emiten claves
 * de API propias, aplican SU rate limit y devuelven solo `taskId`. El Gateway
 * necesita otra cosa — ejecución síncrona con el consumo medido y el hash de
 * auditoría de vuelta, para poder facturar y anclar. Mezclar ambos contratos en
 * las mismas rutas habría hecho ambiguo qué contrato cumple cada respuesta.
 */

/** Comparación en tiempo constante: un `!==` sobre un secreto lo filtra carácter a carácter. */
function keyMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * @param {object} deps  Las mismas piezas que ya construye server.js.
 * @param {number} [deps.taskTimeoutMs] Espera máxima de una tarea síncrona.
 */
function createBridgeRouter(deps) {
  const {
    tenants, apiKeys, plans, rateLimiter, billing, store,
    costTracker, usageMeter, buildTools, registerDefaultJobs,
    taskTimeoutMs = Number(process.env.BRIDGE_TASK_TIMEOUT_MS || 60_000),
  } = deps;

  const router = Router();

  // Anclas ya notificadas por BeZhas: `hasta dónde está notarizado` por tenant.
  // Vive en el store (fact) para sobrevivir a un reinicio.
  const ANCHOR_FACT = 'audit:lastAnchor';

  router.use((req, res, next) => {
    if (!keyMatches(req.headers['x-api-key'], process.env.INTERNAL_API_KEY)) {
      return res.status(401).json({ error: 'puente no autorizado' });
    }
    next();
  });

  /** Espacio del tenant o 404 con un mensaje que dice qué hacer. */
  function spaceOr404(req, res) {
    const space = tenants.get(req.params.tenantId);
    if (!space) {
      res.status(404).json({
        error: `tenant no aprovisionado: ${req.params.tenantId}`,
        code: 'tenant_not_provisioned',
      });
      return null;
    }
    return space;
  }

  // ── Aprovisionamiento ─────────────────────────────────────────────────────

  /**
   * POST /bridge/tenants — alta o reconfiguración. Idempotente.
   *
   * Los límites llegan de BeZhas (derivados del plan contratado) y se aplican
   * tal cual: OPERANT no los renegocia. Si el tenant ya existe, se refrescan
   * cuota y rate limit — que es lo que tiene que pasar cuando alguien sube o
   * baja de plan.
   */
  router.post('/tenants', async (req, res) => {
    const { tenantId, plan = 'starter', departments, limits = {}, businessId } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId requerido' });
    if (!plans[plan]) return res.status(400).json({ error: `plan desconocido: ${plan}` });

    try {
      const existing = tenants.get(tenantId);

      if (!existing) {
        const result = await signup(
          { tenants, apiKeys, plans, rateLimiter, billing },
          { tenantId, plan, departments, businessId, tools: buildTools(tenantId) }
        );
        await registerDefaultJobs(result.tenantId, result.departments);
        applyLimits(tenantId, limits, plan);
        // La clave de API propia del tenant NO se devuelve al puente: dentro
        // del ecosistema la identidad es la api-key del Gateway, y sacar una
        // segunda credencial por la puerta de atrás solo añade superficie.
        return res.json({
          ok: true, created: true, tenantId, plan,
          departments: result.departments,
          limits: effectiveLimits(tenantId, plan),
        });
      }

      // Reconfiguración: cambio de plan / departamentos.
      existing.cfg.plan = plan;
      if (Array.isArray(departments) && departments.length) existing.cfg.departments = departments;
      applyLimits(tenantId, limits, plan);
      await billing.subscribe(tenantId, plan);
      if (store?.upsertTenant) {
        await store.upsertTenant({ tenantId, plan, departments: existing.cfg.departments, businessId });
      }
      existing.audit.log({ tenantId, event: 'tenant:reconfigured', plan, departments: existing.cfg.departments });

      res.json({
        ok: true, created: false, tenantId, plan,
        departments: existing.cfg.departments,
        limits: effectiveLimits(tenantId, plan),
        // Un cambio de departamentos solo entra del todo al reconstruir el
        // ejército de agentes; decirlo evita que BeZhas crea que ya está.
        note: Array.isArray(departments) && departments.length
          ? 'Los departamentos nuevos se activan en el próximo arranque del tenant'
          : undefined,
      });
    } catch (err) {
      res.status(err.code === 'bad_request' ? 400 : 500).json({ error: err.message });
    }
  });

  function applyLimits(tenantId, limits, plan) {
    const planDef = plans[plan] || {};
    if (rateLimiter) rateLimiter.setLimit(tenantId, limits.maxRequestsPerMinute ?? planDef.maxRequestsPerMinute);
    if (usageMeter) usageMeter.setLimit(tenantId, limits.maxAgentCallsMonth ?? planDef.maxAgentCallsMonth);
    const space = tenants.get(tenantId);
    if (space?.orchestrator && limits.maxConcurrentTasks) {
      space.orchestrator.maxConcurrent = limits.maxConcurrentTasks;
    }
  }

  function effectiveLimits(tenantId, plan) {
    const planDef = plans[plan] || {};
    const space = tenants.get(tenantId);
    return {
      maxConcurrentTasks: space?.orchestrator?.maxConcurrent ?? planDef.maxConcurrentTasks,
      maxRequestsPerMinute: planDef.maxRequestsPerMinute,
      maxAgentCallsMonth: usageMeter ? usageMeter.limitFor(tenantId) : planDef.maxAgentCallsMonth,
    };
  }

  // ── Ejecución de tareas ───────────────────────────────────────────────────

  /**
   * POST /bridge/tenants/:tenantId/handle — ejecuta una tarea y devuelve el
   * resultado, el consumo medido y el hash de auditoría.
   *
   * ── Sobre `usage` y por qué lleva `attribution` ─────────────────────────
   * El coste de tokens se mide por tenant (CostTracker), no por tarea. Con una
   * sola tarea en vuelo, el delta del acumulador ES el consumo de esa tarea y
   * se marca `exact`. Con varias en paralelo el delta mezcla tareas, así que se
   * marca `shared` y BeZhas lo descarta y factura con su perfil estimado.
   * Devolver un número inventado como si fuera medido sería peor que no
   * devolver ninguno: se estaría facturando sobre ruido.
   */
  router.post('/tenants/:tenantId/handle', async (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;

    const { department, input, context, async: isAsync } = req.body || {};
    if (!input) return res.status(400).json({ error: 'input requerido' });

    // `department` + `type` saltan la clasificación por palabras clave: BeZhas
    // ya ha decidido (y cobrado) por un departamento concreto, no puede acabar
    // la tarea en otro.
    const payload = {
      text: input,
      ...(context || {}),
      ...(department ? { department, type: `${department}:request` } : {}),
    };

    // Copia, no referencia: CostTracker.usageFor() devuelve el propio objeto
    // acumulador del tenant y record() lo muta EN SITIO, así que quedarse con
    // la referencia hace que `before` y `after` sean el mismo objeto y el delta
    // salga 0 siempre. Se vio en la primera prueba real del puente: toda tarea
    // reportaba `calls: 0` y por tanto atribución `shared`, dejando a BeZhas
    // facturando siempre por estimación aunque el consumo fuera medible.
    const before = costTracker ? { ...costTracker.usageFor(req.params.tenantId) } : null;
    const inFlightBefore = countInFlight(space);

    try {
      if (isAsync) {
        const taskId = await space.orchestrator.handle(payload);
        return res.json({ ok: true, taskId, status: 'queued', department });
      }

      const task = await space.orchestrator.handleAndWait(payload, { timeoutMs: taskTimeoutMs });
      const after = costTracker ? { ...costTracker.usageFor(req.params.tenantId) } : null;

      res.json({
        ok: true,
        taskId: task.id,
        status: task.status,
        department: task.department,
        output: task.result ?? task.output ?? null,
        error: task.error || null,
        requiresApproval: task.status === 'awaiting_approval',
        approvalId: task.approvalId || null,
        auditHash: lastAuditHash(space),
        usage: buildUsage(before, after, inFlightBefore, countInFlight(space)),
      });
    } catch (err) {
      const status = err.code === 'quota_exceeded' ? 429 : /timeout/.test(err.message) ? 504 : 400;
      res.status(status).json({ error: err.message, code: err.code || null });
    }
  });

  /** Tareas del tenant que no están en estado terminal. */
  function countInFlight(space) {
    const recent = space.orchestrator.recentTasks ? space.orchestrator.recentTasks(50) : [];
    const terminal = new Set(['completed', 'failed', 'interrupted']);
    return recent.filter((t) => !terminal.has(t.status)).length;
  }

  function buildUsage(before, after, inFlightBefore, inFlightAfter) {
    if (!before || !after) return null;
    const calls = after.calls - before.calls;
    const inputTokens = after.inputTokens - before.inputTokens;
    const outputTokens = after.outputTokens - before.outputTokens;
    // Solo es atribuible si esta tarea estuvo sola de principio a fin.
    const exact = inFlightBefore === 0 && inFlightAfter === 0 && calls > 0;
    return {
      attribution: exact ? 'exact' : 'shared',
      calls,
      specialists: Math.max(0, calls - 1),   // el manager es la primera llamada
      inputTokens: exact ? inputTokens : null,
      outputTokens: exact ? outputTokens : null,
      costUsd: Number((after.costUsd - before.costUsd).toFixed(6)),
    };
  }

  /** Último hash de la cadena de auditoría del tenant (la tarea recién escrita). */
  function lastAuditHash(space) {
    const recent = space.audit.query({});
    return recent.length ? recent[recent.length - 1].hash : null;
  }

  /** GET /bridge/tenants/:tenantId/tasks/:taskId */
  router.get('/tenants/:tenantId/tasks/:taskId', async (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    const task = await space.orchestrator.findTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'tarea no encontrada' });
    res.json({ ok: true, ...task });
  });

  // ── Aprobaciones humanas ──────────────────────────────────────────────────

  router.get('/tenants/:tenantId/approvals', (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    res.json({ ok: true, approvals: space.hitl.listPending(req.params.tenantId) });
  });

  router.post('/tenants/:tenantId/approvals/:approvalId', (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    const { decision, reason, approver } = req.body || {};
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: "decision debe ser 'approve' o 'reject'" });
    }
    const note = approver ? `${approver}${reason ? `: ${reason}` : ''}` : reason;
    const resolved = space.hitl.resolve(req.params.approvalId, decision === 'approve', note);
    if (!resolved) return res.status(404).json({ error: 'aprobación no encontrada o ya resuelta' });
    res.json({ ok: true, approvalId: req.params.approvalId, decision, auditHash: lastAuditHash(space) });
  });

  // ── Auditoría ─────────────────────────────────────────────────────────────

  /**
   * GET /bridge/tenants/:tenantId/audit/batch — hojas del tramo pendiente.
   *
   * Devuelve HASHES, no registros: BeZhas solo necesita las hojas para calcular
   * y anclar la raíz, y el contenido de la auditoría (correos, datos de leads,
   * CV) no tiene por qué salir del tenant para notarizarlo. Eso es justamente
   * lo que hace útil el esquema merkle.
   */
  router.get('/tenants/:tenantId/audit/batch', async (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    try {
      const records = store?.auditFor ? await store.auditFor(req.params.tenantId) : space.audit.query({});
      const batch = selectBatch(records, {
        since: req.query.since || null,
        until: req.query.until || null,
        max: Number(req.query.max || 10_000),
      });
      res.json({ ok: true, tenantId: req.params.tenantId, ...batch, root: rootOf(batch.leaves) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /bridge/tenants/:tenantId/audit/verify — integridad de la cadena. */
  router.get('/tenants/:tenantId/audit/verify', async (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    try {
      const result = await space.audit.verifyChain();
      const lastAnchor = store?.getFact
        ? await store.getFact({ tenantId: req.params.tenantId, key: ANCHOR_FACT })
        : null;
      res.json({ ok: result.ok, ...result, lastAnchor: lastAnchor || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /bridge/tenants/:tenantId/audit/anchored — BeZhas avisa de que un
   * tramo ya está en la cadena. Se guarda para que el panel de OPERANT pueda
   * decir "notarizado hasta X" sin consultar a BeZhas.
   */
  router.post('/tenants/:tenantId/audit/anchored', async (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    const { merkleRoot, txHash, chainId, blockNumber } = req.body || {};
    if (!merkleRoot || !txHash) return res.status(400).json({ error: 'merkleRoot y txHash requeridos' });

    const anchor = { merkleRoot, txHash, chainId, blockNumber, at: new Date().toISOString() };
    if (store?.setFact) {
      await store.setFact({ tenantId: req.params.tenantId, key: ANCHOR_FACT, value: anchor });
    }
    space.audit.log({ tenantId: req.params.tenantId, event: 'audit:anchored', ...anchor });
    res.json({ ok: true, anchor });
  });

  // ── Optimizador del sistema ───────────────────────────────────────────────

  /**
   * GET /bridge/tenants/:tenantId/optimizer — qué ha visto el optimizador desde
   * su último ciclo, si ya hay bastante para actuar y qué cambió la última vez.
   *
   * BeZhas lo expone en el panel del cliente: es la prueba de que el sistema se
   * está afinando solo, y de que cada ajuste tiene un motivo medible detrás.
   */
  router.get('/tenants/:tenantId/optimizer', (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    if (!space.optimizer) return res.status(404).json({ error: 'tenant sin optimizador' });
    res.json({ ok: true, ...space.optimizer.snapshot() });
  });

  /**
   * POST /bridge/tenants/:tenantId/optimizer/run — fuerza un ciclo.
   *
   * No es el camino normal (el normal es que salte solo cuando hay evidencia),
   * pero hace falta para dos cosas reales: enseñar el mecanismo en una demo, y
   * re-evaluar justo después de un despliegue que cambia el comportamiento.
   */
  router.post('/tenants/:tenantId/optimizer/run', async (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    if (!space.optimizer) return res.status(404).json({ error: 'tenant sin optimizador' });
    try {
      res.json({ ok: true, ...(await space.optimizer.cycle({ force: req.body?.force === true })) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Reglas de enrutado que el sistema ha aprendido para este tenant. */
  router.get('/tenants/:tenantId/optimizer/routes', (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    res.json({ ok: true, routes: space.orchestrator.learnedRoutes?.() || [] });
  });

  /** Quita una regla aprendida (el humano siempre puede corregir a la máquina). */
  router.delete('/tenants/:tenantId/optimizer/routes/:keyword', async (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    const quitada = await space.orchestrator.forgetRoute(req.params.keyword);
    if (!quitada) return res.status(404).json({ error: 'regla no encontrada' });
    space.audit.log({ tenantId: req.params.tenantId, event: 'routing:forgotten', keyword: req.params.keyword });
    res.json({ ok: true, keyword: req.params.keyword, routes: space.orchestrator.learnedRoutes() });
  });

  // ── Consumo (para conciliar con el ledger de BeZhas) ──────────────────────

  router.get('/tenants/:tenantId/usage', (req, res) => {
    const space = spaceOr404(req, res);
    if (!space) return;
    const quota = usageMeter ? usageMeter.check(req.params.tenantId) : null;
    const cost = costTracker ? costTracker.usageFor(req.params.tenantId) : null;
    res.json({
      ok: true,
      tenantId: req.params.tenantId,
      plan: space.cfg.plan,
      quota,
      cost,
      pendingApprovals: space.hitl.listPending(req.params.tenantId).length,
    });
  });

  return router;
}

module.exports = { createBridgeRouter };
