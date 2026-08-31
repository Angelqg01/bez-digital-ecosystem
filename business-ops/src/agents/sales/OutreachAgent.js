'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Outreach Drafter — redacta el contacto comercial (tier 'frontier': la
 * escritura cierra deals, va al mejor modelo).
 *
 * Se apoya en el perfil de negocio del tenant (BusinessProfile): habla como la
 * empresa, con su lenguaje ("Tubería de Cristal"), y en FRÍO respeta sus reglas
 * estrictas — sin jerga cripto, sin enlaces de pago, sin promesas de rentabilidad,
 * un solo caso de uso y un CTA pequeño (derivación o llamada de 10 minutos).
 *
 * Guardarraíles duros antes de enviar:
 *   1. Cuenta excluida (Acuerdo V1 / partner confirmado) → bloqueo, nunca se contacta.
 *   2. En lista de "no contactar" (DoNotContactList, gestionada en caliente por
 *      el tenant — a diferencia de (1), que viene fija en el perfil de negocio).
 *   3. Envío en frío → línea roja cold_outbound → aprobación humana (HITL).
 */
class OutreachAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.outreach',
      name: 'Outreach Drafter',
      department: 'sales',
      modelTier: 'frontier',
      capabilities: ['sales:outreach'],
      systemPrompt:
        'Redactas correos B2B de primer contacto y seguimiento. Tono ejecutivo, ' +
        'creíble y específico del prospecto. Devuelves ASUNTO en la primera línea ' +
        '(formato "Asunto: ...") y luego el cuerpo. Cierras con la firma de la empresa.',
    });
  }

  async run(task) {
    const { lead = {}, offer } = task.payload || {};
    // Frío = prospección (HITL obligatorio). Respuesta a quien nos escribió
    // (sales:inbound) es templada y no requiere aprobación.
    const cold = task.payload?.cold ?? task.type !== 'sales:inbound';

    // Guardarraíles 1 y 2: cuenta vetada (fija, del perfil de negocio) o en la
    // lista de "no contactar" (dinámica, gestionada por el tenant) → ni se
    // redacta ni se envía. Se evalúa antes de gastar una llamada al modelo.
    const dncHit = this.doNotContact ? this.doNotContact.isListed(lead) : null;
    const excluded = (this.business ? this.business.isExcluded(lead) : false) || !!dncHit;
    if (excluded) {
      // Pasa por el PolicyEngine (sin ejecutar nada) solo para quedar auditado
      // en la misma cadena de decisiones que cualquier otro bloqueo — antes
      // este corte no dejaba rastro alguno en el audit log.
      this.guardrails?.evaluate({ agentId: this.id, action: { category: 'outbound', tool: 'email', method: 'send', excluded: true } });
      const reason = dncHit
        ? `En lista de no-contactar${dncHit.reason ? `: ${dncHit.reason}` : '.'}`
        : 'Cuenta excluida (Acuerdo V1 / partner confirmado): no se contacta.';
      this.bus?.emit('sales:outreach_blocked', { tenantId: this.tenantId, lead, reason: dncHit ? 'do-not-contact' : 'cuenta excluida' });
      return { status: 'blocked', reason, lead };
    }

    const segment = this.business ? this.business.segmentOf(lead) : 'sin_clasificar';
    // Quién recibe y quién firma van ETIQUETADOS y separados, y el destinatario
    // se repite al final.
    //
    // Antes el prompt cerraba con `Firma:\n<firma>` y nada más. La firma es lo
    // último que lee el modelo y lleva un nombre propio muy visible (el del
    // CEO), así que los modelos pequeños encabezaban el correo con «Estimado
    // Sr. Hernández» — se lo mandaban al remitente. Un primer contacto en frío
    // dirigido a la persona equivocada quema el lead aunque pase por HITL.
    const destinatario = lead.contact
      ? `${lead.contact}${lead.role ? ` (${lead.role})` : ''} de ${lead.company || 'la empresa'}`
      : `el responsable de ${lead.role || 'dirección'} de ${lead.company || 'la empresa'}`;

    const draft = await this.think(
      `Redacta un correo de ${cold ? 'PRIMER CONTACTO EN FRÍO' : 'seguimiento a un contacto que ya escribió'}.\n` +
      `DESTINATARIO (a quien va dirigido el saludo): ${destinatario}.\n` +
      `Segmento: ${segment}. Caso de uso a destacar: ${offer || 'validación operativa y smart escrow (pagos que se liberan al validar la entrega)'}.\n` +
      `Un solo beneficio y un CTA pequeño (derivación o llamada de 10 minutos con la agenda).\n` +
      `REMITENTE (quien firma al final; NUNCA es el destinatario ni aparece en el saludo):\n${this.business?.signature || ''}\n` +
      `Recuerda: el saludo va dirigido a ${destinatario}, no a quien firma.`,
      { useMemory: false, mode: cold ? 'cold' : 'warm' },
    );

    const subject = (draft.match(/asunto[:\-]\s*(.+)/i) || [, `Contacto ${lead.company || 'comercial'}`])[1].trim();

    // Sin email de contacto (típico en un chat web que aún no lo ha dado):
    // el borrador ES la respuesta al cliente en su mismo canal. No hay a quién
    // enviar un correo todavía, así que no lo intentamos (antes esto rompía
    // la tarea entera con "email: destinatario requerido").
    if (!lead.email) {
      return { draft, subject, segment, cold, send: { skipped: true, reason: 'sin email de contacto' }, status: 'ok' };
    }

    // Guardarraíl 2: envío en frío → línea roja → aprobación humana antes de enviar.
    const sendResult = await this.act({
      category: 'outbound',
      cold,
      tool: 'email',
      method: 'send',
      recipientCount: 1,
      args: { to: lead.email, subject, body: draft },
    });

    if (sendResult.sent || sendResult.status === 'rejected') {
      this.bus?.emit('sales:outreach_drafted', { tenantId: this.tenantId, lead, segment, approved: !!sendResult.sent });
    }

    return { draft, subject, segment, cold, send: sendResult, status: 'ok' };
  }
}
module.exports = OutreachAgent;
