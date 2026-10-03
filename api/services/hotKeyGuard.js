'use strict';

/**
 * hotKeyGuard — qué claves privadas viven en el proceso de la API, y cuáles no
 * deberían.
 *
 * La API todavía firma operaciones de sistema con claves en variables de
 * entorno: anclas de auditoría, lotes de CargoLink, el batcher de L1, el puente
 * VPP y los contratos que administra el despliegue. Son claves de OPERADOR: su
 * trabajo es pagar gas, no custodiar valor. El riesgo aparece cuando una de
 * ellas es, además, la de una cartera con fondos.
 *
 * Al arrancar, en producción:
 *
 *   1. Las claves de la vía de minteo antigua (BEZ_TREASURY_PK, ADMIN_PK) y la
 *      de dispersión de OPERANT se RETIRAN del entorno del proceso si la vía
 *      antigua no está encendida a propósito. Lo que no está no se filtra.
 *   2. Si una clave de operador controla una dirección protegida (Treasury DAO,
 *      Hot Wallet de ventas, cartera de tesorería del firmante), se retira: la
 *      tesorería no se firma desde la API, sólo desde el tx-signer.
 *   3. Se deja un inventario con DIRECCIONES (nunca claves) en el log, para
 *      vigilar su saldo: una clave de operador con saldo de BEZ o USDC es un
 *      hallazgo.
 */

const { ethers } = require('ethers');
const logger = require('../utils/logger');

const CLAVES_OPERADOR = [
    'DEPLOYER_PRIVATE_KEY', 'OPERATOR_PRIVATE_KEY', 'OPERANT_OPERATOR_KEY', 'CARGOLINK_OPERATOR_KEY',
    'L1_BATCHER_KEY', 'L1_WATCHER_KEY', 'VPP_OPERATOR_PK', 'SECURITY_ANCHOR_OPERATOR_KEY',
];
const CLAVES_MINTEO_ANTIGUO = ['BEZ_TREASURY_PK', 'ADMIN_PK', 'DISBURSEMENT_WALLET_PRIVATE_KEY'];

/** Direcciones que nunca se firman desde este proceso (tabla de CLAUDE.md). */
const PROTEGIDAS_BASE = [
    '0x89c23890c742d710265dd61be789c71dc8999b12', // Treasury DAO
    '0x52df82920cbae522880dd7657e43d1a754ed044e', // Hot Wallet de ventas
];

function protegidas(env) {
    const extra = Object.entries(env)
        .filter(([k, v]) => /^TX_TREASURY_ADDRESS(_\d+)?$/.test(k) && /^0x[0-9a-fA-F]{40}$/.test(String(v || '')))
        .map(([, v]) => v.toLowerCase());
    return new Set([...PROTEGIDAS_BASE, ...extra]);
}

function direccionDe(clave) {
    try { return new ethers.Wallet(String(clave).trim()).address.toLowerCase(); } catch { return null; }
}

/**
 * Revisa y, en producción, retira del entorno las claves que no deben estar.
 * @returns {{ inventario: Array, retiradas: Array }}
 */
function revisar(env = process.env) {
    const produccion = env.NODE_ENV === 'production';
    const prohibidas = protegidas(env);
    const inventario = [];
    const retiradas = [];

    const retirar = (variable, motivo) => {
        if (produccion) delete env[variable];
        retiradas.push({ variable, motivo, aplicado: produccion });
    };

    if (env.LEGACY_HOT_MINT_ENABLED !== 'true') {
        for (const v of CLAVES_MINTEO_ANTIGUO) {
            if (env[v]) retirar(v, 'vía de minteo antigua apagada: la clave no hace falta en este proceso');
        }
    }

    for (const v of CLAVES_OPERADOR) {
        if (!env[v]) continue;
        const address = direccionDe(env[v]);
        if (!address) {
            retirar(v, 'no es una clave privada válida');
            continue;
        }
        if (prohibidas.has(address)) {
            retirar(v, `controla una dirección protegida (${address}): la tesorería sólo la firma el tx-signer`);
            continue;
        }
        inventario.push({ variable: v, address });
    }

    for (const r of retiradas) {
        logger[r.aplicado ? 'error' : 'warn']({ variable: r.variable, motivo: r.motivo },
            r.aplicado ? 'CLAVE RETIRADA DEL ENTORNO' : 'Clave que en producción se retiraría');
    }
    if (inventario.length) {
        logger.info({ claves: inventario }, 'Claves de operador en la API (sólo gas; vigilar que no acumulen saldo)');
    }
    return { inventario, retiradas };
}

module.exports = { revisar, CLAVES_OPERADOR, CLAVES_MINTEO_ANTIGUO, PROTEGIDAS_BASE };
