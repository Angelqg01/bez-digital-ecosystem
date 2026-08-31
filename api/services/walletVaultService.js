/**
 * walletVaultService.js — encrypted managed EOA vault for FIAT-first profiles.
 *
 * The managed EOA is the cryptographic owner of the user's SmartWallet.
 * BeZhas stores only an encrypted private key, never plaintext.
 */
const crypto = require('crypto');
const { ethers } = require('ethers');
const { query } = require('../db/pool');

const ALGO = 'aes-256-gcm';
const KEY_VERSION = 1;

const { IS_PRODUCTION } = require('../config/secrets');

function getVaultKey() {
    const raw = process.env.WALLET_VAULT_SECRET || process.env.JWT_SECRET;
    if (!raw) {
        // Esta clave cifra claves privadas de usuario. El literal de desarrollo
        // que había aquí está publicado en el repositorio: cualquiera podría
        // derivarlo y descifrar el vault entero. En producción se para en seco.
        if (IS_PRODUCTION) {
            throw new Error('FATAL: WALLET_VAULT_SECRET (o JWT_SECRET) es obligatorio en producción para cifrar el vault de wallets.');
        }
        return crypto.createHash('sha256').update('dev-only-wallet-vault-secret').digest();
    }
    return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptPrivateKey(privateKey) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, getVaultKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        `v${KEY_VERSION}`,
        iv.toString('base64url'),
        tag.toString('base64url'),
        ciphertext.toString('base64url'),
    ].join(':');
}

function decryptPrivateKey(payload) {
    const [version, ivB64, tagB64, ciphertextB64] = String(payload || '').split(':');
    if (version !== `v${KEY_VERSION}` || !ivB64 || !tagB64 || !ciphertextB64) {
        throw new Error('Unsupported managed wallet key format');
    }
    const decipher = crypto.createDecipheriv(ALGO, getVaultKey(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertextB64, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

async function createManagedWallet(userId) {
    const wallet = ethers.Wallet.createRandom();
    const encrypted = encryptPrivateKey(wallet.privateKey);

    await query(
        `INSERT INTO managed_wallet_keys (user_id, wallet_address, encrypted_key, key_version)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (wallet_address) DO NOTHING`,
        [userId, wallet.address.toLowerCase(), encrypted, KEY_VERSION]
    );

    return {
        address: wallet.address.toLowerCase(),
        custodyMode: 'managed',
        keyVersion: KEY_VERSION,
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
    const { rows } = await query(
        `SELECT encrypted_key
         FROM managed_wallet_keys
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
    );
    if (rows.length === 0) {
        throw new Error('Managed wallet not found for user');
    }
    const privateKey = decryptPrivateKey(rows[0].encrypted_key);
    return new ethers.Wallet(privateKey, provider);
}

module.exports = {
    createManagedWallet,
    getManagedWallet,
    getManagedSigner,
    encryptPrivateKey,
    decryptPrivateKey,
};
