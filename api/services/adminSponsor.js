'use strict';

/**
 * services/adminSponsor.js — gas subvencionado para las pruebas del propietario.
 *
 * La plataforma paga el gas con la clave de OPERADOR de la API (la misma que ya
 * ancla auditorías y lotes; su trabajo es pagar gas, no custodiar valor — ver
 * hotKeyGuard). El administrador no necesita saldo nativo.
 *
 * Alcance deliberadamente estrecho, porque esto firma con una clave en el
 * proceso:
 *
 *   · Sólo contratos del despliegue (por NOMBRE). Nunca una dirección libre.
 *   · Sólo la cadena configurada del proceso. La red no la elige el cliente.
 *   · Mainnet cerrada por defecto: exige ADMIN_SPONSOR_ALLOW_MAINNET=true.
 *   · Sin `value`: no mueve moneda nativa, sólo ejecuta llamadas.
 *   · Métodos de cambio de propiedad / actualización / destrucción vetados.
 *   · Simulación obligatoria antes de firmar; sin `confirm: true` no se emite.
 *   · Tope de gas por tx y presupuesto diario (ADMIN_SPONSOR_MAX_GAS_PER_TX,
 *     ADMIN_SPONSOR_DAILY_GAS).
 *   · Cada ejecución queda en el registro de auditoría encadenado.
 */

const { ethers } = require('ethers');
const { resolverCadena, cadenaPorDefecto, entorno } = require('../config/chain-policy');
const { contratosDeLaCadena, ES_DIRECCION } = require('../config/admin-sectors');
const logger = require('../utils/logger');

const METODOS_VETADOS = new Set([
    'transferOwnership', 'renounceOwnership', 'acceptOwnership',
    'upgradeTo', 'upgradeToAndCall', 'selfdestruct', 'grantRole', 'revokeRole', 'renounceRole',
]);

class SponsorError extends Error {
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

function entero(valor, porDefecto) {
    const n = Number.parseInt(valor, 10);
    return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

function limites(env = process.env) {
    return {
        maxGasPorTx: entero(env.ADMIN_SPONSOR_MAX_GAS_PER_TX, 3_000_000),
        gasDiario: entero(env.ADMIN_SPONSOR_DAILY_GAS, 30_000_000),
        mainnet: env.ADMIN_SPONSOR_ALLOW_MAINNET === 'true',
    };
}

// ── Presupuesto diario ─────────────────────────────────────────────────────
// Redis si está; si no, memoria del proceso (un reinicio lo pone a cero: es un
// freno de pruebas, no contabilidad).
const memoria = new Map();
const claveDia = () => `admin:sponsor:gas:${new Date().toISOString().slice(0, 10)}`;

async function redis() {
    try { return require('../cache/redis').redisClient; } catch { return null; }
}

async function gastadoHoy() {
    const r = await redis();
    if (r) {
        try { return Number(await r.get(claveDia())) || 0; } catch { /* cae a memoria */ }
    }
    return memoria.get(claveDia()) || 0;
}

async function sumarGasto(gas) {
    const r = await redis();
    if (r) {
        try {
            const total = await r.incrBy(claveDia(), gas);
            await r.expire(claveDia(), 172800);
            return Number(total);
        } catch { /* cae a memoria */ }
    }
    const total = (memoria.get(claveDia()) || 0) + gas;
    memoria.set(claveDia(), total);
    return total;
}

// ── Validación (pura, sin red) ─────────────────────────────────────────────

/**
 * Comprueba cadena, contrato, método y argumentos. No toca la red.
 * @returns {{chainId, entorno, nombre, direccion, abi, fragmento}}
 */
function validarPeticion({ contrato, metodo, args = [], chainId }, env = process.env, abiLoader, { lectura = false } = {}) {
    if (typeof contrato !== 'string' || ES_DIRECCION.test(contrato) || !/^[A-Za-z0-9_]{1,64}$/.test(contrato)) {
        throw new SponsorError('CONTRACT_INVALID', 'contract debe ser el nombre de un contrato del despliegue.');
    }
    if (typeof metodo !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(metodo)) {
        throw new SponsorError('METHOD_INVALID', 'method debe ser un nombre de función.');
    }
    if (!Array.isArray(args) || args.length > 16) {
        throw new SponsorError('ARGS_INVALID', 'args debe ser un array de hasta 16 elementos.');
    }
    if (!lectura && METODOS_VETADOS.has(metodo)) {
        throw new SponsorError('METHOD_FORBIDDEN', `${metodo} no se ejecuta con gas subvencionado.`, 403);
    }

    const cadena = resolverCadena(chainId, env);
    if (!cadena.ok) throw new SponsorError(cadena.code, cadena.message);
    if (cadena.chainId !== cadenaPorDefecto(env)) {
        throw new SponsorError('CHAIN_NOT_SPONSORED',
            `El gas sólo se subvenciona en la cadena configurada (${cadenaPorDefecto(env)}).`, 403);
    }
    if (!lectura && cadena.entorno === 'mainnet' && !limites(env).mainnet) {
        throw new SponsorError('MAINNET_CLOSED',
            'Gas subvencionado en mainnet cerrado. Actívalo con ADMIN_SPONSOR_ALLOW_MAINNET=true.', 403);
    }

    const direccion = contratosDeLaCadena(cadena.chainId).todos[contrato];
    if (!direccion) {
        throw new SponsorError('CONTRACT_UNKNOWN', `${contrato} no está desplegado en la cadena ${cadena.chainId}.`, 404);
    }

    const abi = (abiLoader || require('./contractService').loadABI)(contrato);
    const iface = new ethers.Interface(abi);
    const fragmento = iface.fragments.find((f) => f.type === 'function' && f.name === metodo
        && f.inputs.length === args.length);
    if (!fragmento) {
        throw new SponsorError('METHOD_UNKNOWN', `${contrato}.${metodo}(${args.length} args) no existe en el ABI.`, 404);
    }
    if (!lectura && fragmento.payable) {
        throw new SponsorError('METHOD_PAYABLE', 'Los métodos payable no se ejecutan con gas subvencionado.', 403);
    }
    return { chainId: cadena.chainId, entorno: cadena.entorno, nombre: contrato, direccion, abi, iface, fragmento };
}

/** JSON → tipos que ethers acepta (los uint grandes viajan como string). */
function normalizarArgs(args) {
    return args.map((a) => (typeof a === 'number' && !Number.isSafeInteger(a) ? BigInt(a) : a));
}

const seguro = (v) => (typeof v === 'bigint' ? v.toString() : v);

// ── Estado ─────────────────────────────────────────────────────────────────

async function estado(env = process.env) {
    const { getSigner, getProvider } = require('./contractService');
    const lim = limites(env);
    const chainId = cadenaPorDefecto(env);
    const out = {
        chainId,
        entorno: entorno(chainId),
        mainnetPermitida: lim.mainnet,
        topeGasPorTx: lim.maxGasPorTx,
        presupuestoDiarioGas: lim.gasDiario,
        gastadoHoyGas: await gastadoHoy(),
        operador: null,
        saldoOperador: null,
        habilitado: false,
    };
    try {
        const signer = getSigner();
        out.operador = signer.address;
        out.saldoOperador = ethers.formatEther(await getProvider().getBalance(signer.address));
        out.habilitado = true;
    } catch (err) {
        out.motivo = /DEPLOYER_PRIVATE_KEY/.test(err.message)
            ? 'Falta la clave de operador (DEPLOYER_PRIVATE_KEY): no hay quien pague el gas.'
            : 'El nodo RPC no responde.';
    }
    return out;
}

// ── Ejecución ──────────────────────────────────────────────────────────────

/**
 * Simula y, sólo con `confirm === true`, emite la tx pagando el operador.
 */
async function ejecutar(peticion, { actor = null, env = process.env } = {}) {
    const v = validarPeticion(peticion, env);
    const { getSigner } = require('./contractService');
    const lim = limites(env);
    const args = normalizarArgs(peticion.args || []);
    const data = v.iface.encodeFunctionData(v.fragmento, args);

    let signer;
    try { signer = getSigner(); } catch {
        throw new SponsorError('NO_OPERATOR', 'No hay clave de operador configurada para pagar el gas.', 503);
    }

    const tx = { to: v.direccion, data, from: signer.address };

    // 1) Simulación: revierte aquí, sin gastar gas, si la llamada no va a salir.
    let gasEstimado;
    try {
        await signer.provider.call(tx);
        gasEstimado = Number(await signer.provider.estimateGas(tx));
    } catch (err) {
        throw new SponsorError('SIMULATION_REVERTED',
            `La simulación revierte: ${err.shortMessage || err.reason || 'sin motivo'}.`, 422);
    }
    const gasLimit = Math.ceil(gasEstimado * 1.2);
    if (gasLimit > lim.maxGasPorTx) {
        throw new SponsorError('GAS_CAP_EXCEEDED',
            `La tx necesita ~${gasLimit} de gas; el tope por tx es ${lim.maxGasPorTx}.`, 403);
    }
    const gastado = await gastadoHoy();
    if (gastado + gasLimit > lim.gasDiario) {
        throw new SponsorError('DAILY_BUDGET_EXCEEDED',
            `Presupuesto diario agotado (${gastado}/${lim.gasDiario} de gas).`, 429);
    }

    const resumen = {
        chainId: v.chainId, entorno: v.entorno, contrato: v.nombre, direccion: v.direccion,
        metodo: peticion.metodo, gasEstimado, gasLimit, patrocinador: signer.address,
    };
    if (peticion.confirm !== true) {
        return { ...resumen, simulado: true, enviado: false, aviso: 'Añade "confirm": true para emitir la transacción.' };
    }

    // 2) Emisión.
    const audit = require('./securityAudit');
    let respuesta;
    try {
        respuesta = await signer.sendTransaction({ ...tx, gasLimit });
    } catch (err) {
        logger.error(`[admin-sponsor] fallo al emitir ${v.nombre}.${peticion.metodo}: ${err.shortMessage || err.message}`);
        throw new SponsorError('SEND_FAILED', 'No se pudo emitir la transacción.', 502);
    }
    await sumarGasto(gasLimit);
    await audit.registrar({
        eventType: 'admin.sponsored_tx',
        actor,
        payload: { ...resumen, txHash: respuesta.hash, args: (peticion.args || []).map(seguro) },
    });
    return { ...resumen, simulado: true, enviado: true, txHash: respuesta.hash };
}

/** Llamada de sólo lectura (sin gas, sin firma). */
async function leer(peticion, env = process.env) {
    const v = validarPeticion(peticion, env, undefined, { lectura: true });
    if (!['view', 'pure'].includes(v.fragmento.stateMutability)) {
        throw new SponsorError('NOT_READ_ONLY', `${peticion.metodo} no es view/pure; usa /sponsor/execute.`, 400);
    }
    const { getProvider } = require('./contractService');
    const c = new ethers.Contract(v.direccion, v.abi, getProvider());
    const resultado = await c[v.fragmento.format('sighash')](...normalizarArgs(peticion.args || []));
    const plano = (x) => (typeof x === 'bigint' ? x.toString()
        : Array.isArray(x) ? x.map(plano) : x);
    return { contrato: v.nombre, metodo: peticion.metodo, resultado: plano(resultado) };
}

module.exports = { ejecutar, leer, estado, validarPeticion, limites, SponsorError, METODOS_VETADOS };
