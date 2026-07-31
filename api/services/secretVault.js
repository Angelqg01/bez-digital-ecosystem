'use strict';

/**
 * secretVault — cifrado simétrico autenticado para credenciales de terceros
 * que BeZhas custodia en nombre del cliente (API keys de POS/ERP, tokens de
 * integración…).
 *
 * Mismo esquema que walletVaultService (AES-256-GCM, formato `v1:iv:tag:ct`)
 * para no introducir un segundo criptosistema en el proyecto.
 *
 * Compatibilidad hacia atrás: los valores guardados en claro ANTES de este
 * cambio se detectan por la ausencia del prefijo `v1:` y se devuelven tal cual,
 * de modo que las integraciones existentes siguen funcionando. Cada reescritura
 * (linkPos) los migra a cifrado; usa `scripts/encrypt-pos-credentials.js` para
 * migrar el resto de una vez.
 */
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_VERSION = 1;
const PREFIX = `v${KEY_VERSION}`;

function getVaultKey() {
    const raw = process.env.SECRET_VAULT_KEY
        || process.env.WALLET_VAULT_SECRET
        || process.env.JWT_SECRET
        || 'dev-only-secret-vault-key';
    return crypto.createHash('sha256').update(String(raw)).digest();
}

/** ¿El valor ya está cifrado con este esquema? */
function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith(`${PREFIX}:`) && value.split(':').length === 4;
}

/** Cifra un secreto. Devuelve null/undefined tal cual (campo opcional). */
function encryptSecret(plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
    if (isEncrypted(plaintext)) return plaintext; // idempotente: no re-cifrar
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, getVaultKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        PREFIX,
        iv.toString('base64url'),
        tag.toString('base64url'),
        ciphertext.toString('base64url'),
    ].join(':');
}

/**
 * Descifra un secreto. Si el valor NO tiene el prefijo de versión se considera
 * un secreto heredado en claro y se devuelve sin tocar (migración progresiva).
 */
function decryptSecret(payload) {
    if (payload === null || payload === undefined || payload === '') return payload;
    if (!isEncrypted(payload)) return payload; // legado en claro
    const [, ivB64, tagB64, ciphertextB64] = String(payload).split(':');
    const decipher = crypto.createDecipheriv(ALGO, getVaultKey(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertextB64, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

/** Enmascara un secreto para mostrarlo en respuestas/logs. Nunca lo revela. */
function maskSecret(plaintext) {
    if (!plaintext) return null;
    const s = String(plaintext);
    return s.length <= 8 ? '****' : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

module.exports = { encryptSecret, decryptSecret, isEncrypted, maskSecret, KEY_VERSION };
