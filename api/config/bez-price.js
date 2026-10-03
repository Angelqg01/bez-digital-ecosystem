'use strict';

/**
 * config/bez-price.js — el precio de BEZ-Coin, en un solo sitio.
 *
 * Precio real de la fase semilla: 0,0075 USD por BEZ (confirmado por Yoel,
 * 2026-09-18). Había al menos cuatro valores repartidos por el código:
 *
 *   · 0,10 USD en el Gateway, la liquidación y el vigilante on-chain;
 *   · 7 céntimos (0,07 USD) en el minteo del webhook de Stripe, porque
 *     BEZ_PRICE_USD_CENTS era un entero y 0,75 céntimos no cabe en uno;
 *   · 1,24 USD en BezPay (Hub), sacado de un token AJENO de CoinGecko.
 *
 * Con cada uno, el mismo pago entregaba una cantidad distinta de BEZ.
 *
 * El precio se lleva en MICRO-USD (millonésimas de dólar, enteros) para no
 * perder precisión: 0,0075 USD = 7.500 micro-USD. El importe en BEZ se calcula
 * con BigInt, nunca con coma flotante.
 */

const DECIMALES_BEZ = 18;
const PRECIO_POR_DEFECTO = '0.0075';

/** "0.0075" → 7500n. Hasta 6 decimales; lo que no cabe es un error de configuración. */
function aMicroUsd(decimal) {
    const s = String(decimal).trim();
    const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(s);
    if (!m) throw new Error(`Precio de BEZ no válido: "${decimal}" (decimal con punto, hasta 6 decimales).`);
    const micro = BigInt(m[1]) * 1_000_000n + BigInt((m[2] || '').padEnd(6, '0'));
    if (micro <= 0n) throw new Error('El precio de BEZ tiene que ser mayor que cero.');
    return micro;
}

/**
 * Precio vigente en micro-USD. BEZ_PRICE_USD manda; BEZ_PRICE_USD_CENTS se
 * respeta sólo si alguien lo fijó a propósito (compatibilidad), nunca por
 * defecto: su antiguo valor por defecto, 7, era erróneo.
 */
function precioMicroUsd(env = process.env) {
    if (env.BEZ_PRICE_USD) return aMicroUsd(env.BEZ_PRICE_USD);
    if (env.BEZ_PRICE_USD_CENTS) return BigInt(parseInt(env.BEZ_PRICE_USD_CENTS, 10)) * 10_000n;
    return aMicroUsd(PRECIO_POR_DEFECTO);
}

/** Precio en USD como número, para mostrar o para cálculos que ya eran decimales. */
function precioUsd(env = process.env) {
    return Number(precioMicroUsd(env)) / 1_000_000;
}

/** Céntimos de USD → unidades mínimas de BEZ (wei). División entera: nunca redondea a favor del comprador. */
function centimosUsdABezWei(centimos, env = process.env, decimales = DECIMALES_BEZ) {
    const microUsd = BigInt(centimos) * 10_000n;
    return (microUsd * 10n ** BigInt(decimales)) / precioMicroUsd(env);
}

module.exports = { precioMicroUsd, precioUsd, centimosUsdABezWei, aMicroUsd, DECIMALES_BEZ, PRECIO_POR_DEFECTO };
