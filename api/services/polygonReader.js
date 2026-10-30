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

async function llamarEnCadena(direccion, abi, funcion, args = []) {
    const contrato = new ethers.Contract(direccion, abi, getProveedor());
    let t;
    try {
        return await Promise.race([
            contrato[funcion](...args),
            new Promise((_, rej) => { t = setTimeout(() => rej(new Error('RPC sin respuesta')), TIMEOUT_MS); }),
        ]);
    } finally {
        clearTimeout(t);
    }
}

let llamador = llamarEnCadena;

/** Llama a una función `view`. Lanza el error del RPC o del contrato tal cual. */
function leer(direccion, abi, funcion, args) {
    return llamador(direccion, abi, funcion, args);
}

module.exports = {
    CHAIN_ID,
    leer,
    // Solo para tests: (direccion, abi, funcion, args) => valor
    _setLlamador: (fn) => { llamador = fn || llamarEnCadena; },
};
