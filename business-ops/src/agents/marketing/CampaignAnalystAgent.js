'use strict';

const BaseAgent = require('../BaseAgent');
const ab = require('../../platform/abTest');

/**
 * CampaignAnalystAgent — lee las métricas de una campaña y dice qué hacer.
 *
 * Lo que lo distingue de "pedirle a un LLM que mire unos números": la decisión
 * de si hay ganador la toma una prueba estadística (`platform/abTest.js`), no
 * el modelo. Y la respuesta más frecuente —"todavía no se sabe"— se da tal
 * cual, sin adornarla.
 *
 * El motivo es concreto: cambiar la campaña por una diferencia que era ruido
 * cuesta dinero dos veces, en el cambio y en el rendimiento que se pierde. Un
 * analista que siempre encuentra un ganador es un analista inútil, y un modelo
 * al que le pides una recomendación siempre te da una.
 *
 * El modelo solo interviene para redactar la acción concreta, y solo cuando
 * los números respaldan que hay algo que decidir.
 */
class CampaignAnalystAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'marketing.campaign-analyst',
      name: 'Campaign Analyst',
      department: 'marketing',
      modelTier: 'mid',
      capabilities: ['marketing:analyze-campaign'],
      systemPrompt:
        'Recibes el resultado YA CALCULADO de un análisis de campaña. Propones UNA acción '
        + 'concreta en dos frases. No recalcules porcentajes ni contradigas el veredicto '
        + 'estadístico que se te da: si dice que no hay diferencia significativa, la acción '
        + 'es seguir midiendo, no cambiar.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const variants = p.variants || [];
    const channels = p.channels || [];

    if (!variants.length && !channels.length) {
      return { status: 'blocked', reason: 'no se aportaron variantes ni canales que analizar' };
    }

    // 1. Comparación A/B, si hay dos variantes.
    let test = null;
    if (variants.length >= 2) {
      test = ab.compare(variants[0], variants[1]);
    }

    // 2. Ranking de canales. NO se comparan entre sí con una prueba: canales
    //    distintos tienen audiencias distintas, no son un experimento controlado.
    const ranking = channels.length ? ab.rankChannels(channels) : [];
    const fiables = ranking.filter((c) => c.reliable);

    // 3. Recomendación. Solo se pide al modelo si hay algo que decidir; si el
    //    test no es concluyente y ningún canal tiene datos suficientes, la
    //    recomendación honesta es "sigue midiendo" y no hace falta un modelo.
    const hayAlgoQueDecidir = (test && test.conclusive) || fiables.length >= 2;
    let recommendation = null;

    if (hayAlgoQueDecidir) {
      try {
        recommendation = await this.think(
          `Campaña: ${p.campaign || 'sin nombre'}.\n`
          + (test ? `Prueba A/B: ${test.verdict}\n` : '')
          + (fiables.length
            ? `Canales con datos suficientes:\n${fiables.map((c) => `- ${c.name}: ${(c.rate * 100).toFixed(2)} % (${c.impressions} impresiones)`).join('\n')}\n`
            : '')
          + (ranking.length > fiables.length
            ? `Canales SIN datos suficientes (no decidir sobre ellos): ${ranking.filter((c) => !c.reliable).map((c) => c.name).join(', ')}\n`
            : '')
          + '\n¿Qué acción concreta tomamos?',
          { useMemory: false, maxTokens: 250 },
        );
      } catch { /* el análisis ya está hecho; la redacción es un extra */ }
    }

    const summary = test
      ? test.verdict
      : (fiables.length
        ? `Mejor canal con datos fiables: ${fiables[0].name} (${(fiables[0].rate * 100).toFixed(2)} %).`
        : 'Ningún canal tiene todavía datos suficientes para decidir.');

    await this.remember({ task: 'marketing:analyze-campaign', summary, outcome: 'ok' });

    return {
      status: 'ok',
      campaign: p.campaign || null,
      test,
      channels: ranking,
      reliableChannels: fiables.length,
      conclusive: !!(test && test.conclusive),
      summary,
      recommendation,
      // Explícito para el panel: distinguir "no hay ganador" de "no hay datos".
      note: hayAlgoQueDecidir
        ? null
        : 'Sin datos suficientes para cambiar nada. Seguir midiendo cuesta menos que optimizar sobre ruido.',
    };
  }
}

module.exports = CampaignAnalystAgent;
