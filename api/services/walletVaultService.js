/**
 * walletVaultService.js — encrypted managed EOA vault for FIAT-first profiles.
 *
 * The managed EOA is the cryptographic owner of the user's SmartWallet.
 * BeZhas stores only an encrypted private key, never plaintext.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUÉ CAMBIÓ Y POR QUÉ (v2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * v1 derivaba la clave como sha256(WALLET_VAULT_SECRET || JWT_SECRET). Tres
 * problemas:
 *
 *   1. La vuelta a JWT_SECRET. Ese secreto lo tienen la API, business-ops y
 *      cualquier servicio que valide sesiones. Quien lo obtuviera podía firmar
 *      sesiones Y descifrar todas las wallets gestionadas: dos compromisos en
 *      uno. v2 exige un secreto propio y se niega a arrancar en producción si
 *      coincide con JWT_SECRET o INTERNAL_API_KEY.
 *   2. sha256 directo no es una derivación de claves. v2 usa HKDF-SHA256 con
 *      sal de dominio y la versión como `info`.
 *   3. Una sola versión, sin rotación. v2 acepta un llavero
 *      (WALLET_VAULT_KEYS="3:nuevo,2:anterior"): cifra con la más alta,
 *      descifra con la que diga cada registro, y `reencryptAll()` migra.
 *
 * Además, el cifrado se ATA a la dirección de la wallet (AAD de AES-GCM): una
 * clave cifrada copiada a la fila de otra wallet no descifra. Y al descifrar se
 * comprueba que la clave corresponde a la dirección guardada.
 *
 * Los registros v1 existentes se siguen leyendo (con WALLET_VAULT_LEGACY_SECRET
 * o, en su defecto, el secreto que usaba v1) para no perder fondos: se migran
 * con reencryptAll() y después se retira el secreto viejo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  CUSTODIA GESTIONADA DESACTIVADA POR DEFECTO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `getManagedSigner` entrega una clave privada descifrada al proceso de la API.
 * Eso es custodia de claves de usuarios: exposición de seguridad y, según MiCA,
 * probablemente un servicio de custodia regulado. No lo usa ninguna ruta hoy.
 * Queda tras MANAGED_CUSTODY_SIGNING_ENABLED=true para que activarlo sea una
 * decisión explícita y no un efecto secundario.
 */
const crypto = require('crypto');
const { ethers } = require('ethers');
const { query } = require('../db/pool');

const ALGO = 'aes-256-gcm';
const SAL_HKDF = 'bezhas/wallet-vault';
const LONGITUD_MINIMA = 32;
const LITERAL_DESARROLLO = 'dev-only-wallet-vault-secret';
const PROVEEDOR = 'local-aes-gcm-hkdf';

const esProduccion = (env) => env.NODE_ENV === 'production';

function errorVault(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
}

/** Versiones de clave disponibles, de la más nueva a la más vieja. */
function llavero(env = process.env) {
    const entradas = [];
    if (env.WALLET_VAULT_KEYS) {
        for (const parte of String(env.WALLET_VAULT_KEYS).split(',')) {
            const i = parte.indexOf(':');
            const version = Number(parte.slice(0, i).trim());
            const secreto = parte.slice(i + 1).trim();
            if (i > 0 && Number.isInteger(version) && version >= 2 && secreto) entradas.push({ version, secreto });
        }
    } else if (env.WALLET_VAULT_SECRET) {
        entradas.push({ version: 2, secreto: env.WALLET_VAULT_SECRET });
    }

    if (entradas.length === 0) {
        if (esProduccion(env)) {
            throw errorVault('VAULT_NOT_CONFIGURED',
                'FATAL: WALLET_VAULT_SECRET (o WALLET_VAULT_KEYS) es obligatorio en producción. JWT_SECRET ya no se acepta como clave del vault.');
        }
        entradas.push({ version: 2, secreto: LITERAL_DESARROLLO });
    }

    if (esProduccion(env)) {
        for (const { version, secreto } of entradas) {
            if (secreto.length < LONGITUD_MINIMA) {
                throw errorVault('VAULT_SECRET_WEAK', `FATAL: la clave v${version} del vault tiene menos de ${LONGITUD_MINIMA} caracteres.`);
            }
            if (secreto === env.JWT_SECRET || secreto === env.INTERNAL_API_KEY || secreto === LITERAL_DESARROLLO) {
                throw errorVault('VAULT_SECRET_REUSED',
                    `FATAL: la clave v${version} del vault no puede ser JWT_SECRET, INTERNAL_API_KEY ni el literal de desarrollo.`);
            }
        }
    }
    return entradas.sort((a, b) => b.version - a.version);
}

function derivar(secreto, version) {
    return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secreto, 'utf8'), Buffer.from(SAL_HKDF, 'utf8'), Buffer.from(`v${version}`, 'utf8'), 32));
}

/**
 * Claves candidatas de los registros v1 (sha256 del secreto de entonces). Sólo
 * para leer y migrar.
 *
 * Son VARIAS a propósito: v1 usaba WALLET_VAULT_SECRET si existía y, si no,
 * JWT_SECRET. El compose de producción nunca pasó WALLET_VAULT_SECRET, así que
 * lo guardado allí está cifrado con JWT_SECRET; en cuanto se configure el
 * secreto nuevo, elegir «el primero que haya» dejaría esos registros ilegibles.
 * Se prueban todas y AES-GCM dice cuál es la buena (la etiqueta no verifica con
 * las demás).
 */
function clavesLegacyV1(env = process.env) {
    const candidatos = [env.WALLET_VAULT_LEGACY_SECRET, env.WALLET_VAULT_SECRET, env.JWT_SECRET].filter(Boolean);
    if (!esProduccion(env)) candidatos.push(LITERAL_DESARROLLO);
    if (!candidatos.length) throw errorVault('VAULT_LEGACY_KEY_MISSING', 'No hay secreto para leer registros v1 del vault.');
    return [...new Set(candidatos)].map((raw) => crypto.createHash('sha256').update(String(raw)).digest());
}

const versionActual = (env = process.env) => llavero(env)[0].version;

const aad = (address) => Buffer.from(String(address).toLowerCase(), 'utf8');

function encryptPrivateKey(privateKey, { address, env = process.env } = {}) {
    if (!address) throw errorVault('VAULT_ADDRESS_REQUIRED', 'El cifrado se ata a la dirección de la wallet.');
    const { version, secreto } = llavero(env)[0];
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, derivar(secreto, version), iv);
    cipher.setAAD(aad(address));
    const ciphertext = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
    return [`v${version}`, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':');
}

function decryptPrivateKey(payload, { address, env = process.env } = {}) {
    const [etiqueta, ivB64, tagB64, ctB64] = String(payload || '').split(':');
    const version = Number(String(etiqueta || '').replace(/^v/, ''));
    if (!Number.isInteger(version) || version < 1 || !ivB64 || !tagB64 || !ctB64) {
        throw errorVault('VAULT_FORMAT', 'Unsupported managed wallet key format');
    }

    let claves;
    if (version === 1) {
        claves = clavesLegacyV1(env);
    } else {
        const entrada = llavero(env).find((k) => k.version === version);
        if (!entrada) throw errorVault('VAULT_KEY_VERSION_MISSING', `La versión v${version} de la clave del vault no está configurada.`);
        if (!address) throw errorVault('VAULT_ADDRESS_REQUIRED', 'Descifrar un registro v2+ exige la dirección de la wallet.');
        claves = [derivar(entrada.secreto, version)];
    }

    let privateKey = null;
    for (const clave of claves) {
        try {
            const decipher = crypto.createDecipheriv(ALGO, clave, Buffer.from(ivB64, 'base64url'));
            if (version >= 2) decipher.setAAD(aad(address));
            decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
            privateKey = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
            break;
        } catch { /* etiqueta GCM no verifica con esta clave: probar la siguiente */ }
    }
    if (privateKey === null) throw errorVault('VAULT_DECRYPT_FAILED', 'Ninguna clave configurada descifra este registro.');

    if (address && new ethers.Wallet(privateKey).address.toLowerCase() !== String(address).toLowerCase()) {
        throw errorVault('VAULT_ADDRESS_MISMATCH', 'La clave descifrada no corresponde a la dirección registrada.');
    }
    return privateKey;
}

async function createManagedWallet(userId) {
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address.toLowerCase();
    const encrypted = encryptPrivateKey(wallet.privateKey, { address });

    await query(
        `INSERT INTO managed_wallet_keys (user_id, wallet_address, encrypted_key, key_version, kms_provider)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (wallet_address) DO NOTHING`,
        [userId, address, encrypted, versionActual(), PROVEEDOR]
    );

    return {
        address,
        custodyMode: 'managed',
        keyVersion: versionActual(),
    };
}

async function getManagedWallet(userId) {
    const { rows } = await query(
        `SELECT wallet_address, encrypted_key, key_version, status
         FROM managed_wallet_keys
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
    );
    if (rows.length === 0) return null;
    return {
        address: rows[0].wallet_address,
        keyVersion: rows[0].key_version,
        status: rows[0].status,
    };
}

async function getManagedSigner(userId, provider) {
    if (process.env.MANAGED_CUSTODY_SIGNING_ENABLED !== 'true') {
        throw errorVault('MANAGED_CUSTODY_DISABLED',
            'La firma con wallets custodiadas está desactivada. Ver la cabecera de walletVaultService.js antes de activarla.');
    }
    const { rows } = await query(
        `SELECT wallet_address, encrypted_key
         FROM managed_wallet_keys
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
    );
    if (rows.length === 0) {
        throw new Error('Managed wallet not found for user');
    }
    const privateKey = decryptPrivateKey(rows[0].encrypted_key, { address: rows[0].wallet_address });
    return new ethers.Wallet(privateKey, provider);
}

/**
 * Re-cifra con la versión actual los registros de versiones anteriores.
 * Actualización optimista: si otro proceso ya migró la fila, no la pisa.
 */
async function reencryptAll({ limite = 500 } = {}) {
    const actual = versionActual();
    const { rows } = await query(
        `SELECT id, wallet_address, encrypted_key, key_version
           FROM managed_wallet_keys
          WHERE key_version < $1 AND status IN ('active', 'rotating')
          LIMIT $2`,
        [actual, limite]
    );
    let migradas = 0;
    const fallidas = [];
    for (const f of rows) {
        try {
            const pk = decryptPrivateKey(f.encrypted_key, { address: f.wallet_address });
            const nuevo = encryptPrivateKey(pk, { address: f.wallet_address });
            const r = await query(
                `UPDATE managed_wallet_keys
                    SET encrypted_key = $1, key_version = $2, kms_provider = $3, rotated_at = NOW()
                  WHERE id = $4 AND key_version = $5`,
                [nuevo, actual, PROVEEDOR, f.id, f.key_version]
            );
            if (r.rowCount) migradas += 1;
        } catch (err) {
            fallidas.push({ id: f.id, code: err.code || 'ERROR' });
        }
    }
    return { pendientesLeidas: rows.length, migradas, fallidas, versionActual: actual };
}

/** Para el arranque: falla pronto si la configuración del vault no vale. */
function comprobarConfiguracion(env = process.env) {
    llavero(env);
    return { versionActual: versionActual(env) };
}

module.exports = {
    createManagedWallet,
    getManagedWallet,
    getManagedSigner,
    encryptPrivateKey,
    decryptPrivateKey,
    reencryptAll,
    comprobarConfiguracion,
};
