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

    describe('POST /record-usage', () => {
        it('records usage for authenticated user', async () => {
            const token = makeToken();
            const fakeInvoice = { apiCost: 0.028, commission: 0.0084, totalCost: 0.0364 };
            mockBilling.recordUsage.mockResolvedValueOnce({ usageId: 42, invoice: fakeInvoice });

            const res = await request(app)
                .post('/api/ai-billing/record-usage')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    enterpriseAddress: VALID_ADDR,
                    provider: 'claude',
                    model: 'claude-3-5-haiku',
                    inputTokens: 10000,
                    outputTokens: 5000,
                });
            expect(res.status).toBe(200);
            expect(res.body.usageId).toBe(42);
            expect(res.body.invoice.totalCost).toBe(0.0364);
        });

        it('returns 401 without token', async () => {
            const res = await request(app)
                .post('/api/ai-billing/record-usage')
                .send({ enterpriseAddress: VALID_ADDR, provider: 'claude', model: 'claude-4-opus', inputTokens: 1000, outputTokens: 500 });
            expect(res.status).toBe(401);
        });

        it('returns 400 for invalid enterprise address', async () => {
            const token = makeToken();
            const res = await request(app)
                .post('/api/ai-billing/record-usage')
                .set('Authorization', `Bearer ${token}`)
                .send({ enterpriseAddress: 'not-an-address', provider: 'claude', model: 'claude-4-opus', inputTokens: 1000, outputTokens: 500 });
            expect(res.status).toBe(400);
        });

        it('returns 400 when monthly limit exceeded', async () => {
            const token = makeToken();
            mockBilling.recordUsage.mockRejectedValueOnce(new Error('Monthly limit exceeded'));
            const res = await request(app)
                .post('/api/ai-billing/record-usage')
                .set('Authorization', `Bearer ${token}`)
                .send({ enterpriseAddress: VALID_ADDR, provider: 'claude', model: 'claude-4-opus', inputTokens: 1000, outputTokens: 500 });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Monthly limit');
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

    describe('POST /pay-invoice', () => {
        it('pays an invoice', async () => {
            const token = makeToken();
            mockBilling.payInvoice.mockResolvedValueOnce({ invoiceId: 1, amountBez: '1000', status: 'paid' });
            const res = await request(app)
                .post('/api/ai-billing/pay-invoice')
                .set('Authorization', `Bearer ${token}`)
                .send({ invoiceId: 1, enterpriseAddress: VALID_ADDR });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('paid');
        });

        it('returns 400 for invalid invoiceId', async () => {
            const token = makeToken();
            const res = await request(app)
                .post('/api/ai-billing/pay-invoice')
                .set('Authorization', `Bearer ${token}`)
                .send({ invoiceId: -1, enterpriseAddress: VALID_ADDR });
            expect(res.status).toBe(400);
        });

        it('returns 400 when invoice not found', async () => {
            const token = makeToken();
            mockBilling.payInvoice.mockRejectedValueOnce(new Error('Invoice not found or already paid'));
            const res = await request(app)
                .post('/api/ai-billing/pay-invoice')
                .set('Authorization', `Bearer ${token}`)
                .send({ invoiceId: 999, enterpriseAddress: VALID_ADDR });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invoice not found');
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
        it('returns current subscription', async () => {
            const token = makeToken();
            mockBilling.getActiveSubscriptionTier.mockResolvedValueOnce('professional');
            const res = await request(app)
                .get('/api/ai-billing/subscription')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.tier).toBe('professional');
            expect(res.body.discount).toBe(0.10);
        });
    });

    describe('POST /subscribe', () => {
        it('purchases a subscription', async () => {
            const token = makeToken();
            mockBilling.purchaseSubscription.mockResolvedValueOnce({
                subscriptionId: 7, tier: 'enterprise', priceUSD: 299.99, discount: '15%',
            });
            const res = await request(app)
                .post('/api/ai-billing/subscribe')
                .set('Authorization', `Bearer ${token}`)
                .send({ tier: 'enterprise' });
            expect(res.status).toBe(200);
            expect(res.body.tier).toBe('enterprise');
            expect(res.body.priceUSD).toBe(299.99);
        });

        it('returns 400 for invalid tier', async () => {
            const token = makeToken();
            const res = await request(app)
                .post('/api/ai-billing/subscribe')
                .set('Authorization', `Bearer ${token}`)
                .send({ tier: 'platinum' });
            expect(res.status).toBe(400);
        });
    });
});
