'use strict';

const BaseAgent = require('../BaseAgent');
const slashing = require('../../platform/slashingWatch');

/**
 * SlashingWatcherAgent — vigila penalizaciones a validadores.
 *
 * La gravedad la calcula `platform/slashingWatch.js` por el % real de stake
 * penalizado, no por "hubo un evento sí/no": un 0.01% es ruido operativo, un
 * 5%+ suele ser double-signing y es una alarma de verdad.
 *
 * `BeZhasCoreConnector.validatorStats` solo expone agregados
 * (`activeValidators`, `totalStaked`), no eventos de slashing por validador
 * individual — ese endpoint no existe todavía en el stack de BeZhas. Este
 * agente acepta la lista de validadores por payload (de un indexador propio o
 * de una llamada futura al stack) y, si no se le da ninguna, lo dice
 * explícitamente en vez de fingir que comprobó algo.
 */
class SlashingWatcherAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'blockchain.slashing-watcher',
      name: 'Slashing Watcher',
      department: 'blockchain',
      modelTier: 'fast',
      capabilities: ['blockchain:slashing'],
      systemPrompt: 'Recibes eventos de slashing YA CLASIFICADOS por gravedad. Redacta un resumen breve de qué revisar primero.',
    });
  }

  async run(task) {
    const validators = task.payload?.validators;
    if (!Array.isArray(validators) || !validators.length) {
      return {
        status: 'blocked',
        reason: 'sin datos de validadores: BeZhasCoreConnector no expone slashing por validador individual todavía; pásalos por payload.validators',
      };
    }

    const result = slashing.evaluateAll(validators);

    for (const v of result.critical) {
      this.bus?.emit('blockchain:slashing_critical', { tenantId: this.tenantId, validatorId: v.id, slashedPct: v.slashedPct, jailed: v.jailed });
    }

    let summary = null;
    if (result.affected.length) {
      const detalle = result.affected.map((v) => `${v.id}: ${(v.slashedPct * 100).toFixed(2)}% penalizado (${v.level})${v.jailed ? ', encarcelado' : ''}`).join('\n');
      summary = await this.think(`Prioriza estos eventos de slashing:\n${detalle}`, { useMemory: false, maxTokens: 300 });
    }

    return {
      status: 'ok',
      affected: result.affected.length,
      critical: result.critical.length,
      unknownData: result.unknown.length,
      details: result.affected,
      summary,
    };
  }
}

module.exports = SlashingWatcherAgent;
