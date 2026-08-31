'use strict';

/**
 * services/mcpGatewayBridge.js — Lecturas que el MCP de cliente ofrece.
 *
 * Cada función corresponde a un endpoint del Gateway. Se llama al SERVICIO
 * interno, nunca por HTTP a la propia API: una petición a uno mismo duplicaría
 * la autenticación, abriría un camino de SSRF hacia dentro y convertiría un
 * fallo de red en un fallo de herramienta.
 *
 * Donde el endpoint resuelve con SQL directo, la consulta se repite aquí y se
 * anota la ruta equivalente. Es duplicación consciente y acotada: son SELECT de
 * tres líneas sobre tablas de caché. Si alguna crece, toca extraerla a un sitio
 * común y que la consuman las dos.
 *
 * Todo lo de aquí es de SOLO LECTURA. Ninguna función escribe, firma ni mueve
 * fondos, y esa propiedad debe seguir siendo cierta: es lo que permite que el
 * MCP no necesite confirmación humana por llamada.
 */

const { query } = require('../db/pool');
const contractService = require('./contractService');

/** Precio semilla cuando aún no hay fila de caché. Mismo valor que el Gateway. */
const PRECIO_SEMILLA_USD = 0.10;

// ── Token ────────────────────────────────────────────────────────────────────

/** Equivale a GET /api/gateway/v1/token/info */
async function tokenInfo({ chainId } = {}) {
    return contractService.getTokenInfo('BEZCoinV2', chainId);
}

/**
 * Equivale a GET /api/gateway/v1/token/price
 *
 * `updatedAt` va a null cuando se responde con el semilla, no a la hora actual:
 * el semilla es configuración, no una lectura del oráculo, y sellarlo con la
 * hora de ahora lo haría pasar por un precio fresco.
 */
async function tokenPrice() {
    const { rows } = await query(
        "SELECT price_usd, change_24h, updated_at FROM token_price_cache WHERE symbol = 'BEZ' LIMIT 1"
    ).catch(() => ({ rows: [] }));

    if (rows.length > 0) {
        return {
            priceUSD: parseFloat(rows[0].price_usd),
            change24h: parseFloat(rows[0].change_24h || 0),
            updatedAt: rows[0].updated_at,
            source: 'cache',
        };
    }
    return { priceUSD: PRECIO_SEMILLA_USD, change24h: 0, updatedAt: null, source: 'seed' };
}

/** Equivale a GET /api/gateway/v1/oracle/token-prices (endpoint público). */
async function oraclePrices() {
    const { rows } = await query(
        'SELECT symbol, price_usd, change_24h, updated_at FROM token_price_cache'
    ).catch(() => ({ rows: [] }));

    const tokens = {};
    for (const fila of rows) {
        tokens[fila.symbol] = {
            symbol: fila.symbol,
            priceUSD: parseFloat(fila.price_usd),
            change24h: parseFloat(fila.change_24h || 0),
            updatedAt: fila.updated_at,
        };
    }
    if (!tokens.BEZ) {
        tokens.BEZ = { symbol: 'BEZ', priceUSD: PRECIO_SEMILLA_USD, change24h: 0, updatedAt: null };
    }
    return { tokens };
}

// ── DEX ──────────────────────────────────────────────────────────────────────

/** Equivale a GET /api/gateway/v1/dex/quote. Solo calcula: no firma ni envía. */
async function dexQuote({ from, to, amount, chainId }) {
    return contractService.quoteDEXSwap(from, to, amount, chainId);
}

/** Equivale a GET /api/gateway/v1/dex/pool */
async function dexPool({ tokenA = 'BEZ', tokenB = 'USDT', chainId } = {}) {
    return contractService.getDEXPool(tokenA, tokenB, chainId);
}

// ── Red y contratos ──────────────────────────────────────────────────────────

/** Equivale a GET /api/gateway/v1/network/stats (endpoint público). */
async function networkStats() {
    return contractService.getBlockchainStats();
}

/**
 * Equivale a GET /api/gateway/v1/contracts/list
 *
 * Direcciones de contrato: son públicas y verificables en cualquier explorador
 * de bloques, así que no hay nada que proteger aquí más allá del scope.
 */
async function contractsList({ chainId } = {}) {
    const direcciones = await contractService.getAllAddresses(chainId);
    return { chainId: chainId ?? null, contracts: direcciones };
}

// ── Suscripción del propio llamante ─────────────────────────────────────────

/**
 * Equivale a GET /api/gateway/v1/subscription.
 *
 * Recibe el appId del middleware de autenticación, NUNCA de un argumento de la
 * herramienta. Esa es toda la diferencia entre «dime lo mío» y «dime lo de ese
 * otro»: si el identificador viajara como parámetro, cualquier cliente podría
 * leer la suscripción de los demás con solo cambiarlo.
 */
async function subscription(appId) {
    const { rows } = await query(
        'SELECT plan_id, subapps, status, renews_at FROM gateway_subscriptions WHERE app_id = $1',
        [appId]
    ).catch(() => ({ rows: [] }));

    if (rows.length === 0) {
        return { plan: 'starter', addons: [], status: 'active', renewsAt: null };
    }
    return {
        plan: rows[0].plan_id,
        addons: rows[0].subapps || [],
        status: rows[0].status,
        renewsAt: rows[0].renews_at,
    };
}

module.exports = {
    tokenInfo, tokenPrice, oraclePrices,
    dexQuote, dexPool,
    networkStats, contractsList,
    subscription,
};
