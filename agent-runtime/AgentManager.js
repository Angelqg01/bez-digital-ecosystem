/**
 * BeZhas Agent Runtime — AgentManager
 * Gestión del ciclo de vida de todos los agentes del ecosistema BeZhas.
 * Conecta: OpenClawAgent.sol ↔ AEGIS ↔ OpenClaw Engine ↔ Telegram
 */

'use strict';

const EventEmitter = require('events');
const AgentRegistry = require('./AgentRegistry');
const MemoryManager = require('./MemoryManager');
const TaskQueue = require('./TaskQueue');
const BlockchainConnector = require('./connectors/BlockchainConnector');
const OpenClawConnector = require('./connectors/OpenClawConnector');
const AegisConnector = require('./connectors/AegisConnector');
const OrchestrationManifest = require('./core/OrchestrationManifest');
const OrchestrationEventPublisher = require('./core/OrchestrationEventPublisher');

class AgentManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      rpcUrl: config.rpcUrl || process.env.RPC_URL || 'http://localhost:8545',
      openclawUrl: config.openclawUrl || process.env.OPENCLAW_URL || 'http://localhost:8080',
      openClawAgentAddress: config.openClawAgentAddress || process.env.OPENCLAW_AGENT_ADDRESS,
      aegisAddress: config.aegisAddress || process.env.AEGIS_ADDRESS,
      privateKey: config.privateKey || process.env.AGENT_PRIVATE_KEY,
      hitlEnabled: config.hitlEnabled !== false, // Human-in-the-loop ON por defecto
      hitlTimeoutMs: config.hitlTimeoutMs || 60_000, // 60s para confirmar
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      ...config,
    };

    this.registry = new AgentRegistry();
    this.memory = new MemoryManager(this.config.redisUrl);
    this.taskQueue = new TaskQueue({ maxConcurrent: this.config.maxConcurrentTasks });
    this.blockchain = new BlockchainConnector(this.config);
    this.openclaw = new OpenClawConnector(this.config.openclawUrl);
    this.aegis = new AegisConnector(this.config);
    this.orchestration = new OrchestrationManifest({
      path: config.orchestrationManifestPath,
    });
    this.events = new OrchestrationEventPublisher({
      memory: this.memory,
      manifest: this.orchestration,
      enabled: config.eventPublishing !== false,
    });

    this._running = false;
    this._agents = new Map(); // agentId → agente instancia
    this._hitlPending = new Map(); // taskId → { resolve, reject, timeout }
  }

  // ─────────────────────────────────────────────
  // INICIALIZACIÓN
  // ─────────────────────────────────────────────

  async start() {
    if (this._running) return;
    console.log('[AgentManager] 🚀 Iniciando BeZhas Agent Runtime...');

    const manifest = this.orchestration.load();
    if (manifest) {
      const status = this.orchestration.getStatus();
      console.log(`[AgentManager] 🧭 Orquestación v${status.version} cargada (${status.departments} departamentos, ${status.routes} rutas)`);
    } else {
      console.warn(`[AgentManager] ⚠️ Orquestación no disponible: ${this.orchestration.error?.message || 'manifest missing'}`);
    }

    // ── Conexiones resilientes (cada una independiente) ──
    try {
      await this.memory.connect();
    } catch (err) {
      console.warn(`[AgentManager] ⚠️ Memory connect falló (modo degradado): ${err.message}`);
    }

    try {
      await this.blockchain.connect();
    } catch (err) {
      console.warn(`[AgentManager] ⚠️ Blockchain connect falló (modo degradado): ${err.message}`);
    }

    try {
      await this.aegis.start();
    } catch (err) {
      console.warn(`[AgentManager] ⚠️ AEGIS start falló (modo degradado): ${err.message}`);
    }

    // Cargar agentes registrados
    try {
      await this._loadAgents();
    } catch (err) {
      console.warn(`[AgentManager] ⚠️ Load agents falló: ${err.message}`);
    }

    // Suscribir a eventos on-chain (OpenClawAgent.sol)
    try {
      this._subscribeToBlockchainEvents();
    } catch (err) {
      console.warn(`[AgentManager] ⚠️ Blockchain events subscription falló: ${err.message}`);
    }

    // Suscribir a alertas AEGIS
    try {
      this._subscribeToAegisAlerts();
    } catch (err) {
      console.warn(`[AgentManager] ⚠️ AEGIS alerts subscription falló: ${err.message}`);
    }

    // Iniciar TaskQueue
    this.taskQueue.start(this._executeTask.bind(this));

    this._running = true;
    console.log('[AgentManager] ✅ Runtime activo. Agentes:', [...this._agents.keys()]);
    this.emit('started');
  }

  async stop() {
    if (!this._running) return;
    console.log('[AgentManager] 🛑 Deteniendo Agent Runtime...');
    this.taskQueue.stop();
    await this.aegis.stop();
    await this.blockchain.disconnect();
    await this.memory.disconnect();
    this._running = false;
    this.emit('stopped');
  }

  // ─────────────────────────────────────────────
  // REGISTRO DE AGENTES
  // ─────────────────────────────────────────────

  registerAgent(agentClass, options = {}) {
    const agent = new agentClass({
      ...options,
      memory: this.memory,
      blockchain: this.blockchain,
      openclaw: this.openclaw,
      manager: this,
    });
    this._agents.set(agent.id, agent);
    this.registry.register(agent);
    console.log(`[AgentManager] 📌 Agente registrado: ${agent.id} (${agent.name})`);
    return agent;
  }

  getAgent(agentId) {
    return this._agents.get(agentId) || null;
  }

  listAgents() {
    return [...this._agents.values()].map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      capabilities: a.capabilities,
    }));
  }

  getOrchestrationStatus() {
    return this.orchestration.getStatus();
  }

  // ─────────────────────────────────────────────
  // DESPACHO DE TAREAS
  // ─────────────────────────────────────────────

  /**
   * Encola una tarea para ser ejecutada por el agente apropiado.
   * @param {object} task - { type, payload, priority, source, requestedBy }
   * @returns {Promise<string>} taskId
   */
  async dispatch(task) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const routeInfo = this.orchestration.getRouteInfo(task.type);
    const enrichedTask = {
      id: taskId,
      createdAt: new Date().toISOString(),
      status: 'queued',
      orchestration: {
        departmentId: routeInfo.departmentId,
        routeAgentId: routeInfo.agentId,
        eventStream: routeInfo.eventStream,
        kpis: routeInfo.kpis,
      },
      ...task,
    };

    // Persistir en Redis
    await this.memory.setTask(taskId, enrichedTask);
    await this.events.taskQueued(enrichedTask);

    // Encolar
    await this.taskQueue.enqueue(enrichedTask);

    console.log(`[AgentManager] 📬 Tarea encolada: ${taskId} (${task.type})`);
    this.emit('task:queued', enrichedTask);
    return taskId;
  }

  // ─────────────────────────────────────────────
  // HUMAN-IN-THE-LOOP (HITL)
  // ─────────────────────────────────────────────

  /**
   * Pausa la ejecución de una tarea hasta que un humano confirme.
   * Envía notificación vía OpenClaw → Telegram/Discord.
   * @param {string} taskId
   * @param {object} context - Información a mostrar al humano
   * @returns {Promise<{approved: boolean, response: string}>}
   */
  async requestHumanApproval(taskId, context) {
    if (!this.config.hitlEnabled) {
      console.warn('[AgentManager] ⚠️ HITL desactivado — aprobando automáticamente');
      return { approved: true, response: 'auto-approved' };
    }

    console.log(`[AgentManager] 👤 HITL requerido para tarea: ${taskId}`);

    // Enviar notificación al humano vía OpenClaw
    await this.openclaw.sendHITLRequest({
      taskId,
      context,
      approveUrl: `${this.config.hitlCallbackUrl}/approve/${taskId}`,
      rejectUrl: `${this.config.hitlCallbackUrl}/reject/${taskId}`,
    });

    // Persistir estado HITL en Redis
    await this.memory.setHITLPending(taskId, { context, requestedAt: new Date().toISOString() });
    await this.events.hitlRequested(taskId, context);

    // Esperar respuesta con timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._hitlPending.delete(taskId);
        reject(new Error(`HITL timeout para tarea ${taskId}`));
      }, this.config.hitlTimeoutMs);

      this._hitlPending.set(taskId, { resolve, reject, timeout });
    });
  }

  /**
   * Recibe respuesta HITL (llamado por el canal de messaging o API)
   */
  async resolveHITL(taskId, approved, response = '') {
    const pending = this._hitlPending.get(taskId);
    if (!pending) {
      console.warn(`[AgentManager] ⚠️ No hay HITL pendiente para: ${taskId}`);
      return false;
    }

    clearTimeout(pending.timeout);
    this._hitlPending.delete(taskId);
    await this.memory.clearHITLPending(taskId);
    await this.events.hitlResolved(taskId, approved, response);

    pending.resolve({ approved, response });
    console.log(`[AgentManager] ✅ HITL resuelto: ${taskId} → ${approved ? 'APROBADO' : 'RECHAZADO'}`);
    this.emit('hitl:resolved', { taskId, approved, response });
    return true;
  }

  // ─────────────────────────────────────────────
  // EVENTOS ON-CHAIN (OpenClawAgent.sol)
  // ─────────────────────────────────────────────

  _subscribeToBlockchainEvents() {
    // Escuchar eventos emitidos por OpenClawAgent.sol
    this.blockchain.on('AgentTaskRequested', async (event) => {
      console.log('[AgentManager] ⛓️ Tarea desde blockchain:', event);
      await this.dispatch({
        type: 'blockchain:task',
        payload: event,
        priority: 'high',
        source: 'on-chain',
      });
    });

    this.blockchain.on('AegisAlertRaised', async (event) => {
      console.log('[AgentManager] 🔴 Alerta AEGIS desde blockchain:', event);
      await this.dispatch({
        type: 'aegis:alert',
        payload: event,
        priority: 'critical',
        source: 'on-chain',
      });
    });

    this.blockchain.on('WorkflowTriggered', async (event) => {
      console.log('[AgentManager] 🔄 Workflow triggered:', event);
      await this.dispatch({
        type: 'workflow:execute',
        payload: event,
        priority: 'normal',
        source: 'on-chain',
      });
    });
  }

  _subscribeToAegisAlerts() {
    this.aegis.on('threat:detected', async (threat) => {
      console.log('[AgentManager] 🚨 AEGIS detectó amenaza:', threat.type);
      const securityAgent = this._agents.get('security-agent');
      if (securityAgent) {
        await securityAgent.handleThreat(threat);
      }
    });
  }

  // ─────────────────────────────────────────────
  // EJECUCIÓN DE TAREAS
  // ─────────────────────────────────────────────

  async _executeTask(task) {
    console.log(`[AgentManager] ⚙️ Ejecutando: ${task.id} (${task.type})`);
    await this.memory.updateTask(task.id, { status: 'running', startedAt: new Date().toISOString() });
    await this.events.taskStarted(task);
    this.emit('task:started', task);

    try {
      const agent = this._selectAgent(task);
      if (!agent) throw new Error(`Sin agente disponible para tipo: ${task.type}`);

      const result = typeof agent._run === 'function'
        ? await agent._run(task)
        : await agent.execute(task);

      await this.memory.updateTask(task.id, {
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
      });

      console.log(`[AgentManager] ✅ Tarea completada: ${task.id}`);
      await this.events.taskCompleted(task, result);
      this.emit('task:completed', { task, result });
      return result;

    } catch (err) {
      console.error(`[AgentManager] ❌ Error en tarea ${task.id}:`, err.message);
      await this.memory.updateTask(task.id, {
        status: 'failed',
        error: err.message,
        failedAt: new Date().toISOString(),
      });
      await this.events.taskFailed(task, err);
      this.emit('task:failed', { task, error: err });
      throw err;
    }
  }

  _selectAgent(task) {
    const manifestAgentId = this.orchestration.getRouting(task.type);
    if (manifestAgentId) {
      const manifestAgent = this._agents.get(manifestAgentId);
      if (manifestAgent) return manifestAgent;

      console.warn(`[AgentManager] ⚠️ Ruta manifest "${task.type}" apunta a agente no registrado: ${manifestAgentId}`);
    }

    // Routing por tipo de tarea (fallback local)
    const routingMap = {
      'aegis:alert':        'security-agent',
      'blockchain:task':    'workflow-agent',
      'workflow:execute':   'workflow-agent',
      'trade:execute':      'trading-agent',
      'trade:analyze':      'trading-agent',
      'tokenomics:monitor': 'tokenomics-agent',
      'tokenomics:analyze': 'tokenomics-agent',
      'tokenomics:analysis':'tokenomics-agent',
      'tokenomics:report':  'tokenomics-agent',
      'staking:alert':      'tokenomics-agent',
      'bridge:alert':       'tokenomics-agent',
      'bridge:monitor':     'tokenomics-agent',
      'compliance:check':   'compliance-agent',
      'marketing:generate': 'marketing-agent',
    };

    const agentId = routingMap[task.type] || task.agentId;
    return this._agents.get(agentId) || null;
  }

  async _loadAgents() {
    // Los agentes se registran externamente en index.js
    // Este método carga agentes persistidos desde Redis si existiera estado previo
    const savedState = await this.memory.getAgentState('manager');
    if (savedState) {
      console.log('[AgentManager] 📦 Estado previo recuperado desde Redis');
    }
  }
}

module.exports = AgentManager;
