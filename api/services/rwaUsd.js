'use strict';

/**
 * services/rwaUsd.js — equivalencias en USD de los importes en BEZ del RWA.
 *
 * Usa el precio de config/bez-price.js (el único del código: 0,0075 USD por BEZ,
 * el precio real de la fase semilla confirmado por Yoel el 2026-09-18). No es
 * un precio de mercado: BEZ aún no tiene pool de liquidez. Por eso las
 * equivalencias son informativas («≈») y no sustituyen a lo que se firma, que
 * siempre es BEZ.
 *
 * Todo con BigInt: un importe en wei por micro-USD por BEZ, sin coma flotante.
 */

const { ethers } = require('ethers');
const { precioMicroUsd, precioUsd } = require('../config/bez-price');

/** wei de BEZ → USD con 2 decimales, como texto («1333.33»). Redondea al céntimo más cercano. */
function usdDeBezWei(wei, env = process.env) {
    const microUsd = (BigInt(wei) * precioMicroUsd(env)) / 10n ** 18n; // µUSD
    const centimos = (microUsd + 5_000n) / 10_000n;
    return `${centimos / 100n}.${String(centimos % 100n).padStart(2, '0')}`;
}

/** Importe decimal en BEZ («100.5») → USD con 2 decimales. */
function usdDeBez(decimal, env = process.env) {
    return usdDeBezWei(ethers.parseEther(String(decimal)), env);
}

/** Precio de 1 BEZ en USD (número) para mostrarlo junto a las equivalencias. */
const precioBezUsd = (env = process.env) => precioUsd(env);

module.exports = { usdDeBezWei, usdDeBez, precioBezUsd };
