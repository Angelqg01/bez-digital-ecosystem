'use strict';

const BaseAgent = require('../BaseAgent');
const churn = require('../../platform/churnScore');
const csat = require('../../platform/csat');

/**
 * ChurnPredictorAgent — avisa de clientes en riesgo de irse mientras aún se
 * les puede llamar.
 *
 * Se apoya en señales que la plataforma YA observa, no en una bola de cristal:
 * la intención de baja que detecta `SentimentAgent`, las valoraciones de
 * `csat.js`, los escalados de Soporte, el silencio y los impagos. El cálculo
 * vive en `platform/churnScore.js` y es determinista: devuelve el número y
 * **qué factores lo produjeron**, porque un comercial que no entiende por qué
 * una cuenta está en riesgo no la va a llamar.
 *
 * El modelo solo interviene al final, para redactar la acción recomendada.
 * Nunca decide el riesgo.
 */
class ChurnPredictorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.churn-predictor',
      name: 'Churn Predictor',
      department: 'sales',
      modelTier: 'mid',
      capabilities: ['sales:churn'],
      systemPrompt:
        'Propones UNA acción concreta para retener a un cliente en riesgo, en dos frases. '
        + 'Nada de descuentos ni compensaciones (eso lo decide una persona). '
        + 'Céntrate en qué conversación hay que tener y con quién.',
    });
    this.alertFrom = ctx.churnAlertFrom || 'alto';
  }

  async run(task) {
    const p = task.payload || {};
    const customerId = p.customerId || p.account || null;

    // Señales: las del payload mandan (permite analizar una cuenta concreta),
    // y lo que falte se completa con lo que la plataforma ya tiene guardado.
    const signals = { ...(p.signals || {}) };

    if (this.store && signals.csatResponses == null) {
      try {
        const informe = await csat.report({ store: this.store, tenantId: this.tenantId });
        signals.csatResponses = informe.responses;
        signals.detractorResponses = informe.detractors;
      } catch { /* sin CSAT se evalúa con el resto de señales */ }
    }

    const result = churn.evaluate(signals);

    // Sin datos suficientes NO se inventa un número ni se recomienda nada.
    if (result.score == null) {
      return {
        status: 'insufficient_data',
        customerId,
        score: null,
        level: null,
        factors: result.factors,
        note: result.note,
        recommendation: null,
      };
    }

    let recommendation = null;
    if (result.level !== 'bajo') {
      try {
        recommendation = await this.think(
          `Cliente ${customerId || 'sin identificar'} con riesgo de abandono ${result.level} (${result.score}/100).\n`
          + `Factores:\n${result.factors.map((f) => `- ${f.detail}`).join('\n')}\n\n`
          + '¿Qué hacemos ahora?',
          { useMemory: false, maxTokens: 200 },
        );
      } catch { /* la recomendación es un extra: el riesgo ya está calculado */ }
    }

    // Aviso solo en riesgo alto. Si suena con cada cuenta tibia, se ignora.
    if (result.level === this.alertFrom) {
      this.bus?.emit('sales:churn_risk', {
        tenantId: this.tenantId,
        customerId,
        score: result.score,
        level: result.level,
        factors: result.factors,
        recommendation,
      });
    }

    await this.remember({
      task: 'sales:churn',
      summary: `Churn ${customerId || '?'}: ${result.level} (${result.score})`,
      outcome: 'ok',
    });

    return {
      status: 'ok',
      customerId,
      score: result.score,
      level: result.level,
      factors: result.factors,
      observed: result.observed,
      note: result.note,
      recommendation,
    };
  }
}

module.exports = ChurnPredictorAgent;
