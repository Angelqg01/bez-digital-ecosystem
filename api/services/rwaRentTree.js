'use strict';

/**
 * services/rwaRentTree.js — el cálculo fuera de cadena de un reparto de rentas
 * para el contrato RWARentDistributor (smart-contracts/src/finance).
 *
 * El RWAFactory desplegado no tiene snapshots, así que el reparto se calcula
 * aquí: saldos de cada titular en el bloque de corte → importe a prorrata →
 * árbol de Merkle. El emisor publica la raíz y cada titular reclama con su
 * prueba.
 *
 * Todo son funciones puras: no leen la cadena, no firman y no guardan nada.
 * Quien las llama trae los eventos ya leídos, así cualquiera puede repetir el
 * cálculo con los mismos eventos y comprobar que la raíz publicada es la buena.
 *
 * Formato (tiene que coincidir con el contrato):
 *   hoja = keccak256(keccak256(abi.encode(address cuenta, uint256 importe)))
 *   nodo = keccak256 de los dos hijos ordenados (MerkleProof de OpenZeppelin)
 */

const { ethers } = require('ethers');

const CERO = ethers.ZeroAddress;
const coder = ethers.AbiCoder.defaultAbiCoder();

class RwaRentTreeError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'RwaRentTreeError';
        this.code = code;
        this.status = 400;
    }
}

/**
 * Saldos de un activo a partir de sus eventos de transferencia ERC-1155, ya
 * decodificados y en orden de cadena hasta el bloque de corte (incluido).
 *
 * @param {Array<{from:string,to:string,id?:bigint|string,value?:bigint|string,ids?:Array,values?:Array}>} eventos
 *        TransferSingle ({id, value}) o TransferBatch ({ids, values}).
 * @returns {Map<string, bigint>} dirección (checksum) → fracciones, sin ceros.
 */
function saldosEnCorte(eventos, assetId) {
    const id = BigInt(assetId);
    const saldos = new Map();
    const mover = (cuenta, delta) => {
        if (cuenta === CERO) return; // mint y burn no tienen titular al otro lado
        const nuevo = (saldos.get(cuenta) || 0n) + delta;
        if (nuevo < 0n) {
            throw new RwaRentTreeError(
                `Saldo negativo para ${cuenta}: faltan eventos o no están en orden.`, 'INCONSISTENT_EVENTS',
            );
        }
        if (nuevo === 0n) saldos.delete(cuenta);
        else saldos.set(cuenta, nuevo);
    };

    for (const ev of eventos) {
        const from = ethers.getAddress(ev.from);
        const to = ethers.getAddress(ev.to);
        const ids = ev.ids ? ev.ids : [ev.id];
        const values = ev.values ? ev.values : [ev.value];
        for (let i = 0; i < ids.length; i += 1) {
            if (BigInt(ids[i]) !== id) continue;
            const v = BigInt(values[i]);
            mover(from, -v);
            mover(to, v);
        }
    }
    return saldos;
}

/**
 * Reparte `importe` a prorrata de las fracciones, redondeando hacia abajo. El
 * resto del redondeo queda sin asignar: el emisor lo recupera al cerrar el
 * plazo, y así la suma nunca supera lo depositado.
 *
 * @param {Map<string,bigint>} saldos
 * @param {bigint|string} importe En unidades mínimas del token de pago.
 * @param {{excluir?: string[]}} [opts] Direcciones que no cobran (p. ej. el
 *        emisor, por las fracciones que aún no ha vendido). Lo suyo se reparte
 *        entre los demás.
 * @returns {{asignaciones: Array<{cuenta:string, fracciones:bigint, importe:bigint}>, repartido:bigint, resto:bigint}}
 */
function repartir(saldos, importe, { excluir = [] } = {}) {
    const total = BigInt(importe);
    if (total <= 0n) throw new RwaRentTreeError('El importe a repartir tiene que ser mayor que cero.', 'INVALID_AMOUNT');
    const fuera = new Set(excluir.map((d) => ethers.getAddress(d)));

    const titulares = [...saldos.entries()].filter(([cuenta, f]) => !fuera.has(cuenta) && f > 0n);
    const fracciones = titulares.reduce((s, [, f]) => s + f, 0n);
    if (fracciones === 0n) throw new RwaRentTreeError('No hay ningún titular con fracciones que cobre.', 'NO_HOLDERS');

    const asignaciones = titulares
        .map(([cuenta, f]) => ({ cuenta, fracciones: f, importe: (total * f) / fracciones }))
        .filter((a) => a.importe > 0n)
        .sort((a, b) => (a.cuenta.toLowerCase() < b.cuenta.toLowerCase() ? -1 : 1));
    if (asignaciones.length === 0) {
        throw new RwaRentTreeError('El importe es demasiado pequeño: a nadie le toca ni una unidad.', 'AMOUNT_TOO_SMALL');
    }

    const repartido = asignaciones.reduce((s, a) => s + a.importe, 0n);
    return { asignaciones, repartido, resto: total - repartido };
}

function hoja(cuenta, importe) {
    return ethers.keccak256(ethers.keccak256(coder.encode(['address', 'uint256'], [cuenta, importe])));
}

function par(a, b) {
    return BigInt(a) < BigInt(b) ? ethers.keccak256(ethers.concat([a, b])) : ethers.keccak256(ethers.concat([b, a]));
}

/**
 * Árbol de Merkle de las asignaciones.
 * @returns {{raiz:string, pruebas: Record<string, {importe:string, prueba:string[]}>}}
 */
function construirArbol(asignaciones) {
    if (!asignaciones.length) throw new RwaRentTreeError('No hay asignaciones.', 'NO_HOLDERS');
    const vistas = new Set();
    const hojas = asignaciones.map((a) => {
        const cuenta = ethers.getAddress(a.cuenta);
        if (vistas.has(cuenta)) throw new RwaRentTreeError(`Cuenta repetida: ${cuenta}.`, 'DUPLICATE_ACCOUNT');
        vistas.add(cuenta);
        return { cuenta, importe: BigInt(a.importe), hash: hoja(cuenta, BigInt(a.importe)) };
    }).sort((a, b) => (BigInt(a.hash) < BigInt(b.hash) ? -1 : 1));

    // Niveles de abajo arriba; un nodo sin pareja sube tal cual.
    const niveles = [hojas.map((h) => h.hash)];
    while (niveles[niveles.length - 1].length > 1) {
        const abajo = niveles[niveles.length - 1];
        const arriba = [];
        for (let i = 0; i < abajo.length; i += 2) {
            arriba.push(i + 1 < abajo.length ? par(abajo[i], abajo[i + 1]) : abajo[i]);
        }
        niveles.push(arriba);
    }

    const pruebas = {};
    hojas.forEach((h, indice) => {
        const prueba = [];
        let i = indice;
        for (let n = 0; n < niveles.length - 1; n += 1) {
            const hermano = i % 2 === 0 ? i + 1 : i - 1;
            if (hermano < niveles[n].length) prueba.push(niveles[n][hermano]);
            i = Math.floor(i / 2);
        }
        pruebas[h.cuenta] = { importe: h.importe.toString(), prueba };
    });

    return { raiz: niveles[niveles.length - 1][0], pruebas };
}

/** La misma comprobación que hace el contrato (MerkleProof.verify). */
function verificar(raiz, cuenta, importe, prueba) {
    let nodo = hoja(ethers.getAddress(cuenta), BigInt(importe));
    for (const p of prueba) nodo = par(nodo, p);
    return nodo === raiz;
}

/**
 * De los eventos al reparto listo para publicar.
 * @returns {{assetId:string, importe:string, repartido:string, resto:string, titulares:number, raiz:string, pruebas:object}}
 */
function calcularReparto({ eventos, assetId, importe, excluir }) {
    const saldos = saldosEnCorte(eventos, assetId);
    const { asignaciones, repartido, resto } = repartir(saldos, importe, { excluir });
    const { raiz, pruebas } = construirArbol(asignaciones);
    return {
        assetId: String(assetId),
        importe: BigInt(importe).toString(),
        repartido: repartido.toString(),
        resto: resto.toString(),
        titulares: asignaciones.length,
        raiz,
        pruebas,
    };
}

module.exports = {
    saldosEnCorte, repartir, construirArbol, verificar, calcularReparto, hoja, RwaRentTreeError,
};
