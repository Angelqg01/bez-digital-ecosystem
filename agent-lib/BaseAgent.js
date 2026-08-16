/**
 * BeZhas Agent Runtime — BaseAgent
 * Clase abstracta base. Todos los agentes del ecosistema extienden esta clase.
 *
 * Ciclo de vida:
 *   initialize() → execute(task) → [HITL?] → result → memory.remember()
 */

'use strict';

const { randomUUID } = require('crypto');

class BaseAgent {
  /**
   * @param {object} opts
   * @param {string} opts.id         - ID único del agente (default: auto UUID)
   * @param {string} opts.name       - Nombre humano del agente
   * @param {string[]} opts.capabilities - Lista de tipos de tarea que maneja
   * @param {object} opts.memory     - MemoryManager instance
   * @param {object} opts.blockchain - BlockchainConnector instance
   * @param {object} opts.openclaw   - OpenClawConnector instance
   * @param {object} opts.manager    - AgentManager instance (para HITL)
   */
  constructor(opts = {}) {
    if (new.target === BaseAgent) {
      throw new Error('BaseAgent es abstracta — debes extenderla');
    }

    this.id           = opts.id || `agent-${randomUUID().slice(0, 8)}`;
    this.name         = opts.name || 'UnnamedAgent';
    this.capabilities = opts.capabilities || [];
    this.status       = 'idle';   // idle | running | paused | error
    this.version      = opts.version || '1.0.0';

    // Dependencias inyectadas por AgentManager
    this.memory     = opts.memory;
    this.blockchain = opts.blockchain;
    this.openclaw   = opts.openclaw;
    this.manager    = opts.manager;

    // Configuración del agente
    this.config = opts.config || {};

    // Métricas internas
    this._stats = {
      tasksExecuted: 0,
      tasksFailed: 0,
      lastExecutedAt: null,
    };
  }

  // ─────────────────────────────────────────────
  // MÉTODOS ABSTRACTOS — obligatorio implementar
  // ─────────────────────────────────────────────

  /**
   * Lógica principal del agente. DEBE ser implementada por cada subclase.
   * @param {object} task - Tarea encolada por AgentManager
   * @returns {Promise<object>} resultado de la ejecución
   */
  async execute(task) {
    throw new Error(`${this.name} debe implementar execute(task)`);
  }

  // ─────────────────────────────────────────────
  // MÉTODOS BASE — disponibles para todas las subclases
  // ─────────────────────────────────────────────

  /**
   * Llama al LLM vía OpenClaw con el fallback chain configurado.
   * Ollama (localhost:11434) es el último fallback local.
   */
  async think(prompt, opts = {}) {
    const response = await this.openclaw.complete({
      prompt,
      systemPrompt: this._systemPrompt(),
      model: opts.model || null,  // null = auto fallback chain
      maxTokens: opts.maxTokens || 1024,
      agentId: this.id,
    });
    return response.text;
  }

  /**
   * Solicita aprobación humana antes de ejecutar una acción crítica.
   * Bloquea hasta recibir respuesta o timeout.
   */
  async requireApproval(taskId, context) {
    if (!this.manager) throw new Error('Manager no disponible para HITL');
    return this.manager.requestHumanApproval(taskId, {
      agent: this.name,
      agentId: this.id,
      ...context,
    });
  }

  /**
   * Persiste un hecho en la memoria del agente.
   */
  async remember(key, value) {
    if (!this.memory) return;
    await this.memory.remember(this.id, key, value);
  }

  /**
   * Recupera un hecho de la memoria del agente.
   */
  async recall(key) {
    if (!this.memory) return null;
    return this.memory.recall(this.id, key);
  }

  /**
   * Recupera toda la memoria del agente.
   */
  async recallAll() {
    if (!this.memory) return {};
    return this.memory.recallAll(this.id);
  }

  /**
   * Envía una notificación al canal de messaging (Telegram/Discord).
   */
  async notify(message, opts = {}) {
    if (!this.openclaw) return;
    await this.openclaw.sendNotification({
      agentId: this.id,
      agentName: this.name,
      message,
      channel: opts.channel || 'telegram',
      level: opts.level || 'info',
    });
  }

  // ─────────────────────────────────────────────
  // CICLO DE VIDA INTERNO
  // ─────────────────────────────────────────────

  async _run(task) {
    this.status = 'running';
    this._stats.tasksExecuted++;
    this._stats.lastExecutedAt = new Date().toISOString();

    try {
      // Cargar memoria previa antes de ejecutar
      const memories = await this.recallAll();
      task._agentMemory = memories;

      const result = await this.execute(task);
      this.status = 'idle';
      return result;

    } catch (err) {
      this.status = 'error';
      this._stats.tasksFailed++;
      throw err;
    }
  }

  getStats() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      capabilities: this.capabilities,
      version: this.version,
      ...this._stats,
    };
  }

  // System prompt base — cada agente puede sobreescribir
  _systemPrompt() {
    return `Eres ${this.name}, un agente AI especializado del ecosistema BeZhas Blockchain.
Tu rol: ${this.capabilities.join(', ')}.
Actúas con precisión, transparencia y siempre en beneficio del usuario.
Cuando necesitas confirmación humana, lo indicas explícitamente.
Contexto: Plataforma blockchain L2 BeZhas sobre BNB Chain y Polygon.`;
  }
}

module.exports = BaseAgent;
