'use strict';

/**
 * Configuración del firmante. Vive en un fichero montado en SOLO LECTURA
 * (SIGNER_CONFIG_PATH), no en la base de datos de la API.
 *
 * Esa es la frontera de confianza: aprobadores, carteras, topes y destinos
 * permitidos los decide quien despliega el firmante, no quien controla la API.
 * Si la API cae en manos equivocadas puede pedir firmas, pero no puede añadirse
 * como aprobador ni subir un tope.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function error(message) {
    const e = new Error(`Configuración del firmante: ${message}`);
    e.code = 'SIGNER_CONFIG_INVALID';
    return e;
}

/** Activos que el firmante conoce sin configuración (mismos que api/config/tx-rails.js). */
const ACTIVOS_BASE = Object.freeze({
    137: {
        BEZ: { address: '0xecba873b534c54de2b62acde232adca4369f11a8', decimals: 18 },
        USDC: { address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', decimals: 6 },
        USDT: { address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6 },
    },
    56: {
        BEZ: { address: '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55', decimals: 18 },
        USDC: { address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', decimals: 18 },
        USDT: { address: '0x55d398326f99059ff775485246999027b3197955', decimals: 18 },
    },
});

const esDireccion = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || ''));
const esDecimal = (v) => /^\d{1,24}(\.\d{1,18})?$/.test(String(v || ''));

function validar(c, env) {
    if (!Array.isArray(c.allowedChainIds) || !c.allowedChainIds.length || !c.allowedChainIds.every(Number.isInteger)) {
        throw error('allowedChainIds debe ser una lista de enteros.');
    }
    if (!Array.isArray(c.approvers) || !c.approvers.length) throw error('hace falta al menos un aprobador.');
    for (const a of c.approvers) {
        if (!esDireccion(a.address)) throw error(`aprobador con dirección no válida: ${a.address}`);
        if (!Array.isArray(a.roles) || !a.roles.includes('treasury')) throw error(`el aprobador ${a.address} necesita el rol treasury.`);
    }
    const minimo = Number(c.minApprovals ?? 2);
    if (!Number.isInteger(minimo) || minimo < 1) throw error('minApprovals debe ser un entero ≥ 1.');
    if (env.NODE_ENV === 'production' && minimo < 2) {
        // Una sola persona no debe poder vaciar la tesorería (§51, regla de las dos personas).
        throw error('en producción minApprovals no puede ser menor que 2.');
    }
    if (minimo > c.approvers.length) throw error('minApprovals supera el número de aprobadores: nada podría firmarse.');
    if (!Array.isArray(c.wallets) || !c.wallets.length) throw error('hace falta al menos una cartera.');
    for (const w of c.wallets) {
        if (!w.id || !esDireccion(w.address)) throw error(`cartera sin id o con dirección no válida: ${w.id}`);
        if (!Array.isArray(w.chainIds) || !w.chainIds.length) throw error(`la cartera ${w.id} no declara cadenas.`);
        if (!w.key?.provider) throw error(`la cartera ${w.id} no declara proveedor de clave.`);
        if (!w.limits || typeof w.limits !== 'object' || !Object.keys(w.limits).length) {
            // Sin tope declarado no se firma nada de ese activo: el tope es obligatorio, no opcional.
            throw error(`la cartera ${w.id} no declara topes por activo.`);
        }
        for (const [activo, l] of Object.entries(w.limits)) {
            if (!esDecimal(l.perTx) || !esDecimal(l.daily)) throw error(`topes de ${activo} en ${w.id} no válidos.`);
        }
        if (w.allowedDestinations && !w.allowedDestinations.every(esDireccion)) {
            throw error(`allowedDestinations de ${w.id} contiene direcciones no válidas.`);
        }
    }
    return c;
}

function cargarConfig(env = process.env) {
    const ruta = env.SIGNER_CONFIG_PATH;
    if (!ruta) throw error('falta SIGNER_CONFIG_PATH.');
    const c = validar(JSON.parse(fs.readFileSync(path.resolve(ruta), 'utf8')), env);
    return construir(c, env);
}

function construir(c, env = process.env) {
    const claveHmac = env.TX_SIGNER_REQUEST_KEY || '';
    if (claveHmac.length < 32) throw error('TX_SIGNER_REQUEST_KEY debe tener al menos 32 caracteres.');
    const dataDir = env.TX_SIGNER_DATA_DIR || '/data';

    const aprobadores = new Map(c.approvers.map((a) => [a.address.toLowerCase(), a.roles]));
    const activos = JSON.parse(JSON.stringify(ACTIVOS_BASE));
    for (const [chainId, mapa] of Object.entries(c.assets || {})) {
        activos[chainId] = activos[chainId] || {};
        for (const [simbolo, def] of Object.entries(mapa)) {
            if (!esDireccion(def.address) || !Number.isInteger(def.decimals)) throw error(`activo ${simbolo}@${chainId} no válido.`);
            activos[chainId][simbolo] = { address: def.address.toLowerCase(), decimals: def.decimals };
        }
    }

    return {
        allowedChainIds: new Set(c.allowedChainIds),
        minApprovals: Number(c.minApprovals ?? 2),
        // Desde este importe (en unidades del activo), dos aprobadores como mínimo.
        dualApprovalAbove: c.dualApprovalAbove || {},
        maxGasLimit: BigInt(c.maxGasLimit ?? 200000),
        maxFeePerGas: ethers.parseUnits(String(c.maxFeePerGasGwei ?? 500), 'gwei'),
        maxIntentTtlSeconds: Number(c.maxIntentTtlSeconds ?? 86400),
        aprobadores,
        wallets: c.wallets.map((w) => ({ ...w, address: w.address.toLowerCase() })),
        activo(simbolo, chainId) { return activos[chainId]?.[simbolo] || null; },
        carteraPara(chainId) { return this.wallets.find((w) => w.chainIds.includes(chainId)) || null; },
        claveHmac,
        dataDir,
        lockdownActivo() {
            return env.TX_SIGNER_LOCKDOWN === 'true' || fs.existsSync(path.join(dataDir, 'LOCKDOWN'));
        },
    };
}

module.exports = { cargarConfig, construir, validar, ACTIVOS_BASE };
