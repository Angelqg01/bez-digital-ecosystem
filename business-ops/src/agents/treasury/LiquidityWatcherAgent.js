'use strict';

const BaseAgent = require('../BaseAgent');
const liquidity = require('../../platform/liquidityMath');

/**
 * LiquidityWatcherAgent — vigila la salud del pool BEZ/USDC con la fórmula
 * real del AMM (x·y=k), no con la sensación de "el pool es grande".
 *
 * Ambos umbrales de salud (liquidez mínima, slippage máximo tolerable) son
 * política del tenant, nunca un valor por defecto inventado aquí: sin
 * configurarlos, el agente no dice si el pool está "sano".
 */
class LiquidityWatcherAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'treasury.liquidity-watcher',
      name: 'Liquidity Watcher',
      department: 'treasury',
      modelTier: 'fast',
      capabilities: ['treasury:liquidity'],
      systemPrompt: 'Recibes el estado de liquidez del pool YA CALCULADO. Redacta qué implica en una frase, sin recalcular nada.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const pool = p.pool || {};
    if (!(pool.reserveBez > 0) || !(pool.reserveUsdc > 0)) {
      return { status: 'blocked', reason: 'sin reservas del pool (reserveBez/reserveUsdc)' };
    }

    const result = liquidity.evaluatePool(pool, {
      minLiquidityUsd: p.minLiquidityUsd,
      typicalTradeSizeBez: p.typicalTradeSizeBez,
      maxSlippagePct: p.maxSlippagePct,
    });

    if (result.healthy === null) {
      return { status: 'ok', ...result, note: 'sin políticas de liquidez configuradas: solo se informan las reservas' };
    }

    if (!result.healthy) {
      this.bus?.emit('treasury:liquidity_unhealthy', { tenantId: this.tenantId, reasons: result.reasons, totalLiquidityUsd: result.totalLiquidityUsd });
    }

    const note = await this.think(
      `Estado del pool BEZ/USDC (ya calculado): ${result.healthy ? 'sano' : 'con problemas'}. `
      + `${result.reasons?.length ? `Motivos: ${result.reasons.join('; ')}` : ''} Redáctalo en una frase.`,
      { useMemory: false, maxTokens: 150 },
    );

    return { status: 'ok', ...result, note };
  }
}

module.exports = LiquidityWatcherAgent;
