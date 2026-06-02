/**
 * BeZhas — RedisMemoryManager
 * ─────────────────────────────────────────────────────────────────────────────
 * Memoria persistente para los agentes IA de OpenClaw. Gestiona:
 *  - Historial de conversaciones por canal/usuario
 *  - Memoria de trabajo por departamento (corto plazo)
 *  - Memoria episódica (medio plazo, eventos importantes)
 *  - Perfil de entidades conocidas (empresas, contactos, activos)
 *  - Estado de tareas en curso (pending tasks)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class RedisMemoryManager {
  /**
   * @param {import('ioredis').Redis} redis
   * @param {object} opts
   * @param {string}  opts.prefix      - Prefijo de claves. Default: 'bezhas:mem:'
   * @param {number}  opts.historyMax  - Máximo mensajes por conversación. Default: 100
   * @param {number}  opts.stmTTL     - TTL memoria corto plazo (segundos). Default: 3600 (1h)
   * @param {number}  opts.episodeTTL - TTL episodios (segundos). Default: 604800 (7d)
   * @param {number}  opts.entityTTL  - TTL entidades conocidas (segundos). Default: 2592000 (30d)
   */
  constructor(redis, opts = {}) {
    if (!redis) throw new Error('RedisMemoryManager: redis client requerido');
    this.redis = redis;
    this.prefix    = opts.prefix      || 'bezhas:mem:';
    this.histMax   = opts.historyMax  || 100;
    this.stmTTL    = opts.stmTTL     || 3_600;
    this.epTTL     = opts.episodeTTL || 604_800;
    this.entityTTL = opts.entityTTL  || 2_592_000;
  }

  // ─── Helpers de clave ─────────────────────────────────────────────────────
  _k(...parts) { return `${this.prefix}${parts.join(':')}`; }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL DE CONVERSACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Añade un mensaje al historial de una conversación.
   * @param {string} sessionId - ID único de sesión (chatId, userId, etc.)
   * @param {'user'|'assistant'|'system'|'tool'} role
   * @param {string|object} content
   * @param {object} meta - metadata adicional (agent, tool_call_id, etc.)
   */
  async addMessage(sessionId, role, content, meta = {}) {
    const key = this._k('hist', sessionId);
    const entry = {
      role,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      ts: Date.now(),
      ...meta
    };
    const pipe = this.redis.pipeline();
    pipe.lpush(key, JSON.stringify(entry));
    pipe.ltrim(key, 0, this.histMax - 1);
    pipe.expire(key, this.epTTL);
    await pipe.exec();
    return entry;
  }

  /**
   * Obtiene el historial de conversación ordenado cronológicamente.
   * @param {string} sessionId
   * @param {number} limit - Número de mensajes más recientes
   * @returns {Array<{role, content, ts, ...}>}
   */
  async getHistory(sessionId, limit = 20) {
    const key = this._k('hist', sessionId);
    const raw = await this.redis.lrange(key, 0, limit - 1);
    return raw.map(r => JSON.parse(r)).reverse(); // cronológico (más viejo primero)
  }

  /**
   * Devuelve el historial formateado para insertar en prompt de LLM.
   * @param {string} sessionId
   * @param {number} limit
   * @returns {Array<{role, content}>}
   */
  async getHistoryForLLM(sessionId, limit = 20) {
    const history = await this.getHistory(sessionId, limit);
    return history.map(({ role, content }) => ({ role, content }));
  }

  /** Borra el historial de una sesión. */
  async clearHistory(sessionId) {
    return this.redis.del(this._k('hist', sessionId));
  }

  /** Número de mensajes en el historial. */
  async historyLength(sessionId) {
    return this.redis.llen(this._k('hist', sessionId));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORIA DE TRABAJO (Short-Term Memory) — por agente/departamento
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guarda un dato en la memoria de trabajo de un agente.
   * Se borra automáticamente tras stmTTL segundos.
   * @param {string} agentId - ID del agente (ej: 'trading-agent', 'marketing-agent')
   * @param {string} key - Clave del dato
   * @param {*} value - Valor (se serializa a JSON)
   * @param {number} ttl - Override TTL en segundos
   */
  async setWorkingMemory(agentId, key, value, ttl) {
    const redisKey = this._k('stm', agentId, key);
    const serialized = JSON.stringify({ value, saved_at: Date.now() });
    await this.redis.setex(redisKey, ttl || this.stmTTL, serialized);
  }

  /** Recupera un dato de la memoria de trabajo. */
  async getWorkingMemory(agentId, key) {
    const raw = await this.redis.get(this._k('stm', agentId, key));
    if (!raw) return null;
    const { value } = JSON.parse(raw);
    return value;
  }

  /** Borra un dato de la memoria de trabajo. */
  async deleteWorkingMemory(agentId, key) {
    return this.redis.del(this._k('stm', agentId, key));
  }

  /** Obtiene toda la memoria de trabajo de un agente. */
  async getAllWorkingMemory(agentId) {
    const pattern = this._k('stm', agentId, '*');
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return {};

    const values = await this.redis.mget(...keys);
    const result = {};
    keys.forEach((k, i) => {
      const fieldKey = k.replace(this._k('stm', agentId) + ':', '');
      result[fieldKey] = values[i] ? JSON.parse(values[i]).value : null;
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORIA EPISÓDICA — eventos importantes con semántica
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guarda un episodio importante en la memoria del agente.
   * Úsalo para: trades ejecutados, leads contactados, decisiones importantes.
   * @param {string} agentId
   * @param {string} type - Tipo de episodio: 'trade', 'lead', 'alert', 'decision'
   * @param {object} data - Datos del episodio
   * @param {string[]} tags - Tags para búsqueda
   */
  async saveEpisode(agentId, type, data, tags = []) {
    const episodeId = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const episode = {
      id: episodeId,
      agent: agentId,
      type,
      data,
      tags,
      created_at: Date.now()
    };

    const key = this._k('ep', agentId, episodeId);
    await this.redis.setex(key, this.epTTL, JSON.stringify(episode));

    // Índice por tipo
    await this.redis.lpush(this._k('ep_idx', agentId, type), episodeId);
    await this.redis.ltrim(this._k('ep_idx', agentId, type), 0, 499);

    // Índice por tags
    for (const tag of tags) {
      await this.redis.sadd(this._k('ep_tag', agentId, tag), episodeId);
      await this.redis.expire(this._k('ep_tag', agentId, tag), this.epTTL);
    }

    return episode;
  }

  /** Obtiene los últimos N episodios de un tipo. */
  async getEpisodes(agentId, type, limit = 10) {
    const ids = await this.redis.lrange(this._k('ep_idx', agentId, type), 0, limit - 1);
    if (ids.length === 0) return [];

    const keys = ids.map(id => this._k('ep', agentId, id));
    const raws = await this.redis.mget(...keys);
    return raws.filter(Boolean).map(r => JSON.parse(r));
  }

  /** Busca episodios por tag. */
  async getEpisodesByTag(agentId, tag, limit = 10) {
    const ids = await this.redis.smembers(this._k('ep_tag', agentId, tag));
    const limitedIds = ids.slice(0, limit);
    if (limitedIds.length === 0) return [];

    const keys = limitedIds.map(id => this._k('ep', agentId, id));
    const raws = await this.redis.mget(...keys);
    return raws.filter(Boolean).map(r => JSON.parse(r));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFIL DE ENTIDADES — empresas, contactos, activos conocidos
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guarda o actualiza el perfil de una entidad conocida.
   * @param {'company'|'contact'|'asset'|'contract'} entityType
   * @param {string} entityId - ID único de la entidad
   * @param {object} profile - Datos del perfil (se hace merge con lo existente)
   */
  async upsertEntity(entityType, entityId, profile) {
    const key = this._k('entity', entityType, entityId);
    const existing = await this.getEntity(entityType, entityId);
    const merged = {
      ...(existing || {}),
      ...profile,
      entity_type: entityType,
      entity_id: entityId,
      updated_at: Date.now(),
      created_at: existing?.created_at || Date.now()
    };
    await this.redis.setex(key, this.entityTTL, JSON.stringify(merged));
    return merged;
  }

  /** Obtiene el perfil de una entidad. */
  async getEntity(entityType, entityId) {
    const raw = await this.redis.get(this._k('entity', entityType, entityId));
    return raw ? JSON.parse(raw) : null;
  }

  /** Busca entidades por patrón de ID. */
  async searchEntities(entityType, pattern = '*') {
    const keys = await this.redis.keys(this._k('entity', entityType, pattern));
    if (keys.length === 0) return [];
    const raws = await this.redis.mget(...keys);
    return raws.filter(Boolean).map(r => JSON.parse(r));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAREAS PENDIENTES — task queue por agente
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Añade una tarea pendiente para un agente.
   * @param {string} agentId
   * @param {object} task - { type, description, priority, data }
   * @returns {string} taskId
   */
  async addPendingTask(agentId, task) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fullTask = {
      id: taskId,
      agent: agentId,
      status: 'pending',
      created_at: Date.now(),
      ...task
    };
    const key = this._k('tasks', agentId);
    await this.redis.lpush(key, JSON.stringify(fullTask));
    await this.redis.expire(key, this.epTTL);
    return taskId;
  }

  /** Obtiene todas las tareas pendientes de un agente. */
  async getPendingTasks(agentId) {
    const key = this._k('tasks', agentId);
    const raws = await this.redis.lrange(key, 0, -1);
    return raws
      .map(r => JSON.parse(r))
      .filter(t => t.status === 'pending')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /** Marca una tarea como completada. */
  async completeTask(agentId, taskId, result = {}) {
    const key = this._k('tasks', agentId);
    const tasks = await this.redis.lrange(key, 0, -1);

    for (let i = 0; i < tasks.length; i++) {
      const task = JSON.parse(tasks[i]);
      if (task.id === taskId) {
        task.status = 'completed';
        task.completed_at = Date.now();
        task.result = result;
        await this.redis.lset(key, i, JSON.stringify(task));
        return task;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXTO GLOBAL DEL SISTEMA
  // ═══════════════════════════════════════════════════════════════════════════

  /** Guarda el estado global del sistema (precios, health, etc.). */
  async setSystemContext(key, value, ttl = 300) {
    await this.redis.setex(this._k('sys', key), ttl, JSON.stringify(value));
  }

  /** Recupera el estado global del sistema. */
  async getSystemContext(key) {
    const raw = await this.redis.get(this._k('sys', key));
    return raw ? JSON.parse(raw) : null;
  }

  /** Resumen completo del estado de la memoria para debugging. */
  async getMemoryStats() {
    const keys = await this.redis.keys(`${this.prefix}*`);
    const byType = {};
    keys.forEach(k => {
      const type = k.replace(this.prefix, '').split(':')[0];
      byType[type] = (byType[type] || 0) + 1;
    });
    return {
      total_keys: keys.length,
      by_type: byType,
      prefix: this.prefix,
      config: {
        history_max: this.histMax,
        stm_ttl_secs: this.stmTTL,
        episode_ttl_secs: this.epTTL,
        entity_ttl_secs: this.entityTTL
      }
    };
  }
}
