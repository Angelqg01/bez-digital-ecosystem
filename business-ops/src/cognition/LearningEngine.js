'use strict';

/**
 * LearningEngine — el bucle de mejora continua que cumple la promesa de la
 * plataforma: aprender de cada interacción.
 *
 * Corre periódicamente (acción 'learn' del Scheduler). Mina la memoria episódica
 * por agente, separa lo que se resolvió solo de lo que se escaló o rechazó, y
 * destila un "playbook" conciso que se PERSISTE (fact playbook:<agentId>) y se
 * reinyecta en los prompts futuros del agente (BaseAgent lee su playbook). Así
 * el sistema mejora sin tocar código ni reentrenar el modelo.
 *
 * NO reentrena modelos en vivo. Todo es scoped al tenant (la memoria ya lo está).
 */
const MIN_INTERACTIONS = 3;   // por debajo de esto no hay señal suficiente
const MAX_SAMPLE = 60;        // casos recientes que mira por ciclo

class LearningEngine {
  constructor({ memory, model, audit, tenantId } = {}) {
    this.memory = memory;
    this.model = model;
    this.audit = audit;
    this.tenantId = tenantId;
  }

  /** Categoriza un outcome en positivo / atención / neutro. */
  static bucket(outcome) {
    const o = String(outcome || '').toLowerCase();
    if (['ok', 'won', 'resolved', 'sent', 'approved', 'completed'].includes(o)) return 'positivo';
    if (['escalated', 'lost', 'rejected', 'failed', 'blocked', 'partial'].includes(o)) return 'atencion';
    return 'neutro';
  }

  /**
   * Ciclo de aprendizaje de un agente: destila y persiste su playbook.
   * @returns {object} { agentId, updated, metrics, playbook? }
   */
  async cycle(agentId) {
    const interactions = await this.memory.recall('', { agentId, k: MAX_SAMPLE });
    if (interactions.length < MIN_INTERACTIONS) {
      return { agentId, updated: false, reason: 'sin datos suficientes', metrics: { total: interactions.length } };
    }

    const positivos = [], atencion = [];
    for (const i of interactions) {
      (LearningEngine.bucket(i.outcome) === 'atencion' ? atencion : positivos).push(i.summary || '');
    }
    const metrics = {
      total: interactions.length,
      resueltoSolo: positivos.length,
      requirioAtencion: atencion.length,
      tasaAutonomia: interactions.length ? +(positivos.length / interactions.length).toFixed(2) : 0,
    };

    let playbookText = '';
    if (this.model) {
      const out = await this.model.complete({
        tier: 'fast',
        system: 'Eres un analista de procesos. Destilas aprendizajes accionables y concisos ' +
          'para que un agente mejore. Nada de relleno.',
        messages: [{
          role: 'user',
          content:
            `Agente: ${agentId}. Destila un PLAYBOOK breve (máx 6 viñetas) a partir de sus casos recientes.\n` +
            `Formato: "QUÉ FUNCIONA:" (patrones de lo resuelto solo) y "CUÁNDO ESCALAR / QUÉ EVITAR:" (de lo que requirió atención).\n\n` +
            `RESUELTO SOLO (${positivos.length}):\n${positivos.slice(0, 20).map((s, i) => `${i + 1}. ${s}`).join('\n') || '(ninguno)'}\n\n` +
            `REQUIRIÓ ATENCIÓN (${atencion.length}):\n${atencion.slice(0, 20).map((s, i) => `${i + 1}. ${s}`).join('\n') || '(ninguno)'}`,
        }],
        maxTokens: 400,
        meta: { tenantId: this.tenantId, agentId: 'cognition.learning' },
      });
      playbookText = out.text;
    }

    const playbook = { text: playbookText, metrics, at: new Date().toISOString() };
    await this.memory.setFact(`playbook:${agentId}`, playbook);
    this.audit?.log({ tenantId: this.tenantId, event: 'learning:cycle', agentId, metrics });
    return { agentId, updated: true, metrics, playbook };
  }

  /** Corre el ciclo para varios agentes (los que tengan datos). */
  async learnAll(agentIds = []) {
    const results = [];
    for (const id of agentIds) {
      try {
        results.push(await this.cycle(id));
      } catch (err) {
        results.push({ agentId: id, updated: false, error: err.message });
      }
    }
    const updated = results.filter((r) => r.updated).length;
    this.audit?.log({ tenantId: this.tenantId, event: 'learning:run', agents: agentIds.length, updated });
    return { agents: agentIds.length, updated, results };
  }

  /** Playbook persistido de un agente (o null). */
  async getPlaybook(agentId) {
    return this.memory?.getFact ? this.memory.getFact(`playbook:${agentId}`) : null;
  }
}

module.exports = LearningEngine;
