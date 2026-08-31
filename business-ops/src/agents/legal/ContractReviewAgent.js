'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * ContractReviewAgent — revisa un contrato o cláusula y señala riesgos
 * (pagos, responsabilidad, terminación, propiedad intelectual, protección
 * de datos). Puede REDACTAR una recomendación de firma, pero la firma en sí
 * (`category: 'signature'`) cruza la línea roja `legal_commitment` en
 * RedLines.js → siempre HITL. Este agente nunca firma ni compromete nada.
 */
class ContractReviewAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'legal.contract-review',
      name: 'Contract Review',
      department: 'legal',
      modelTier: 'mid',
      capabilities: ['legal:review'],
      systemPrompt:
        'Eres un revisor de contratos B2B. Señalas cláusulas de riesgo (pagos, responsabilidad, terminación, ' +
        'propiedad intelectual, protección de datos) de forma concreta. Nunca firmas ni comprometes legalmente ' +
        'a la empresa; solo recomiendas. La firma la decide y ejecuta un humano.',
    });
  }

  async run(task) {
    const text = task.payload?.text || '';
    // Substring simple a propósito: "firma" cubre firmar/firmarla/firmando/firmado
    // (el español pega pronombres al verbo — un \b tras "firmar" no basta).
    const wantsSign = /firma|\bsign\b/i.test(text);

    const review = await this.think(
      `Revisa este contrato o cláusula y señala en una lista breve los puntos de riesgo (pagos, responsabilidad, ` +
      `terminación, propiedad intelectual, protección de datos). Si no hay texto de contrato, dilo claramente.\n\n` +
      `TEXTO: "${text}"`,
      { useMemory: true, maxTokens: 800 },
    );

    let signature = null;
    if (wantsSign) {
      // Cruza la línea roja legal_commitment → espera aprobación humana antes de firmar.
      signature = await this.act({
        category: 'signature',
        tool: 'esign',
        method: 'sign',
        args: { document: text.slice(0, 200) },
      });
    }

    return { review, signatureRequested: wantsSign, signature, status: 'ok' };
  }
}
module.exports = ContractReviewAgent;
