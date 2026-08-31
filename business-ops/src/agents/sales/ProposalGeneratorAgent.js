'use strict';

const BaseAgent = require('../BaseAgent');
const pricing = require('../../platform/priceCatalog');

/**
 * ProposalGeneratorAgent — prepara una propuesta comercial con importes reales.
 *
 * Reparto de responsabilidades, que es lo que hace fiable a este agente:
 *   - **El código calcula el dinero** (`platform/priceCatalog.js`): líneas,
 *     descuento por línea, IVA por tipo y total. Determinista y con tests.
 *   - **El modelo solo escribe la prosa** que envuelve esos números.
 *
 * Un LLM sumando importes falla en silencio, y una propuesta con el total mal
 * es un problema comercial. Aquí el modelo nunca ve una operación que hacer:
 * recibe los importes ya calculados y los redacta.
 *
 * Dos guardarraíles:
 *   1. **SKU desconocido → no hay propuesta.** Si el prospecto pide algo que no
 *      está en el catálogo, se dice; inventar una línea de precio es el fallo
 *      que todo esto evita.
 *   2. **Descuento > 15 % → HITL.** El margen es de la empresa, no del agente.
 *      Además, enviar la propuesta es outbound y pasa por su línea roja.
 */
class ProposalGeneratorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.proposal',
      name: 'Proposal Generator',
      department: 'sales',
      modelTier: 'frontier',      // una propuesta cierra o pierde el trato
      capabilities: ['sales:proposal'],
      systemPrompt:
        'Redactas propuestas comerciales B2B. Recibes los importes YA CALCULADOS: '
        + 'cópialos tal cual, no los recalcules ni los redondees. Estructura: contexto '
        + 'del cliente, qué resuelve, el detalle económico que se te da, y siguiente paso. '
        + 'Sin promesas de rentabilidad ni jerga cripto. Devuelve solo el texto.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const lead = p.lead || {};
    const items = p.items || [];
    const discountPct = Number(p.discountPct || 0);

    const catalog = this.store
      ? await pricing.list({ store: this.store, tenantId: this.tenantId })
      : (p.catalog || []);

    if (!catalog.length) {
      return {
        status: 'blocked',
        reason: 'El tenant no tiene catálogo de precios cargado (PUT /tenants/:id/sales/catalog). '
          + 'No se genera propuesta para no inventar importes.',
        quote: null, draft: null,
      };
    }

    // Cálculo determinista. Un SKU inexistente aborta: mejor sin propuesta que
    // con un precio inventado.
    let quote;
    try {
      quote = pricing.quote({ items, catalog, discountPct, currency: p.currency || 'EUR' });
    } catch (err) {
      return {
        status: 'blocked',
        reason: err.message,
        code: err.code,
        quote: null,
        draft: null,
        // Ayuda al humano a corregir la petición sin ir a buscar el catálogo.
        availableSkus: catalog.map((c) => c.sku),
      };
    }

    const resumen = pricing.renderLines(quote);
    const totales = [
      `Subtotal: ${pricing.formatCents(quote.subtotalCents, quote.currency)}`,
      quote.discountCents ? `Descuento (${quote.discountPct}%): -${pricing.formatCents(quote.discountCents, quote.currency)}` : null,
      `Base imponible: ${pricing.formatCents(quote.taxedBaseCents, quote.currency)}`,
      `IVA: ${pricing.formatCents(quote.vatCents, quote.currency)}`,
      `TOTAL: ${pricing.formatCents(quote.totalCents, quote.currency)}`,
    ].filter(Boolean).join('\n');

    const draft = await this.think(
      `Redacta la propuesta para ${lead.contact || 'el responsable'} `
      + `(${lead.role || 'dirección'}) de ${lead.company || 'la empresa'}.\n`
      + `${p.context ? `Contexto: ${p.context}\n` : ''}`
      + `\nLÍNEAS (cópialas tal cual):\n${resumen}\n\nIMPORTES (cópialos tal cual):\n${totales}\n`
      + `\nFirma:\n${this.business?.signature || ''}`,
      { useMemory: false, maxTokens: 900 },
    );

    // Enviar es outbound: la línea roja decide si necesita aprobación. Un
    // descuento fuerte la fuerza siempre, sea quien sea el destinatario.
    let send = null;
    if (p.send && lead.email) {
      send = await this.act({
        category: 'outbound',
        cold: p.cold ?? false,
        // Lo evalúa la línea roja `pricing_concession`, no este agente: quien
        // propone el descuento no puede decidir si necesita permiso.
        discountPct: quote.discountPct,
        tool: 'email',
        method: 'send',
        recipientCount: 1,
        args: {
          to: lead.email,
          subject: `Propuesta para ${lead.company || 'su equipo'}`,
          body: draft,
        },
      });
    }

    await this.remember({
      task: 'sales:proposal',
      summary: `Propuesta a ${lead.company || '?'} por ${pricing.formatCents(quote.totalCents, quote.currency)}`,
      outcome: 'ok',
    });

    return {
      status: 'ok',
      draft,
      quote: {
        currency: quote.currency,
        lines: quote.lines,
        subtotalCents: quote.subtotalCents,
        discountPct: quote.discountPct,
        discountCents: quote.discountCents,
        vatCents: quote.vatCents,
        totalCents: quote.totalCents,
        total: pricing.formatCents(quote.totalCents, quote.currency),
      },
      requiresApproval: quote.requiresApproval,
      send,
    };
  }
}

module.exports = ProposalGeneratorAgent;
