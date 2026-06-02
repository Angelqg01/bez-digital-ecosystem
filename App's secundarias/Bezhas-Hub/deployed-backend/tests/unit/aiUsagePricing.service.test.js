const {
    calculateOpenAICostUsd,
    calculateBezCharge,
    estimateAIUsageCharge
} = require('../../services/aiUsagePricing.service');

describe('aiUsagePricing.service', () => {
    it('calculates OpenAI token cost with cached input tokens', () => {
        const cost = calculateOpenAICostUsd(
            {
                inputTokens: 1_000_000,
                cachedInputTokens: 250_000,
                outputTokens: 100_000
            },
            {
                inputUsdPer1M: 1,
                cachedInputUsdPer1M: 0.25,
                outputUsdPer1M: 4
            }
        );

        expect(cost).toBe(1.2125);
    });

    it('turns real API cost into BEZ charge with risk, margin and VAT', () => {
        const charge = calculateBezCharge({
            openaiCostUsd: 1,
            usdEur: 1,
            infraMultiplier: 1.25,
            marginMultiplier: 2,
            vatRate: 0.21,
            bezEurRate: 0.05
        });

        expect(charge.grossEur).toBe(3.03);
        expect(charge.chargedBez).toBe(60.5);
        expect(charge.marginEur).toBeGreaterThan(0);
    });

    it('estimates a full GPT charge in BEZ-Coin credits', () => {
        const estimate = estimateAIUsageCharge({
            model: 'gpt-4o-mini',
            usage: {
                inputTokens: 10_000,
                cachedInputTokens: 2_000,
                outputTokens: 1_000
            },
            usdEur: 1,
            infraMultiplier: 1.25,
            marginMultiplier: 2,
            vatRate: 0.21,
            bezEurRate: 0.05
        });

        expect(estimate.provider).toBe('openai');
        expect(estimate.model).toBe('gpt-4o-mini');
        expect(estimate.openaiCostUsd).toBeGreaterThan(0);
        expect(estimate.chargedBez).toBeGreaterThan(0);
        expect(estimate.usage.cachedInputTokens).toBe(2000);
    });
});
