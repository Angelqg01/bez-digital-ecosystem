'use strict';

/**
 * services/polygonReader.js — lecturas `view` contra contratos de Polygon.
 *
 * Una sola puerta para el RPC de los servicios que PREPARAN transacciones sin
 * firmar (swap de BEZ, mercado RWA): ninguno firma ni envía, sólo lee precios,
 * ofertas y estados. Con un tiempo máximo, porque los RPC públicos a veces no
 * contestan, y sustituible en las pruebas para no depender de la red.
 */

const { ethers } = require('ethers');
const { urlsParaCadena } = require('./rpcQuorum');

const CHAIN_ID = 137;
const TIMEOUT_MS = parseInt(process.env.POLYGON_READ_TIMEOUT_MS || '8000', 10);

let proveedor = null;
function getProveedor() {
    if (!proveedor) {
        const url = urlsParaCadena(CHAIN_ID)[0] || 'https://polygon-bor-rpc.publicnode.com';
        proveedor = new ethers.JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true });
    }
    return proveedor;
}

async function conTimeout(promesa, ms = TIMEOUT_MS) {
    let t;
    try {
        return await Promise.race([
            promesa,
            new Promise((_, rej) => { t = setTimeout(() => rej(new Error('RPC sin respuesta')), ms); }),
        ]);
    } finally {
        clearTimeout(t);
    }
}

async function llamarEnCadena(direccion, abi, funcion, args = []) {
    const contrato = new ethers.Contract(direccion, abi, getProveedor());
    return conTimeout(contrato[funcion](...args));
}

/** Lo que hace falta de la cadena para leer eventos (los logs tardan más que una llamada `view`). */
const cadenaReal = {
    bloqueActual: () => conTimeout(getProveedor().getBlockNumber()),
    timestampDeBloque: async (n) => (await conTimeout(getProveedor().getBlock(n)))?.timestamp,
    logs: (filtro) => conTimeout(getProveedor().getLogs(filtro), TIMEOUT_MS * 3),
};
let cadena = cadenaReal;

let llamador = llamarEnCadena;

/** Llama a una función `view`. Lanza el error del RPC o del contrato tal cual. */
function leer(direccion, abi, funcion, args) {
    return llamador(direccion, abi, funcion, args);
}

/** Número del último bloque. */
const bloqueActual = () => cadena.bloqueActual();
/** Marca de tiempo (segundos) de un bloque. */
const timestampDeBloque = (n) => cadena.timestampDeBloque(n);
/** Logs de un filtro { address, topics, fromBlock, toBlock }. */
const logs = (filtro) => cadena.logs(filtro);

module.exports = {
    CHAIN_ID,
    leer,
    bloqueActual,
    timestampDeBloque,
    logs,
    // Solo para tests: (direccion, abi, funcion, args) => valor
    _setLlamador: (fn) => { llamador = fn || llamarEnCadena; },
    // Solo para tests: { bloqueActual, timestampDeBloque, logs }
    _setCadena: (c) => { cadena = c || cadenaReal; },
};
