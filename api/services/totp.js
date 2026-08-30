'use strict';

/**
 * services/totp.js — TOTP (RFC 6238) sobre HMAC, sin dependencias externas.
 *
 * Se implementa aquí en vez de traer `otplib`/`speakeasy` porque son 80 líneas
 * de RFC bien definido y con vectores de prueba oficiales, y esto protege el
 * acceso SUPER_ADMIN: menos superficie de suministro que auditar.
 *
 * Compatible con Google Authenticator, Authy, 1Password y Aegis: SHA-1,
 * 6 dígitos, ventana de 30 s. No se cambia a SHA-256 aunque sea "mejor" —
 * varias apps de autenticación lo ignoran y el usuario acabaría con códigos
 * que nunca validan.
 */
const crypto = require('crypto');

const DIGITS = 6;
const PERIOD_S = 30;
const ALGO = 'sha1';

// RFC 4648 §6. Sin padding: los otpauth:// de las apps no lo llevan.
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

function base32Decode(str) {
    const clean = str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const out = [];
    for (const char of clean) {
        const idx = B32_ALPHABET.indexOf(char);
        if (idx === -1) throw new Error('Base32 inválido');
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/** Secreto nuevo. 20 bytes = 160 bits, el tamaño que recomienda la RFC 4226. */
function generateSecret() {
    return base32Encode(crypto.randomBytes(20));
}

/** Código para un contador concreto (HOTP, RFC 4226 §5.3). */
function hotp(secretBase32, counter) {
    const key = base32Decode(secretBase32);
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));

    const digest = crypto.createHmac(ALGO, key).update(buf).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);

    return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** Código actual (o el de un instante dado, en segundos epoch). */
function totp(secretBase32, atSeconds = Math.floor(Date.now() / 1000)) {
    return hotp(secretBase32, Math.floor(atSeconds / PERIOD_S));
}

/**
 * Verifica un código con tolerancia de ±`window` periodos, para absorber el
 * desfase de reloj del móvil. window=1 → ±30 s.
 *
 * La comparación es en tiempo constante: comparar con `===` filtra el código
 * dígito a dígito y, con 10^6 posibilidades, eso es material aprovechable.
 */
function verify(secretBase32, code, { window = 1, atSeconds = Math.floor(Date.now() / 1000) } = {}) {
    if (typeof code !== 'string' && typeof code !== 'number') return false;
    const clean = String(code).replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) return false;

    const counter = Math.floor(atSeconds / PERIOD_S);
    let matched = false;
    for (let i = -window; i <= window; i++) {
        const expected = hotp(secretBase32, counter + i);
        // Sin cortar el bucle al primer acierto: salir antes revela por tiempo
        // qué posición de la ventana casó.
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) {
            matched = true;
        }
    }
    return matched;
}

/** URI otpauth:// que se mete en el QR. */
function otpauthUrl({ secret, account, issuer = 'BeZhas' }) {
    const label = encodeURIComponent(`${issuer}:${account}`);
    const params = new URLSearchParams({
        secret,
        issuer,
        algorithm: ALGO.toUpperCase(),
        digits: String(DIGITS),
        period: String(PERIOD_S),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = { generateSecret, totp, hotp, verify, otpauthUrl, base32Encode, base32Decode, PERIOD_S, DIGITS };
