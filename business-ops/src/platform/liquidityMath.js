'use strict';

/**
 * liquidityMath — impacto de precio y profundidad de un pool AMM (x·y=k),
 * calculado con la fórmula real del protocolo, no con la impresión del
 * modelo al leer "reservas: 500.000 BEZ / 250.000 USDC".
 *
 * Por qué importa que sea exacto: el impacto de precio de un pool es lo que
 * decide si "hay liquidez suficiente" es verdad o una sensación. Un pool con
 * mucho volumen total pero mal repartido puede tener una slippage brutal en
 * una venta mediana, y eso solo se ve hacienda la cuenta real, no leyendo el
 * tamaño total del pool.
 */

/**
 * Precio impacto de vender `amountIn` del activo base contra un pool
 * constant-product (Uniswap v2 style, sin fees para mantener la fórmula
 * clara — los fees reales solo restan un pequeño % adicional al output).
 *
 * @param {number} reserveIn   - reservas del activo que se vende (p. ej. BEZ)
 * @param {number} reserveOut  - reservas del activo que se recibe (p. ej. USDC)
 * @param {number} amountIn    - cantidad que se quiere vender
 * @returns {{amountOut:number, priceImpactPct:number, effectivePrice:number, spotPrice:number}}
 */
function priceImpact(reserveIn, reserveOut, amountIn) {
  if (!(reserveIn > 0) || !(reserveOut > 0) || !(amountIn > 0)) {
    return { amountOut: null, priceImpactPct: null, effectivePrice: null, spotPrice: null, reason: 'reservas o importe inválidos' };
  }
  const spotPrice = reserveOut / reserveIn;
  const k = reserveIn * reserveOut;
  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = k / newReserveIn;
  const amountOut = reserveOut - newReserveOut;
  const effectivePrice = amountOut / amountIn;
  const priceImpactPct = Number((1 - effectivePrice / spotPrice).toFixed(6));
  return { amountOut: Number(amountOut.toFixed(6)), priceImpactPct, effectivePrice: Number(effectivePrice.toFixed(6)), spotPrice: Number(spotPrice.toFixed(6)), reason: null };
}

/**
 * Evalúa la salud de un pool contra dos políticas explícitas del tenant:
 * liquidez mínima en USD y slippage máximo tolerable para un "trade típico".
 * Ninguno de los dos umbrales se inventa aquí — sin configurarlos, el módulo
 * no opina sobre si el pool está "sano".
 *
 * @param {{reserveBez:number, reserveUsdc:number}} pool
 * @param {{minLiquidityUsd?:number, typicalTradeSizeBez?:number, maxSlippagePct?:number}} policy
 */
function evaluatePool(pool = {}, policy = {}) {
  const { reserveBez, reserveUsdc } = pool;
  if (!(reserveBez > 0) || !(reserveUsdc > 0)) {
    return { healthy: null, reason: 'reservas del pool inválidas o vacías', totalLiquidityUsd: null };
  }
  // Liquidez total en USD ≈ 2× el lado USDC (ambos lados valen lo mismo en un
  // pool balanceado). Aproximación estándar, no un precio de mercado externo.
  const totalLiquidityUsd = reserveUsdc * 2;
  const spotPrice = reserveUsdc / reserveBez;

  const checks = {};
  let healthy = true;
  const reasons = [];

  if (policy.minLiquidityUsd != null) {
    checks.meetsMinLiquidity = totalLiquidityUsd >= policy.minLiquidityUsd;
    if (!checks.meetsMinLiquidity) { healthy = false; reasons.push(`liquidez total $${totalLiquidityUsd.toFixed(0)} por debajo del mínimo $${policy.minLiquidityUsd}`); }
  }

  let trade = null;
  if (policy.typicalTradeSizeBez != null && policy.maxSlippagePct != null) {
    trade = priceImpact(reserveBez, reserveUsdc, policy.typicalTradeSizeBez);
    checks.slippageWithinLimit = trade.priceImpactPct != null && trade.priceImpactPct <= policy.maxSlippagePct;
    if (!checks.slippageWithinLimit) { healthy = false; reasons.push(`un trade de ${policy.typicalTradeSizeBez} BEZ movería el precio ${(trade.priceImpactPct * 100).toFixed(2)}% (máximo ${(policy.maxSlippagePct * 100).toFixed(2)}%)`); }
  }

  if (!Object.keys(checks).length) {
    return { healthy: null, reason: 'sin políticas configuradas (minLiquidityUsd / maxSlippagePct): no se opina sobre si el pool está sano', totalLiquidityUsd, spotPrice };
  }

  return { healthy, checks, reasons, totalLiquidityUsd, spotPrice, trade, reason: null };
}

module.exports = { priceImpact, evaluatePool };
