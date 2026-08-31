'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Triage — clasifica cada ticket: categoría, prioridad y sentimiento.
 * Usa reglas deterministas (rápidas, sin depender del modelo) y deja un
 * resumen legible para el equipo. Modelo barato.
 */
class TriageAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.triage',
      name: 'Triage',
      department: 'support',
      modelTier: 'fast',
      capabilities: ['support:triage'],
      systemPrompt: 'Eres un agente de clasificación de incidencias. Resumes la incidencia en una línea para el equipo.',
    });
  }

  async run(task) {
    const text = (task.payload?.text || '').toLowerCase();

    let category = 'general';
    if (/factura|pago|cobro|tarjeta|reembolso/.test(text)) category = 'billing';
    else if (/error|bug|no funciona|ca[ií]d|fall|petar/.test(text)) category = 'technical';
    else if (/c[óo]mo|configur|empezar|onboarding|instalar|activar/.test(text)) category = 'howto';

    const priority = /urgent|ca[ií]d|no funciona|inmediat|bloque|cr[ií]tic/.test(text) ? 'high' : 'normal';
    const sentiment = /no funciona|fatal|enfadad|terrible|cancelar|peor|harto|verg[üu]enza/.test(text) ? 'negative' : 'neutral';

    const note = await this.think(
      `Resume en una línea esta incidencia para el equipo: "${task.payload?.text || ''}"`,
      { useMemory: false, maxTokens: 120 },
    );

    return { category, priority, sentiment, note, status: 'ok' };
  }
}

module.exports = TriageAgent;
