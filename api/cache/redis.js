'use strict';

const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;
let connectPromise = null;

function buildClient() {
    const client = createClient({
        url: REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        },
    });

    client.on('error', (err) => {
        console.warn('[Redis] Client error:', err.message);
    });

    client.on('ready', () => {
        console.log('[Redis] Client ready');
    });

    return client;
}

async function connectRedis() {
    if (redisClient?.isOpen) return redisClient;
    if (connectPromise) return connectPromise;

    redisClient = redisClient || buildClient();
    connectPromise = redisClient.connect()
        .then(() => redisClient)
        .finally(() => {
            connectPromise = null;
        });

    return connectPromise;
}

async function cacheGet(key) {
    try {
        const client = await connectRedis();
        const value = await client.get(key);
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    } catch (err) {
        console.warn(`[Redis] cacheGet error for key ${key}:`, err.message);
        return null;
    }
}

async function cacheSet(key, value, ttlSeconds) {
    try {
        const client = await connectRedis();
        const strValue = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttlSeconds) {
            await client.set(key, strValue, { EX: ttlSeconds });
        } else {
            await client.set(key, strValue);
        }
        return true;
    } catch (err) {
        console.warn(`[Redis] cacheSet error for key ${key}:`, err.message);
        return false;
    }
}

async function publish(channel, message) {
    try {
        const client = await connectRedis();
        const strMessage = typeof message === 'string' ? message : JSON.stringify(message);
        await client.publish(channel, strMessage);
        return true;
    } catch (err) {
        console.warn(`[Redis] publish error on channel ${channel}:`, err.message);
        return false;
    }
}

/**
 * Invalida una clave de caché.
 *
 * Faltaba, y sin embargo cuatro servicios la importaban (walletService,
 * channelService, qrService, documentService). El efecto era peor que un
 * simple 500: la escritura en base de datos se completaba y ENTONCES reventaba
 * al invalidar la caché, así que el cliente recibía un error sobre una
 * operación que sí había ocurrido. Al reintentar se encontraba un conflicto de
 * duplicado — «ya firmado», «ya existe»— sin haber visto nunca un éxito.
 *
 * Igual que cacheGet/cacheSet, no propaga el fallo: una caché que no se puede
 * invalidar es un problema de rendimiento, no de corrección, y no debe tumbar
 * una operación ya confirmada.
 */
async function cacheDelete(key) {
    try {
        const client = await connectRedis();
        await client.del(key);
        return true;
    } catch (err) {
        console.warn(`[Redis] cacheDelete error for key ${key}:`, err.message);
        return false;
    }
}

/**
 * Contador de peticiones por ventana fija. Devuelve si la petición cabe.
 *
 * Faltaba, y la importaban dos sitios: `enterpriseRateLimit` en
 * middleware/security.js y el limitador del login de administrador en
 * routes/admin-auth.js. Al ser `undefined`, la llamada lanzaba un TypeError
 * dentro de un middleware async y, en Express 4, un rechazo async no llega al
 * manejador de errores: la petición se quedaba colgada sin respuesta hasta que
 * el cliente desistía. Es decir, POST /api/admin-auth/login no fallaba — no
 * contestaba nunca.
 *
 * Ventana fija con INCR + EXPIRE, no deslizante: para "5 intentos cada 15
 * minutos" la diferencia es irrelevante y el coste es una operación por
 * petición en vez de un sorted set que hay que podar.
 *
 * Si Redis no responde, DEJA PASAR. Es una decisión deliberada: fallar cerrado
 * dejaría al administrador fuera de su propio panel justo durante una
 * incidencia de infraestructura, y el limitador global en memoria de
 * express-rate-limit (index.js) sigue de red de seguridad frente a la fuerza
 * bruta. Se avisa por consola para que no pase inadvertido.
 */
async function checkRateLimit(key, limit, windowSec) {
    try {
        const client = await connectRedis();
        const redisKey = `ratelimit:${key}`;
        const count = await client.incr(redisKey);
        // Sólo al crear la clave: renovar el TTL en cada intento convertiría la
        // ventana en deslizante-por-actividad y quien insistiera sin parar
        // nunca vería expirar su bloqueo.
        if (count === 1) await client.expire(redisKey, windowSec);

        const ttl = await client.ttl(redisKey);
        return {
            allowed: count <= limit,
            count,
            limit,
            remaining: Math.max(0, limit - count),
            resetInSec: ttl >= 0 ? ttl : windowSec,
        };
    } catch (err) {
        console.warn(`[Redis] checkRateLimit no disponible para ${key} (se deja pasar):`, err.message);
        return { allowed: true, count: 0, limit, remaining: limit, resetInSec: windowSec, degraded: true };
    }
}

module.exports = {
    connectRedis,
    cacheGet,
    cacheSet,
    cacheDelete,
    checkRateLimit,
    publish,
    get redisClient() {
        redisClient = redisClient || buildClient();
        return redisClient;
    },
};
