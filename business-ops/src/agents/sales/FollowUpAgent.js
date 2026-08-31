'use strict';

const BaseAgent = require('../BaseAgent');
const policy = require('../../platform/followUpPolicy');

/**
 * FollowUpAgent — insiste a un prospecto que no contestó, con criterio.
 *
 * La decisión de SI insistir la toma `platform/followUpPolicy` (función pura,
 * probada exhaustivamente); este agente solo redacta y envía cuando esa
 * política dice que sí. Separarlo importa porque el fallo caro aquí no es un
 * error visible: es insistir de más, quemar el contacto y el dominio.
 *
 * Cada envío sigue pasando por la línea roja `cold_outbound`, igual que el
 * primer contacto: un seguimiento a alguien que nunca respondió sigue siendo
 * comunicación en frío.
 */
class FollowUpAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.followup',
      name: 'Follow-Up',
      department: 'sales',
      modelTier: 'mid',
      capabilities: ['sales:followup'],
      systemPrompt:
        'Redactas un correo BREVE de seguimiento a un prospecto que no contestó. '
        + 'Máximo 5 líneas. Aportas algo nuevo (un dato, un caso, una pregunta concreta): '
        + 'no repitas el correo anterior ni escribas "solo por si acaso" ni "haciendo seguimiento". '
        + 'Nunca reproches el silencio. Devuelve ASUNTO en la primera línea y luego el cuerpo.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const lead = p.lead || {};
    const leadKey = String(lead.email || lead.company || '').toLowerCase();

    if (!leadKey) {
      return { status: 'skipped', reason: 'lead sin email ni empresa: no hay a quién seguir' };
    }

    // Cuenta vetada (fija) o añadida a "no contactar" DESPUÉS de que se abriera
    // la secuencia (p.ej. el prospecto pidió que no le escriban más a mitad de
    // la conversación): ni el primer contacto ni el seguimiento.
    const dncHit = this.doNotContact ? this.doNotContact.isListed(lead) : null;
    if (this.business?.isExcluded(lead) || dncHit) {
      this.guardrails?.evaluate({ agentId: this.id, action: { category: 'outbound', tool: 'email', method: 'send', excluded: true } });
      return { status: 'blocked', reason: dncHit ? `En lista de no-contactar${dncHit.reason ? `: ${dncHit.reason}` : '.'}` : 'Cuenta excluida: no se contacta.', lead };
    }

    const todas = this.store ? await policy.loadAll({ store: this.store, tenantId: this.tenantId }) : {};
    let state = todas[leadKey];

    // Señal de parada recibida (respondió, se dio de baja, rebotó, se cerró).
    if (p.stopReason) {
      state = policy.stop(state || policy.start({ leadKey }), p.stopReason);
      if (this.store) await policy.saveOne({ store: this.store, tenantId: this.tenantId, leadKey, state });
      return { status: 'stopped', reason: p.stopReason, state };
    }

    if (!state) {
      return { status: 'skipped', reason: 'sin secuencia abierta para este lead', state: null };
    }

    const decision = policy.decide(state, {
      now: p.now ?? Date.now(),
      hourOfDay: p.hourOfDay ?? null,
      dayOfWeek: p.dayOfWeek ?? null,
    });

    if (!decision.send) {
      return { status: 'skipped', reason: decision.reason, nextAt: decision.nextAt, state };
    }

    const draft = await this.think(
      `Seguimiento nº ${decision.attempt} a ${lead.contact || 'el responsable'} `
      + `(${lead.role || 'dirección'}) de ${lead.company || 'la empresa'}.\n`
      + `${p.lastMessage ? `Lo último que le escribimos fue: "${String(p.lastMessage).slice(0, 500)}"\n` : ''}`
      + `Aporta un ángulo NUEVO, no repitas lo anterior.\n`
      + `Firma:\n${this.business?.signature || ''}`,
      { useMemory: false, mode: 'cold', maxTokens: 400 },
    );

    const subject = (draft.match(/asunto[:\-]\s*(.+)/i) || [, `Seguimiento · ${lead.company || ''}`])[1].trim();

    let send = null;
    if (lead.email) {
      send = await this.act({
        category: 'outbound',
        cold: true,                 // un seguimiento sin respuesta previa sigue siendo frío
        tool: 'email',
        method: 'send',
        recipientCount: 1,
        args: { to: lead.email, subject, body: draft },
      });
    }

    // El contador sube solo si el envío salió de verdad. Si el humano lo
    // rechazó en el HITL, no se ha molestado a nadie y no debe gastar intento.
    if (send?.sent) {
      state = policy.recordSent(state, { now: p.now ?? Date.now() });
      if (this.store) await policy.saveOne({ store: this.store, tenantId: this.tenantId, leadKey, state });
    }

    return {
      status: 'ok',
      attempt: decision.attempt,
      draft,
      subject,
      send,
      state,
    };
  }
}

module.exports = FollowUpAgent;
