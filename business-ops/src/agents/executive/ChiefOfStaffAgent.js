'use strict';

const BaseAgent = require('../BaseAgent');
const { personaFor } = require('../../platform/personas');

/**
 * ChiefOfStaffAgent — la única voz que habla con el SuperAdmin.
 *
 * Recibe los informes de los managers ({ department, done, blocked, decision,
 * risk, stance? }), y por código (no por modelo) saca la cola de decisiones y
 * los desacuerdos. El modelo solo redacta el parte final; así lo importante no
 * depende de que el modelo lo recuerde.
 */
class ChiefOfStaffAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'executive.chief-of-staff',
      name: 'Chief of Staff',
      department: 'chief',
      tier: 'manager',
      modelTier: 'mid',
      capabilities: ['executive:digest'],
      systemPrompt: 'Eres Dirección: la única voz que habla con el SuperAdmin (Yoel). ' +
        'Consolidas los informes de los departamentos en un parte breve, en español, sin jerga. ' +
        'Das una recomendación clara y nunca prometes rentabilidad ni cifras no verificadas.',
    });
  }

  static isPending(decision) {
    const d = String(decision || '').trim().toLowerCase();
    return d !== '' && d !== 'ninguna' && d !== 'none';
  }

  /** Cola de decisiones: solo lo que algún departamento pide explícitamente. */
  static decisionQueue(reports) {
    return reports
      .filter(r => ChiefOfStaffAgent.isPending(r.decision))
      .map(r => ({
        department: r.department,
        voice: (personaFor(r.department) || {}).name || r.department,
        decision: r.decision,
        risk: r.risk || null,
        approvalId: r.approvalId || null,
      }));
  }

  /** Desacuerdos: departamentos con postura opuesta sobre el mismo asunto. */
  static disagreements(reports) {
    const bySubject = new Map();
    for (const r of reports) {
      if (!r.stance || !r.stance.subject) continue;
      const list = bySubject.get(r.stance.subject) || [];
      list.push({ department: r.department, position: r.stance.position });
      bySubject.set(r.stance.subject, list);
    }
    return [...bySubject.entries()]
      .filter(([, list]) => new Set(list.map(l => l.position)).size > 1)
      .map(([subject, positions]) => ({ subject, positions }));
  }

  async run(task) {
    const reports = Array.isArray(task.payload?.reports) ? task.payload.reports : [];
    const decisions = ChiefOfStaffAgent.decisionQueue(reports);
    const disagreements = ChiefOfStaffAgent.disagreements(reports);

    const lines = reports.map(r => {
      const name = (personaFor(r.department) || {}).name || r.department;
      return `${name}: Hecho: ${r.done || '—'} · Bloqueado: ${r.blocked || '—'} · ` +
        `Decisión: ${r.decision || 'Ninguna'} · Riesgo: ${r.risk || '—'}`;
    }).join('\n');

    const digest = await this.think(
      `Redacta el parte diario para Yoel con estos informes. Cierra con tu recomendación ` +
      `en una frase. Desacuerdos entre departamentos: ${JSON.stringify(disagreements)}.\n${lines}`,
      { useMemory: false, maxTokens: 700 }
    );

    return { digest, decisions, disagreements, status: 'ok' };
  }
}

module.exports = ChiefOfStaffAgent;
