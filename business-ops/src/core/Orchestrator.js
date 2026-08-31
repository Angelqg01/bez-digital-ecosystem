'use strict';

const TaskQueue = require('./TaskQueue');
const { runInTask } = require('./executionContext');

/**
 * Orchestrator — el "Director General IA" de UN tenant (Nivel 1).
 *
 * Recibe toda entrada del cliente, entiende la intención, decide qué
 * departamento la atiende, encola la tarea, sintetiza el resultado y decide
 * qué escalar al humano. No ejecuta trabajo de detalle: delega en los managers.
 *
 * ¿Por qué no un motor de grafos (LangGraph)? Ver docs/DECISION-LANGGRAPH.md:
 * el despacho real es lineal (clasificar → 1 departamento → 1 especialista),
 * sin branching ni ciclos, y el HITL ya está resuelto de forma nativa
 * (park/unpark + persistencia + huérfanos) sin necesitar ese framework.
 */
class Orchestrator {
  constructor(ctx) {
    this.tenantId = ctx.tenantId;
    this.model = ctx.model;
    this.memory = ctx.memory;
    this.guardrails = ctx.guardrails;
    this.bus = ctx.bus;
    this.audit = ctx.audit;
    this.usageMeter = ctx.usageMeter; // cuotas por plan (opcional)
    this.store = ctx.store || null;   // durabilidad de tareas (opcional)

    this.departments = new Map(); // department -> DepartmentManager
    this.queue = new TaskQueue({ maxConcurrent: ctx.maxConcurrent || 5 });

    // Política de reintento ante fallo transitorio (proveedor caído, red, etc.).
    // Ver _shouldRetry(): jamás se reintenta algo que ya tuvo efecto fuera.
    this.retry = {
      maxAttempts: ctx.retryMaxAttempts ?? 3,      // 1 intento + 2 reintentos
      baseDelayMs: ctx.retryBaseDelayMs ?? 1000,
      maxDelayMs: ctx.retryMaxDelayMs ?? 30_000,
    };
    this._retryTimers = new Set();

    // Ventana caliente de tareas en RAM. NO es el histórico: la verdad vive en
    // el Store (SQLite/Postgres). Sin tope, este Map crecía sin límite con el
    // resultado completo de cada tarea dentro (borradores de email enteros) y
    // el proceso solo lo soltaba al reiniciar.
    this._tasks = new Map();
    this.maxHotTasks = ctx.maxHotTasks || 200;

    // Reglas de enrutado APRENDIDAS, encima de las de fábrica. Las escribe el
    // SystemOptimizer cuando ve casos que ninguna regla reconoce, y viven en
    // memoria persistida — no en este archivo. Se consultan ANTES que las
    // estáticas: son más específicas del negocio de este tenant que cualquier
    // lista de palabras que podamos escribir a mano aquí.
    this._learnedRoutes = [];
  }

  /** Carga las reglas de enrutado aprendidas para este tenant. */
  async hydrateRoutes() {
    if (!this.memory?.getFact) return 0;
    const saved = await this.memory.getFact('routing:learned').catch(() => null);
    this._learnedRoutes = Array.isArray(saved) ? saved : [];
    return this._learnedRoutes.length;
  }

  /**
   * Añade una regla aprendida. Idempotente por palabra clave: reaprender lo
   * mismo no duplica reglas ni las multiplica en cada ciclo.
   */
  async learnRoute({ keyword, department, type, source = 'optimizer' }) {
    if (!keyword || !department) return false;
    const kw = String(keyword).toLowerCase().trim();
    if (this._learnedRoutes.some((r) => r.keyword === kw)) return false;
    this._learnedRoutes.push({ keyword: kw, department, type: type || `${department}:request`, source, at: new Date().toISOString() });
    await this.memory?.setFact?.('routing:learned', this._learnedRoutes).catch(() => {});
    this.audit?.log({ tenantId: this.tenantId, event: 'routing:learned', keyword: kw, department, source });
    return true;
  }

  /** Reglas aprendidas (para el panel y para poder quitarlas a mano). */
  learnedRoutes() {
    return [...this._learnedRoutes];
  }

  async forgetRoute(keyword) {
    const kw = String(keyword).toLowerCase().trim();
    const antes = this._learnedRoutes.length;
    this._learnedRoutes = this._learnedRoutes.filter((r) => r.keyword !== kw);
    if (this._learnedRoutes.length === antes) return false;
    await this.memory?.setFact?.('routing:learned', this._learnedRoutes).catch(() => {});
    return true;
  }

  /**
   * Poda la ventana caliente: descarta las tareas terminadas más antiguas.
   * Nunca descarta lo que sigue vivo (queued/running/awaiting_approval), que es
   * justo lo que necesita el panel y lo que puede reanudarse.
   */
  _pruneTasks() {
    if (this._tasks.size <= this.maxHotTasks) return;
    const terminal = new Set(['completed', 'failed', 'interrupted']);
    for (const [id, t] of this._tasks) {          // Map conserva orden de inserción
      if (this._tasks.size <= this.maxHotTasks) break;
      if (terminal.has(t.status)) this._tasks.delete(id);
    }
  }

  /**
   * Errores que NO tiene sentido reintentar: repetirlos daría exactamente el
   * mismo resultado porque el problema es de configuración, no de suerte.
   */
  static isPermanentError(message = '') {
    return /sin departamento:|herramienta no disponible:|Cuota mensual agotada/i.test(message);
  }

  /**
   * ¿Se puede reintentar esta tarea automáticamente?
   *
   * La condición dura es `sideEffectPerformed`: si la tarea ya envió un email,
   * escribió en el CRM o disparó un workflow, repetirla duplicaría ese efecto.
   * Ante un fallo a mitad de camino preferimos dejarlo en manos de un humano
   * (reintento manual con `POST .../tasks/:id/retry`) antes que arriesgar un
   * segundo envío al mismo cliente.
   */
  _shouldRetry(task, err) {
    if (task.sideEffectPerformed) return { retry: false, reason: 'la tarea ya tuvo efectos externos' };
    if (Orchestrator.isPermanentError(err.message)) return { retry: false, reason: 'error permanente' };
    if (task.attempts >= this.retry.maxAttempts) return { retry: false, reason: 'reintentos agotados' };
    return { retry: true };
  }

  /** Backoff exponencial con jitter (mismo criterio que ModelGateway). */
  _retryDelay(attempt) {
    const exp = Math.min(this.retry.baseDelayMs * 2 ** (attempt - 1), this.retry.maxDelayMs);
    return Math.round(exp * (0.5 + Math.random() * 0.5));   // 50-100% del tope
  }

  /** Reencola la tarea tras el backoff (el temporizador no retiene la cola). */
  _scheduleRetry(task, delayMs) {
    const timer = setTimeout(() => {
      this._retryTimers.delete(timer);
      // Si algo la resolvió mientras esperaba (p. ej. un reintento manual), no insistas.
      if (task.status !== 'retrying') return;
      this.queue.enqueue(task).catch((err) => {
        console.warn(`[tasks:${this.tenantId}] no se pudo reencolar ${task.id}: ${err.message}`);
      });
    }, delayMs);
    if (timer.unref) timer.unref();      // no mantiene vivo el proceso
    this._retryTimers.add(timer);
  }

  /** Cancela los reintentos pendientes (apagado ordenado / tests). */
  stop() {
    for (const t of this._retryTimers) clearTimeout(t);
    this._retryTimers.clear();
    this.queue.stop();
  }

  /** Persiste el estado de una tarea (best-effort: nunca frena el flujo). */
  _persistTask(task) {
    if (!this.store?.upsertTask) return;
    Promise.resolve(this.store.upsertTask(task))
      .catch((err) => console.warn(`[tasks:${this.tenantId}] no se pudo persistir ${task.id}: ${err.message}`));
  }

  /**
   * Rehidratación tras un reinicio: recupera el historial reciente para el
   * panel y marca como `interrupted` lo que estaba en vuelo cuando murió el
   * proceso. NO se re-ejecuta a ciegas (evita duplicar emails/acciones):
   * un humano o la API deciden reintentar (retryTask).
   */
  async hydrate() {
    if (!this.store?.listTasks) return { restored: 0, interrupted: 0 };
    const saved = await this.store.listTasks({ tenantId: this.tenantId, limit: 50 });
    let interrupted = 0;
    for (const t of saved.reverse()) {          // más antiguas primero, como en vivo
      // 'awaiting_approval' también se interrumpe: el agente que esperaba murió
      // con el proceso. La APROBACIÓN en sí no se pierde — sobrevive como
      // huérfana en el HITLGate y, si el humano dice que sí, la acción se
      // ejecuta igual vía onOrphanApproved.
      // 'retrying' igual: el temporizador del reintento murió con el proceso.
      // No se reencola sola — un reinicio no debe disparar trabajo a ciegas.
      if (['queued', 'running', 'awaiting_approval', 'retrying'].includes(t.status)) {
        t.status = 'interrupted';
        t.error = 'proceso reiniciado con la tarea en vuelo';
        interrupted++;
        this._persistTask(t);
        this.audit.log({ tenantId: this.tenantId, event: 'task:interrupted', taskId: t.id });
      }
      this._tasks.set(t.id, t);
    }
    return { restored: saved.length, interrupted };
  }

  /** Reintenta una tarea interrumpida o fallida como una tarea NUEVA. */
  async retryTask(taskId) {
    const prev = this._tasks.get(taskId);
    if (!prev) throw new Error(`tarea no encontrada: ${taskId}`);
    if (!['interrupted', 'failed'].includes(prev.status)) {
      throw new Error(`solo se reintentan tareas interrumpidas o fallidas (estado: ${prev.status})`);
    }
    const newId = await this.handle({ ...prev.payload, retryOf: taskId });
    return newId;
  }

  registerDepartment(manager) {
    this.departments.set(manager.department, manager);
    return manager;
  }

  start() {
    this.queue.start(this._execute.bind(this));
  }

  /**
   * Punto de entrada de TODA solicitud de un cliente final.
   * @param {object} input - { text, channel, customerId, ... }
   */
  async handle(input) {
    // Cuota de plan: corta antes de hacer trabajo si el tenant agotó su mes.
    if (this.usageMeter) {
      const q = this.usageMeter.check(this.tenantId);
      if (!q.allowed) {
        this.audit.log({ tenantId: this.tenantId, event: 'quota:exceeded', used: q.used, limit: q.limit });
        const err = new Error(`Cuota mensual agotada (${q.used}/${q.limit} llamadas).`);
        err.code = 'quota_exceeded';
        throw err;
      }
    }

    const intent = await this._classify(input);
    // `fallback` lo consume el SystemOptimizer: es su señal de "caso que nadie
    // reconoció". Deducirlo desde fuera obligaba a reimplementar la
    // clasificación, que es justo la clase de duplicado que se desincroniza.
    const task = {
      fallback: intent.fallback === true,
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: this.tenantId,
      type: intent.type,
      department: intent.department,
      payload: input,
      createdAt: new Date().toISOString(),
      status: 'queued',
    };

    this._tasks.set(task.id, task);
    this._pruneTasks();
    this._persistTask(task);
    this.audit.log({ tenantId: this.tenantId, event: 'task:queued', taskId: task.id, intent });
    this.bus.emit('task:queued', task);
    await this.queue.enqueue(task);
    return task.id;
  }

  /**
   * Clasificación de intención → departamento. Usa el modelo barato (fast).
   * En desarrollo cae a reglas simples si no hay modelo.
   */
  async _classify(input) {
    // Los webhooks de proveedores (Stripe, etc.) conocen su propio departamento/tipo
    // de antemano — se saltan la clasificación por palabras clave del texto.
    if (input.type && input.department) return { type: input.type, department: input.department };

    const text = (input.text || '').toLowerCase();

    // Lo aprendido va primero: si el optimizador descubrió que en ESTE negocio
    // "incidencia de báscula" es de operaciones y no de soporte, esa regla sabe
    // más que la lista genérica de abajo.
    for (const r of this._learnedRoutes) {
      if (Orchestrator.matchesKeyword(text, r.keyword)) {
        return { department: r.department, type: r.type, learned: true };
      }
    }

    const rules = [
      // Términos on-chain y legales específicos primero: son inequívocos, a
      // diferencia de "precio"/"contrato" (sales) que colarían frases como
      // "precio del gas" o "revisa esta cláusula del contrato".
      { kw: ['validador', 'validator', 'bridge', 'nodo', 'estado de la cadena', 'blockchain status', 'gobernanza', 'propuesta de gobernanza', 'precio del gas', 'gas price'], department: 'blockchain', type: 'blockchain:monitor' },
      { kw: ['revisa el contrato', 'revisar contrato', 'cláusula', 'clausula', 'rgpd', 'gdpr', 'nis2', 'dora', 'ens', 'esquema nacional de seguridad', 'veri*factu', 'crea y crece', 'normativa legal', 'acuerdo de confidencialidad', 'aviso legal', 'protección de datos'], department: 'legal', type: 'legal:review' },
      { kw: ['tokenomics', 'precio del token', 'precio de bez', 'salud del token', 'bez-coin', 'bez coin'], department: 'treasury', type: 'treasury:tokenomics' },
      { kw: ['tesorería', 'tesoreria', 'treasury', 'runway', 'balance del treasury', 'meses de autonomía', 'meses de autonomia'], department: 'treasury', type: 'treasury:runway' },
      { kw: ['inversor', 'family office', 'fondo de capital', 'venture capital', 'ronda de inversión', 'ronda de inversion', 'ronda de financiación', 'ronda de financiacion', 'term sheet', 'due diligence', 'capital institucional'], department: 'fundraising', type: 'fundraising:inbound' },
      { kw: ['precio', 'comprar', 'demo', 'contrato', 'propuesta', 'cotiza'], department: 'sales', type: 'sales:inbound' },
      { kw: ['no funciona', 'error', 'ayuda', 'problema', 'soporte', 'factura no'], department: 'support', type: 'support:ticket' },
      { kw: ['campaña', 'contenido', 'redes', 'post', 'marketing', 'seo'], department: 'marketing', type: 'marketing:request' },
      { kw: ['cv', 'vacante', 'candidato', 'entrevista', 'nómina', 'empleado'], department: 'hr', type: 'hr:request' },
      { kw: ['factura', 'pago', 'cobro', 'impago', 'contabilidad'], department: 'finance', type: 'finance:request' },
      { kw: ['informe operativo', 'inventario', 'stock', 'proveedor', 'compra', 'logística', 'operaciones'], department: 'operations', type: 'operations:request' },
    ];
    for (const r of rules) {
      if (r.kw.some(k => Orchestrator.matchesKeyword(text, k))) return { department: r.department, type: r.type };
    }
    // Red de seguridad: nadie reconoció el caso. Se marca para que el
    // optimizador lo cuente como candidato a regla nueva.
    return { department: 'support', type: 'support:ticket', fallback: true };
  }

  /**
   * ¿Aparece la palabra clave en el texto?
   *
   * Las claves de UNA palabra se comparan por límite de palabra; las frases,
   * por subcadena. La distinción no es cosmética: con subcadena a secas, `ens`
   * (Esquema Nacional de Seguridad) casaba dentro de "tok<b>ens</b> del" y
   * mandaba a Legal cualquier mensaje sobre tokens — en una empresa de tokens,
   * eso es casi todo el soporte. Lo mismo con `demo` en "democracia", `post`
   * en "impostor" o `pago` en "pagoda".
   *
   * Las frases se dejan por subcadena a propósito: ya son inequívocas y así
   * toleran plurales y conjugaciones ("revisar contrato" en "revisar contratos").
   *
   * La palabra suelta se exige al PRINCIPIO de palabra, pero se permite lo que
   * venga detrás. En español hace falta: "factura" tiene que seguir casando con
   * "facturación" y "facturas". El precio de esa tolerancia es que "demo" casa
   * con "democracia" y "pago" con "pagoda"; se asume a sabiendas, porque en una
   * bandeja de soporte B2B esas palabras no aparecen, mientras que las formas
   * flexionadas de factura/pago/contrato aparecen a diario.
   */
  static matchesKeyword(text, keyword) {
    const k = String(keyword).trim();
    if (!k) return false;
    if (k.includes(' ')) return text.includes(k);      // frase: subcadena
    // `\b` de JS no entiende acentos, así que la frontera se declara a mano.
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}`, 'iu').test(text);
  }

  async _execute(task) {
    const manager = this.departments.get(task.department);
    if (!manager) {
      // Mismos metadatos que cualquier otro fallo, para que el panel no muestre
      // huecos: es permanente (reintentar daría exactamente lo mismo).
      task.status = 'failed';
      task.error = `sin departamento: ${task.department}`;
      task.attempts = (task.attempts || 0) + 1;
      task.deadLetter = false;
      task.notRetriedBecause = 'error permanente';
      this._persistTask(task);
      this.audit.log({
        tenantId: this.tenantId, event: 'task:failed', taskId: task.id,
        error: task.error, attempts: task.attempts, deadLetter: false, reason: task.notRetriedBecause,
      });
      this.bus.emit('task:failed', task);
      return;
    }
    task.status = 'running';
    task.startedAt = Date.now();
    task.attempts = (task.attempts || 0) + 1;
    this._persistTask(task);

    // Contexto de ejecución: permite que el HITLGate, sin conocer ni la tarea
    // ni la cola, aparque esta tarea mientras espera a un humano. Así una
    // aprobación pendiente no retiene un hueco de concurrencia del tenant.
    const exec = {
      taskId: task.id,
      // Un agente ejecutó algo con efecto fuera del sistema: desde aquí, la
      // tarea deja de ser reintentable en automático (ver _shouldRetry).
      markSideEffect: (detail) => {
        if (task.sideEffectPerformed) return;
        task.sideEffectPerformed = true;
        task.firstSideEffect = detail;
        this._persistTask(task);
      },
      park: (approvalId = null) => {
        task.status = 'awaiting_approval';
        task.awaitingApprovalId = approvalId;
        task.waitingSince = Date.now();
        this._persistTask(task);
        this.audit.log({ tenantId: this.tenantId, event: 'task:awaiting_approval', taskId: task.id, approvalId });
        this.bus.emit('task:awaiting_approval', task);
        this.queue.park();
      },
      unpark: async () => {
        await this.queue.unpark();
        // El tiempo esperando a un humano no cuenta como trabajo del agente.
        if (task.waitingSince) {
          task.waitedMs = (task.waitedMs || 0) + (Date.now() - task.waitingSince);
          task.waitingSince = null;
        }
        task.status = 'running';
        task.awaitingApprovalId = null;
        this._persistTask(task);
        this.bus.emit('task:resumed', task);
      },
    };

    // Latencia REAL del agente: descuenta lo que la tarea pasó esperando a un
    // humano. Antes, una aprobación de 43 min se reportaba como 43 min de
    // "trabajo" y contaminaba las métricas de rendimiento.
    const elapsed = () => (Date.now() - task.startedAt) - (task.waitedMs || 0);

    try {
      const result = await runInTask(exec, () => manager.run(task));
      task.status = 'completed';
      task.ms = elapsed();
      task.result = result;
      this._persistTask(task);
      this.audit.log({ tenantId: this.tenantId, event: 'task:completed', taskId: task.id });
      this.bus.emit('task:completed', task);
    } catch (err) {
      task.ms = task.startedAt ? elapsed() : undefined;
      task.error = err.message;

      const { retry, reason } = this._shouldRetry(task, err);
      if (retry) {
        const delayMs = this._retryDelay(task.attempts);
        task.status = 'retrying';
        task.nextRetryAt = Date.now() + delayMs;
        this._persistTask(task);
        this.audit.log({
          tenantId: this.tenantId, event: 'task:retrying', taskId: task.id,
          attempt: task.attempts, maxAttempts: this.retry.maxAttempts, delayMs, error: err.message,
        });
        this.bus.emit('task:retrying', task);
        this._scheduleRetry(task, delayMs);
        return;   // libera el hueco de cola; el temporizador la reencolará
      }

      // Sin reintento: terminal. `deadLetter` marca lo que agotó su presupuesto
      // de reintentos, para poder filtrarlo del ruido de fallos permanentes.
      task.status = 'failed';
      task.deadLetter = task.attempts >= this.retry.maxAttempts && !Orchestrator.isPermanentError(err.message);
      task.notRetriedBecause = reason;
      task.nextRetryAt = null;
      this._persistTask(task);
      this.audit.log({
        tenantId: this.tenantId, event: 'task:failed', taskId: task.id,
        error: err.message, attempts: task.attempts, deadLetter: !!task.deadLetter, reason,
      });
      this.bus.emit('task:failed', task);
    }
  }

  getTask(id) { return this._tasks.get(id) || null; }

  /**
   * Como getTask(), pero si la tarea ya salió de la ventana caliente la busca
   * en el Store. Así podar la RAM no hace desaparecer una tarea de la API.
   */
  async findTask(id) {
    const hot = this._tasks.get(id);
    if (hot) return hot;
    if (!this.store?.getTask) return null;
    try {
      return await this.store.getTask({ tenantId: this.tenantId, taskId: id });
    } catch {
      return null;
    }
  }

  /** IDs de todos los agentes del tenant (managers + especialistas). */
  agentIds() {
    const ids = [];
    for (const manager of this.departments.values()) {
      ids.push(manager.id);
      if (manager.specialists) ids.push(...manager.specialists.keys());
    }
    return ids;
  }

  /** Últimas n tareas (resumen), de más reciente a más antigua. */
  recentTasks(n = 10) {
    return [...this._tasks.values()]
      .slice(-n)
      .reverse()
      .map((t) => ({
        id: t.id, status: t.status, department: t.department, type: t.type, createdAt: t.createdAt,
        // Para que el operador distinga en el panel un fallo puntual de uno que
        // ya agotó sus reintentos, y sepa si la tarea llegó a hacer algo fuera.
        attempts: t.attempts || 0,
        deadLetter: !!t.deadLetter,
        sideEffectPerformed: !!t.sideEffectPerformed,
      }));
  }

  /**
   * Espera a que una tarea llegue a estado terminal (completed/failed).
   * Útil para canales síncronos (widget web): encola y devuelve el resultado.
   */
  waitForTask(id, { timeoutMs = 30000 } = {}) {
    const task = this._tasks.get(id);
    if (task && (task.status === 'completed' || task.status === 'failed')) {
      return Promise.resolve(task);
    }
    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.bus.off('task:completed', onDone);
        this.bus.off('task:failed', onDone);
      };
      const onDone = (t) => { if (t.id === id) { cleanup(); resolve(t); } };
      if (timeoutMs) {
        timer = setTimeout(() => { cleanup(); reject(new Error(`waitForTask: timeout (${id})`)); }, timeoutMs);
      }
      this.bus.on('task:completed', onDone);
      this.bus.on('task:failed', onDone);
    });
  }

  /** Encola una solicitud y espera su resultado (vía síncrona para canales). */
  async handleAndWait(input, opts = {}) {
    const id = await this.handle(input);
    return this.waitForTask(id, opts);
  }
}

module.exports = Orchestrator;
