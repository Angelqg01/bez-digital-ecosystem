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

module.exports = {
    connectRedis,
    cacheGet,
    cacheSet,
    publish,
    get redisClient() {
        redisClient = redisClient || buildClient();
        return redisClient;
    },
};
