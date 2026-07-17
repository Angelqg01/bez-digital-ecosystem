/**
 * gateway-metering — mide uso API-SDK solo para apps en plan Starter,
 * solo en respuestas 2xx, y de forma perezosa (lee req.registeredApp en
 * res.on('finish'), no antes) para funcionar como router.use() global
 * colocado ANTES de authenticateGateway en la cadena de cada ruta.
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const mockRecordUsage = jest.fn().mockResolvedValue({ credits: 1, reported: true });
jest.mock('../../services/usageBilling', () => ({
    recordUsage: (...args) => mockRecordUsage(...args),
}));

const { meterUsage, _clearPlanCacheForTests } = require('../../middleware/gateway-metering');

function buildApp({ plan } = {}) {
    const app = express();
    // meterUsage se registra ANTES del middleware que puebla req.registeredApp,
    // igual que en gateway.js (router.use(meterUsage(...)) antes de las rutas).
    app.use(meterUsage('api_call'));
    app.use((req, res, next) => {
        req.registeredApp = { id: 42 };
        next();
    });
    app.get('/ok', (req, res) => res.json({ ok: true }));
    app.get('/fail', (req, res) => res.status(500).json({ ok: false }));
    return app;
}

// isStarterApp() hace SELECT plan_id FROM gateway_subscriptions.
const mockPlanRow = (planId) =>
    planId === undefined
        ? { rows: [], rowCount: 0 }
        : { rows: [{ plan_id: planId }], rowCount: 1 };

describe('gateway-metering', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockRecordUsage.mockClear();
        _clearPlanCacheForTests();
    });

    it('factura una petición 2xx de una app en Starter', async () => {
        mockQuery.mockResolvedValueOnce(mockPlanRow('starter'));
        const app = buildApp();
        await request(app).get('/ok').expect(200);
        // res.on('finish') es asíncrono — dar un tick para que corra.
        await new Promise((r) => setImmediate(r));
        expect(mockRecordUsage).toHaveBeenCalledWith(42, { action: 'api_call', ref: undefined });
    });

    it('sin fila en gateway_subscriptions también se factura (Starter es el default)', async () => {
        mockQuery.mockResolvedValueOnce(mockPlanRow(undefined));
        const app = buildApp();
        await request(app).get('/ok').expect(200);
        await new Promise((r) => setImmediate(r));
        expect(mockRecordUsage).toHaveBeenCalled();
    });

    it('NO factura apps en planes de pago fijo (business, creator_pro, enterprise_vip)', async () => {
        mockQuery.mockResolvedValueOnce(mockPlanRow('business'));
        const app = buildApp();
        await request(app).get('/ok').expect(200);
        await new Promise((r) => setImmediate(r));
        expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it('NO factura respuestas de error (>=400)', async () => {
        mockQuery.mockResolvedValueOnce(mockPlanRow('starter'));
        const app = buildApp();
        await request(app).get('/fail').expect(500);
        await new Promise((r) => setImmediate(r));
        expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it('no revienta la petición si falla la consulta del plan (fail-open)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('db down'));
        const app = buildApp();
        const res = await request(app).get('/ok');
        expect(res.status).toBe(200); // la respuesta al cliente no se ve afectada
        await new Promise((r) => setImmediate(r));
        expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it('no mide peticiones sin req.registeredApp (SSO, internal-key, público)', async () => {
        mockQuery.mockResolvedValueOnce(mockPlanRow('starter'));
        const app = express();
        app.use(meterUsage('api_call')); // sin middleware que ponga registeredApp
        app.get('/ok', (req, res) => res.json({ ok: true }));
        await request(app).get('/ok').expect(200);
        await new Promise((r) => setImmediate(r));
        expect(mockRecordUsage).not.toHaveBeenCalled();
    });
});
