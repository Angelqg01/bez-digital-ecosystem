/**
 * walletNonce.js — One-time, expiring nonces for wallet-signature login.
 *
 * Prevents signature replay: a login signature is only valid for a nonce that
 * the server issued for that address and has not yet consumed. Nonces are
 * single-use (atomically consumed via Redis GETDEL) and expire quickly.
 *
 * Falls back to an in-memory store when Redis is unavailable (dev / single node).
 */
const crypto = require('crypto');
const { connectRedis } = require('../cache/redis');

const NONCE_TTL_SECONDS = 300; // 5 minutes
const KEY_PREFIX = 'walletnonce:';

// In-memory fallback: Map<key, { nonce, expiresAt }>
const memStore = new Map();

function keyFor(address) {
    return KEY_PREFIX + String(address).toLowerCase();
}

function memSet(key, nonce) {
    memStore.set(key, { nonce, expiresAt: Date.now() + NONCE_TTL_SECONDS * 1000 });
}

function memConsume(key) {
    const entry = memStore.get(key);
    if (!entry) return null;
    memStore.delete(key);
    if (entry.expiresAt < Date.now()) return null;
    return entry.nonce;
}

/**
 * Issue a fresh nonce for an address and the exact message the client must sign.
 * @returns {Promise<{ nonce: string, message: string }>}
 */
async function issueNonce(address) {
    const addr = String(address).toLowerCase();
    const nonce = crypto.randomBytes(24).toString('hex');
    const key = keyFor(addr);

    try {
        const client = await connectRedis();
        await client.set(key, nonce, { EX: NONCE_TTL_SECONDS });
    } catch (_) {
        memSet(key, nonce);
    }
    // Always mirror to memory as a safety net.
    memSet(key, nonce);

    return { nonce, message: buildLoginMessage(addr, nonce) };
}

/**
 * Atomically consume (read + delete) the stored nonce for an address.
 * @returns {Promise<string|null>} the nonce if present, else null.
 */
async function consumeNonce(address) {
    const key = keyFor(address);
    let fromRedis = null;
    try {
        const client = await connectRedis();
        // GETDEL is atomic — eliminates read/delete race that would allow replay.
        fromRedis = typeof client.getDel === 'function'
            ? await client.getDel(key)
            : await client.get(key).then(async v => { if (v) await client.del(key); return v; });
    } catch (_) {
        fromRedis = null;
    }
    const fromMem = memConsume(key);
    return fromRedis || fromMem;
}

/**
 * Canonical message a client must sign. The nonce binds the signature to a
 * single server-issued challenge for this address.
 */
function buildLoginMessage(address, nonce) {
    return `BeZhas Login\naddress: ${String(address).toLowerCase()}\nnonce: ${nonce}`;
}

/** Extract the nonce embedded in a signed login message, or null. */
function extractNonce(message) {
    const m = /nonce:\s*([a-f0-9]{16,})/i.exec(String(message || ''));
    return m ? m[1] : null;
}

module.exports = {
    issueNonce,
    consumeNonce,
    buildLoginMessage,
    extractNonce,
    NONCE_TTL_SECONDS,
};
