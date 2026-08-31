'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Escalation — empaqueta el caso para un agente humano cuando no se resuelve
 * solo. No "resuelve": prepara un handoff claro y lo notifica por el bus
 * (que el panel/Telegram recogerá).
 */
class EscalationAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.escalation',
      name: 'Escalation',
      department: 'support',
      modelTier: 'fast',
      capabilities: ['support:escalate'],
      systemPrompt: 'Eres un agente que prepara el traspaso a un humano: resume la incidencia, lo intentado y la decisión pendiente. Sé conciso.',
    });
  }

  async run(task) {
    const { triage = {}, resolution = {}, sentiment = {} } = task.payload || {};
    const brief = await this.think(
      `Prepara un resumen para el agente humano (incidencia, contexto y decisión pendiente). ` +
      `Incidencia: "${task.payload?.text || ''}". Motivo de escalado: ${resolution.reason || 'n/d'}.`,
      { useMemory: false, maxTokens: 250 },
    );

    const handoff = {
      to: 'human',
      category: triage.category || 'general',
      // La gravedad del sentimiento manda sobre la prioridad del triage: un
      // cliente que amenaza con irse es urgente aunque su consulta sea trivial.
      priority: ['high', 'critical'].includes(sentiment.severity) ? 'high' : (triage.priority || 'normal'),
      sentimentSeverity: sentiment.severity || 'none',
      signals: sentiment.signals || [],
      brief,
      status: 'pending_human',
    };

    if (this.bus) {
      this.bus.emit('support:escalated', { tenantId: this.tenantId, customerId: task.payload?.customerId, ...handoff });
    }
    return handoff;
  }
}

module.exports = EscalationAgent;
