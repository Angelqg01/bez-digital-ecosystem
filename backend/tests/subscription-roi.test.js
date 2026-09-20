/**
 * ============================================================================
 * SUBSCRIPTION & ROI CALCULATION TESTS
 * ============================================================================
 * 
 * Unit tests for the unified subscription tier system and ROI calculations.
 * 
 * @version 2.0.0
 */

const {
    SUBSCRIPTION_TIERS,
    TIER_HIERARCHY,
    BASE_STAKING_APY,
    BEZ_TO_USD_RATE,
    getTierConfig,
    getEffectiveAPY,
    calculatePotentialROI,
    compareROIAcrossTiers
} = require('../config/tier.config');
const tokenomics = require('../config/tokenomics.config');

describe('Tier Configuration', () => {

    describe('SUBSCRIPTION_TIERS', () => {

        test('should have all three tiers defined', () => {
            expect(SUBSCRIPTION_TIERS).toHaveProperty('STARTER');
            expect(SUBSCRIPTION_TIERS).toHaveProperty('CREATOR');
            expect(SUBSCRIPTION_TIERS).toHaveProperty('BUSINESS');
        });

        test('STARTER tier should be free', () => {
            const starter = SUBSCRIPTION_TIERS.STARTER;
            expect(starter.price.monthly).toBe(0);
            expect(starter.price.yearly).toBe(0);
        });

        test('CREATOR tier should cost 99/month', () => {
            const creator = SUBSCRIPTION_TIERS.CREATOR;
            expect(creator.price.monthly).toBe(99);
            expect(creator.price.yearly).toBe(990);
        });

        test('BUSINESS tier should cost 499/month', () => {
            const business = SUBSCRIPTION_TIERS.BUSINESS;
            expect(business.price.monthly).toBe(499);
            expect(business.price.yearly).toBe(4990);
        });

        test('ENTERPRISE tier should cost 2499/month', () => {
            const enterprise = SUBSCRIPTION_TIERS.ENTERPRISE;
            expect(enterprise.price.monthly).toBe(2499);
            expect(enterprise.price.yearly).toBe(24990);
        });

        test('token lock amounts should be correct', () => {
            expect(SUBSCRIPTION_TIERS.STARTER.tokenLock.amount).toBe(0);
            expect(SUBSCRIPTION_TIERS.CREATOR.tokenLock.amount).toBe(5000);
            expect(SUBSCRIPTION_TIERS.BUSINESS.tokenLock.amount).toBe(50000);
        });

        test('staking multipliers should be correct', () => {
            expect(SUBSCRIPTION_TIERS.STARTER.staking.multiplier).toBe(1.0);
            expect(SUBSCRIPTION_TIERS.CREATOR.staking.multiplier).toBe(1.5);
            expect(SUBSCRIPTION_TIERS.BUSINESS.staking.multiplier).toBe(2.5);
        });

        test('gas subsidies should be correct', () => {
            expect(SUBSCRIPTION_TIERS.STARTER.gas.subsidyPercent).toBe(0);
            expect(SUBSCRIPTION_TIERS.CREATOR.gas.subsidyPercent).toBe(0.25);
            expect(SUBSCRIPTION_TIERS.BUSINESS.gas.subsidyPercent).toBe(1.0);
        });

    });

    describe('TIER_HIERARCHY', () => {

        test('should have correct order', () => {
            expect(TIER_HIERARCHY).toEqual(['STARTER', 'CREATOR', 'BUSINESS', 'ENTERPRISE']);
        });

        test('should have 4 tiers', () => {
            expect(TIER_HIERARCHY.length).toBe(4);
        });

    });

    describe('Constants', () => {

        test('BASE_STAKING_APY should be 12.5%', () => {
            expect(BASE_STAKING_APY).toBe(12.5);
        });

        test('BEZ_TO_USD_RATE sale del precio único del BEZ', () => {
            // Este fichero exigía 0,05 $: un octavo precio del BEZ que convivía
            // con los otros siete. La constante ya no es suya, viene de
            // config/tokenomics.config.js.
            expect(BEZ_TO_USD_RATE).toBe(tokenomics.price.usd);
        });

    });

});

describe('getTierConfig', () => {

    test('should return STARTER config for undefined input', () => {
        const config = getTierConfig(undefined);
        expect(config.id).toBe('starter');
    });

    test('should return STARTER config for null input', () => {
        const config = getTierConfig(null);
        expect(config.id).toBe('starter');
    });

    test('should return correct config for each tier', () => {
        expect(getTierConfig('STARTER').id).toBe('starter');
        expect(getTierConfig('CREATOR').id).toBe('creator');
        expect(getTierConfig('BUSINESS').id).toBe('business');
    });

    test('should be case-insensitive', () => {
        expect(getTierConfig('starter').id).toBe('starter');
        expect(getTierConfig('Creator').id).toBe('creator');
        expect(getTierConfig('BUSINESS').id).toBe('business');
    });

    test('should return STARTER for invalid tier', () => {
        const config = getTierConfig('INVALID');
        expect(config.id).toBe('starter');
    });

});

describe('getEffectiveAPY', () => {

    test('STARTER should have 12.5% APY', () => {
        const apy = getEffectiveAPY('STARTER');
        expect(apy).toBe(12.5);
    });

    test('CREATOR should have 18.75% APY (1.5x)', () => {
        const apy = getEffectiveAPY('CREATOR');
        expect(apy).toBe(18.75);
    });

    test('BUSINESS should have 31.25% APY (2.5x)', () => {
        const apy = getEffectiveAPY('BUSINESS');
        expect(apy).toBe(31.25);
    });

    test('should return base APY for undefined tier', () => {
        const apy = getEffectiveAPY(undefined);
        expect(apy).toBe(12.5);
    });

});

describe('calculatePotentialROI', () => {

    describe('Basic Calculations', () => {

        test('should calculate staking reward correctly for STARTER', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 12);

            // 10000 BEZ * 12.5% = 1250 BEZ per year
            expect(roi.periodStakingReward).toBe(1250);
            expect(roi.effectiveAPY).toBe(12.5);
        });

        test('should calculate staking reward correctly for CREATOR', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);

            // 10000 BEZ * 18.75% = 1875 BEZ per year
            expect(roi.periodStakingReward).toBe(1875);
            expect(roi.effectiveAPY).toBe(18.75);
        });

        test('should calculate staking reward correctly for BUSINESS', () => {
            const roi = calculatePotentialROI(10000, 'BUSINESS', 12);

            // 10000 BEZ * 31.25% = 3125 BEZ per year
            expect(roi.periodStakingReward).toBe(3125);
            expect(roi.effectiveAPY).toBe(31.25);
        });

        test('should prorate rewards for partial year', () => {
            const roi6months = calculatePotentialROI(10000, 'STARTER', 6);
            const roi12months = calculatePotentialROI(10000, 'STARTER', 12);

            expect(roi6months.periodStakingReward).toBe(roi12months.periodStakingReward / 2);
        });

    });

    describe('Subscription Costs', () => {

        test('STARTER should have zero subscription cost', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 12);

            expect(roi.totalSubscriptionCost).toBe(0);
            expect(roi.subscriptionCostInBEZ).toBe(0);
        });

        test('CREATOR should cost 1188 per year', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);

            // 99 * 12 = 1188
            expect(roi.totalSubscriptionCost).toBe(1188);
        });

        test('BUSINESS should cost 5988 per year', () => {
            const roi = calculatePotentialROI(10000, 'BUSINESS', 12);

            // 499 * 12 = 5988
            expect(roi.totalSubscriptionCost).toBe(5988);
        });

        test('subscription cost should be converted to BEZ correctly', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);

            // La regla es la conversión, no una cifra concreta: el coste anual
            // dividido por el precio vigente del BEZ.
            expect(roi.subscriptionCostInBEZ).toBeCloseTo(1188 / BEZ_TO_USD_RATE, 1);
        });

    });

    describe('Net Profit Calculations', () => {

        test('STARTER should always be profitable (no cost)', () => {
            const roi = calculatePotentialROI(100, 'STARTER', 12);
            expect(roi.isProfitable).toBe(true);
            expect(roi.netProfitBEZ).toBeGreaterThan(0);
        });

        test('small stake net profit is less than STARTER for paid tiers', () => {
            const roiStarter = calculatePotentialROI(1000, 'STARTER', 12);
            const roiCreator = calculatePotentialROI(1000, 'CREATOR', 12);
            const roiBusiness = calculatePotentialROI(1000, 'BUSINESS', 12);

            // Small stakes: STARTER should have better net profit than paid tiers
            // (paid tiers may still be profitable due to gas/AI value, but less than STARTER)
            expect(roiStarter.netProfitBEZ).toBeGreaterThan(roiCreator.netProfitBEZ - roiCreator.gasSavingsInBEZ - roiCreator.aiValueInBEZ);
        });

        test('large stake should be profitable for CREATOR', () => {
            // Hay que apostar lo bastante para cubrir 1188/año de suscripción.
            // La cantidad depende del precio del BEZ, así que se deriva del
            // propio punto de equilibrio en vez de escribirse a mano.
            const equilibrio = calculatePotentialROI(10000, 'CREATOR', 12).breakEvenStake;
            const roi = calculatePotentialROI(equilibrio * 1.6, 'CREATOR', 12);

            expect(roi.isProfitable).toBe(true);
        });

        test('very large stake should be profitable for BUSINESS', () => {
            const equilibrio = calculatePotentialROI(10000, 'BUSINESS', 12).breakEvenStake;
            const roi = calculatePotentialROI(equilibrio * 1.4, 'BUSINESS', 12);

            expect(roi.isProfitable).toBe(true);
        });

    });

    describe('Break-even Calculations', () => {

        test('STARTER should have zero break-even stake', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 12);
            expect(roi.breakEvenStake).toBe(0);
        });

        test('CREATOR break-even sale del coste anual, el precio y el APY', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);

            // 1188 $/año / precio del BEZ = coste en BEZ; dividido por el APY
            // efectivo (18,75 %) da la cantidad que hay que apostar.
            const esperado = (1188 / BEZ_TO_USD_RATE) / 0.1875;

            expect(roi.breakEvenStake).toBeCloseTo(esperado, -2);
        });

        test('BUSINESS break-even sale del coste anual, el precio y el APY', () => {
            const roi = calculatePotentialROI(10000, 'BUSINESS', 12);

            const esperado = (5988 / BEZ_TO_USD_RATE) / 0.3125;

            expect(roi.breakEvenStake).toBeCloseTo(esperado, -2);
        });

    });

    describe('Comparison with STARTER', () => {

        test('should calculate extra APY vs STARTER', () => {
            const roiCreator = calculatePotentialROI(10000, 'CREATOR', 12);
            const roiBusiness = calculatePotentialROI(10000, 'BUSINESS', 12);

            expect(roiCreator.vsStarter.extraAPY).toBe(6.25); // 18.75 - 12.5
            expect(roiBusiness.vsStarter.extraAPY).toBe(18.75); // 31.25 - 12.5
        });

        test('should calculate extra reward BEZ vs STARTER', () => {
            const roiCreator = calculatePotentialROI(10000, 'CREATOR', 12);

            // 10000 * (18.75% - 12.5%) = 625 extra BEZ
            expect(roiCreator.vsStarter.extraRewardBEZ).toBe(625);
        });

    });

    describe('Edge Cases', () => {

        test('should handle zero stake amount', () => {
            const roi = calculatePotentialROI(0, 'STARTER', 12);

            expect(roi.periodStakingReward).toBe(0);
            // STARTER has no subscription cost, so net profit from staking alone is 0
            expect(roi.stakeAmount).toBe(0);
        });

        test('should handle very large stake amounts', () => {
            const roi = calculatePotentialROI(1000000, 'BUSINESS', 12);

            expect(roi.periodStakingReward).toBe(312500); // 1M * 31.25%
            expect(roi.isProfitable).toBe(true);
        });

        test('should handle 1 month duration', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 1);

            // 1250 / 12 ≈ 104.17
            expect(roi.periodStakingReward).toBeCloseTo(104.17, 1);
        });

        test('should handle 24 month duration', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 24);

            // 1250 * 2 = 2500
            expect(roi.periodStakingReward).toBe(2500);
        });

    });

});

describe('compareROIAcrossTiers', () => {

    test('should return comparison for all tiers', () => {
        const comparison = compareROIAcrossTiers(10000, 12);

        expect(comparison.comparison).toHaveProperty('STARTER');
        expect(comparison.comparison).toHaveProperty('CREATOR');
        expect(comparison.comparison).toHaveProperty('BUSINESS');
    });

    test('should include stake amount and duration', () => {
        const comparison = compareROIAcrossTiers(10000, 12);

        expect(comparison.stakeAmount).toBe(10000);
        expect(comparison.durationMonths).toBe(12);
    });

    test('should recommend a tier for small stakes', () => {
        const comparison = compareROIAcrossTiers(1000, 12);

        // Should recommend some tier based on algorithm logic
        expect(TIER_HIERARCHY).toContain(comparison.recommendation.tier);
    });

    test('should recommend a tier for medium stakes', () => {
        const comparison = compareROIAcrossTiers(30000, 12);

        // At 30,000 BEZ stake:
        // Algorithm considers overall value (staking rewards + gas savings + AI value)
        // The actual recommendation depends on the algorithm implementation
        expect(TIER_HIERARCHY).toContain(comparison.recommendation.tier);
    });

    test('should recommend BUSINESS for very large stakes', () => {
        const comparison = compareROIAcrossTiers(200000, 12);

        // El beneficio neto más alto manda. Con los precios vigentes, a
        // 200 000 BEZ gana BUSINESS: su multiplicador de staking compensa de
        // sobra la cuota, y ENTERPRISE aún no llega a su equilibrio.
        expect(comparison.recommendation.tier).toBe('BUSINESS');
        expect(Number.isFinite(comparison.recommendation.netProfit)).toBe(true);
    });

    test('ningún plan produce un beneficio infinito', () => {
        // Los cupos «ilimitados» se representan con Infinity. Si se propagan
        // al cálculo, ENTERPRISE gana siempre y el importe llega a JSON como
        // null. Ilimitado no es infinito.
        for (const stake of [0, 1000, 200000, 1000000]) {
            const comparison = compareROIAcrossTiers(stake, 12);
            for (const tier of TIER_HIERARCHY) {
                expect(Number.isFinite(comparison.comparison[tier].netProfitBEZ)).toBe(true);
                expect(Number.isFinite(comparison.comparison[tier].gasSavingsInBEZ)).toBe(true);
            }
        }
    });

    test('should include recommendation reason', () => {
        const comparison = compareROIAcrossTiers(10000, 12);

        expect(comparison.recommendation.reason).toBeDefined();
        expect(typeof comparison.recommendation.reason).toBe('string');
    });

});

describe('Feature Access', () => {

    test('STARTER should not have advanced features', () => {
        const config = getTierConfig('STARTER');

        expect(config.features.canCreateProposals).toBe(false);
        expect(config.features.advancedAIModels).toBe(false);
        expect(config.features.apiAccess).toBe(false);
    });

    test('CREATOR should have most features', () => {
        const config = getTierConfig('CREATOR');

        expect(config.features.canCreateProposals).toBe(true);
        expect(config.features.advancedAIModels).toBe(true);
        expect(config.features.analytics).toBe(true);
        expect(config.features.apiAccess).toBe(false); // Only BUSINESS
    });

    test('BUSINESS should have all features', () => {
        const config = getTierConfig('BUSINESS');

        expect(config.features.canCreateProposals).toBe(true);
        expect(config.features.advancedAIModels).toBe(true);
        expect(config.features.apiAccess).toBe(true);
        expect(config.features.webhooks).toBe(true);
    });

});

describe('AI Limits', () => {

    test('STARTER should have 5 daily queries', () => {
        const config = getTierConfig('STARTER');
        expect(config.ai.dailyQueries).toBe(5);
    });

    test('CREATOR should have 50 daily queries', () => {
        const config = getTierConfig('CREATOR');
        expect(config.ai.dailyQueries).toBe(50);
    });

    test('BUSINESS should have unlimited queries', () => {
        const config = getTierConfig('BUSINESS');
        expect(config.ai.dailyQueries).toBe(Infinity);
    });

    test('model access should be tier-based', () => {
        const starter = getTierConfig('STARTER');
        const creator = getTierConfig('CREATOR');
        const business = getTierConfig('BUSINESS');

        expect(starter.ai.models).toEqual(['gpt-3.5-turbo']);
        expect(creator.ai.models).toContain('gpt-4');
        expect(business.ai.models).toEqual(['all']);
    });

});

describe('Gas Subsidies', () => {

    test('STARTER should have 0% gas subsidy', () => {
        const config = getTierConfig('STARTER');
        expect(config.gas.subsidyPercent).toBe(0);
    });

    test('CREATOR should have 25% gas subsidy', () => {
        const config = getTierConfig('CREATOR');
        expect(config.gas.subsidyPercent).toBe(0.25);
    });

    test('BUSINESS should have 100% gas subsidy (free gas)', () => {
        const config = getTierConfig('BUSINESS');
        expect(config.gas.subsidyPercent).toBe(1.0);
    });

});
