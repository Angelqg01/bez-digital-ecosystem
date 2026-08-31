'use strict';

const BaseAgent = require('../BaseAgent');
const dpia = require('../../platform/dpiaChecklist');

/**
 * DPIAAgent — determina si una SubApp necesita una Evaluación de Impacto
 * (RGPD art. 35) según los 9 criterios objetivos de la guía WP248, no según
 * la impresión general del modelo al leer la descripción del tratamiento.
 *
 * Dos criterios o más → obligatoria (regla publicada). El modelo NUNCA marca
 * un tratamiento como "no necesita DPIA" por su cuenta — el veredicto sale
 * del checklist. Y ni siquiera un veredicto "no obligatoria" es un cierre:
 * `requiresDPOReview` es siempre `true`. Un DPIA "aprobado por un agente" sin
 * que lo vea el DPO es exactamente el tipo de automatización que el propio
 * artículo 35 intenta evitar.
 */
class DPIAAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'legal.dpia',
      name: 'DPIA',
      department: 'legal',
      modelTier: 'mid',
      capabilities: ['legal:dpia'],
      systemPrompt:
        'Recibes el veredicto YA CALCULADO sobre si una SubApp necesita DPIA y qué criterios '
        + 'lo disparan. Redacta un borrador de las secciones descriptivas (qué se trata, con qué '
        + 'fin, qué riesgos) basándote SOLO en los datos dados. Nunca concluyas que el documento '
        + 'está aprobado o completo: siempre falta la revisión del DPO.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const subapp = p.subapp || 'SubApp sin nombre';
    const flags = p.flags || {};

    if (!Object.keys(flags).length) {
      return { status: 'blocked', reason: 'sin criterios evaluados (payload.flags): no se opina sobre la necesidad de DPIA sin datos' };
    }

    const result = dpia.evaluate(flags);

    let draft = null;
    if (result.verdict !== 'not_required') {
      draft = await this.think(
        `SubApp: ${subapp}.\nVeredicto YA CALCULADO: ${result.verdict === 'mandatory' ? 'DPIA obligatoria' : 'DPIA recomendable'}.\n`
        + `Criterios que lo disparan:\n${result.matchedLabels.map((l) => `- ${l}`).join('\n')}\n`
        + `${p.processingDescription ? `Descripción del tratamiento: ${p.processingDescription}\n` : ''}`
        + '\nRedacta el borrador de las secciones descriptivas (tratamiento, finalidad, riesgos preliminares).',
        { useMemory: false, maxTokens: 600 },
      );
    }

    return {
      status: 'ok',
      subapp,
      verdict: result.verdict,
      matchedCriteria: result.matched,
      matchedLabels: result.matchedLabels,
      requiresDPOReview: result.requiresDPOReview,
      draft,
    };
  }
}

module.exports = DPIAAgent;
