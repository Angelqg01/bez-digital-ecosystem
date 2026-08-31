/**
 * subapp-entitlement — la puerta de servidor que hace exigible el contrato de
 * suscripción. Hasta ahora los entitlements solo se comprobaban en el SDK, lo
 * que dejaba la puerta abierta a cualquiera con curl.
 *
 * Lo que se fija aquí: sin API key no se pasa, sin la SubApp activada no se
 * pasa, con la suscripción caída no se pasa, y — lo importante — si la base de
 * datos falla NO se pasa (fail-closed): dar acceso "por si acaso" ante un
 * error de infraestructura sería regalar un servicio de pago.
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const { requireSubApp, _clearCacheForTests } = require('../../middleware/subapp-entitlement');

function buildApp({ withApp = true } = {}) {
    const app = express();
    app.use((req, _res, next) => {
        if (withApp) req.registeredApp = { id: 'app-1', name: 'test' };
        next();
    });
    app.get('/x', requireSubApp('operant'), (req, res) =>
        res.json({ ok: true, plan: req.subscription.plan })
    );
    return app;
}

const subRow = (plan, subapps, status = 'active') => ({
    rows: [{ plan_id: plan, subapps, status }],
    rowCount: 1,
});

describe('requireSubApp', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        _clearCacheForTests();
    });

    test('sin API key devuelve 401 y dice qué falta', async () => {
        const res = await request(buildApp({ withApp: false })).get('/x');
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/x-api-key/);
    });

    test('con la SubApp activada deja pasar y expone el plan a la ruta', async () => {
        mockQuery.mockResolvedValueOnce(subRow('business', ['operant', 'pay']));
        const res = await request(buildApp()).get('/x');
        expect(res.status).toBe(200);
        expect(res.body.plan).toBe('business');
    });

    test('sin la SubApp activada devuelve 403 y explica cómo activarla', async () => {
        mockQuery.mockResolvedValueOnce(subRow('business', ['pay']));
        const res = await request(buildApp()).get('/x');
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('SUBAPP_NOT_ACTIVATED');
        expect(res.body.activate).toMatch(/subscription\/activate/);
    });

    test('las SubApps del core nunca se gatean', async () => {
        mockQuery.mockResolvedValueOnce(subRow('starter', []));
        const app = express();
        app.use((req, _res, next) => { req.registeredApp = { id: 'app-1' }; next(); });
        app.get('/w', requireSubApp('wallet'), (_req, res) => res.json({ ok: true }));
        const res = await request(app).get('/w');
        expect(res.status).toBe(200);
    });

    test('una suscripción no activa devuelve 402, no 403', async () => {
        mockQuery.mockResolvedValueOnce(subRow('business', ['operant'], 'past_due'));
        const res = await request(buildApp()).get('/x');
        expect(res.status).toBe(402);
        expect(res.body.status).toBe('past_due');
    });

    test('sin fila de suscripción se asume Starter sin addons (no acceso)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(buildApp()).get('/x');
        expect(res.status).toBe(403);
        expect(res.body.plan).toBe('starter');
    });

    test('si la DB falla NO se sirve: fail-closed', async () => {
        mockQuery.mockRejectedValueOnce(new Error('conexión perdida'));
        const res = await request(buildApp()).get('/x');
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/verificar la suscripción/);
    });

    test('la caché evita una consulta por petición', async () => {
        mockQuery.mockResolvedValue(subRow('business', ['operant']));
        const app = buildApp();
        await request(app).get('/x');
        await request(app).get('/x');
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });
});
