'use strict';

const EventBus = require('./EventBus');
const Orchestrator = require('./Orchestrator');
const HITLGate = require('./HITLGate');
const MemoryManager = require('../cognition/MemoryManager');
const LearningEngine = require('../cognition/LearningEngine');
const SystemOptimizer = require('../cognition/SystemOptimizer');
const KnowledgeBase = require('../platform/KnowledgeBase');
const LeadOutcomeTracker = require('../platform/LeadOutcomeTracker');
const PolicyEngine = require('../guardrails/PolicyEngine');
const AuditLog = require('../guardrails/AuditLog');
const BusinessProfile = require('../platform/BusinessProfile');
const DoNotContactList = require('../platform/DoNotContactList');
const SalesAutonomy = require('../platform/SalesAutonomy');
const LeadFunnel = require('../platform/LeadFunnel');
const { WebFormSource } = require('../platform/leadSources');
const { buildDepartments } = require('../agents');

/**
 * TenantManager — capa de multi-tenencia.
 *
 * Mantiene un "espacio" totalmente aislado por cada empresa cliente: su propio
 * EventBus, memoria, política, auditoría y orquestador con su ejército de agentes.
 * Un fallo o fuga en un tenant nunca toca a otro.
 */
class TenantManager {
  constructor({ modelGateway, store, usageMeter, metrics, telemetry, hitlNotifier, plans, embedder, optimizerThresholds, hitlTimeoutMs = 0, hitlEscalateAfterMs = 0 } = {}) {
    this.modelGateway = modelGateway; // compartido, pero cada llamada lleva tenantId
    this.store = store;               // acceso a datos (Postgres) con scope por tenant
    this.usageMeter = usageMeter;     // cuotas por plan (opcional)
    this.metrics = metrics;           // KPIs por tenant (opcional)
    this.telemetry = telemetry;       // observabilidad (opcional)
    this.hitlNotifier = hitlNotifier; // push de aprobaciones HITL (opcional)
    this.embedder = embedder;         // async (text)=>vector para RAG semántico (opcional)
    this.hitlTimeoutMs = hitlTimeoutMs;             // 0 = sin timeout (espera indefinida)
    this.hitlEscalateAfterMs = hitlEscalateAfterMs; // 0 = sin escalado a un segundo canal
    this.plans = plans || require('../../config/plans.json');
    this.optimizerThresholds = optimizerThresholds || undefined;
    this._tenants = new Map();        // tenantId -> espacio del tenant
  }

  /**
   * Da de alta una empresa cliente y construye su ejército de agentes según su plan.
   * @param {object} cfg - { tenantId, plan, departments: ['sales','support',...], tools }
   */
  async provision(cfg) {
    if (this._tenants.has(cfg.tenantId)) return this._tenants.get(cfg.tenantId);

    const bus = new EventBus(cfg.tenantId);
    if (this.metrics) this.metrics.attach(bus, cfg.tenantId);
    if (this.telemetry) this.telemetry.attach(bus, cfg.tenantId);
    // Alertas proactivas (anomalía on-chain, runway crítico): sin esta
    // suscripción los agentes de vigilancia emitían al vacío.
    if (this.hitlNotifier?.attach) this.hitlNotifier.attach(bus, cfg.tenantId);
    const audit = new AuditLog({ tenantId: cfg.tenantId, store: this.store });
    const memory = new MemoryManager({ tenantId: cfg.tenantId, store: this.store, embedder: this.embedder });
    const knowledgeBase = new KnowledgeBase({ tenantId: cfg.tenantId, store: this.store, embedder: this.embedder });
    // Resultados de captación: alimenta los pesos que aprende LeadFunnel.
    const outcomes = new LeadOutcomeTracker({ tenantId: cfg.tenantId, store: this.store });
    // Cada decisión de guardrails (permitida/bloqueada/requiere aprobación) y
    // cada cambio de política queda en el mismo audit log encadenado por hash.
    const guardrails = new PolicyEngine({ tenantId: cfg.tenantId, plan: cfg.plan, audit });
    // Lista dinámica de "no contactar" (a nivel de empresa/deal, gestionable en
    // caliente) y "autonomy dial" del Escuadrón de Ventas — paridad con las
    // plataformas de AI SDR (Artisan/11x). El dial se implementa sobre los
    // mismos overrides de `guardrails`, así que se crea después de él.
    const doNotContact = new DoNotContactList({ tenantId: cfg.tenantId, store: this.store });
    const salesAutonomy = new SalesAutonomy({ tenantId: cfg.tenantId, guardrails, store: this.store });
    const notify = this.hitlNotifier ? (a) => this.hitlNotifier.notify(a) : cfg.notify;
    const onEscalate = this.hitlNotifier ? (a) => this.hitlNotifier.escalate(a) : null;
    const hitl = new HITLGate({
      bus, audit, notify, onEscalate,
      timeoutMs: this.hitlTimeoutMs,
      escalateAfterMs: this.hitlEscalateAfterMs,
      store: this.store,
      tenantId: cfg.tenantId,
      // Aprobación huérfana (de antes de un reinicio) aprobada: la acción se
      // ejecuta directamente con los conectores del tenant. El humano ES la
      // aprobación; los guardrails ya se evaluaron al solicitarla.
      onOrphanApproved: async (action) => {
        const tool = (cfg.tools || {})[action?.tool];
        if (!tool) throw new Error(`herramienta no disponible: ${action?.tool}`);
        return tool.execute(action.method, action.args);
      },
    });

    await memory.connect();
    await audit.hydrate();         // continúa la cadena de hashes tras un reinicio (no la reinicia a génesis)
    await knowledgeBase.hydrate(); // recupera los artículos persistidos del tenant
    await outcomes.hydrate();      // histórico de captación (pesos aprendidos)
    await hitl.hydrate();          // aprobaciones pendientes de antes del reinicio
    await doNotContact.hydrate();  // lista de "no contactar" persistida
    await salesAutonomy.hydrate(); // nivel de autonomía persistido → aplica sus overrides al guardrails

    // Perfil de negocio del tenant: identidad, lenguaje y reglas que compondrán
    // los prompts de sus agentes. Prioridad: fact persistido → cfg.businessProfile
    // → archivo config/business/<businessId>.json. El primero que exista se
    // persiste para poder editarlo después.
    let business = null;
    const savedProfile = this.store?.getFact ? await this.store.getFact({ tenantId: cfg.tenantId, key: 'business:profile' }) : null;
    if (savedProfile) {
      business = new BusinessProfile(savedProfile);
    } else if (cfg.businessProfile) {
      business = new BusinessProfile(cfg.businessProfile);
    } else if (cfg.businessId) {
      business = BusinessProfile.fromFile(cfg.businessId);
    }
    if (business && !savedProfile && this.store?.setFact) {
      await this.store.setFact({ tenantId: cfg.tenantId, key: 'business:profile', value: business.toJSON() });
    }

    // Aplica los límites del plan contratado.
    const planLimits = this.plans[cfg.plan] || {};
    if (this.usageMeter) {
      this.usageMeter.setLimit(cfg.tenantId, planLimits.maxAgentCallsMonth);
    }

    const orchestrator = new Orchestrator({
      tenantId: cfg.tenantId,
      model: this.modelGateway,
      memory, guardrails, bus, audit,
      usageMeter: this.usageMeter,
      maxConcurrent: planLimits.maxConcurrentTasks,
      store: this.store, // durabilidad de tareas
    });

    // Construye solo los departamentos contratados en el plan.
    const departments = buildDepartments({
      tenantId: cfg.tenantId,
      enabled: cfg.departments || ['sales', 'support'],
      model: this.modelGateway,
      memory, guardrails, hitl, knowledgeBase, bus, business, doNotContact,
      store: this.store,
      tools: cfg.tools || {},
    });
    departments.forEach(d => orchestrator.registerDepartment(d));

    // Reglas de enrutado que el optimizador aprendió en ciclos anteriores.
    // Sin esto, cada reinicio devolvía el enrutado a la lista de fábrica.
    await orchestrator.hydrateRoutes();

    // Historial de tareas + marcado de interrumpidas (nunca re-ejecuta a ciegas).
    const { interrupted } = await orchestrator.hydrate();
    if (interrupted) {
      console.warn(`[tasks:${cfg.tenantId}] ${interrupted} tareas quedaron en vuelo en el último apagado (estado: interrupted; reintenta con POST .../tasks/:id/retry)`);
    }

    orchestrator.start();

    // Bucle de mejora continua: destila playbooks de la memoria episódica.
    const learning = new LearningEngine({ memory, model: this.modelGateway, audit, tenantId: cfg.tenantId });

    // Optimizador del propio sistema: enrutado, modelo por departamento y dial
    // de autonomía. Mira los mismos eventos que ya emite el bus y actúa cuando
    // la evidencia acumulada lo justifica, no en cada tick.
    const optimizer = new SystemOptimizer({
      tenantId: cfg.tenantId,
      model: this.modelGateway,
      memory, audit, orchestrator, hitl, learning,
      autonomy: salesAutonomy,
      thresholds: this.optimizerThresholds,
    });
    await optimizer.hydrate();
    optimizer.attach(bus);

    // Los agentes se reconstruyen en cada arranque con su tier de fábrica: sin
    // esto, cada reinicio deshacía lo que el optimizador había aprendido.
    await this._restoreLearnedTiers({ orchestrator, memory, departments: cfg.departments || [] });

    // Embudo de captación: cierra el bucle entre el formulario público y el
    // escuadrón de Ventas. Estaba construido y probado, pero no lo instanciaba
    // NADIE fuera de los tests: `POST /intake` llenaba `intake:queue` y esa
    // cola no la vaciaba nadie, así que los leads entraban y se quedaban ahí.
    // Solo tiene sentido si el tenant tiene Ventas contratado.
    const funnel = this._buildFunnel({ cfg, orchestrator, outcomes, bus });

    const space = { cfg, bus, audit, memory, knowledgeBase, outcomes, guardrails, hitl, orchestrator, learning, optimizer, business, doNotContact, salesAutonomy, funnel };
    this._tenants.set(cfg.tenantId, space);
    audit.log({ tenantId: cfg.tenantId, event: 'tenant:provisioned', plan: cfg.plan, departments: cfg.departments });
    return space;
  }

  /**
   * Monta el embudo con los especialistas reales del tenant. Devuelve null si
   * no hay departamento de Ventas: sin scorer, matcher y outreach no hay
   * embudo que valga, y montarlo a medias fallaría en la primera ejecución.
   */
  _buildFunnel({ cfg, orchestrator, outcomes, bus }) {
    const ventas = orchestrator.departments.get('sales');
    if (!ventas) return null;
    const scorer = ventas.getSpecialist('sales.lead-scorer');
    const matcher = ventas.getSpecialist('sales.pitch-matcher');
    const outreach = ventas.getSpecialist('sales.outreach');
    if (!scorer || !matcher || !outreach) return null;

    return new LeadFunnel({
      tenantId: cfg.tenantId,
      tracker: outcomes,
      agents: { scorer, matcher, outreach },
      // El formulario público es la fuente que ya existe y llega sola. Las
      // demás (listas propias, búsqueda por MCP) se añaden por configuración.
      sources: [new WebFormSource({ store: this.store, tenantId: cfg.tenantId })],
      bus,
    });
  }

  /**
   * Re-aplica los tiers de modelo que el optimizador fijó en ciclos anteriores.
   * Se hace al provisionar, antes de la primera tarea: un agente que arranca
   * con el tier de fábrica gasta de más (o rinde de menos) hasta el siguiente
   * ciclo, y el ciclo puede tardar días en dispararse.
   */
  async _restoreLearnedTiers({ orchestrator, memory, departments }) {
    if (!memory?.getFact) return 0;
    let n = 0;
    for (const dept of departments) {
      const tier = await memory.getFact(`optimizer:tier:${dept}`).catch(() => null);
      if (!tier) continue;
      const manager = orchestrator.departments.get(dept);
      if (!manager) continue;
      if (manager.modelTier !== undefined) manager.modelTier = tier;
      for (const esp of manager.specialists?.values() || []) esp.modelTier = tier;
      n++;
    }
    return n;
  }

  get(tenantId) {
    return this._tenants.get(tenantId) || null;
  }

  /**
   * Punto de entrada de una solicitud de cliente final, enrutada al tenant correcto.
   */
  async handle(tenantId, input) {
    const space = this.get(tenantId);
    if (!space) throw new Error(`tenant no aprovisionado: ${tenantId}`);
    return space.orchestrator.handle(input);
  }

  /** Como handle(), pero espera el resultado (vía síncrona para canales). */
  async handleAndWait(tenantId, input, opts = {}) {
    const space = this.get(tenantId);
    if (!space) throw new Error(`tenant no aprovisionado: ${tenantId}`);
    return space.orchestrator.handleAndWait(input, opts);
  }

  list() {
    return [...this._tenants.keys()];
  }
}

module.exports = TenantManager;
