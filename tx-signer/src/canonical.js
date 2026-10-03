'use strict';

/**
 * Copia byte a byte de api/services/txCanonical.js.
 *
 * Está duplicada a propósito: el firmante no importa código de la API (vive en
 * otro contenedor y no debe fiarse de ella). test/paridad.test.js comprueba que
 * las dos producen lo mismo; si alguien cambia una sin la otra, falla.
 */

const crypto = require('crypto');

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

function sha256Hex(texto) {
    return `0x${crypto.createHash('sha256').update(texto, 'utf8').digest('hex')}`;
}

const hashCanonico = (valor) => sha256Hex(stableStringify(valor));

module.exports = { stableStringify, sha256Hex, hashCanonico };
