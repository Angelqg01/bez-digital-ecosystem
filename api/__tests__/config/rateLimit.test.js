/**
 * Limitador global de la API.
 *
 * Regresiones que cubre este archivo:
 *  - agrupar por `x-api-key` sin validarla permitía esquivar el límite
 *    cambiando la cabecera en cada petición;
 *  - los webhooks firmados (Stripe, banco) caían en el mismo límite por IP;
 *  - 100 peticiones / 15 min dejaba en 429 a un cliente con el panel abierto.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const request = require('supertest');
const { globalLimiterOptions, MAX_PRODUCCION } = require('../../config/rateLimit');

function appCon(opts) {
    const app = express();
    app.use(rateLimit(globalLimiterOptions(opts)));
    app.all('*', (_req, res) => res.json({ ok: true }));
    return app;
}

describe('globalLimiterOptions', () => {
    it('en producción admite 1000 peticiones por ventana salvo que RATE_LIMIT_MAX diga otra cosa', () => {
        expect(globalLimiterOptions({ isProduction: true, env: {} }).max).toBe(MAX_PRODUCCION);
        expect(globalLimiterOptions({ isProduction: true, env: { RATE_LIMIT_MAX: '250' } }).max).toBe(250);
    });

    it('no define keyGenerator: agrupa solo por IP', () => {
        expect(globalLimiterOptions({ isProduction: true, env: {} }).keyGenerator).toBeUndefined();
    });
});

describe('limitador global en una app', () => {
    const prod = { isProduction: true, env: { RATE_LIMIT_MAX: '2' } };

    it('cambiar x-api-key en cada petición NO da un cubo nuevo', async () => {
        const app = appCon(prod);
        await request(app).get('/api/x').set('x-api-key', 'a').expect(200);
        await request(app).get('/api/x').set('x-api-key', 'b').expect(200);
        await request(app).get('/api/x').set('x-api-key', 'c').expect(429);
    });

    it('los webhooks firmados no consumen ni respetan el límite por IP', async () => {
        const app = appCon(prod);
        for (let i = 0; i < 5; i++) {
            await request(app).post('/api/webhooks/stripe').expect(200);
        }
        await request(app).get('/api/x').expect(200);
    });

    it('el War Room sigue fuera (tiene su propio limitador)', async () => {
        const app = appCon(prod);
        for (let i = 0; i < 5; i++) {
            await request(app).get('/api/monitor/status').expect(200);
        }
    });
});
