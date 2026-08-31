'use strict';

const BaseAgent = require('../BaseAgent');
const vesting = require('../../platform/vestingMath');

/**
 * VestingMonitorAgent — cuánto BEZ-Coin tiene liberado cada fundador/inversor
 * y cuándo se libera el siguiente tramo, calculado con la fórmula de vesting
 * real (cliff + lineal mensual), no con la lectura de una tabla por el modelo.
 *
 * Cuánto puede vender alguien hoy es un dato que mueve la lectura de presión
 * de venta del token — equivocarlo no es un matiz de redacción.
 */
class VestingMonitorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'treasury.vesting-monitor',
      name: 'Vesting Monitor',
      department: 'treasury',
      modelTier: 'fast',
      capabilities: ['treasury:vesting'],
      systemPrompt: 'Recibes el estado de vesting YA CALCULADO. Redacta qué desbloqueos próximos vigilar y por qué, en un párrafo breve.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const grants = p.grants || [];
    if (!grants.length) {
      return { status: 'blocked', reason: 'sin grants de vesting que evaluar' };
    }

    const { results, upcoming } = vesting.evaluateAll(grants, p.now);
    const horizonDays = p.horizonDays ?? 30;
    const now = p.now ?? Date.now();
    const proximos = upcoming.filter((u) => (new Date(u.nextUnlockDate).getTime() - now) <= horizonDays * 86_400_000);

    for (const u of proximos) {
      this.bus?.emit('treasury:vesting_unlock_upcoming', {
        tenantId: this.tenantId, holder: u.holder, nextUnlockDate: u.nextUnlockDate, nextUnlockAmount: u.nextUnlockAmount,
      });
    }

    let summary = null;
    if (proximos.length) {
      const detalle = proximos.map((u) => `${u.holder}: ${u.nextUnlockAmount} tokens el ${u.nextUnlockDate.slice(0, 10)}`).join('\n');
      summary = await this.think(`Desbloqueos de vesting en los próximos ${horizonDays} días:\n${detalle}`, { useMemory: false, maxTokens: 300 });
    }

    return { status: 'ok', results, upcomingWithinHorizon: proximos, summary };
  }
}

module.exports = VestingMonitorAgent;
