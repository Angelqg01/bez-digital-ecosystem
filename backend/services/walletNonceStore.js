/**
 * Almacén de nonces SIWE: un solo uso y con caducidad.
 *
 * - Con Redis configurado (REDIS_URL/REDIS_HOST/REDIS_PORT) el nonce vive en Redis, de modo que
 *   emitirlo en una instancia y consumirlo en otra funciona, y el consumo es atómico (GET+DEL en MULTI).
 * - Sin Redis configurado se usa memoria del proceso (válido solo para una instancia).
 * - Con Redis configurado pero caído NO se cae a memoria (en multi-instancia rompería el un-solo-uso
 *   entre nodos): se responde 503.
 * - WALLET_AUTH_REQUIRE_REDIS=true exige Redis incluso si no está configurado.
 */
const redisService = require('./redis.service');

const PREFIX = 'siwe:nonce:';
const MAX_MEMORY = 10_000;

const memory = new Map(); // nonce -> { address, exp }
let warned = false;

const unavailable = () => Object.assign(new Error('Servicio de autenticación no disponible'), { status: 503 });
const redisConfigured = () => !!(process.env.REDIS_URL || process.env.REDIS_HOST || process.env.REDIS_PORT);

/** Devuelve un cliente Redis, null si se debe usar memoria; lanza 503 si Redis es obligatorio y no responde. */
async function client() {
    const required = process.env.WALLET_AUTH_REQUIRE_REDIS === 'true';
    if (!redisConfigured()) {
        if (required) throw unavailable();
        if (!warned && process.env.NODE_ENV === 'production') {
            warned = true;
            console.warn('⚠️ Nonces SIWE en memoria: con varias instancias configura REDIS_URL.');
        }
        return null;
    }
    let c = null;
    try { c = await redisService.getConnection(); } catch (_) { c = null; }
    if (!c) throw unavailable();
    return c;
}

function sweep(now = Date.now()) {
    for (const [n, v] of memory) if (v.exp < now) memory.delete(n);
    while (memory.size > MAX_MEMORY) memory.delete(memory.keys().next().value); // más antiguos primero
}

/** Guarda el nonce ligado a la dirección (minúsculas) durante ttlMs. */
async function put(nonce, address, ttlMs) {
    const c = await client();
    if (c) {
        try { await c.set(PREFIX + nonce, address, 'PX', ttlMs); } catch (_) { throw unavailable(); }
        return;
    }
    sweep();
    memory.set(nonce, { address, exp: Date.now() + ttlMs });
}

/** Consume el nonce (siempre lo elimina) y devuelve su dirección, o null si no existe/caducó. */
async function take(nonce) {
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9]{8,64}$/.test(nonce)) return null;
    const c = await client();
    if (c) {
        try {
            const res = await c.multi().get(PREFIX + nonce).del(PREFIX + nonce).exec();
            const [err, value] = (res && res[0]) || [null, null];
            return err ? null : (value || null);
        } catch (_) { throw unavailable(); }
    }
    const entry = memory.get(nonce);
    memory.delete(nonce);
    return entry && entry.exp >= Date.now() ? entry.address : null;
}

module.exports = { put, take, _memory: memory };
