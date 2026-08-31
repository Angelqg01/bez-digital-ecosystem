'use strict';

const BaseAgent = require('../BaseAgent');
const redaction = require('../../platform/candidateRedaction');
const requisitionMatch = require('../../platform/requisitionMatch');

/**
 * CV Screener — criba candidatos frente a una vacante.
 *
 * Dos guardarraíles antes de que el modelo vea nada:
 *
 *   1. **Redacción de proxies de discriminación** (`platform/candidateRedaction.js`):
 *      nombre, edad, nacionalidad, foto, estado civil se quitan del texto que
 *      llega al modelo. La contratación es una decisión automatizada de alto
 *      riesgo (RGPD art. 22, AI Act de la UE) y un modelo no puede explicar
 *      si una correlación implícita con el nombre influyó en su veredicto —
 *      así que directamente no la ve.
 *   2. **Encaje objetivo contra el puesto** (`platform/requisitionMatch.js`):
 *      el código calcula qué habilidades pedidas cumple y cuáles no; el
 *      modelo redacta la valoración cualitativa alrededor de ese número, no
 *      lo inventa desde cero. Mismo motivo que en `priceCatalog`: sin esto,
 *      el mismo CV podría sacar notas distintas según el día, sin que nadie
 *      pueda explicar por qué.
 *
 * Una decisión de empleo real (contratar/descartar formal) sigue sin
 * ejecutarse sola: línea roja `employment_decision` → HITL, como siempre.
 */
class CVScreenerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'hr.cv-screener',
      name: 'CV Screener',
      department: 'hr',
      modelTier: 'fast',
      capabilities: ['hr:screen'],
      systemPrompt:
        'Evalúas candidaturas frente a una vacante. Recibes el candidato SIN datos personales '
        + '(ya redactados) y un encaje objetivo YA CALCULADO contra los requisitos. Redacta '
        + 'fortalezas, riesgos y una recomendación basada en esos datos — no inventes '
        + 'habilidades ni experiencia que no estén en el texto. No decides contrataciones.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const candidate = p.candidate || {};
    const requisition = p.requisition || null;

    const { safeCandidate, removed } = redaction.redact(candidate);

    let match = null;
    if (requisition) {
      match = requisitionMatch.score(requisition, safeCandidate);
    }

    const contexto = match
      ? `\n\nENCAJE OBJETIVO YA CALCULADO (${Math.round(match.score * 100)}/100):\n`
        + `Requisitos cumplidos: ${match.matchedRequired.join(', ') || 'ninguno'}\n`
        + `Requisitos que faltan: ${match.missingRequired.join(', ') || 'ninguno'}\n`
        + `Deseables cumplidos: ${match.matchedNiceToHave.join(', ') || 'ninguno'}\n`
        + `${match.meetsMinYears != null ? `Cumple la experiencia mínima: ${match.meetsMinYears ? 'sí' : 'no'}\n` : ''}`
      : '';

    const assessment = await this.think(
      `Evalúa este candidato (datos personales ya redactados): ${JSON.stringify(safeCandidate)}.${contexto}\n`
      + 'Da fortalezas, riesgos y una recomendación.',
      { maxTokens: 600 },
    );

    // Una decisión de empleo NO se ejecuta sola: línea roja → HITL.
    let decision = null;
    if (p.decision) {
      decision = await this.act({ category: 'employment', method: p.decision, args: { candidate } });
    }

    return {
      assessment,
      match,
      redactedFields: removed,
      decision,
      status: 'ok',
    };
  }
}

module.exports = CVScreenerAgent;
