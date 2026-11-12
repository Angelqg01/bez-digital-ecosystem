/**
 * Integration tests — /api/ai-billing routes
 * Uses the same mock pattern as wallet.test.js, agents.test.js, etc.
 */
const request = require('supertest');
const { mockQuery, mockCacheGet, mockCacheSet, makeToken, mockContractService } = require('../helpers');

// ─── AI Billing service mock ────────────────────────────────────────
const mockBilling = {
    recordUsage: jest.fn(),
    getActiveSubscriptionTier: jest.fn().mockResolvedValue('free'),
    purchaseSubscription: jest.fn(),
    getUserInvoices: jest.fn().mockResolvedValue([]),
    payInvoice: jest.fn(),
    getUserStats: jest.fn().mockResolvedValue({
        total_requests: 0, total_input: 0, total_output: 0,
        total_api_cost: 0, total_commission: 0, total_discount: 0, total_spent: 0,
    }),
    usdToBez: jest.fn().mockResolvedValue('1000000000000000000'),
    getMonthlySpend: jest.fn().mockResolvedValue(0),
};
jest.mock('../../services/aiBillingService', () => mockBilling);
const mockPrincipal = jest.fn().mockResolvedValue({ plan: 'none' });
jest.mock('../../services/ai-workspace/principal', () => ({ resolverPrincipal: (...a) => mockPrincipal(...a) }));

const app = require('../../index');

const VALID_ADDR = '0x' + 'f'.repeat(40);

describe('Routes: /api/ai-billing', () => {
    beforeEach(() => jest.clearAllMocks());

    // ═══════════════════════════════════════════════
    //  PUBLIC ENDPOINTS
    // ═══════════════════════════════════════════════

    describe('GET /prices', () => {
        it('returns price catalogue without auth', async () => {
            const res = await request(app).get('/api/ai-billing/prices');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('claude');
            expect(res.body).toHaveProperty('gemini');
            expect(res.body).toHaveProperty('kimi');
            expect(res.body).toHaveProperty('ollama');
        });

        it('each provider has models array', async () => {
            const res = await request(app).get('/api/ai-billing/prices');
            for (const prov of Object.values(res.body)) {
                expect(prov).toHaveProperty('name');
                expect(Array.isArray(prov.models)).toBe(true);
            }
        });
    });

    describe('GET /subscriptions', () => {
        it('returns 4 subscription tiers', async () => {
            const res = await request(app).get('/api/ai-billing/subscriptions');
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(4);
            const ids = res.body.map(t => t.id);
            expect(ids).toEqual(expect.arrayContaining(['free', 'starter', 'professional', 'enterprise']));
        });
    });

    describe('POST /estimate', () => {
        it('returns invoice estimate for Claude', async () => {
            const res = await request(app)
                .post('/api/ai-billing/estimate')
                .send({ provider: 'claude', model: 'claude-4-opus', inputTokens: 10000, outputTokens: 5000 });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('apiCost');
            expect(res.body).toHaveProperty('commission');
            expect(res.body).toHaveProperty('totalCost');
            expect(res.body.commissionRate).toBe(0.30);
        });

        it('returns estimate with professional discount', async () => {
            const res = await request(app)
                .post('/api/ai-billing/estimate')
                .send({
                    provider: 'gemini', model: 'gemini-2.0-flash',
                    inputTokens: 100000, outputTokens: 50000,
                    subscriptionTier: 'professional',
                });
            expect(res.status).toBe(200);
            expect(res.body.discountPct).toBe(0.10);
            expect(res.body.discountAmount).toBeGreaterThan(0);
        });

        it('returns estimate for Ollama with exec time', async () => {
            const res = await request(app)
                .post('/api/ai-billing/estimate')
                .send({ provider: 'ollama', model: 'llama3', inputTokens: 1, outputTokens: 1, execSeconds: 3600 });
            expect(res.status).toBe(200);
            expect(res.body.apiCost).toBeGreaterThan(0);
        });

        it('returns 400 for invalid provider', async () => {
            const res = await request(app)
                .post('/api/ai-billing/estimate')
                .send({ provider: 'openai', model: 'gpt-4', inputTokens: 1000, outputTokens: 500 });
            expect(res.status).toBe(400);
        });

        it('returns 400 for missing fields', async () => {
            const res = await request(app)
                .post('/api/ai-billing/estimate')
                .send({ provider: 'claude' });
            expect(res.status).toBe(400);
        });

        it('returns 400 for unknown model', async () => {
            const res = await request(app)
                .post('/api/ai-billing/estimate')
                .send({ provider: 'claude', model: 'nonexistent', inputTokens: 1000, outputTokens: 500 });
            expect(res.status).toBe(400);
        });
    });

    // ═══════════════════════════════════════════════
    //  AUTHENTICATED ENDPOINTS
    // ═══════════════════════════════════════════════

    describe('POST /record-usage (retirada)', () => {
        it('responde 410 y no toca el servicio, aunque el cuerpo sea válido', async () => {
            const res = await request(app)
                .post('/api/ai-billing/record-usage')
                .set('Authorization', `Bearer ${makeToken()}`)
                .send({ enterpriseAddress: VALID_ADDR, provider: 'claude', model: 'claude-4-opus', inputTokens: 1000, outputTokens: 500 });
            expect(res.status).toBe(410);
            expect(res.body.code).toBe('AI_BILLING_RETIRED');
            expect(mockBilling.recordUsage).not.toHaveBeenCalled();
        });

        it('returns 401 without token', async () => {
            const res = await request(app).post('/api/ai-billing/record-usage').send({ enterpriseAddress: VALID_ADDR, provider: 'claude', model: 'claude-4-opus', inputTokens: 1000, outputTokens: 500 });
            expect(res.status).toBe(401);
        });
    });

    describe('GET /invoices', () => {
        it('returns empty invoices list', async () => {
            const token = makeToken();
            mockBilling.getUserInvoices.mockResolvedValueOnce([]);
            const res = await request(app)
                .get('/api/ai-billing/invoices')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.invoices).toHaveLength(0);
        });

        it('returns invoices filtered by status', async () => {
            const token = makeToken();
            const fakeInvoice = { id: 1, status: 'paid', amount_usd: 0.05 };
            mockBilling.getUserInvoices.mockResolvedValueOnce([fakeInvoice]);
            const res = await request(app)
                .get('/api/ai-billing/invoices?status=paid')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.invoices).toHaveLength(1);
            expect(mockBilling.getUserInvoices).toHaveBeenCalledWith(expect.anything(), 'paid');
        });

        it('returns 401 without auth', async () => {
            const res = await request(app).get('/api/ai-billing/invoices');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /pay-invoice (retirada)', () => {
        it('responde 410 y no toca el servicio, aunque el cuerpo sea válido', async () => {
            const res = await request(app)
                .post('/api/ai-billing/pay-invoice')
                .set('Authorization', `Bearer ${makeToken()}`)
                .send({ invoiceId: 1, enterpriseAddress: VALID_ADDR });
            expect(res.status).toBe(410);
            expect(res.body.code).toBe('AI_BILLING_RETIRED');
            expect(mockBilling.payInvoice).not.toHaveBeenCalled();
        });

        it('returns 401 without token', async () => {
            const res = await request(app).post('/api/ai-billing/pay-invoice').send({ invoiceId: 1, enterpriseAddress: VALID_ADDR });
            expect(res.status).toBe(401);
        });
    });

    describe('GET /stats', () => {
        it('returns usage stats', async () => {
            const token = makeToken();
            const res = await request(app)
                .get('/api/ai-billing/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('total_requests');
            expect(res.body).toHaveProperty('total_spent');
        });
    });

    describe('GET /subscription', () => {
        it('una fila antigua de ai_subscriptions ya no eleva el nivel: nadie verificó ese cobro', async () => {
            const token = makeToken();
            mockBilling.getActiveSubscriptionTier.mockResolvedValueOnce('professional');
            const res = await request(app)
                .get('/api/ai-billing/subscription')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.tier).toBe('free');
            expect(mockBilling.getActiveSubscriptionTier).not.toHaveBeenCalled();
        });

        it('resuelve el plan de la organización para un usuario con id UUID (sin tocar ai_subscriptions)', async () => {
            mockPrincipal.mockResolvedValueOnce({ plan: 'business' });
            const token = makeToken({ userId: '4d13de02-8cac-49ab-8574-c59e62f98542' });
            const res = await request(app).get('/api/ai-billing/subscription').set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.tier).toBe('professional');
            expect(mockBilling.getActiveSubscriptionTier).not.toHaveBeenCalled();
        });

        it('Enterprise VIP → enterprise y sin plan → free', async () => {
            mockPrincipal.mockResolvedValueOnce({ plan: 'enterprise_vip' });
            const uuid = '4d13de02-8cac-49ab-8574-c59e62f98542';
            let res = await request(app).get('/api/ai-billing/subscription').set('Authorization', `Bearer ${makeToken({ userId: uuid })}`);
            expect(res.body.tier).toBe('enterprise');
            res = await request(app).get('/api/ai-billing/subscription').set('Authorization', `Bearer ${makeToken({ userId: uuid })}`);
            expect(res.body.tier).toBe('free');
        });
    });

    describe('POST /subscribe (retirada)', () => {
        it('responde 410 y no toca el servicio, aunque el cuerpo sea válido', async () => {
            const res = await request(app)
                .post('/api/ai-billing/subscribe')
                .set('Authorization', `Bearer ${makeToken()}`)
                .send({ tier: 'enterprise' });
            expect(res.status).toBe(410);
            expect(res.body.code).toBe('AI_BILLING_RETIRED');
            expect(mockBilling.purchaseSubscription).not.toHaveBeenCalled();
        });

        it('returns 401 without token', async () => {
            const res = await request(app).post('/api/ai-billing/subscribe').send({ tier: 'enterprise' });
            expect(res.status).toBe(401);
        });
    });
});
