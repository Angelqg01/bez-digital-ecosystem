'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Procurement — prepara solicitudes de compra (RFQ/orden). Pagar a un proveedor
 * es línea roja (mover dinero) → pasa por aprobación humana.
 */
class ProcurementAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.procurement',
      name: 'Procurement',
      department: 'operations',
      modelTier: 'mid',
      capabilities: ['operations:procure'],
      systemPrompt: 'Preparas compras: especificas necesidad, comparas opciones y redactas la orden. No pagas a proveedores por tu cuenta.',
    });
  }

  async run(task) {
    const order = await this.think(`Prepara una solicitud de compra para: ${JSON.stringify(task.payload?.item || task.payload?.text || {})}. Incluye especificación y criterios de selección.`);

    // Pagar al proveedor NO se hace solo: línea roja → HITL.
    let payment = null;
    if (task.payload?.pay) {
      payment = await this.act({ category: 'payment', tool: 'payment', method: 'pay_vendor', recipientCount: 1, args: { vendor: task.payload.vendor, amount: task.payload.amount } });
    }
    return { order, payment, status: 'ok' };
  }
}

module.exports = ProcurementAgent;
