'use strict';

// Con Redis inaccesible, node-redis no rechaza: reintenta para siempre. Sin un
// plazo por operación, checkRateLimit nunca resolvía y POST /api/admin-auth/login
// se quedaba sin respuesta. Estos tests fijan que se deja pasar y que responde.
describe('cache/redis — plazo con Redis inaccesible', () => {
    let redis;

    beforeAll(() => {
        process.env.REDIS_URL = 'redis://127.0.0.1:6399';
        process.env.REDIS_OP_TIMEOUT_MS = '300';
        jest.resetModules();
        redis = require('../../cache/redis');
    });

    afterAll(async () => {
        // El cliente reintenta la conexión para siempre y mantendría vivo el
        // proceso de Jest.
        try { await redis.redisClient.disconnect(); } catch { /* ya cerrado */ }
    });

    test('checkRateLimit contesta y deja pasar (degraded)', async () => {
        const res = await redis.checkRateLimit('test', 5, 900);
        expect(res.allowed).toBe(true);
        expect(res.degraded).toBe(true);
    }, 5000);

    test('cacheGet devuelve null y cacheSet false, sin colgarse', async () => {
        expect(await redis.cacheGet('k')).toBeNull();
        expect(await redis.cacheSet('k', 'v', 5)).toBe(false);
    }, 5000);
});
