/**
 * BeZhas Agent Runtime — AgentRegistry
 * Registro centralizado de todos los agentes activos.
 * Permite descubrimiento por capability, búsqueda y health-check.
 */

'use strict';

class AgentRegistry {
  constructor() {
    this._agents = new Map();          // id → agente
    this._byCapability = new Map();    // capability → Set<agentId>
  }

  // ─────────────────────────────────────────────
  // REGISTRO
  // ─────────────────────────────────────────────

  register(agent) {
    if (this._agents.has(agent.id)) {
      throw new Error(`Agente ya registrado: ${agent.id}`);
    }

    this._agents.set(agent.id, agent);

    // Indexar por capability
    for (const cap of agent.capabilities) {
      if (!this._byCapability.has(cap)) {
        this._byCapability.set(cap, new Set());
      }
      this._byCapability.get(cap).add(agent.id);
    }

    console.log(`[AgentRegistry] ✅ ${agent.id} registrado (capabilities: ${agent.capabilities.join(', ')})`);
    return this;
  }

  unregister(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent) return false;

    // Limpiar índice de capabilities
    for (const cap of agent.capabilities) {
      this._byCapability.get(cap)?.delete(agentId);
    }

    this._agents.delete(agentId);
    console.log(`[AgentRegistry] 🗑️  ${agentId} eliminado del registro`);
    return true;
  }

  // ─────────────────────────────────────────────
  // CONSULTA
  // ─────────────────────────────────────────────

  get(agentId) {
    return this._agents.get(agentId) || null;
  }

  /** Devuelve el primer agente idle que tenga la capability requerida */
  findByCapability(capability) {
    const ids = this._byCapability.get(capability);
    if (!ids || ids.size === 0) return null;

    for (const id of ids) {
      const agent = this._agents.get(id);
      if (agent && agent.status === 'idle') return agent;
    }

    // Si todos están ocupados, devolver el primero igualmente
    const [firstId] = ids;
    return this._agents.get(firstId) || null;
  }

  list() {
    return [...this._agents.values()].map(a => a.getStats());
  }

  listCapabilities() {
    const result = {};
    for (const [cap, ids] of this._byCapability) {
      result[cap] = [...ids];
    }
    return result;
  }

  // ─────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────

  healthReport() {
    const agents = this.list();
    return {
      total: agents.length,
      idle:    agents.filter(a => a.status === 'idle').length,
      running: agents.filter(a => a.status === 'running').length,
      error:   agents.filter(a => a.status === 'error').length,
      agents,
    };
  }
}

module.exports = AgentRegistry;
