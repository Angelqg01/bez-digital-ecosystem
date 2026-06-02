/**
 * Unit tests — aiPricingService (pure functions, no mocks needed)
 */
const pricing = require('../../services/aiPricingService');

describe('aiPricingService', () => {

    // ── resolveModel ───────────────────────────────────────────────
    describe('resolveModel()', () => {
        it('resolves valid provider + model', () => {
            const { providerMeta, modelMeta } = pricing.resolveModel('claude', 'claude-4-opus');
            expect(providerMeta.name).toContain('Claude');
            expect(modelMeta.inputPer1M).toBe(15);
        });

        it('throws for unknown provider', () => {
            expect(() => pricing.resolveModel('openai', 'gpt-4')).toThrow('Unsupported provider');
        });

        it('throws for unknown model', () => {
            expect(() => pricing.resolveModel('claude', 'nonexistent')).toThrow('Unsupported model');
        });
    });

    // ── calculateAPICost ───────────────────────────────────────────
    describe('calculateAPICost()', () => {
        it('calculates Claude cost correctly', () => {
            // claude-4-opus: $15/1M input, $75/1M output
            // 10K input = 10000/1e6 * 15   = 0.15
            // 5K output = 5000/1e6  * 75   = 0.375
            // total = 0.525
            const cost = pricing.calculateAPICost('claude', 'claude-4-opus', 10000, 5000);
            expect(cost).toBeCloseTo(0.525, 4);
        });

        it('calculates Gemini flash cost correctly', () => {
            // gemini-2.0-flash: $0.075/1M input, $0.30/1M output
            // 1M input  = 0.075
            // 500K output = 0.15
            const cost = pricing.calculateAPICost('gemini', 'gemini-2.0-flash', 1000000, 500000);
            expect(cost).toBeCloseTo(0.225, 4);
        });

        it('calculates Kimi cost correctly', () => {
            // moonshot-v1-128k: $0.060/1M both
            const cost = pricing.calculateAPICost('kimi', 'moonshot-v1-128k', 100000, 50000);
            expect(cost).toBeCloseTo(0.009, 4);
        });

        it('returns 0 for Ollama with no exec time', () => {
            const cost = pricing.calculateAPICost('ollama', 'llama3', 10000, 5000, 0);
            expect(cost).toBe(0);
        });

        it('adds compute cost for Ollama with exec time', () => {
            // llama3 computePerHour = 0.50
            // 3600s = 1h → $0.50
            const cost = pricing.calculateAPICost('ollama', 'llama3', 0, 0, 3600);
            expect(cost).toBeCloseTo(0.50, 4);
        });

        it('returns 0 for zero tokens', () => {
            const cost = pricing.calculateAPICost('gemini', 'gemini-2.0-flash', 0, 0);
            expect(cost).toBe(0);
        });
    });

    // ── calculateInvoice ───────────────────────────────────────────
    describe('calculateInvoice()', () => {
        it('applies 30 % commission on free tier', () => {
            const inv = pricing.calculateInvoice('claude', 'claude-3-5-haiku', 10000, 5000, 'free');
            // haiku: $0.80/1M in, $4.00/1M out
            // api = 10000/1e6*0.8 + 5000/1e6*4.0 = 0.008 + 0.02 = 0.028
            expect(inv.apiCost).toBeCloseTo(0.028, 4);
            expect(inv.commission).toBeCloseTo(0.028 * 0.30, 4);
            expect(inv.subtotal).toBeCloseTo(0.028 * 1.30, 4);
            // no discount
            expect(inv.discountAmount).toBe(0);
            expect(inv.totalCost).toBeCloseTo(0.028 * 1.30, 4);
        });

        it('applies 5 % starter discount', () => {
            const inv = pricing.calculateInvoice('gemini', 'gemini-1.5-pro', 100000, 50000, 'starter');
            // api = 100000/1e6*1.25 + 50000/1e6*5.0 = 0.125 + 0.25 = 0.375
            const sub = 0.375 * 1.30;
            expect(inv.subtotal).toBeCloseTo(sub, 4);
            expect(inv.discountPct).toBe(0.05);
            expect(inv.totalCost).toBeCloseTo(sub * 0.95, 4);
        });

        it('applies 10 % professional discount', () => {
            const inv = pricing.calculateInvoice('kimi', 'moonshot-v1-8k', 1000000, 500000, 'professional');
            const apiCost = 1e6 / 1e6 * 0.012 + 500000 / 1e6 * 0.012;
            const sub = apiCost * 1.30;
            expect(inv.totalCost).toBeCloseTo(sub * 0.90, 4);
        });

        it('applies 15 % enterprise discount (max)', () => {
            const inv = pricing.calculateInvoice('claude', 'claude-4-sonnet', 50000, 20000, 'enterprise');
            // api = 50000/1e6*3 + 20000/1e6*15 = 0.15 + 0.30 = 0.45
            const sub = 0.45 * 1.30;
            expect(inv.totalCost).toBeCloseTo(sub * 0.85, 4);
        });

        it('includes Ollama compute in total', () => {
            const inv = pricing.calculateInvoice('ollama', 'mistral', 0, 0, 'free', 1800);
            // compute = 1800/3600 * 0.75 = 0.375
            expect(inv.apiCost).toBeCloseTo(0.375, 4);
            expect(inv.commission).toBeCloseTo(0.375 * 0.30, 4);
        });

        it('returns all expected fields', () => {
            const inv = pricing.calculateInvoice('claude', 'claude-4-opus', 1000, 1000, 'free');
            expect(inv).toHaveProperty('provider', 'claude');
            expect(inv).toHaveProperty('model', 'claude-4-opus');
            expect(inv).toHaveProperty('inputTokens', 1000);
            expect(inv).toHaveProperty('outputTokens', 1000);
            expect(inv).toHaveProperty('apiCost');
            expect(inv).toHaveProperty('commissionRate', 0.30);
            expect(inv).toHaveProperty('commission');
            expect(inv).toHaveProperty('subtotal');
            expect(inv).toHaveProperty('subscriptionTier', 'free');
            expect(inv).toHaveProperty('discountPct');
            expect(inv).toHaveProperty('discountAmount');
            expect(inv).toHaveProperty('totalCost');
            expect(inv).toHaveProperty('currency', 'USD');
            expect(inv).toHaveProperty('timestamp');
        });

        it('handles unknown tier gracefully (no discount)', () => {
            const inv = pricing.calculateInvoice('claude', 'claude-4-opus', 1000, 1000, 'vip');
            expect(inv.discountPct).toBe(0);
            expect(inv.discountAmount).toBe(0);
        });
    });

    // ── getPriceCatalogue ──────────────────────────────────────────
    describe('getPriceCatalogue()', () => {
        it('returns all 4 providers', () => {
            const cat = pricing.getPriceCatalogue();
            expect(Object.keys(cat)).toEqual(expect.arrayContaining(['claude', 'gemini', 'kimi', 'ollama']));
        });

        it('each provider has models array', () => {
            const cat = pricing.getPriceCatalogue();
            for (const prov of Object.values(cat)) {
                expect(prov).toHaveProperty('name');
                expect(Array.isArray(prov.models)).toBe(true);
                expect(prov.models.length).toBeGreaterThan(0);
            }
        });

        it('ollama models include computePerHour', () => {
            const cat = pricing.getPriceCatalogue();
            const ollamaModels = cat.ollama.models;
            for (const m of ollamaModels) {
                expect(m).toHaveProperty('computePerHour');
            }
        });
    });

    // ── getSubscriptionTiers ───────────────────────────────────────
    describe('getSubscriptionTiers()', () => {
        it('returns 4 tiers', () => {
            const tiers = pricing.getSubscriptionTiers();
            expect(tiers).toHaveLength(4);
        });

        it('enterprise has 15% discount', () => {
            const tiers = pricing.getSubscriptionTiers();
            const ent = tiers.find(t => t.id === 'enterprise');
            expect(ent.discount).toBe(0.15);
            expect(ent.discountPct).toBe('15%');
        });

        it('free tier has 0 discount and 0 price', () => {
            const tiers = pricing.getSubscriptionTiers();
            const free = tiers.find(t => t.id === 'free');
            expect(free.discount).toBe(0);
            expect(free.priceUSD).toBe(0);
        });
    });

    // ── COMMISSION_RATE constant ──────────────────────────────────
    describe('COMMISSION_RATE', () => {
        it('is 30 %', () => {
            expect(pricing.COMMISSION_RATE).toBe(0.30);
        });
    });
});
