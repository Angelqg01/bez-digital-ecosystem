'use strict';

/**
 * gasTank/prices — precios para convertir gas y comisiones de protocolo a EUR.
 *
 *   POL/EUR: token_price_cache['POL'] (USD, con frescura) ÷ EUR/USD; si no hay precio fresco, la variable
 *            GAS_TANK_POL_EUR. Sin ninguna de las dos NO se mide: preferible rechazar una operación
 *            que regalarla a un precio inventado.
 *   BEZ/EUR: token_price_cache['BEZ'] ÷ EUR/USD (sólo hace falta si la operación cobra comisión en BEZ).
 */

const db = require('../../db/pool');
const { getEurUsdRate } = require('../fxService');

const FRESH_MS = 60 * 60 * 1000;

function error(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
}

async function eurFromCache(symbol, { now = Date.now() } = {}) {
    const { rows } = await db.query('SELECT price_usd, updated_at FROM token_price_cache WHERE symbol = $1 LIMIT 1', [symbol]);
    if (!rows.length) return null;
    if (now - new Date(rows[0].updated_at).getTime() > FRESH_MS) return null;
    const { rate } = await getEurUsdRate({ fallback: Number(process.env.EUR_USD_RATE) || undefined });
    return Number(rows[0].price_usd) / rate;
}

async function getPolEur() {
    const cached = await eurFromCache('POL');
    if (cached > 0) return cached;
    const fijo = Number(process.env.GAS_TANK_POL_EUR);
    if (fijo > 0) return fijo;
    throw error('NO_POL_PRICE', 'Sin precio fresco de POL ni GAS_TANK_POL_EUR: no se puede medir el gas.');
}

async function getBezEur() {
    const cached = await eurFromCache('BEZ');
    if (cached > 0) return cached;
    throw error('NO_BEZ_PRICE', 'Sin precio fresco de BEZ: no se puede cobrar la comisión de protocolo.');
}

module.exports = { getPolEur, getBezEur };
