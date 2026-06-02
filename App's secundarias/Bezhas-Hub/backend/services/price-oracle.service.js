/**
 * @fileoverview Price Oracle Service - Oráculo de Precios QuickSwap DEX
 * @description Obtiene el precio en tiempo real de BEZ/USDC desde QuickSwap LP Pool
 * @critical Este servicio es crítico para evitar insolvencia por volatilidad
 * @version 2.0.0
 * @updated 2026-01-31
 */

const { ethers } = require('ethers');
const axios = require('axios');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const tokenomics = require('../config/tokenomics.config');

// ============================================================
// QUICKSWAP V2 POOL CONFIGURATION
// ============================================================

// QuickSwap V2 Pool BEZ/USDC Address (Polygon Mainnet)
const QUICKSWAP_POOL_ADDRESS = tokenomics.priceOracle.quickswapPool.address;

// UniswapV2Pair ABI (compatible con QuickSwap V2)
const PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'function totalSupply() external view returns (uint256)'
];

// ERC20 ABI for token info
const ERC20_ABI = [
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)'
];

// Token addresses
const BEZ_TOKEN_ADDRESS = tokenomics.token.address;
const USDC_ADDRESS = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'; // USDC en Polygon

// Provider
const PROVIDER_URL = tokenomics.blockchain.polygonMainnet;
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// Cache de precios con TTL configurable
let priceCache = {
    bezUsd: null,
    bezEur: null,
    timestamp: null,
    ttl: tokenomics.priceOracle.cacheTTL,
    source: null,
    reserves: null
};

// EUR/USD rate cache
let eurUsdCache = {
    rate: tokenomics.fiat.eurUsdRate,
    timestamp: null,
    ttl: 300000 // 5 minutos
};

// Fallback prices from config
const FALLBACK_PRICE_USD = tokenomics.priceOracle.fallbackPriceUSD;
const FALLBACK_PRICE_EUR = tokenomics.priceOracle.fallbackPriceEUR;

// Spread de protección anti-arbitraje (2%)
const SPREAD_PERCENT = tokenomics.priceOracle.spreadPercent || 2;

// ============================================================
// ANTI-ARBITRAGE PROTECTION
// ============================================================
// El precio de venta en BeZhas incluye un spread del 2% sobre el precio del pool
// Esto evita que usuarios compren BEZ barato en BeZhas y vendan en DEX con ganancia

/**
 * Aplica el spread de protección al precio
 * @param {number} spotPrice - Precio spot del pool
 * @returns {number} Precio con spread aplicado (más alto para compras)
 */
function applySpreadProtection(spotPrice) {
    if (!spotPrice || spotPrice <= 0) return spotPrice;
    const spreadMultiplier = 1 + (SPREAD_PERCENT / 100);
    return spotPrice * spreadMultiplier;
}

/**
 * Obtiene el tipo de cambio EUR/USD actual
 * @returns {Promise<number>} EUR/USD rate
 */
async function getEurUsdRate() {
    const now = Date.now();

    // Check cache
    if (eurUsdCache.rate && eurUsdCache.timestamp && (now - eurUsdCache.timestamp < eurUsdCache.ttl)) {
        return eurUsdCache.rate;
    }

    try {
        // Intentar obtener rate de exchangerate-api (gratis)
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR', {
            timeout: 5000
        });

        const rate = response.data?.rates?.USD;
        if (rate && rate > 0) {
            eurUsdCache = {
                rate,
                timestamp: now,
                ttl: 300000
            };
            logger.debug({ rate }, 'EUR/USD rate fetched');
            return rate;
        }
    } catch (error) {
        logger.warn({ error: error.message }, 'Failed to fetch EUR/USD rate, using fallback');
    }

    return tokenomics.fiat.eurUsdRate;
}

/**
 * Obtiene el precio de BEZ/USD desde QuickSwap LP Pool
 * @returns {Promise<number>} Precio en USD por BEZ-Coin
 */
async function getBezUsdPriceFromQuickSwap() {
    try {
        const pairContract = new ethers.Contract(QUICKSWAP_POOL_ADDRESS, PAIR_ABI, provider);

        // Obtener información del pool
        const [reserves, token0Address, token1Address] = await Promise.all([
            pairContract.getReserves(),
            pairContract.token0(),
            pairContract.token1()
        ]);

        const reserve0 = reserves[0];
        const reserve1 = reserves[1];

        logger.debug({
            reserve0: reserve0.toString(),
            reserve1: reserve1.toString(),
            token0: token0Address,
            token1: token1Address
        }, 'QuickSwap reserves fetched');

        // Determinar qué token es BEZ y cuál es USDC
        const bezIsToken0 = token0Address.toLowerCase() === BEZ_TOKEN_ADDRESS.toLowerCase();

        // USDC tiene 6 decimales, BEZ tiene 18 decimales
        const BEZ_DECIMALS = 18;
        const USDC_DECIMALS = 6;

        let price;
        if (bezIsToken0) {
            // BEZ es token0, USDC es token1
            // Precio = (reserve1 / 10^6) / (reserve0 / 10^18)
            const usdcAmount = Number(reserve1) / (10 ** USDC_DECIMALS);
            const bezAmount = Number(reserve0) / (10 ** BEZ_DECIMALS);
            price = usdcAmount / bezAmount;
        } else {
            // USDC es token0, BEZ es token1
            // Precio = (reserve0 / 10^6) / (reserve1 / 10^18)
            const usdcAmount = Number(reserve0) / (10 ** USDC_DECIMALS);
            const bezAmount = Number(reserve1) / (10 ** BEZ_DECIMALS);
            price = usdcAmount / bezAmount;
        }

        // Guardar información de reservas para debugging
        priceCache.reserves = {
            reserve0: reserve0.toString(),
            reserve1: reserve1.toString(),
            bezIsToken0,
            timestamp: new Date().toISOString()
        };

        logger.info({
            price,
            source: 'quickswap',
            pool: QUICKSWAP_POOL_ADDRESS
        }, 'BEZ/USD price fetched from QuickSwap');

        return price;

    } catch (error) {
        logger.error({
            error: error.message,
            pool: QUICKSWAP_POOL_ADDRESS
        }, 'Failed to fetch price from QuickSwap');
        throw error;
    }
}

/**
 * Obtiene el precio actual de BEZ/USD con cache y fallback
 * @param {boolean} withSpread - Si true, aplica el spread de protección (default: false)
 * @returns {Promise<number>} Precio en USD por BEZ-Coin
 */
async function getBezUsdPrice(withSpread = false) {
    const now = Date.now();

    // 1. Verificar cache
    if (priceCache.bezUsd && priceCache.timestamp && (now - priceCache.timestamp < priceCache.ttl)) {
        const cachedPrice = priceCache.bezUsd;
        logger.debug({ price: cachedPrice, cached: true, withSpread }, 'Using cached BEZ/USD price');
        return withSpread ? applySpreadProtection(cachedPrice) : cachedPrice;
    }

    // 2. Intentar obtener precio de QuickSwap
    try {
        const price = await getBezUsdPriceFromQuickSwap();

        if (price && price > 0) {
            // Actualizar cache (precio spot sin spread)
            priceCache.bezUsd = price;
            priceCache.timestamp = now;
            priceCache.source = 'quickswap';

            // Calcular precio en EUR
            const eurUsdRate = await getEurUsdRate();
            priceCache.bezEur = price / eurUsdRate;

            // Retornar con o sin spread según parámetro
            return withSpread ? applySpreadProtection(price) : price;
        }
    } catch (error) {
        logger.warn({ error: error.message }, 'QuickSwap price fetch failed');
    }

    // 3. Fallback a precio configurado
    logger.warn({ fallbackPrice: FALLBACK_PRICE_USD }, 'Using fallback BEZ/USD price');

    priceCache = {
        bezUsd: FALLBACK_PRICE_USD,
        bezEur: FALLBACK_PRICE_EUR,
        timestamp: now,
        ttl: priceCache.ttl,
        source: 'fallback'
    };

    return withSpread ? applySpreadProtection(FALLBACK_PRICE_USD) : FALLBACK_PRICE_USD;
}

/**
 * Obtiene el precio actual de BEZ/EUR desde múltiples fuentes
 * @param {boolean} withSpread - Si true, aplica el spread de protección (default: false)
 * @returns {Promise<number>} Precio en EUR por BEZ-Coin
 */
async function getBezEurPrice(withSpread = false) {
    // 1. Verificar cache
    const now = Date.now();
    if (priceCache.bezEur && priceCache.timestamp && (now - priceCache.timestamp < priceCache.ttl)) {
        const cachedPrice = priceCache.bezEur;
        logger.debug({ price: cachedPrice, cached: true, withSpread }, 'Using cached BEZ/EUR price');
        return withSpread ? applySpreadProtection(cachedPrice) : cachedPrice;
    }

    // 2. Obtener precio USD y convertir
    const bezUsd = await getBezUsdPrice();
    const eurUsdRate = await getEurUsdRate();
    const bezEur = bezUsd / eurUsdRate;

    // Actualizar cache
    priceCache.bezEur = bezEur;

    logger.info({ bezUsd, eurUsdRate, bezEur, source: priceCache.source }, 'BEZ/EUR price calculated');

    return withSpread ? applySpreadProtection(bezEur) : bezEur;
}

/**
 * Obtiene el precio de VENTA para BeZhas (con spread de protección)
 * Este es el precio que usará Stripe/SEPA para calcular cuántos BEZ recibe el usuario
 * @returns {Promise<object>} Precios spot y con spread
 */
async function getSalePrices() {
    const [spotUsd, spotEur] = await Promise.all([
        getBezUsdPrice(false),
        getBezEurPrice(false)
    ]);

    const saleUsd = applySpreadProtection(spotUsd);
    const saleEur = applySpreadProtection(spotEur);

    logger.info({
        spotUsd,
        spotEur,
        saleUsd,
        saleEur,
        spreadPercent: SPREAD_PERCENT
    }, 'Sale prices calculated with spread protection');

    return {
        spot: { usd: spotUsd, eur: spotEur },
        sale: { usd: saleUsd, eur: saleEur },
        spreadPercent: SPREAD_PERCENT,
        source: priceCache.source
    };
}

/**
 * Convierte una cantidad FIAT (EUR) a BEZ-Coin
 * @param {number} amountEur - Cantidad en EUR
 * @param {boolean} useSalePrice - Si true, usa precio con spread (default: true para compras)
 * @returns {Promise<number>} Cantidad en BEZ-Coin (con 18 decimales)
 */
async function convertEurToBez(amountEur, useSalePrice = true) {
    if (!amountEur || amountEur <= 0) {
        throw new Error('Invalid EUR amount');
    }

    // Para compras FIAT, usamos el precio con spread (más alto = menos BEZ por EUR)
    const pricePerBez = await getBezEurPrice(useSalePrice);
    const bezAmount = amountEur / pricePerBez;

    logger.debug({ amountEur, pricePerBez, bezAmount }, 'Converted EUR to BEZ');

    // Retornar con precisión de 18 decimales (estándar ERC20)
    return bezAmount;
}

/**
 * Convierte una cantidad BEZ-Coin a FIAT (EUR)
 * @param {number} amountBez - Cantidad en BEZ-Coin
 * @returns {Promise<number>} Cantidad en EUR
 */
async function convertBezToEur(amountBez) {
    if (!amountBez || amountBez <= 0) {
        throw new Error('Invalid BEZ amount');
    }

    const pricePerBez = await getBezEurPrice();
    const eurAmount = amountBez * pricePerBez;

    logger.debug({ amountBez, pricePerBez, eurAmount }, 'Converted BEZ to EUR');

    return eurAmount;
}

/**
 * Limpia el cache de precios (útil para testing)
 */
function clearCache() {
    priceCache = {
        bezUsd: null,
        bezEur: null,
        timestamp: null,
        ttl: tokenomics.priceOracle.cacheTTL,
        source: null,
        reserves: null
    };
    eurUsdCache = {
        rate: tokenomics.fiat.eurUsdRate,
        timestamp: null,
        ttl: 300000
    };
    logger.info('Price cache cleared');
}

/**
 * Obtiene información del cache actual
 * @returns {object} Estado del cache
 */
function getCacheInfo() {
    return {
        priceUsd: priceCache.bezUsd,
        priceEur: priceCache.bezEur,
        timestamp: priceCache.timestamp,
        age: priceCache.timestamp ? Date.now() - priceCache.timestamp : null,
        ttl: priceCache.ttl,
        source: priceCache.source,
        isValid: priceCache.timestamp && (Date.now() - priceCache.timestamp < priceCache.ttl),
        reserves: priceCache.reserves,
        eurUsdRate: eurUsdCache.rate,
        poolAddress: QUICKSWAP_POOL_ADDRESS
    };
}

/**
 * Obtiene información completa del oráculo de precios
 * @returns {Promise<object>} Información completa
 */
async function getOracleInfo() {
    const [spotUsd, spotEur, eurUsdRate, salePrices] = await Promise.all([
        getBezUsdPrice(false),
        getBezEurPrice(false),
        getEurUsdRate(),
        getSalePrices()
    ]);

    return {
        prices: {
            spot: { usd: spotUsd, eur: spotEur },
            sale: salePrices.sale,
            eurUsdRate
        },
        spreadPercent: SPREAD_PERCENT,
        cache: getCacheInfo(),
        config: {
            pool: QUICKSWAP_POOL_ADDRESS,
            bezToken: BEZ_TOKEN_ADDRESS,
            fallbackPriceUsd: FALLBACK_PRICE_USD,
            fallbackPriceEur: FALLBACK_PRICE_EUR,
            cacheTtl: priceCache.ttl,
            spreadPercent: SPREAD_PERCENT
        },
        tokenomics: {
            burn: tokenomics.burn,
            treasury: tokenomics.treasury,
            marketplace: tokenomics.marketplace
        }
    };
}

module.exports = {
    getBezEurPrice,
    getBezUsdPrice,
    getEurUsdRate,
    getSalePrices,
    applySpreadProtection,
    convertEurToBez,
    convertBezToEur,
    clearCache,
    getCacheInfo,
    getOracleInfo,
    // Export constants
    QUICKSWAP_POOL_ADDRESS,
    FALLBACK_PRICE_USD,
    FALLBACK_PRICE_EUR,
    SPREAD_PERCENT
};
