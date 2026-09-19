'use strict';

/**
 * txCanonical — la forma única de convertir una intención en bytes.
 *
 * La API calcula el hash de una intención y el firmante (tx-signer) lo vuelve a
 * calcular por su cuenta. Si los dos serializaran distinto —orden de claves,
 * `undefined`, BigInt— el firmante rechazaría intenciones legítimas o, peor,
 * aceptaría una distinta de la aprobada. Por eso hay UNA función, duplicada byte
 * a byte en tx-signer/src/canonical.js, y un test que comprueba que coinciden.
 */

const crypto = require('crypto');

/**
 * JSON determinista: claves ordenadas, `undefined` omitido (igual que
 * JSON.stringify), BigInt como texto. Los arrays conservan su orden.
 */
function stableStringify(value) {
    if (typeof value === 'bigint') return JSON.stringify(value.toString());
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
        return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
    }
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    const claves = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${claves.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** sha256 en formato bytes32 (`0x` + 64 hex), que es lo que firma EIP-712. */
function sha256Hex(texto) {
    return `0x${crypto.createHash('sha256').update(texto, 'utf8').digest('hex')}`;
}

const hashCanonico = (valor) => sha256Hex(stableStringify(valor));

module.exports = { stableStringify, sha256Hex, hashCanonico };
