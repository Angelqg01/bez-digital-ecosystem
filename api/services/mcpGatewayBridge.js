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
const { bezPublicado } = require('../config/bez-price');
const contractService = require('./contractService');
const logger = require('../utils/logger');

/**
 * Cadena por defecto del MCP: Polygon, la única donde existe BEZ-Coin. Sin esto
 * se caía a 31337 (nodo local) y todas las lecturas on-chain fallaban en
 * producción con «Contract … not deployed on chain default».
 */
const CADENA_POR_DEFECTO = 137;
const CADENAS_PRODUCCION = [137]; // BEZ no está desplegado en BNB Chain
const cadena = (chainId) => chainId ?? CADENA_POR_DEFECTO;
const nombreBEZ = (chainId) => (CADENAS_PRODUCCION.includes(chainId) ? 'BEZCoin' : 'BEZCoinV2');

/** Stablecoins oficiales por cadena (los mismos que ofrece el selector de la web). */
const TOKENS_POR_CADENA = {
    137: {
        USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
        USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
        MATIC: { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18 }, // WMATIC
    },
    56: {
        USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
        USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
        BNB: { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 }, // WBNB
    },
};

/** Precio semilla cuando aún no hay fila de caché. Mismo valor que el Gateway. */

// ── Token ────────────────────────────────────────────────────────────────────

/**
 * Equivale a GET /api/gateway/v1/token/info.
 *
 * Si el nodo no responde no se inventa supply: se devuelve lo que no depende
 * de él (dirección, símbolo, decimales) y `source: 'unavailable'`.
 */
async function tokenInfo({ chainId } = {}) {
    const cid = cadena(chainId);
    const nombre = nombreBEZ(cid);
    try {
        const token = await contractService.getTokenInfo(nombre, cid);
        return { source: 'onchain', ...token, circulatingSupply: token.totalSupply };
    } catch (err) {
        logger.warn({ chainId: cid, error: err.message }, 'MCP token_info: lectura on-chain fallida');
        const address = await contractService.getContractAddress(nombre, cid).catch(() => null);
        return {
            source: 'unavailable', address, name: 'BEZ-Coin', symbol: 'BEZ', decimals: 18, chainId: cid,
            totalSupply: null, totalSupplyWei: null, circulatingSupply: null,
        };
    }
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

    // Siempre el precio de configuración (el de la liquidación); la caché sólo aporta frescura.
    const bez = bezPublicado(rows[0]);
    return { priceUSD: bez.priceUSD, change24h: bez.change24h, updatedAt: bez.updatedAt, source: bez.seed ? 'seed' : 'cache' };
}

/** Equivale a GET /api/gateway/v1/oracle/token-prices (endpoint público). */
async function oraclePrices() {
    const { rows } = await query(
        'SELECT symbol, price_usd, change_24h, updated_at FROM token_price_cache'
    ).catch(() => ({ rows: [] }));

    const tokens = {};
    for (const fila of rows) {
        if (fila.symbol === 'BEZ') continue;
        tokens[fila.symbol] = {
            symbol: fila.symbol,
            priceUSD: parseFloat(fila.price_usd),
            change24h: parseFloat(fila.change_24h || 0),
            updatedAt: fila.updated_at,
        };
    }
    const bez = bezPublicado(rows.find((f) => f.symbol === 'BEZ'));
    tokens.BEZ = { symbol: 'BEZ', priceUSD: bez.priceUSD, change24h: bez.change24h, updatedAt: bez.updatedAt };
    return { tokens };
}

// ── DEX ──────────────────────────────────────────────────────────────────────

/**
 * Resuelve un símbolo (BEZ, USDT…) a dirección y decimales en la cadena.
 * null si ese token no existe en esa cadena (p. ej. BNB en Polygon).
 */
async function resolverToken(simbolo, cid) {
    if (simbolo === 'BEZ') {
        const address = await contractService.getContractAddress(nombreBEZ(cid), cid).catch(() => null);
        return address ? { address, decimals: 18 } : null;
    }
    return TOKENS_POR_CADENA[cid]?.[simbolo] ?? null;
}

/**
 * Estado «sin mercado» explícito. Igual que token_price, que un DEX aún no esté
 * desplegado en la cadena es un estado real, no un fallo de la herramienta: con
 * un error genérico el agente reintentaba y el cliente creía que BeZhas estaba caído.
 */
function sinMercado(motivo, cid, extra = {}) {
    return {
        disponible: false,
        motivo,
        chainId: cid,
        nota: 'No se ha movido nada. Para comprar BEZ ahora mismo usa la compra directa en Polygon (bezhas_checkout_prepare o /defi → Comprar BEZ-Coin).',
        ...extra,
    };
}

async function dexDesplegado(cid) {
    return Boolean(await contractService.getContractAddress('BeZhasDEX', cid).catch(() => null));
}

/** Equivale a GET /api/gateway/v1/dex/quote. Solo calcula: no firma ni envía. */
async function dexQuote({ from, to, amount, chainId }) {
    const cid = cadena(chainId);
    if (from === to) return sinMercado('mismo_token', cid, { nota: 'El token de origen y el de destino son el mismo.' });
    if (!(await dexDesplegado(cid))) return sinMercado('dex_no_desplegado', cid);

    const [tIn, tOut] = await Promise.all([resolverToken(from, cid), resolverToken(to, cid)]);
    const falta = !tIn ? from : !tOut ? to : null;
    if (falta) return sinMercado('token_no_disponible_en_cadena', cid, { token: falta });

    const dex = await contractService.getContract('BeZhasDEX', cid);
    // getPool no revierte: se mira antes de cotizar para distinguir «ese par no
    // existe» o «no tiene liquidez» de un fallo real del nodo.
    const pool = await dex.getPool(tIn.address, tOut.address);
    if (!pool.exists) return sinMercado('pool_inexistente', cid, { par: `${from}/${to}` });
    if (pool.reserve0 === 0n || pool.reserve1 === 0n) return sinMercado('pool_sin_liquidez', cid, { par: `${from}/${to}` });

    const { ethers } = require('ethers');
    const out = await dex.quoteSwap(tIn.address, tOut.address, ethers.parseUnits(String(amount), tIn.decimals));
    return {
        disponible: true,
        chainId: cid,
        from, to,
        amountIn: String(amount),
        amountOut: ethers.formatUnits(out, tOut.decimals),
        amountOutWei: out.toString(),
    };
}

/** Equivale a GET /api/gateway/v1/dex/pool */
async function dexPool({ tokenA = 'BEZ', tokenB = 'USDT', chainId } = {}) {
    const cid = cadena(chainId);
    if (!(await dexDesplegado(cid))) return sinMercado('dex_no_desplegado', cid);
    const [a, b] = await Promise.all([resolverToken(tokenA, cid), resolverToken(tokenB, cid)]);
    if (!a || !b) return sinMercado('token_no_disponible_en_cadena', cid);
    const pool = await contractService.getDEXPool(a.address, b.address, cid);
    if (!pool.exists) return sinMercado('pool_inexistente', cid, { par: `${tokenA}/${tokenB}` });
    return { disponible: true, chainId: cid, ...pool };
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
