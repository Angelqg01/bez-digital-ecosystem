/**
 * Gateway subscription endpoints — plan, quote, activate/deactivate.
 * These back the @bezhas/connect SDK subscription module
 * (packages/connect/src/subscription.js + registry.js).
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const API_KEY = 'test-gateway-key';
const APP_ROW = { id: 7, app_name: 'test-app', scopes: ['wallet'], tier: 'business', is_active: true };

// First mockQuery call in every authenticated request is the app_registry lookup.
const mockAppAuth = () => mockQuery.mockResolvedValueOnce({ rows: [APP_ROW], rowCount: 1 });

describe('Gateway subscription', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('GET /api/gateway/v1/subscription', () => {
        it('rejects without API key (JWT-only has no app identity)', async () => {
            const res = await request(app).get('/api/gateway/v1/subscription');
            expect(res.status).toBe(401);
        });

        it('returns starter defaults when no subscription row exists', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // gateway_subscriptions
            const res = await request(app)
                .get('/api/gateway/v1/subscription')
                .set('x-api-key', API_KEY);
            expect(res.status).toBe(200);
            expect(res.body.plan).toBe('starter');
            expect(res.body.subapps).toEqual(expect.arrayContaining(['hub', 'wallet']));
            expect(res.body.status).toBe('active');
        });

        it('returns stored plan + core∪addons subapps', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({
                rows: [{ plan_id: 'business', subapps: ['pay', 'energy'], status: 'active', renews_at: null }],
                rowCount: 1,
            });
            const res = await request(app)
                .get('/api/gateway/v1/subscription')
                .set('x-api-key', API_KEY);
            expect(res.status).toBe(200);
            expect(res.body.plan).toBe('business');
            expect(res.body.subapps.sort()).toEqual(['energy', 'hub', 'pay', 'wallet']);
            expect(res.body.addons.sort()).toEqual(['energy', 'pay']);
        });
    });

    describe('GET /api/gateway/v1/subscription/quote', () => {
        it('quotes a plan with the canonical calculation (creator_pro monthly)', async () => {
            mockAppAuth();
            const res = await request(app)
                .get('/api/gateway/v1/subscription/quote?plan=creator_pro')
                .set('x-api-key', API_KEY);
            expect(res.status).toBe(200);
            expect(res.body.base).toBe(99);
            expect(res.body.iva).toBe(20.79);
            expect(res.body.total).toBe(119.79);
        });

        it('applies the −20% BEZ discount and annual pricing', async () => {
            mockAppAuth();
            const res = await request(app)
                .get('/api/gateway/v1/subscription/quote?plan=business&annual=1&payWithBez=1')
                .set('x-api-key', API_KEY);
            expect(res.status).toBe(200);
            expect(res.body.base).toBe(4990);
            expect(res.body.bezDiscount).toBe(998);
            expect(res.body.subtotal).toBe(3992);
            expect(res.body.total).toBe(4830.32);
        });

        it('404s on unknown plan, 400s on unknown addon', async () => {
            mockAppAuth();
            const bad = await request(app)
                .get('/api/gateway/v1/subscription/quote?plan=gold')
                .set('x-api-key', API_KEY);
            expect(bad.status).toBe(404);

            mockAppAuth();
            const badAddon = await request(app)
                .get('/api/gateway/v1/subscription/quote?plan=starter&addons=pay,notasubapp')
                .set('x-api-key', API_KEY);
            expect(badAddon.status).toBe(400);
            expect(badAddon.body.error).toMatch(/notasubapp/);
        });
    });

    describe('POST /api/gateway/v1/subscription/activate', () => {
        it('activates a SubApp and persists the union', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({ rows: [{ plan_id: 'starter', subapps: ['pay'], status: 'active', renews_at: null }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // upsert
            const res = await request(app)
                .post('/api/gateway/v1/subscription/activate')
                .set('x-api-key', API_KEY)
                .send({ subapp: 'energy' });
            expect(res.status).toBe(200);
            expect(res.body.subapps).toEqual(expect.arrayContaining(['pay', 'energy', 'hub', 'wallet']));
            const upsert = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO gateway_subscriptions'));
            expect(upsert[1][0]).toBe(APP_ROW.id);
            expect(JSON.parse(upsert[1][1]).sort()).toEqual(['energy', 'pay']);
        });

        it('is a no-op for core SubApps and 404s unknown ones', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const core = await request(app)
                .post('/api/gateway/v1/subscription/activate')
                .set('x-api-key', API_KEY)
                .send({ subapp: 'wallet' });
            expect(core.status).toBe(200);
            expect(core.body.alreadyIncluded).toBe(true);

            mockAppAuth();
            const unknown = await request(app)
                .post('/api/gateway/v1/subscription/activate')
                .set('x-api-key', API_KEY)
                .send({ subapp: 'nope' });
            expect(unknown.status).toBe(404);
        });
    });

    describe('POST /api/gateway/v1/subscription/deactivate', () => {
        it('removes an addon', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({ rows: [{ plan_id: 'starter', subapps: ['pay', 'energy'], status: 'active', renews_at: null }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // upsert
            const res = await request(app)
                .post('/api/gateway/v1/subscription/deactivate')
                .set('x-api-key', API_KEY)
                .send({ subapp: 'pay' });
            expect(res.status).toBe(200);
            expect(res.body.subapps).not.toContain('pay');
            expect(res.body.subapps).toEqual(expect.arrayContaining(['energy', 'hub', 'wallet']));
        });

        it('refuses to deactivate core SubApps', async () => {
            mockAppAuth();
            const res = await request(app)
                .post('/api/gateway/v1/subscription/deactivate')
                .set('x-api-key', API_KEY)
                .send({ subapp: 'hub' });
            expect(res.status).toBe(400);
        });
    });
});
