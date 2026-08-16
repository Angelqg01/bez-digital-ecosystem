/**
 * BeZhas Agent Runtime — MemoryManager
 * Memoria in-memory con TTL automático — Sin dependencias externas (Redis-free).
 * Compatible 1:1 con la API anterior basada en Redis.
 *
 * En Cloud Run (scale-to-zero), el estado es efímero: se pierde al apagar.
 * Para persistencia real, se podría conectar a Firestore (future).
 *
 * Namespaces lógicos:
 *   bezhas:agent:{agentId}:state      → Estado del agente
 *   bezhas:task:{taskId}              → Estado de una tarea
 *   bezhas:hitl:{taskId}              → Confirmaciones HITL pendientes
 *   bezhas:memory:{agentId}:{key}     → Memoria semántica del agente
 *   bezhas:session:{sessionId}        → Sesión de conversación
 *   bezhas:context:{entityId}         → Contexto de entidad
 */

'use strict';

class TTLMap {
  constructor() {
    this._store = new Map();
    this._timers = new Map();
  }

  set(key, value, ttlSeconds) {
    this.delete(key); // limpiar timer anterior
    this._store.set(key, value);
    if (ttlSeconds && ttlSeconds > 0) {
      const timer = setTimeout(() => {
        this._store.delete(key);
        this._timers.delete(key);
      }, ttlSeconds * 1000);
      timer.unref?.(); // No bloquear el event loop
      this._timers.set(key, timer);
    }
  }

  get(key) {
    return this._store.get(key) || null;
  }

  delete(key) {
    this._store.delete(key);
    const timer = this._timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(key);
    }
  }

  keys(pattern) {
    const prefix = pattern.replace('*', '');
    return [...this._store.keys()].filter(k => k.startsWith(prefix));
  }

  clear() {
    for (const timer of this._timers.values()) clearTimeout(timer);
    this._store.clear();
    this._timers.clear();
  }

  get size() {
    return this._store.size;
  }
}

// ─────────────────────────────────────────────
// Streams in-memory (reemplazo de Redis Streams)
// ─────────────────────────────────────────────
class InMemoryStream {
  constructor(maxLen = 1000) {
    this._entries = [];
    this.maxLen = maxLen;
  }

  add(fields) {
    const id = `${Date.now()}-${this._entries.length}`;
    this._entries.push({ id, fields, ts: Date.now() });
    if (this._entries.length > this.maxLen) {
      this._entries = this._entries.slice(-this.maxLen);
    }
    return id;
  }

  range(count = 50) {
    return this._entries.slice(-count).reverse();
  }
}

class MemoryManager {
  constructor(redisUrl) {
    // redisUrl se acepta por compatibilidad pero se ignora
    this._store = new TTLMap();
    this._streams = new Map();
    this._connected = false;
    this._fallbackSessions = new Map();
    this.maxMessages = 50;
    this.ttl = 3600;
    this.PREFIX = 'bezhas';
    this.DEFAULT_TTL = 86_400; // 24h
    this.client = null; // Compatibilidad: algunas partes chequean this.client
  }

  // ─────────────────────────────────────────────
  // CONEXIÓN (no-op, siempre disponible)
  // ─────────────────────────────────────────────

  async connect() {
    this._connected = true;
    this.client = this; // self-reference para compatibilidad con checks como this.client?.isOpen
    console.log('[MemoryManager] ✅ In-memory storage activo (sin Redis)');
  }

  async disconnect() {
    this._store.clear();
    this._connected = false;
    console.log('[MemoryManager] 🔌 In-memory storage liberado');
  }

  // Compatibilidad con checks de Redis client
  get isOpen() {
    return this._connected;
  }

  // ─────────────────────────────────────────────
  // ESTADO DE AGENTES
  // ─────────────────────────────────────────────

  async getAgentState(agentId) {
    const key = `${this.PREFIX}:agent:${agentId}:state`;
    return this._getJSON(key);
  }

  async setAgentState(agentId, state) {
    const key = `${this.PREFIX}:agent:${agentId}:state`;
    this._setJSON(key, { ...state, updatedAt: new Date().toISOString() }, this.DEFAULT_TTL * 7);
  }

  async updateAgentState(agentId, patch) {
    const current = await this.getAgentState(agentId) || {};
    await this.setAgentState(agentId, { ...current, ...patch });
  }

  // ─────────────────────────────────────────────
  // GESTIÓN DE TAREAS
  // ─────────────────────────────────────────────

  async setTask(taskId, task) {
    const key = `${this.PREFIX}:task:${taskId}`;
    this._setJSON(key, task, this.DEFAULT_TTL);
  }

  async getTask(taskId) {
    const key = `${this.PREFIX}:task:${taskId}`;
    return this._getJSON(key);
  }

  async updateTask(taskId, patch) {
    const task = await this.getTask(taskId) || {};
    await this.setTask(taskId, { ...task, ...patch });
  }

  async listRecentTasks(limit = 50) {
    const keys = this._store.keys(`${this.PREFIX}:task:`);
    const tasks = keys.slice(0, limit).map(k => this._getJSON(k)).filter(Boolean);
    return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ─────────────────────────────────────────────
  // ORCHESTRATION EVENTS (In-Memory Streams)
  // ─────────────────────────────────────────────

  _getStream(name) {
    if (!this._streams.has(name)) {
      this._streams.set(name, new InMemoryStream());
    }
    return this._streams.get(name);
  }

  async xadd(stream, fields) {
    return this._getStream(stream).add(fields);
  }

  async listRecentEvents(stream = 'bezhas:events:all', limit = 50) {
    const s = this._streams.get(stream);
    if (!s) return [];
    return s.range(limit).map(entry => ({ id: entry.id, ...entry.fields }));
  }

  async listEventStreams() {
    return [...this._streams.keys()].sort();
  }

  // ─────────────────────────────────────────────
  // HUMAN-IN-THE-LOOP STATE
  // ─────────────────────────────────────────────

  async setHITLPending(taskId, context) {
    const key = `${this.PREFIX}:hitl:${taskId}`;
    this._setJSON(key, {
      taskId, context,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    }, 300);
  }

  async getHITLPending(taskId) {
    const key = `${this.PREFIX}:hitl:${taskId}`;
    return this._getJSON(key);
  }

  async clearHITLPending(taskId) {
    const key = `${this.PREFIX}:hitl:${taskId}`;
    this._store.delete(key);
  }

  async listPendingHITL() {
    const keys = this._store.keys(`${this.PREFIX}:hitl:`);
    return keys.map(k => this._getJSON(k)).filter(Boolean);
  }

  // ─────────────────────────────────────────────
  // MEMORIA SEMÁNTICA DEL AGENTE
  // ─────────────────────────────────────────────

  async remember(agentId, key, value, ttlSeconds = this.DEFAULT_TTL * 30) {
    const redisKey = `${this.PREFIX}:memory:${agentId}:${key}`;
    this._setJSON(redisKey, { value, rememberedAt: new Date().toISOString() }, ttlSeconds);
  }

  async recall(agentId, key) {
    const redisKey = `${this.PREFIX}:memory:${agentId}:${key}`;
    const data = this._getJSON(redisKey);
    return data ? data.value : null;
  }

  async forget(agentId, key) {
    const redisKey = `${this.PREFIX}:memory:${agentId}:${key}`;
    this._store.delete(redisKey);
  }

  async recallAll(agentId) {
    const keys = this._store.keys(`${this.PREFIX}:memory:${agentId}:`);
    const memories = {};
    for (const k of keys) {
      const shortKey = k.replace(`${this.PREFIX}:memory:${agentId}:`, '');
      const data = this._getJSON(k);
      if (data) memories[shortKey] = data.value;
    }
    return memories;
  }

  // ─────────────────────────────────────────────
  // SESIONES DE CONVERSACIÓN
  // ─────────────────────────────────────────────

  async saveSession(sessionId, messages) {
    const key = `${this.PREFIX}:session:${sessionId}`;
    this._setJSON(key, { sessionId, messages, updatedAt: new Date().toISOString() }, 3600);
  }

  async getSession(sessionId) {
    const key = `${this.PREFIX}:session:${sessionId}`;
    return this._getJSON(key) || { sessionId, messages: [] };
  }

  async appendToSession(sessionId, message) {
    const session = await this.getSession(sessionId);
    session.messages.push({ ...message, timestamp: new Date().toISOString() });
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }
    await this.saveSession(sessionId, session.messages);
  }

  // ─── API compatible con UnifiedAgent ───

  async append(sessionId, message) {
    return this.appendToSession(sessionId, message);
  }

  async getHistory(sessionId) {
    const session = await this.getSession(sessionId);
    return (session.messages || []).map((message) => {
      if (message.role === 'user') return { user: message.content, timestamp: message.timestamp };
      if (message.role === 'assistant') return { assistant: message.content, timestamp: message.timestamp };
      return message;
    });
  }

  async buildContext(sessionId, limit = 10) {
    const history = await this.getHistory(sessionId);
    return history.slice(-limit).map((item) => {
      if (item.user) return `Usuario: ${item.user}`;
      if (item.assistant) return `Agente: ${item.assistant}`;
      return JSON.stringify(item);
    }).join('\n');
  }

  async stats(sessionId) {
    const session = await this.getSession(sessionId);
    const messages = session.messages || [];
    return {
      messageCount: messages.length,
      maxMessages: this.maxMessages,
      firstMessageAt: messages[0]?.timestamp || null,
      lastMessageAt: messages[messages.length - 1]?.timestamp || null,
    };
  }

  async clear(sessionId) {
    const key = `${this.PREFIX}:session:${sessionId}`;
    this._store.delete(key);
  }

  // ─────────────────────────────────────────────
  // CONTEXTO DE ENTIDADES
  // ─────────────────────────────────────────────

  async setEntityContext(entityId, context) {
    const key = `${this.PREFIX}:context:${entityId}`;
    this._setJSON(key, { ...context, entityId, updatedAt: new Date().toISOString() }, this.DEFAULT_TTL * 30);
  }

  async getEntityContext(entityId) {
    const key = `${this.PREFIX}:context:${entityId}`;
    return this._getJSON(key);
  }

  // ─────────────────────────────────────────────
  // CACHÉ GENÉRICO
  // ─────────────────────────────────────────────

  async cache(key, value, ttlSeconds = 300) {
    const redisKey = `${this.PREFIX}:cache:${key}`;
    this._setJSON(redisKey, value, ttlSeconds);
  }

  async getCached(key) {
    const redisKey = `${this.PREFIX}:cache:${key}`;
    return this._getJSON(redisKey);
  }

  async invalidateCache(key) {
    const redisKey = `${this.PREFIX}:cache:${key}`;
    this._store.delete(redisKey);
  }

  // ─────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────

  async healthCheck() {
    return {
      status: 'ok',
      backend: 'in-memory',
      entries: this._store.size,
      streams: this._streams.size,
    };
  }

  // ─────────────────────────────────────────────
  // ALERTAS (compatibilidad)
  // ─────────────────────────────────────────────

  async getRecentAlerts() {
    return this.listRecentEvents('bezhas:events:alerts', 20);
  }

  // ─────────────────────────────────────────────
  // INTERNOS
  // ─────────────────────────────────────────────

  _setJSON(key, value, ttlSeconds) {
    this._store.set(key, JSON.stringify(value), ttlSeconds);
  }

  _getJSON(key) {
    const raw = this._store.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  // Redis-compatible command proxy (para OrchestrationEventPublisher)
  async sendCommand(args) {
    const [cmd, ...rest] = args;
    if (cmd === 'XADD') {
      const [stream, , ...fieldPairs] = rest;
      const fields = {};
      for (let i = 0; i < fieldPairs.length; i += 2) {
        fields[fieldPairs[i]] = fieldPairs[i + 1];
      }
      return this.xadd(stream, fields);
    }
    if (cmd === 'XREVRANGE') {
      const [stream, , , , countStr] = rest;
      return this.listRecentEvents(stream, parseInt(countStr, 10) || 50);
    }
    return null;
  }
}

module.exports = MemoryManager;
