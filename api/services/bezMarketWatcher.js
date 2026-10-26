'use strict';

/**
 * bezMarketWatcher.js — el mercado real de BEZ en Polygon, para GET /api/gateway/v1/oracle/token-prices.
 *
 * Lee las reservas del par BEZ/USDC de QuickSwap V2 y rellena `token_market_cache` (migración 047), que hasta ahora
 * nadie escribía y por eso `markets[]` salía siempre en `pending`.
 *
 * Regla de honestidad: el precio de mercado SOLO se publica si el pool tiene liquidez de verdad. A 2026-10-26 el par
 * existe (0x4edc…45A9) pero lo único que guarda es polvo (1 unidad mínima de USDC), y un precio calculado con eso
 * sería disparatado y manipulable con unos céntimos. Por debajo de MIN_LIQUIDITY_USD la fila queda en `pending`, con la
 * liquidez real y sin precio. El precio con el que se cobra y se liquida sigue siendo el de config/bez-price.js; esto
 * solo informa del mercado.
 */

const { ethers } = require('ethers');
const { query } = require('../db/pool');
const logger = require('pino')({ level: 'info', name: 'bez-market-watcher' });

const CHAIN_ID = 137;
const BEZ = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // USDC nativo de Polygon (6 decimales)
const QUICKSWAP_V2_FACTORY = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32';
const POOL_NAME = 'QuickSwap V2';
const MIN_LIQUIDITY_USD = parseFloat(process.env.BEZ_MARKET_MIN_LIQUIDITY_USD || '5000');

const FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
const PAIR_ABI = [
    'function token0() view returns (address)',
    'function getReserves() view returns (uint112,uint112,uint32)',
];

/**
 * Precio y liquidez a partir de las reservas (enteros). Con BigInt hasta el último paso: las reservas llegan a 1e30.
 * Liquidez = 2 × la pata USDC (el pool está equilibrado por construcción del AMM de producto constante).
 * @returns {{ priceUsd: number|null, liquidityUsd: number, status: 'active'|'pending' }}
 */
function computeMarket({ usdcReserve, bezReserve }, minLiquidityUsd = MIN_LIQUIDITY_USD) {
    const usdc = BigInt(usdcReserve);
    const bez = BigInt(bezReserve);
    const liquidityUsd = Number(usdc * 2n) / 1e6;
    if (bez === 0n || liquidityUsd < minLiquidityUsd) {
        return { priceUsd: null, liquidityUsd, status: 'pending' };
    }
    // USD por BEZ = (usdc / 1e6) / (bez / 1e18) = usdc * 1e12 / bez
    const priceMicro = (usdc * 10n ** 12n * 1_000_000n) / bez;
    return { priceUsd: Number(priceMicro) / 1e6, liquidityUsd, status: 'active' };
}

const defaultContract = (address, abi, provider) => new ethers.Contract(address, abi, provider);

/** Lee el par on-chain. `provider` y `makeContract` son inyectables para los tests. */
async function readPair(provider, makeContract = defaultContract) {
    const factory = makeContract(QUICKSWAP_V2_FACTORY, FACTORY_ABI, provider);
    const pairAddress = await factory.getPair(BEZ, USDC);
    if (pairAddress === ethers.ZeroAddress) return null;
    const pair = makeContract(pairAddress, PAIR_ABI, provider);
    const [token0, reserves] = await Promise.all([pair.token0(), pair.getReserves()]);
    const usdcIsToken0 = token0.toLowerCase() === USDC.toLowerCase();
    return {
        pairAddress,
        usdcReserve: usdcIsToken0 ? reserves[0] : reserves[1],
        bezReserve: usdcIsToken0 ? reserves[1] : reserves[0],
    };
}

/** Una lectura y su escritura en token_market_cache. Devuelve lo publicado (o null si no hay par). */
async function refreshOnce(provider = null, makeContract = defaultContract) {
    provider = provider || new ethers.JsonRpcProvider(process.env.POLYGON_MAINNET_RPC || 'https://polygon-bor-rpc.publicnode.com');
    const pair = await readPair(provider, makeContract);
    const market = pair ? computeMarket(pair) : { priceUsd: null, liquidityUsd: 0, status: 'pending' };

    await query(
        `INSERT INTO token_market_cache (chain_id, symbol, token_address, pool, price_usd, liquidity_usd, status, updated_at)
         VALUES ($1, 'BEZ', $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (chain_id) DO UPDATE
           SET pool = EXCLUDED.pool, price_usd = EXCLUDED.price_usd, liquidity_usd = EXCLUDED.liquidity_usd,
               status = EXCLUDED.status, updated_at = NOW()`,
        [CHAIN_ID, BEZ, POOL_NAME, market.priceUsd, market.liquidityUsd, market.status],
    );
    return { ...market, pair: pair?.pairAddress ?? null };
}

let _timer = null;

/** Arranca el sondeo (idempotente). Se activa con BEZ_MARKET_WATCHER_ENABLED=true. */
function startWatcher({ intervalMs = 300_000 } = {}) {
    if (_timer) return _timer;
    const tick = () => refreshOnce().then(
        (m) => logger.info({ status: m.status, liquidityUsd: m.liquidityUsd }, 'BEZ market refreshed'),
        (err) => logger.warn({ err: err.message }, 'BEZ market refresh failed'),
    );
    tick();
    _timer = setInterval(tick, intervalMs);
    _timer.unref?.();
    return _timer;
}

function stopWatcher() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { computeMarket, readPair, refreshOnce, startWatcher, stopWatcher, MIN_LIQUIDITY_USD };
