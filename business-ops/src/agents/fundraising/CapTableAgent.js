'use strict';

const BaseAgent = require('../BaseAgent');
const capTable = require('../../platform/capTableMath');

/**
 * CapTableAgent — simula una ronda de inversión: dilución exacta por
 * accionista, calculada con la fórmula estándar de cap table
 * (`platform/capTableMath.js`), no con la prosa de un modelo "estimando"
 * quién se diluye cuánto.
 *
 * Es el mismo motivo que en `priceCatalog`: un inversor va a contrastar este
 * número con su propia hoja de cálculo, y un error aquí no es un matiz de
 * redacción, es un desacuerdo de contrato. El modelo solo redacta el resumen
 * alrededor de cifras que ya están cerradas.
 *
 * Este agente NUNCA ejecuta la ronda ni modifica ningún registro societario
 * real: es una simulación de "qué pasaría si". Formalizar una ronda de verdad
 * es una decisión legal (línea roja `legal_commitment`) fuera de este agente.
 */
class CapTableAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'fundraising.cap-table',
      name: 'Cap Table',
      department: 'fundraising',
      modelTier: 'fast',
      capabilities: ['fundraising:cap-table'],
      systemPrompt:
        'Recibes la dilución de una ronda YA CALCULADA. Redacta un resumen breve de qué le pasa '
        + 'a cada accionista. Copia los porcentajes tal cual, no los recalcules ni los redondees distinto.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const table = p.capTable || [];

    let result;
    try {
      result = capTable.simulateRound(table, {
        preMoneyValuation: p.preMoneyValuation,
        raiseAmount: p.raiseAmount,
        newInvestorName: p.newInvestorName,
      });
    } catch (err) {
      return { status: 'blocked', reason: err.message };
    }

    const resumen = result.holders.map((h) => (
      `${h.holder}: ${(h.pctBefore * 100).toFixed(2)}% → ${(h.pctAfter * 100).toFixed(2)}%`
      + (h.dilutionPct > 0 ? ` (dilución ${(h.dilutionPct * 100).toFixed(2)} pp)` : '')
    )).join('\n');

    const summary = await this.think(
      `Ronda: ${p.raiseAmount} sobre pre-money ${p.preMoneyValuation} (post-money ${result.postMoneyValuation}).\n`
      + `Reparto YA CALCULADO:\n${resumen}\n\nRedacta un resumen breve para los fundadores.`,
      { useMemory: false, maxTokens: 400 },
    );

    return { status: 'ok', simulation: result, summary };
  }
}

module.exports = CapTableAgent;
