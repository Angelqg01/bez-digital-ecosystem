'use strict';

/**
 * Normalización de texto no confiable para DETECCIÓN (escudo del chat, cuarentena de documentos, tokenizador):
 * NFKD, minúsculas, sin caracteres invisibles ni de control bidireccional, homoglifos cirílicos/griegos pasados a
 * latino y sin marcas diacríticas. No se usa para mostrar ni para guardar el texto: sólo para compararlo.
 */

// Homoglifos cirílicos/griegos más usados para disfrazar palabras latinas, por código de carácter.
const HOMOGLIFOS = { 0x430: 'a', 0x435: 'e', 0x43e: 'o', 0x440: 'p', 0x441: 'c', 0x445: 'x', 0x443: 'y', 0x456: 'i', 0x3bf: 'o', 0x3b1: 'a', 0x3b5: 'e' };

// Guion suave, zero-width y marcas de dirección (200b-200f), bidi embebido (202a-202e) y aislado (2066-2069), word joiner, BOM.
const esInvisible = (cp) => cp === 0xad || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x202a && cp <= 0x202e)
    || cp === 0x2060 || (cp >= 0x2066 && cp <= 0x2069) || cp === 0xfeff;

function normalizar(texto) {
    let limpio = '';
    for (const ch of String(texto || '').toLowerCase().normalize('NFKD')) {
        const cp = ch.codePointAt(0);
        if (esInvisible(cp)) continue;
        limpio += HOMOGLIFOS[cp] || ch;
    }
    return limpio.replace(/[̀-ͯ]/g, '');
}

module.exports = { normalizar, esInvisible, HOMOGLIFOS };
