'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Lead Scorer — puntúa un lead 0-100 (tier 'fast': alto volumen, modelo barato/local).
 *
 * Contexto de negocio (campaña AEGIS-Growth): evalúa leads institucionales. Da fitScore
 * alto (>80) a entidades con alto tráfico portuario o gestión aduanera que se benefician
 * de automatización y tokenización de activos logísticos (RWA / BEZ-Coin).
 *
 * Si fitScore > 80, da el lead de alta automáticamente en el CRM propio (Twenty).
 * El alta de un lead NO es una línea roja (no es irreversible ni compromete a nadie).
 */
class LeadScorerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.lead-scorer',
      name: 'Lead Scorer',
      department: 'sales',
      modelTier: 'fast',
      capabilities: ['sales:score'],
      systemPrompt:
        'Calificas leads institucionales 0-100 según la guía de scoring de la empresa. ' +
        'Devuelves SOLO un número 0-100 seguido de una razón de una línea, sin texto extra.',
    });
    this.crmThreshold = ctx.crmThreshold ?? 80;
  }

  async run(task) {
    const lead = task.payload?.lead || {};

    // Cuenta vetada: score 0 y fuera del pipeline, sin gastar el modelo.
    if (this.business && this.business.isExcluded(lead)) {
      return { score: 0, segment: 'excluida', rationale: 'Cuenta excluida (Acuerdo V1 / partner confirmado).', status: 'ok' };
    }

    const segment = this.business ? this.business.segmentOf(lead) : 'sin_clasificar';
    const guide = this.business ? `\n\nGUÍA DE SCORING:\n${this.business.scoringGuide()}` : '';
    const out = await this.think(
      `Puntúa este lead 0-100 (segmento detectado: ${segment}): ${JSON.stringify(lead)}${guide}`,
      { useMemory: false, maxTokens: 200 },
    );
    const score = Math.min(100, parseInt((out.match(/\d{1,3}/) || [50])[0], 10));

    const result = { score, segment, rationale: out, status: 'ok' };

    // fitScore alto → alta automática en el CRM propio (Twenty).
    if (score > this.crmThreshold && this.tools.crm) {
      try {
        const crmLead = await this.act({
          category: 'crm',
          tool: 'crm',
          method: 'upsertLead',
          args: {
            companyName: lead.company || lead.companyName,
            contactName: lead.contact || lead.contactName,
            role: lead.role,
            fitScore: score,
          },
        });
        result.crm = crmLead;
        this.bus?.emit('sales:lead_qualified', { tenantId: this.tenantId, lead, score, crmLead });
      } catch (err) {
        result.crmError = err.message;
      }
    }

    await this.remember({ summary: `Lead ${lead.company || '?'} puntuado ${score}`, score });
    return result;
  }
}
module.exports = LeadScorerAgent;
