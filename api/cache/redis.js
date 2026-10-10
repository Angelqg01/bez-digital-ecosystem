'use strict';

const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * En producción, sin REDIS_URL no hay Redis: no se intenta conectar a
 * localhost, que en Cloud Run no existe y solo producía un reintento cada
 * pocos segundos en el log. connectRedis() rechaza y cada llamador aplica su
 * plan B (caché en memoria, dejar pasar, 'down'). En desarrollo se mantiene
 * el localhost de siempre.
 */
const REDIS_CONFIGURADO = Boolean(process.env.REDIS_URL) || process.env.NODE_ENV !== 'production';

let redisClient = null;
let connectPromise = null;

function buildClient() {
    const client = createClient({
        url: REDIS_URL,
        // Sin esto, mientras Redis no está disponible cada comando se encola a
        // la espera de una conexión que puede no llegar nunca: cacheGet, el
        // limitador del login y /api/health se quedaban colgados en vez de
        // degradar como está previsto. Así fallan al momento y cada llamador
        // aplica su plan B (null, dejar pasar, 'down').
        disableOfflineQueue: true,
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
    if (!REDIS_CONFIGURADO) throw new Error('Redis no configurado (REDIS_URL vacío)');
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


// Plazo por operación. Con Redis inaccesible, `connect()` de node-redis NO
// rechaza —reintenta para siempre según reconnectStrategy— y los comandos sobre
// un cliente "abierto" pero desconectado se encolan sin límite. Sin un plazo,
// cualquier `await` a Redis queda colgado, y con él la petición que lo espera:
// POST /api/admin-auth/login (limitador de intentos) dejaba de contestar y el
// panel de administración se quedaba cargando. Pasado el plazo se rechaza, y
// cada llamante aplica su política (caché: ignorar; rate limit: dejar pasar).
const REDIS_OP_TIMEOUT_MS = Number(process.env.REDIS_OP_TIMEOUT_MS) || 1500;

function withDeadline(promise, label = 'op') {
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`Redis no responde (${label}, ${REDIS_OP_TIMEOUT_MS} ms)`)),
            REDIS_OP_TIMEOUT_MS
        );
        timer.unref?.();
    });
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

// Tras un fallo por plazo, las llamadas siguientes fallan al instante durante
// unos segundos en vez de esperar 1,5 s cada una: con Redis caído, cada login
// sumaría ese retraso. Pasado el enfriamiento se vuelve a intentar.
const REDIS_COOLDOWN_MS = 10_000;
let redisDownUntil = 0;

/** Ejecuta `fn(client)` con el cliente conectado, todo bajo un único plazo. */
async function redisOp(label, fn) {
    if (Date.now() < redisDownUntil) {
        throw new Error(`Redis no disponible (${label}, en enfriamiento)`);
    }
    try {
        return await withDeadline((async () => fn(await connectRedis()))(), label);
    } catch (err) {
        if (/no responde/.test(err.message)) redisDownUntil = Date.now() + REDIS_COOLDOWN_MS;
        throw err;
    }
}

async function cacheGet(key) {
    if (!REDIS_CONFIGURADO) return null;
    try {
        const value = await redisOp('get', (client) => client.get(key));
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
    if (!REDIS_CONFIGURADO) return false;
    try {
        const strValue = typeof value === 'string' ? value : JSON.stringify(value);
        await redisOp('set', (client) => ttlSeconds
            ? client.set(key, strValue, { EX: ttlSeconds })
            : client.set(key, strValue));
        return true;
    } catch (err) {
        console.warn(`[Redis] cacheSet error for key ${key}:`, err.message);
        return false;
    }
}

async function publish(channel, message) {
    if (!REDIS_CONFIGURADO) return false;
    try {
        const strMessage = typeof message === 'string' ? message : JSON.stringify(message);
        await redisOp('publish', (client) => client.publish(channel, strMessage));
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
    if (!REDIS_CONFIGURADO) return false;
    try {
        await redisOp('del', (client) => client.del(key));
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
    // Sin Redis, el mismo «deja pasar» que cuando Redis no responde (ver
    // arriba), pero sin un aviso por petición: ya se avisó al arrancar.
    if (!REDIS_CONFIGURADO) return { allowed: true, count: 0, limit, remaining: limit, resetInSec: windowSec, degraded: true };
    try {
        const redisKey = `ratelimit:${key}`;
        // Todo el INCR + EXPIRE + TTL bajo un solo plazo: si Redis no contesta,
        // se cae al catch y se deja pasar en vez de colgar la petición.
        const { count, ttl } = await redisOp('ratelimit', async (client) => {
            const count = await client.incr(redisKey);
            // Sólo al crear la clave: renovar el TTL en cada intento convertiría la
            // ventana en deslizante-por-actividad y quien insistiera sin parar
            // nunca vería expirar su bloqueo.
            if (count === 1) await client.expire(redisKey, windowSec);
            return { count, ttl: await client.ttl(redisKey) };
        });
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
        if (!REDIS_CONFIGURADO) return null;
        redisClient = redisClient || buildClient();
        return redisClient;
    },
    REDIS_CONFIGURADO,
};
