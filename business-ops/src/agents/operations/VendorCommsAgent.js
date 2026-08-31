'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * VendorCommsAgent — redacta y envía comunicación a proveedores (petición de
 * presupuesto, seguimiento de un pedido con retraso, confirmación de orden).
 *
 * Es comunicación externa igual que el outreach de Ventas, y pasa por las
 * MISMAS líneas rojas: primer contacto con un proveedor nuevo = `cold_outbound`
 * (HITL siempre); a un proveedor ya conocido no hace falta marcarlo en frío,
 * pero sigue siendo `outbound` y respeta `mass_outbound` si se dispara a
 * muchos a la vez.
 *
 * Idempotencia por referencia: si se le pasa `referenceId` (número de pedido,
 * de RFQ), no se manda dos veces el mismo seguimiento el mismo día — un
 * reintento de la tarea no debe insistirle dos veces al mismo proveedor por
 * el mismo pedido.
 */
class VendorCommsAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.vendor-comms',
      name: 'Vendor Comms',
      department: 'operations',
      modelTier: 'mid',
      capabilities: ['operations:vendor-comms'],
      systemPrompt:
        'Redactas comunicaciones B2B breves y profesionales a proveedores: petición de '
        + 'presupuesto, seguimiento de un pedido, confirmación de orden. Sin promesas de pago '
        + 'ni compromisos económicos — eso lo decide Finanzas. Devuelve ASUNTO en la primera '
        + 'línea y luego el cuerpo.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const vendor = p.vendor || {};
    const purpose = p.purpose || 'quote_request';
    const referenceId = p.referenceId || null;

    if (!vendor.email) {
      return { status: 'blocked', reason: 'sin email del proveedor' };
    }

    // Idempotencia: mismo proveedor + mismo purpose + misma referencia, en la
    // misma jornada, no se reenvía. Sin store no hay forma de comprobarlo, así
    // que se deja pasar (fallback seguro: mejor un posible duplicado raro que
    // bloquear todo el flujo por falta de persistencia).
    const today = new Date(p.now ?? Date.now()).toISOString().slice(0, 10);
    const dedupeKey = referenceId ? `${vendor.email}|${purpose}|${referenceId}|${today}` : null;
    if (dedupeKey && this.store) {
      const sent = (await this.store.getFact({ tenantId: this.tenantId, key: 'operations:vendor_comms_sent' })) || {};
      if (sent[dedupeKey]) {
        return { status: 'skipped', reason: 'ya se contactó a este proveedor por esta misma referencia hoy', draft: null };
      }
    }

    const contexto = {
      quote_request: 'Pide presupuesto para el material/servicio indicado.',
      delay_followup: 'Pregunta con firmeza pero cordialidad por el retraso en la entrega del pedido.',
      order_confirmation: 'Confirma los términos del pedido: cantidades, precio y fecha de entrega.',
    }[purpose] || 'Redacta el mensaje según el contexto dado.';

    const draft = await this.think(
      `Proveedor: ${vendor.name || vendor.email}.\nMotivo: ${contexto}\n`
      + `${p.context ? `Contexto: ${p.context}\n` : ''}${referenceId ? `Referencia: ${referenceId}\n` : ''}`
      + `Firma:\n${this.business?.signature || ''}`,
      { useMemory: false, mode: p.cold ? 'cold' : 'base', maxTokens: 400 },
    );

    const subject = (draft.match(/asunto[:\-]\s*(.+)/i) || [, `${vendor.name || 'Proveedor'} — ${purpose}`])[1].trim();

    const send = await this.act({
      category: 'outbound',
      cold: !!p.cold,
      tool: 'email',
      method: 'send',
      recipientCount: 1,
      args: { to: vendor.email, subject, body: draft },
    });

    if (send?.sent && dedupeKey && this.store) {
      const sent = (await this.store.getFact({ tenantId: this.tenantId, key: 'operations:vendor_comms_sent' })) || {};
      sent[dedupeKey] = { at: Date.now() };
      await this.store.setFact({ tenantId: this.tenantId, key: 'operations:vendor_comms_sent', value: sent });
    }

    return { status: 'ok', draft, subject, send };
  }
}

module.exports = VendorCommsAgent;
