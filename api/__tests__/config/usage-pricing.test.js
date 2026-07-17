const {
    calculateCallCost, MARGIN_RATE, EUR_PER_CREDIT, STARTER_TRIAL_DAYS,
} = require('../../config/usage-pricing');

describe('usage-pricing (Starter pago por uso)', () => {
    test('trial es de 15 días', () => {
        expect(STARTER_TRIAL_DAYS).toBe(15);
    });

    test('llamada API sin LLM cobra solo cómputo +25%', () => {
        const c = calculateCallCost({ action: 'api_call' });
        expect(c.claudeCostEUR).toBe(0);
        expect(c.rawCostEUR).toBeCloseTo(0.0008, 6);
        expect(c.billableEUR).toBeCloseTo(0.0008 * 1.25, 6);
        expect(c.credits).toBe(1); // 0.001 EUR → 1 crédito (ceil)
    });

    test('acción IA con tokens de Opus 4.8 incluye coste Claude', () => {
        const c = calculateCallCost({
            model: 'claude-opus-4-8', inputTokens: 10_000, outputTokens: 2_000, action: 'ai_action',
        });
        // Claude: (0.01*5 + 0.002*25) USD = 0.1 USD
        expect(c.claudeCostEUR).toBeGreaterThan(0.08);
        expect(c.billableEUR).toBeCloseTo(c.rawCostEUR * (1 + MARGIN_RATE), 6);
        expect(c.credits).toBe(Math.ceil(c.billableEUR / EUR_PER_CREDIT));
        expect(c.credits).toBeGreaterThan(100);
    });

    test('los créditos nunca son 0 (mínimo 1, redondeo hacia arriba)', () => {
        const c = calculateCallCost({ action: 'webhook_delivery' });
        expect(c.credits).toBeGreaterThanOrEqual(1);
    });

    test('acción desconocida usa coste default', () => {
        const c = calculateCallCost({ action: 'algo_raro' });
        expect(c.computeCostEUR).toBe(0.001);
    });
});
