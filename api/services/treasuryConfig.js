'use strict';

/**
 * treasuryConfig — la configuración de «Treasury & Web3» del panel, en un solo sitio.
 *
 * La leen y escriben /api/admin-config/treasury (formato antiguo) y
 * /api/admin-hot-wallet (la sección fusionada). Antes vivía sólo en admin-config.js,
 * que leía `require('../cache/redis').client`: ese export no existe, así que nada
 * se guardaba nunca y el panel enseñaba siempre los valores por defecto (entre
 * ellos una cuenta de Anvil como «Hot Wallet»).
 *
 * Qué es configurable aquí y qué no:
 *   · safeWallet        el multisig de tesorería que el panel vigila on-chain.
 *   · dailyLimit,
 *     approvalThreshold preferencias del panel. NO son los límites que se aplican:
 *                       los reales están en la política (txPolicyEngine) y en el
 *                       signer.json del tx-signer, que la API no puede tocar.
 *   · hotWallet         NO se configura: es la del despliegue (TX_TREASURY_ADDRESS_137),
 *                       la que firma el tx-signer. Una casilla editable aquí sólo
 *                       serviría para que el panel y la realidad no coincidan.
 *   · loginWallet       NO se configura: el login por wallet usa ADMIN_WALLET.
 */

const { ethers } = require('ethers');
const { cacheGet, cacheSet } = require('../cache/redis');

const CLAVE = 'admin:config:treasury';
const SAFE_REGISTRADA = '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3';
const HOT_WALLET_REGISTRADA = '0x52Df82920CBAE522880dD7657e43d1A754eD044E';
const MAX_LIMITE = 1_000_000_000;

const DEFAULTS = Object.freeze({ safeWallet: SAFE_REGISTRADA, dailyLimit: 100, approvalThreshold: 500 });

class ConfigInvalida extends Error {
    constructor(errores) {
        super(errores.join(' '));
        this.code = 'TREASURY_CONFIG_INVALID';
        this.status = 400;
        this.errores = errores;
    }
}

function limpiar(guardado = {}) {
    const c = { ...DEFAULTS };
    if (typeof guardado.safeWallet === 'string' && ethers.isAddress(guardado.safeWallet)) {
        c.safeWallet = ethers.getAddress(guardado.safeWallet);
    }
    for (const k of ['dailyLimit', 'approvalThreshold']) {
        const n = Number(guardado[k]);
        if (Number.isFinite(n) && n >= 0 && n <= MAX_LIMITE) c[k] = n;
    }
    return c;
}

async function leer() {
    return limpiar((await cacheGet(CLAVE)) || {});
}

/** Valida y guarda los campos presentes. Ignora hotWallet y loginWallet (ver cabecera). */
async function guardar(cambios = {}) {
    const errores = [];
    const actual = await leer();
    const nuevo = { ...actual };
    if (cambios.safeWallet !== undefined) {
        if (!ethers.isAddress(String(cambios.safeWallet || ''))) errores.push('safeWallet debe ser una dirección 0x.');
        else nuevo.safeWallet = ethers.getAddress(cambios.safeWallet);
    }
    for (const k of ['dailyLimit', 'approvalThreshold']) {
        if (cambios[k] === undefined) continue;
        const n = Number(cambios[k]);
        if (!Number.isFinite(n) || n < 0 || n > MAX_LIMITE) errores.push(`${k} debe ser un número entre 0 y ${MAX_LIMITE}.`);
        else nuevo[k] = n;
    }
    if (errores.length) throw new ConfigInvalida(errores);
    const ok = await cacheSet(CLAVE, nuevo);
    return { config: nuevo, persistida: ok };
}

/** Lo que el panel enseña junto a la config: direcciones que vienen del despliegue. */
function delDespliegue(env = process.env) {
    const hot = env.TX_TREASURY_ADDRESS_137 || env.TX_TREASURY_ADDRESS || null;
    return {
        hotWallet: hot || HOT_WALLET_REGISTRADA,
        hotWalletConfigured: Boolean(hot),
        loginWallet: env.ADMIN_WALLET || null,
    };
}

module.exports = { leer, guardar, delDespliegue, ConfigInvalida, DEFAULTS, SAFE_REGISTRADA, HOT_WALLET_REGISTRADA, CLAVE };
