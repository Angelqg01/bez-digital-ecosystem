/**
 * plan-limits — límite por minuto por api-key y cupo mensual de acciones de IA en el
 * gateway REST. El recuento del cupo se prueba en services/aiActionQuota.test.js; aquí,
 * qué hace el middleware con lo que el cupo responde.
 */
const request = require('supertest');
const express = require('express');
const { mockCheckRateLimit, mockCupoReservar, mockCupoAnular, mockQuery, mockCupoConsumo } = require('../helpers');
const { AiQuotaError } = require('../../services/aiActionQuota');
const { getEntitlements } = require('../../config/plan-entitlements');
const { limitePorMinutoApi, cupoMensual } = require('../../middleware/plan-limits');

function construir({ app = { id: 'app-1', scopes: ['wallet'] }, plan = 'starter', estado = 200 } = {}) {
    // app: null = petición con JWT de usuario, sin api-key.
    const srv = express();
    srv.use((req, _res, next) => {
        req.registeredApp = app;
        req.plan = plan;
        req.entitlements = getEntitlements(plan);
        next();
    });
    srv.use(limitePorMinutoApi, cupoMensual);
    srv.all('/accion', (_req, res) => res.status(estado).json({ ok: estado < 400 }));
    return srv;
}

const agotado = () => new AiQuotaError({ plan: 'starter', limit: 150, used: 150 });

beforeEach(() => {
    mockCupoReservar.mockReset().mockResolvedValue({ appId: 'app-1', plan: 'starter', used: 7, limit: 150 });
    mockCupoAnular.mockReset().mockResolvedValue(undefined);
    mockCheckRateLimit.mockReset().mockResolvedValue({ allowed: true, count: 1, limit: 30, remaining: 29, resetInSec: 60 });
});

describe('cupo mensual de acciones de IA (REST)', () => {
    it('una escritura gasta una acción y lo dice en las cabeceras', async () => {
        const res = await request(construir()).post('/accion');
        expect(res.status).toBe(200);
        expect(mockCupoReservar).toHaveBeenCalledWith({ app: expect.objectContaining({ id: 'app-1' }), plan: 'starter' });
        expect(res.headers['x-ai-actions-used']).toBe('7');
        expect(res.headers['x-ai-actions-limit']).toBe('150');
        expect(mockCupoAnular).not.toHaveBeenCalled();
    });

    it.each(['put', 'patch', 'delete'])('%s también es escritura', async (metodo) => {
        await request(construir())[metodo]('/accion');
        expect(mockCupoReservar).toHaveBeenCalledTimes(1);
    });

    it('las lecturas no gastan cupo', async () => {
        const res = await request(construir()).get('/accion');
        expect(res.status).toBe(200);
        expect(mockCupoReservar).not.toHaveBeenCalled();
    });

    it('con el cupo agotado responde 402 sin ejecutar la ruta', async () => {
        mockCupoReservar.mockRejectedValue(agotado());
        const res = await request(construir()).post('/accion');
        expect(res.status).toBe(402);
        expect(res.body).toMatchObject({ code: 'QUOTA_EXCEEDED', plan: 'starter', limit: 150, used: 150, upgradeActionId: 'subscribe_plans' });
        expect(res.body.resetsAt).toMatch(/^\d{4}-\d{2}-01T00:00:00/);
        expect(res.body.ok).toBeUndefined();
    });

    it('si la ruta falla (4xx/5xx), la acción se devuelve', async () => {
        const reserva = { appId: 'app-1', plan: 'starter', used: 3, limit: 150 };
        mockCupoReservar.mockResolvedValue(reserva);
        const res = await request(construir({ estado: 422 })).post('/accion');
        expect(res.status).toBe(422);
        await new Promise((r) => setImmediate(r));
        expect(mockCupoAnular).toHaveBeenCalledWith(reserva);
    });

    it('si no se puede comprobar el cupo, la escritura no pasa (503)', async () => {
        mockCupoReservar.mockRejectedValue(new Error('connection reset'));
        const res = await request(construir()).post('/accion');
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('QUOTA_UNAVAILABLE');
    });

    it('las claves internas (scope admin) no gastan cupo', async () => {
        await request(construir({ app: { id: 'interna', scopes: ['admin'] } })).post('/accion');
        expect(mockCupoReservar).not.toHaveBeenCalled();
    });
});

describe('límite por minuto por api-key (REST)', () => {
    it('cuenta por id de la app, nunca por la api-key en claro', async () => {
        await request(construir()).get('/accion').set('x-api-key', 'bz_secreta');
        const claves = mockCheckRateLimit.mock.calls.map((c) => c[0]);
        expect(claves).toEqual([expect.stringContaining('app:app-1')]);
        expect(claves.join()).not.toContain('bz_secreta');
    });

    it.each([
        ['starter', 30], ['creator_pro', 120], ['business', 600], ['enterprise_vip', 1200],
    ])('%s: techo de %i por minuto', async (plan, techo) => {
        // El store devuelve cuántas lleva; quien decide es el techo del plan.
        mockCheckRateLimit.mockResolvedValueOnce({ count: techo, resetInSec: 60 });
        expect((await request(construir({ plan })).get('/accion')).status).toBe(200);
        mockCheckRateLimit.mockResolvedValueOnce({ count: techo + 1, resetInSec: 60 });
        expect((await request(construir({ plan })).get('/accion')).status).toBe(429);
    });

    it('por encima del techo del plan responde 429 PLAN_RATE_LIMIT', async () => {
        mockCheckRateLimit.mockResolvedValue({ allowed: false, count: 31, limit: 30, remaining: 0, resetInSec: 40 });
        const res = await request(construir()).post('/accion');
        expect(res.status).toBe(429);
        expect(res.body).toMatchObject({ code: 'PLAN_RATE_LIMIT', plan: 'starter' });
        expect(mockCupoReservar).not.toHaveBeenCalled();
    });

    it('sin api-key (JWT de usuario) no se aplica', async () => {
        await request(construir({ app: null })).post('/accion');
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
        expect(mockCupoReservar).not.toHaveBeenCalled();
    });
});

describe('montado en el gateway', () => {
    const gatewayRoutes = require('../../routes/gateway');
    const gw = express();
    gw.use(express.json());
    gw.use('/api/gateway/v1', gatewayRoutes);

    const fila = (plan) => ({
        rows: [{ id: 'app-9', app_name: 'cliente', scopes: ['staking', 'wallet'], tier: 'standard', is_active: true, plan_id: plan }],
    });

    beforeEach(() => {
        mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('una escritura con el cupo agotado da 402 antes de tocar la cadena', async () => {
        mockQuery.mockResolvedValueOnce(fila('creator_pro'));
        mockCupoReservar.mockRejectedValue(new AiQuotaError({ plan: 'creator_pro', limit: 1500, used: 1500 }));
        const res = await request(gw).post('/api/gateway/v1/staking/stake')
            .set('x-api-key', 'k').send({ amount: '10' });
        expect(res.status).toBe(402);
        expect(res.body).toMatchObject({ code: 'QUOTA_EXCEEDED', plan: 'creator_pro', limit: 1500 });
        expect(mockCupoReservar).toHaveBeenCalledWith(expect.objectContaining({ plan: 'creator_pro' }));
    });

    it('el plan sale de la misma consulta de la api-key (sin otra ida a la base)', async () => {
        mockQuery.mockResolvedValueOnce(fila('business'));
        mockCheckRateLimit.mockResolvedValueOnce({ count: 601, resetInSec: 60 });
        const res = await request(gw).post('/api/gateway/v1/staking/stake').set('x-api-key', 'k').send({ amount: '10' });
        const auth = String(mockQuery.mock.calls[0][0]);
        expect(auth).toMatch(/gateway_subscriptions[\s\S]*status = 'active'[\s\S]*AS plan_id/);
        // 601 > 600 del Business: se aplica el techo del plan leído en esa consulta.
        expect(res.status).toBe(429);
        expect(res.body.plan).toBe('business');
        expect(mockQuery.mock.calls.some((c) => /^\s*SELECT plan_id FROM gateway_subscriptions/.test(c[0]))).toBe(false);
    });

    it('gestionar la suscripción no gasta cupo aunque esté agotado', async () => {
        mockQuery.mockResolvedValueOnce(fila('starter'));
        mockCupoReservar.mockRejectedValue(agotado());
        const res = await request(gw).post('/api/gateway/v1/subscription/deactivate')
            .set('x-api-key', 'k').send({ subapp: 'pay' });
        expect(res.status).not.toBe(402);
        expect(mockCupoReservar).not.toHaveBeenCalled();
    });

    it('/subscription/usage informa del cupo del plan', async () => {
        mockQuery.mockResolvedValueOnce(fila('creator_pro'));
        mockQuery.mockResolvedValueOnce({ rows: [{ calls: 4, credits: 0, billable_eur: '0' }] });
        mockCupoConsumo.mockResolvedValueOnce({ used: 12, limit: 1500, resetsAt: '2026-11-01T00:00:00.000Z' });
        const res = await request(gw).get('/api/gateway/v1/subscription/usage').set('x-api-key', 'k');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ plan: 'creator_pro', aiActions: { used: 12, limit: 1500 } });
    });
});
