'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * TicketTriageAgent — analiza la entrada del cliente, sentimiento, urgencia y
 * decide si requiere escalado inmediato o puede resolverse automáticamente.
 */
class TicketTriageAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.ticket-triage',
      name: 'Ticket Triage',
      department: 'support',
      modelTier: 'fast',
      capabilities: ['support:triage'],
      systemPrompt: 'Eres un clasificador inteligente de incidencias de soporte. Analizas el canal, sentimiento y urgencia para decidir si requiere resolución automática o escalado inmediato.',
    });
  }

  async run(task) {
    const text = (task.payload?.text || '').toLowerCase();
    const channel = task.payload?.channel || 'web';

    let category = 'general';
    if (/factura|pago|cobro|tarjeta|reembolso|precio/.test(text)) category = 'billing';
    else if (/error|bug|no funciona|ca[ií]d|fall|petar|roto/.test(text)) category = 'technical';
    else if (/c[óo]mo|configur|empezar|onboarding|instalar|activar/.test(text)) category = 'howto';

    const sentiment = /no funciona|fatal|enfadad|terrible|cancelar|peor|harto|verg[üu]enza|insatisfecho/.test(text) ? 'negative' : 'neutral';
    const priority = /urgent|ca[ií]d|no funciona|inmediat|bloque|cr[ií]tic/.test(text) || sentiment === 'negative' ? 'high' : 'normal';

    // Decisión de escalado inmediato al humano
    const requiresEscalation = priority === 'high' || sentiment === 'negative' || channel === 'email';

    const note = await this.think(
      `Resume brevemente en una frase el problema y el sentimiento de esta solicitud recibida por ${channel}: "${task.payload?.text || ''}"`,
      { useMemory: false, maxTokens: 120 }
    );

    return { category, priority, sentiment, note, requiresEscalation, status: 'ok' };
  }
}

module.exports = TicketTriageAgent;
