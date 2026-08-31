'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Collections (AR chaser) — gestiona impagos: redacta recordatorios firmes pero
 * respetuosos. COBRAR es línea roja (mover dinero) → pasa por aprobación humana.
 */
class CollectionsAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.collections',
      name: 'Collections',
      department: 'finance',
      modelTier: 'frontier',
      capabilities: ['finance:collect'],
      systemPrompt: 'Gestionas el cobro de facturas vencidas con tacto: recordatorios claros y profesionales que preservan la relación.',
    });
  }

  async run(task) {
    const reminder = await this.think(
      `Redacta un recordatorio de pago para esta factura vencida: ${JSON.stringify(task.payload?.invoice || task.payload?.text || '')}.`,
    );

    // Un cargo real NUNCA se ejecuta solo: pasa por guardrails (línea roja) → HITL.
    let charge = null;
    if (task.payload?.charge) {
      charge = await this.act({
        category: 'payment',
        tool: 'payment',
        method: 'charge',
        recipientCount: 1,
        args: { amount: task.payload.amount, customerId: task.payload.customerId },
      });
    }
    return { reminder, charge, status: 'ok' };
  }
}

module.exports = CollectionsAgent;
