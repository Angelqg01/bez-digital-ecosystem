'use strict';

/**
 * services/adminCredentials.js — Credencial del SuperAdmin, con la base como
 * fuente de verdad y el entorno sólo como semilla del primer arranque.
 *
 * El panel necesita poder rotar usuario y contraseña. Con ADMIN_PASSWORD_HASH
 * leído del entorno al cargar el módulo eso era imposible: rotar habría
 * significado reescribir un .env y reiniciar. Aquí la fila manda, y
 * ADMIN_USERNAME / ADMIN_PASSWORD_HASH sólo se usan para sembrarla la primera
 * vez.
 *
 * Todas las funciones toleran que la base no esté disponible: devuelven null y
 * el llamante decide. Un fallo de Postgres no debe convertirse en un 500 que
 * parezca "credenciales incorrectas".
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');

const BCRYPT_COST = 12;
const PASSWORD_HISTORY_LIMIT = 5;
const BACKUP_CODE_COUNT = 10;
const MIN_PASSWORD_LENGTH = 14;

// Mismo esquema de cifrado que routes/identity.js: aes-256-gcm con VAULT_KEY.
// La clave efímera de reserva sirve para desarrollo; en producción sin
// VAULT_KEY el secreto TOTP no sobrevive a un reinicio, y eso se avisa.
const VAULT_KEY = process.env.VAULT_KEY
    ? Buffer.from(process.env.VAULT_KEY, 'hex')
    : crypto.randomBytes(32);
const HAS_PERSISTENT_VAULT_KEY = Boolean(process.env.VAULT_KEY);

function encrypt(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(ciphertext) {
    const [ivHex, tagHex, encHex] = String(ciphertext).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', VAULT_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}

async function ensureSchema() {
    await query(`
        CREATE TABLE IF NOT EXISTS admin_credentials (
            id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            username                 VARCHAR(50)  NOT NULL,
            password_hash            TEXT         NOT NULL,
            wallet_address           VARCHAR(42),
            totp_secret_encrypted    TEXT,
            totp_enabled             BOOLEAN      NOT NULL DEFAULT FALSE,
            backup_codes             JSONB        NOT NULL DEFAULT '[]'::jsonb,
            password_history         JSONB        NOT NULL DEFAULT '[]'::jsonb,
            must_change_password     BOOLEAN      NOT NULL DEFAULT FALSE,
            last_password_rotated_at TIMESTAMPTZ,
            last_2fa_verified_at     TIMESTAMPTZ,
            created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    `);
}

/**
 * Devuelve la fila, sembrándola desde el entorno si aún no existe.
 * null si no hay base o si no hay nada con lo que sembrar.
 */
async function load() {
    try {
        const { rows } = await query('SELECT * FROM admin_credentials WHERE id = 1');
        if (rows.length) return rows[0];

        const envUser = process.env.ADMIN_USERNAME;
        const envHash = process.env.ADMIN_PASSWORD_HASH;
        if (!envUser || !envHash) return null;

        const wallet = process.env.ADMIN_WALLET ? process.env.ADMIN_WALLET.toLowerCase() : null;
        // ON CONFLICT: dos réplicas arrancando a la vez sembrarían la misma
        // fila y la segunda reventaría por clave duplicada.
        const seeded = await query(
            `INSERT INTO admin_credentials (id, username, password_hash, wallet_address)
             VALUES (1, $1, $2, $3)
             ON CONFLICT (id) DO NOTHING
             RETURNING *`,
            [envUser, envHash, wallet]
        );
        if (seeded.rows.length) return seeded.rows[0];
        const again = await query('SELECT * FROM admin_credentials WHERE id = 1');
        return again.rows[0] || null;
    } catch {
        return null;
    }
}

/**
 * Credenciales efectivas para el login. Si la base no responde, cae al entorno
 * para no dejar al administrador fuera por una incidencia de Postgres.
 */
async function resolveForLogin() {
    const row = await load();
    if (row) {
        return {
            source: 'db',
            username: row.username,
            passwordHash: row.password_hash,
            walletAddress: row.wallet_address,
            totpEnabled: row.totp_enabled,
            mustChangePassword: row.must_change_password,
        };
    }
    const envUser = process.env.ADMIN_USERNAME;
    const envHash = process.env.ADMIN_PASSWORD_HASH;
    if (!envUser || !envHash) return null;
    return {
        source: 'env',
        username: envUser,
        passwordHash: envHash,
        walletAddress: process.env.ADMIN_WALLET ? process.env.ADMIN_WALLET.toLowerCase() : null,
        totpEnabled: false,
        mustChangePassword: false,
    };
}

/** Motivo por el que la contraseña no vale, o null si es aceptable. */
function validatePassword(password) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
    }
    if (password.length > 128) return 'La contraseña no puede superar los 128 caracteres';
    return null;
}

/** true si la contraseña coincide con la actual o con alguna del historial. */
async function isPasswordReused(row, newPassword) {
    const previous = [row.password_hash, ...(Array.isArray(row.password_history) ? row.password_history : [])];
    for (const hash of previous.slice(0, PASSWORD_HISTORY_LIMIT + 1)) {
        if (hash && await bcrypt.compare(newPassword, hash)) return true;
    }
    return false;
}

/** Rota usuario y contraseña. Devuelve { ok, error?, row? }. */
async function rotate({ username, currentPassword, newPassword }) {
    await ensureSchema();
    const row = await load();
    if (!row) return { ok: false, error: 'No hay credenciales de administrador que rotar', status: 503 };

    if (!await bcrypt.compare(currentPassword, row.password_hash)) {
        return { ok: false, error: 'La contraseña actual no es correcta', status: 401 };
    }
    const invalid = validatePassword(newPassword);
    if (invalid) return { ok: false, error: invalid, status: 400 };

    // Reutilizar una contraseña anterior anula el sentido de rotar: si la
    // antigua se filtró, volver a ella la deja igual de expuesta.
    if (await isPasswordReused(row, newPassword)) {
        return { ok: false, error: 'Esa contraseña ya se ha usado antes. Elige una distinta.', status: 400 };
    }

    const history = [row.password_hash, ...(Array.isArray(row.password_history) ? row.password_history : [])]
        .slice(0, PASSWORD_HISTORY_LIMIT);

    const { rows } = await query(
        `UPDATE admin_credentials
            SET username = $1,
                password_hash = $2,
                password_history = $3::jsonb,
                must_change_password = FALSE,
                last_password_rotated_at = NOW(),
                updated_at = NOW()
          WHERE id = 1
      RETURNING *`,
        [username, await bcrypt.hash(newPassword, BCRYPT_COST), JSON.stringify(history)]
    );
    return { ok: true, row: rows[0] };
}

/** Códigos de respaldo nuevos. Devuelve los claros (una sola vez) y guarda hashes. */
async function regenerateBackupCodes() {
    const plain = Array.from({ length: BACKUP_CODE_COUNT }, () =>
        crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-')
    );
    // Coste 8: son 10 códigos de 80 bits aleatorios, no contraseñas humanas.
    // Con coste 12 el alta tardaría segundos sin ganar nada frente a una
    // entropía que ya hace inviable la fuerza bruta.
    const hashes = await Promise.all(plain.map(code => bcrypt.hash(code, 8)));
    await query(
        `UPDATE admin_credentials SET backup_codes = $1::jsonb, updated_at = NOW() WHERE id = 1`,
        [JSON.stringify(hashes)]
    );
    return plain;
}

/** Consume un código de respaldo. true si era válido (y lo invalida). */
async function consumeBackupCode(code) {
    const row = await load();
    if (!row) return false;
    const hashes = Array.isArray(row.backup_codes) ? row.backup_codes : [];
    const normalized = String(code).trim().toUpperCase();

    for (let i = 0; i < hashes.length; i++) {
        if (await bcrypt.compare(normalized, hashes[i])) {
            const remaining = hashes.filter((_, idx) => idx !== i);
            await query(
                `UPDATE admin_credentials SET backup_codes = $1::jsonb, updated_at = NOW() WHERE id = 1`,
                [JSON.stringify(remaining)]
            );
            return true;
        }
    }
    return false;
}

async function setTotpSecret(secretBase32) {
    await query(
        `UPDATE admin_credentials
            SET totp_secret_encrypted = $1, totp_enabled = FALSE, updated_at = NOW()
          WHERE id = 1`,
        [encrypt(secretBase32)]
    );
}

async function getTotpSecret() {
    const row = await load();
    if (!row?.totp_secret_encrypted) return null;
    try {
        return decrypt(row.totp_secret_encrypted);
    } catch {
        // VAULT_KEY cambiada o secreto corrupto: mejor null (y re-alta) que
        // un 500 que deje al administrador sin poder rehacer el 2FA.
        return null;
    }
}

async function enableTotp() {
    await query(
        `UPDATE admin_credentials
            SET totp_enabled = TRUE, last_2fa_verified_at = NOW(), updated_at = NOW()
          WHERE id = 1`
    );
}

async function markTotpVerified() {
    await query(`UPDATE admin_credentials SET last_2fa_verified_at = NOW(), updated_at = NOW() WHERE id = 1`);
}

async function completeBootstrap(newPassword) {
    await ensureSchema();
    const row = await load();
    if (!row) return { ok: false, error: 'No hay credenciales de administrador', status: 503 };

    const invalid = validatePassword(newPassword);
    if (invalid) return { ok: false, error: invalid, status: 400 };
    if (await isPasswordReused(row, newPassword)) {
        return { ok: false, error: 'Esa contraseña ya se ha usado antes. Elige una distinta.', status: 400 };
    }

    const history = [row.password_hash, ...(Array.isArray(row.password_history) ? row.password_history : [])]
        .slice(0, PASSWORD_HISTORY_LIMIT);
    const { rows } = await query(
        `UPDATE admin_credentials
            SET password_hash = $1,
                password_history = $2::jsonb,
                must_change_password = FALSE,
                last_password_rotated_at = NOW(),
                updated_at = NOW()
          WHERE id = 1
      RETURNING *`,
        [await bcrypt.hash(newPassword, BCRYPT_COST), JSON.stringify(history)]
    );
    return { ok: true, row: rows[0] };
}

/** Estado que pinta el panel. Nunca incluye hashes ni el secreto TOTP. */
async function status() {
    const row = await load();
    if (!row) return null;
    return {
        username: row.username,
        walletAddress: row.wallet_address || '',
        twoFactorEnabled: row.totp_enabled,
        passwordHistoryCount: Array.isArray(row.password_history) ? row.password_history.length : 0,
        backupCodesRemaining: Array.isArray(row.backup_codes) ? row.backup_codes.length : 0,
        mustChangePassword: row.must_change_password,
        lastPasswordRotatedAt: row.last_password_rotated_at,
        last2FAVerifiedAt: row.last_2fa_verified_at,
    };
}

module.exports = {
    ensureSchema, load, resolveForLogin, rotate, status,
    regenerateBackupCodes, consumeBackupCode,
    setTotpSecret, getTotpSecret, enableTotp, markTotpVerified,
    completeBootstrap, validatePassword,
    MIN_PASSWORD_LENGTH, HAS_PERSISTENT_VAULT_KEY,
};
