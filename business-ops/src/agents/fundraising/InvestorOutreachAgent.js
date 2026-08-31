'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * InvestorOutreachAgent — redacta contacto con inversores (VC/family office/
 * fondo). Mismas líneas rojas que el resto de outbound: cuenta excluida →
 * bloqueo duro; primer contacto en frío → HITL antes de enviar.
 */
class InvestorOutreachAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'fundraising.investor-outreach',
      name: 'Investor Outreach',
      department: 'fundraising',
      modelTier: 'frontier',
      capabilities: ['fundraising:outreach'],
      systemPrompt:
        'Redactas contacto con inversores institucionales (VC, family office, fondo). Tono ejecutivo, con tracción y ' +
        'métricas concretas si se aportan, sin prometer rentabilidad ni cifras de retorno. Un CTA pequeño (llamada ' +
        'de 15-20 min o envío del deck). Cierras con la firma de la empresa.',
    });
  }

  async run(task) {
    const { lead = {}, context } = task.payload || {};
    const cold = task.payload?.cold ?? task.type !== 'fundraising:inbound';

    const excluded = this.business ? this.business.isExcluded(lead) : false;
    if (excluded) {
      this.bus?.emit('fundraising:outreach_blocked', { tenantId: this.tenantId, lead, reason: 'cuenta excluida' });
      return { status: 'blocked', reason: 'Cuenta excluida: no se contacta.', lead };
    }

    const draft = await this.think(
      `Redacta un correo de ${cold ? 'PRIMER CONTACTO EN FRÍO' : 'seguimiento'} a ${lead.contact || lead.contacto_nombre || 'el/la inversor/a'} ` +
      `(${lead.role || lead.contacto_cargo || 'inversor institucional'}) de ${lead.company || lead.empresa || 'su fondo'}. ` +
      `Contexto/tracción a destacar: ${context || 'infraestructura Web3 B2B de BeZhas para logística/economía azul, validación operativa y smart escrow'}. ` +
      `Un CTA pequeño (llamada de 15-20 min o envío del deck). Firma:\n${this.business?.signature || ''}`,
      { useMemory: false, mode: cold ? 'cold' : 'warm' },
    );

    const subject = (draft.match(/asunto[:\-]\s*(.+)/i) || [, `Contacto ${lead.company || lead.empresa || 'inversor'}`])[1].trim();

    if (!lead.email) {
      return { draft, subject, cold, send: { skipped: true, reason: 'sin email de contacto' }, status: 'ok' };
    }

    const sendResult = await this.act({
      category: 'outbound',
      cold,
      tool: 'email',
      method: 'send',
      recipientCount: 1,
      args: { to: lead.email, subject, body: draft },
    });

    return { draft, subject, cold, send: sendResult, status: 'ok' };
  }
}
module.exports = InvestorOutreachAgent;
