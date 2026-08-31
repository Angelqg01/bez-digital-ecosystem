'use strict';

const BaseAgent = require('../BaseAgent');
const pricing = require('../../platform/priceCatalog');

/**
 * Invoice — redacta el documento de factura formal (conceptos, base, IVA,
 * total) a partir del MISMO catálogo de precios que usa `ProposalGenerator`.
 * No cobra ni emite enlace de pago — eso lo hace `InvoiceBot` sobre un deal
 * ya ganado. Este agente es para el documento contable en sí: el que se
 * archiva y se manda al cliente como factura, con desglose real.
 *
 * Mismo reparto de responsabilidades que en Ventas, y por el mismo motivo:
 * **el código calcula el dinero, el modelo solo redacta**. Antes, esta clase
 * le pedía al modelo "genera la factura con base, IVA y total" en texto
 * libre — exactamente el fallo que ya se corrigió en `ProposalGeneratorAgent`,
 * solo que aquí encima acaba en un documento fiscal real archivado. SKU fuera
 * de catálogo → no hay factura; inventar un precio en un documento contable
 * es peor que no emitirlo.
 */
class InvoiceAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.invoice',
      name: 'Invoice',
      department: 'finance',
      modelTier: 'fast',
      capabilities: ['finance:invoice-draft'],
      systemPrompt:
        'Redactas el texto de una factura B2B. Recibes los importes YA CALCULADOS: '
        + 'cópialos tal cual, no los recalcules ni los redondees. No emites cobros.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const items = p.items || [];
    const discountPct = Number(p.discountPct || 0);

    const catalog = this.store
      ? await pricing.list({ store: this.store, tenantId: this.tenantId })
      : (p.catalog || []);

    if (!catalog.length) {
      return {
        status: 'blocked',
        reason: 'sin catálogo de precios cargado (PUT /tenants/:id/sales/catalog). No se inventa un importe en una factura.',
        quote: null, draft: null,
      };
    }

    let quote;
    try {
      quote = pricing.quote({ items, catalog, discountPct, currency: p.currency || 'EUR' });
    } catch (err) {
      return {
        status: 'blocked', reason: err.message, code: err.code,
        quote: null, draft: null,
        availableSkus: catalog.map((c) => c.sku),
      };
    }

    const lineas = pricing.renderLines(quote);
    const totales = [
      `Base imponible: ${pricing.formatCents(quote.taxedBaseCents, quote.currency)}`,
      `IVA: ${pricing.formatCents(quote.vatCents, quote.currency)}`,
      `TOTAL: ${pricing.formatCents(quote.totalCents, quote.currency)}`,
    ].join('\n');

    const draft = await this.think(
      `Redacta el texto de una factura para ${p.client || 'el cliente'}.\n\n`
      + `LÍNEAS (cópialas tal cual):\n${lineas}\n\nIMPORTES (cópialos tal cual):\n${totales}\n`
      + `\nFirma:\n${this.business?.signature || ''}`,
      { maxTokens: 600 },
    );

    return {
      status: 'ok',
      draft,
      quote: {
        currency: quote.currency,
        lines: quote.lines,
        subtotalCents: quote.subtotalCents,
        vatCents: quote.vatCents,
        totalCents: quote.totalCents,
        total: pricing.formatCents(quote.totalCents, quote.currency),
      },
    };
  }
}

module.exports = InvoiceAgent;
