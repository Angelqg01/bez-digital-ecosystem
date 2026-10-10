'use strict';

/**
 * config/chain-policy.js — en qué cadenas puede operar BeZhas y cuál se usa
 * cuando la petición no lo dice.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL PROBLEMA QUE CIERRA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Todas las rutas del Gateway que construyen transacciones hacían
 *
 *     parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337')
 *
 * Dos fallos en una línea:
 *
 *   1. El cliente elegía la red. Cualquier entero valía, y con él cambiaban la
 *      dirección del contrato y el significado de la transacción que se le
 *      devolvía. Un agente que «prueba en testnet» y otro que opera en mainnet
 *      eran indistinguibles para el servidor.
 *   2. Sin configuración, producción caía a 31337 (Anvil local): construía
 *      transacciones para una cadena que no existe fuera del portátil.
 *
 * Aquí la red se valida contra una lista cerrada por entorno. En producción
 * sólo existen las redes principales; las de pruebas y la local hay que
 * habilitarlas A MANO con ALLOWED_CHAIN_IDS, de modo que nunca se cuelan por
 * omisión. Es la regla del documento de seguridad del MCP (§44): nunca permitir
 * que un agente cambie de MAINNET a TESTNET de forma implícita.
 */

const MAINNET = Object.freeze({ 56: 'bsc', 137: 'polygon', 2708: 'bezhas-l2' });
const TESTNET = Object.freeze({ 97: 'bsc-testnet', 80002: 'polygon-amoy', 80001: 'polygon-mumbai' });
const LOCAL = Object.freeze({ 31337: 'anvil' });

const esProduccion = (env) => env.NODE_ENV === 'production';

function entorno(chainId) {
    if (MAINNET[chainId]) return 'mainnet';
    if (TESTNET[chainId]) return 'testnet';
    if (LOCAL[chainId]) return 'local';
    return null;
}

function nombreRed(chainId) {
    return MAINNET[chainId] || TESTNET[chainId] || LOCAL[chainId] || null;
}

/** `polygon` → 137. Nombre desconocido → null, nunca un valor por defecto. */
function chainIdPorRed(nombre) {
    for (const tabla of [MAINNET, TESTNET, LOCAL]) {
        for (const [id, n] of Object.entries(tabla)) {
            if (n === nombre) return Number(id);
        }
    }
    return null;
}

function parsearLista(raw) {
    return String(raw).split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Cadenas habilitadas. ALLOWED_CHAIN_IDS manda si está: es la forma explícita
 * de habilitar una testnet en producción (o de restringir aún más).
 */
function cadenasPermitidas(env = process.env) {
    if (env.ALLOWED_CHAIN_IDS) return new Set(parsearLista(env.ALLOWED_CHAIN_IDS));
    const principales = Object.keys(MAINNET).map(Number);
    if (esProduccion(env)) return new Set(principales);
    return new Set([
        ...principales,
        ...Object.keys(TESTNET).map(Number),
        ...Object.keys(LOCAL).map(Number),
    ]);
}

/** La L2 de BeZhas en producción; Anvil en desarrollo. Nunca 31337 en producción por omisión. */
function cadenaPorDefecto(env = process.env) {
    if (env.BEZHAS_CHAIN_ID) return Number.parseInt(env.BEZHAS_CHAIN_ID, 10);
    return esProduccion(env) ? 2708 : 31337;
}

/**
 * Resuelve la cadena de una petición.
 * @returns {{ok:true, chainId:number, entorno:string, red:string|null, explicita:boolean}
 *          |{ok:false, code:string, message:string, permitidas?:number[]}}
 */
function resolverCadena(solicitada, env = process.env) {
    const permitidas = cadenasPermitidas(env);
    const explicita = !(solicitada === undefined || solicitada === null || solicitada === '');

    let chainId;
    if (!explicita) {
        chainId = cadenaPorDefecto(env);
    } else {
        // String(array) → "1,2": un `?chainId=1&chainId=2` no pasa el patrón.
        const s = String(solicitada).trim();
        if (!/^\d{1,10}$/.test(s)) {
            return { ok: false, code: 'CHAIN_INVALID', message: 'chainId debe ser un entero positivo.' };
        }
        chainId = Number(s);
    }

    if (!Number.isInteger(chainId) || chainId <= 0) {
        return { ok: false, code: 'CHAIN_INVALID', message: 'La cadena configurada por defecto no es válida.' };
    }
    if (!permitidas.has(chainId)) {
        return {
            ok: false,
            code: 'CHAIN_NOT_ALLOWED',
            message: `La cadena ${chainId} no está habilitada en este entorno.`,
            permitidas: [...permitidas],
        };
    }
    return { ok: true, chainId, entorno: entorno(chainId) || 'custom', red: nombreRed(chainId), explicita };
}

/**
 * Atajo para rutas Express: devuelve el chainId o responde 400 y devuelve null.
 *
 *     const chainId = cadenaOResponder400(res, req.body.chainId);
 *     if (chainId === null) return;
 */
function cadenaOResponder400(res, solicitada) {
    const r = resolverCadena(solicitada);
    if (r.ok) return r.chainId;
    res.status(400).json({ error: r.message, code: r.code, allowedChainIds: r.permitidas });
    return null;
}

module.exports = {
    MAINNET, TESTNET, LOCAL,
    entorno, nombreRed, chainIdPorRed,
    cadenasPermitidas, cadenaPorDefecto, resolverCadena, cadenaOResponder400,
};
