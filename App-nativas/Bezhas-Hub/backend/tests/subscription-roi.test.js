/**
 * ============================================================================
 * SUBSCRIPTION & ROI CALCULATION TESTS
 * ============================================================================
 *
 * Reescrito por completo: la versión anterior probaba un sistema de 3 tiers
 * en USD (Creator $14.99, Business $99.99) que ya no existe. El sistema real
 * tiene 4 tiers en EUR (Starter/Creator/Business/Enterprise), reconciliados
 * contra config/plans.js — "FUENTE ÚNICA Y DEFINITIVA de planes de
 * suscripción", basada en los PDFs de precios aprobados. Cada número de aquí
 * sale de ejecutar tier.config.js de verdad, no de una tabla aparte.
 *
 * @version 3.0.0
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

describe('Tier Configuration', () => {

    describe('SUBSCRIPTION_TIERS', () => {

        test('should have los 4 tiers reales definidos', () => {
            expect(SUBSCRIPTION_TIERS).toHaveProperty('STARTER');
            expect(SUBSCRIPTION_TIERS).toHaveProperty('CREATOR');
            expect(SUBSCRIPTION_TIERS).toHaveProperty('BUSINESS');
            expect(SUBSCRIPTION_TIERS).toHaveProperty('ENTERPRISE');
        });

        test('STARTER tier should be free', () => {
            const starter = SUBSCRIPTION_TIERS.STARTER;
            expect(starter.price.monthly).toBe(0);
            expect(starter.price.yearly).toBe(0);
        });

        // Precios en EUR — config/plans.js l.35-73, no USD como antes.
        test('CREATOR tier should cost €99/month', () => {
            const creator = SUBSCRIPTION_TIERS.CREATOR;
            expect(creator.price.monthly).toBe(99);
            expect(creator.price.yearly).toBe(990);
            expect(creator.price.currency).toBe('EUR');
        });

        test('BUSINESS tier should cost €499/month', () => {
            const business = SUBSCRIPTION_TIERS.BUSINESS;
            expect(business.price.monthly).toBe(499);
            expect(business.price.yearly).toBe(4990);
            expect(business.price.currency).toBe('EUR');
        });

        test('ENTERPRISE tier should cost €2499/month', () => {
            const enterprise = SUBSCRIPTION_TIERS.ENTERPRISE;
            expect(enterprise.price.monthly).toBe(2499);
            expect(enterprise.price.yearly).toBe(24990);
            expect(enterprise.price.currency).toBe('EUR');
        });

        test('token lock amounts should be correct', () => {
            expect(SUBSCRIPTION_TIERS.STARTER.tokenLock.amount).toBe(0);
            expect(SUBSCRIPTION_TIERS.CREATOR.tokenLock.amount).toBe(5000);
            expect(SUBSCRIPTION_TIERS.BUSINESS.tokenLock.amount).toBe(50000);
            expect(SUBSCRIPTION_TIERS.ENTERPRISE.tokenLock.amount).toBe(100000);
        });

        // Multiplicadores corregidos contra config/plans.js (apy: 12.5/18.75/25/31.25,
        // l.21,37,52,73) — la vuelta anterior traía Business en 2.5x y Enterprise
        // en 3.5x, ninguno de los dos respaldado por el PDF de precios aprobado.
        test('staking multipliers should match config/plans.js', () => {
            expect(SUBSCRIPTION_TIERS.STARTER.staking.multiplier).toBe(1.0);
            expect(SUBSCRIPTION_TIERS.CREATOR.staking.multiplier).toBe(1.5);
            expect(SUBSCRIPTION_TIERS.BUSINESS.staking.multiplier).toBe(2.0);
            expect(SUBSCRIPTION_TIERS.ENTERPRISE.staking.multiplier).toBe(2.5);
        });

        test('gas subsidies should match config/plans.js', () => {
            expect(SUBSCRIPTION_TIERS.STARTER.gas.subsidyPercent).toBe(0);
            expect(SUBSCRIPTION_TIERS.CREATOR.gas.subsidyPercent).toBe(0.25);
            expect(SUBSCRIPTION_TIERS.BUSINESS.gas.subsidyPercent).toBe(0.5);
            expect(SUBSCRIPTION_TIERS.ENTERPRISE.gas.subsidyPercent).toBe(1.0);
        });

        // El campo estático effectiveAPY (usado por BeVIP.jsx, useSubscription.js)
        // debe coincidir siempre con multiplier × BASE_STAKING_APY — el bug real
        // que se corrigió era exactamente esta desincronización.
        test('effectiveAPY estático debe coincidir con el multiplicador, para cada tier', () => {
            for (const key of TIER_HIERARCHY) {
                const tier = SUBSCRIPTION_TIERS[key];
                expect(tier.staking.effectiveAPY).toBe(BASE_STAKING_APY * tier.staking.multiplier);
            }
        });

        // El bug real: ningún límite de gasto puede quedar en Infinity sin que
        // alguien lo haya decidido a propósito — config/plans.js no define un
        // concepto de "presupuesto mensual", así que Infinity no tiene respaldo.
        test('ningún tier de pago debe tener presupuesto de gas o stake sin tope', () => {
            for (const key of ['CREATOR', 'BUSINESS', 'ENTERPRISE']) {
                const tier = SUBSCRIPTION_TIERS[key];
                expect(Number.isFinite(tier.gas.monthlySubsidyBudget)).toBe(true);
                expect(Number.isFinite(tier.gas.maxSubsidyPerTx)).toBe(true);
                expect(Number.isFinite(tier.staking.maxStakeAmount)).toBe(true);
            }
        });

    });

    describe('TIER_HIERARCHY', () => {

        test('should have correct order, incluido ENTERPRISE', () => {
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

        // ⚠️ Guarda de regresión, no una afirmación de que 0.05 esté bien.
        // bezpay.service.js usa BEZ_PRICE_USD=1.24 en todo el resto del
        // sistema — esta constante sigue 20x por debajo, sin unificar. Ver
        // el informe de rentabilidad de suscripciones. Si esto cambia sin
        // querer, este test debe fallar y avisar; si cambia a propósito
        // (unificación), hay que revisar también los tests de ROI de abajo,
        // que dependen de este valor.
        test('BEZ_TO_USD_RATE sigue en 0,05 — inconsistente con bezpay.service.js (1,24), sin unificar aún', () => {
            expect(BEZ_TO_USD_RATE).toBe(0.05);
        });

    });

});

describe('getTierConfig', () => {

    test('should return STARTER config for undefined input', () => {
        expect(getTierConfig(undefined).id).toBe('starter');
    });

    test('should return STARTER config for null input', () => {
        expect(getTierConfig(null).id).toBe('starter');
    });

    test('should return correct config for each tier', () => {
        expect(getTierConfig('STARTER').id).toBe('starter');
        expect(getTierConfig('CREATOR').id).toBe('creator');
        expect(getTierConfig('BUSINESS').id).toBe('business');
        expect(getTierConfig('ENTERPRISE').id).toBe('enterprise');
    });

    test('should be case-insensitive', () => {
        expect(getTierConfig('starter').id).toBe('starter');
        expect(getTierConfig('Creator').id).toBe('creator');
        expect(getTierConfig('BUSINESS').id).toBe('business');
        expect(getTierConfig('enterprise').id).toBe('enterprise');
    });

    test('should return STARTER for invalid tier', () => {
        expect(getTierConfig('INVALID').id).toBe('starter');
    });

});

describe('getEffectiveAPY', () => {

    test('STARTER should have 12.5% APY', () => {
        expect(getEffectiveAPY('STARTER')).toBe(12.5);
    });

    test('CREATOR should have 18.75% APY (1.5x)', () => {
        expect(getEffectiveAPY('CREATOR')).toBe(18.75);
    });

    test('BUSINESS should have 25% APY (2.0x) — no 31.25%, ese era el bug', () => {
        expect(getEffectiveAPY('BUSINESS')).toBe(25);
    });

    test('ENTERPRISE should have 31.25% APY (2.5x) — no 43.75%, esa fue mi propia corrección a medias', () => {
        expect(getEffectiveAPY('ENTERPRISE')).toBe(31.25);
    });

    test('should return base APY for undefined tier', () => {
        expect(getEffectiveAPY(undefined)).toBe(12.5);
    });

});

describe('calculatePotentialROI', () => {

    describe('Basic Calculations', () => {

        test('should calculate staking reward correctly for STARTER', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 12);
            expect(roi.periodStakingReward).toBe(1250); // 10000 * 12.5%
            expect(roi.effectiveAPY).toBe(12.5);
        });

        test('should calculate staking reward correctly for CREATOR', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);
            expect(roi.periodStakingReward).toBe(1875); // 10000 * 18.75%
            expect(roi.effectiveAPY).toBe(18.75);
        });

        test('should calculate staking reward correctly for BUSINESS', () => {
            const roi = calculatePotentialROI(10000, 'BUSINESS', 12);
            expect(roi.periodStakingReward).toBe(2500); // 10000 * 25%
            expect(roi.effectiveAPY).toBe(25);
        });

        test('should calculate staking reward correctly for ENTERPRISE', () => {
            const roi = calculatePotentialROI(10000, 'ENTERPRISE', 12);
            expect(roi.periodStakingReward).toBe(3125); // 10000 * 31.25%
            expect(roi.effectiveAPY).toBe(31.25);
        });

        test('should prorate rewards for partial year', () => {
            const roi6 = calculatePotentialROI(10000, 'STARTER', 6);
            const roi12 = calculatePotentialROI(10000, 'STARTER', 12);
            expect(roi6.periodStakingReward).toBe(roi12.periodStakingReward / 2);
        });

    });

    describe('Subscription Costs', () => {

        test('STARTER should have zero subscription cost', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 12);
            expect(roi.totalSubscriptionCost).toBe(0);
            expect(roi.subscriptionCostInBEZ).toBe(0);
        });

        test('CREATOR should cost €1.188 per year (€99 × 12)', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);
            expect(roi.totalSubscriptionCost).toBe(1188);
        });

        test('BUSINESS should cost €5.988 per year (€499 × 12)', () => {
            const roi = calculatePotentialROI(10000, 'BUSINESS', 12);
            expect(roi.totalSubscriptionCost).toBe(5988);
        });

        test('ENTERPRISE should cost €29.988 per year (€2.499 × 12)', () => {
            const roi = calculatePotentialROI(10000, 'ENTERPRISE', 12);
            expect(roi.totalSubscriptionCost).toBe(29988);
        });

        test('subscription cost should be converted to BEZ at BEZ_TO_USD_RATE', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);
            // 1188 / 0.05 = 23.760 BEZ
            expect(roi.subscriptionCostInBEZ).toBeCloseTo(23760, 1);
        });

    });

    describe('Net Profit Calculations', () => {

        test('STARTER should always be profitable (no cost)', () => {
            const roi = calculatePotentialROI(100, 'STARTER', 12);
            expect(roi.isProfitable).toBe(true);
            expect(roi.netProfitBEZ).toBeGreaterThan(0);
        });

        // A 10.000 BEZ (justo el tokenLock de Creator), Creator NO es rentable
        // todavía — hace falta bastante más stake. Es el hallazgo real del
        // informe de rentabilidad, no un caso límite artificial.
        test('CREATOR a 10.000 BEZ (su propio tokenLock) NO es rentable aún', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);
            expect(roi.isProfitable).toBe(false);
        });

        test('CREATOR se vuelve rentable por encima de su breakEvenStake', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);
            const roiAboveBreakEven = calculatePotentialROI(roi.breakEvenStake + 10000, 'CREATOR', 12);
            expect(roiAboveBreakEven.isProfitable).toBe(true);
        });

        test('BUSINESS a 10.000 BEZ ya es rentable', () => {
            const roi = calculatePotentialROI(10000, 'BUSINESS', 12);
            expect(roi.isProfitable).toBe(true);
        });

        // A este mismo stake de referencia, Enterprise NO es rentable — su
        // cuota (€29.988/año) pesa más que lo que devuelve un stake moderado,
        // aun con el subsidio de gas ya acotado a 2.000€/mes.
        test('ENTERPRISE a 10.000 BEZ NO es rentable a ese nivel de stake', () => {
            const roi = calculatePotentialROI(10000, 'ENTERPRISE', 12);
            expect(roi.isProfitable).toBe(false);
        });

        test('ENTERPRISE se vuelve rentable por encima de su breakEvenStake', () => {
            const roi = calculatePotentialROI(10000, 'ENTERPRISE', 12);
            const roiAboveBreakEven = calculatePotentialROI(roi.breakEvenStake + 10000, 'ENTERPRISE', 12);
            expect(roiAboveBreakEven.isProfitable).toBe(true);
        });

    });

    describe('Break-even Calculations', () => {

        test('STARTER should have zero break-even stake', () => {
            expect(calculatePotentialROI(10000, 'STARTER', 12).breakEvenStake).toBe(0);
        });

        test('CREATOR break-even se calcula desde su propio coste y APY', () => {
            const roi = calculatePotentialROI(10000, 'CREATOR', 12);
            // 1.188€ / 0,05 = 23.760 BEZ de coste; 23.760 / 0,1875 = 126.720 BEZ
            expect(roi.breakEvenStake).toBe(126720);
        });

        test('BUSINESS break-even se calcula desde su propio coste y APY', () => {
            const roi = calculatePotentialROI(10000, 'BUSINESS', 12);
            // 5.988€ / 0,05 = 119.760 BEZ de coste; 119.760 / 0,25 = 479.040 BEZ
            expect(roi.breakEvenStake).toBe(479040);
        });

        test('ENTERPRISE break-even se calcula desde su propio coste y APY', () => {
            const roi = calculatePotentialROI(10000, 'ENTERPRISE', 12);
            // 29.988€ / 0,05 = 599.760 BEZ de coste; 599.760 / 0,3125 = 1.919.232 BEZ
            expect(roi.breakEvenStake).toBe(1919232);
        });

    });

    describe('Comparison with STARTER', () => {

        test('should calculate extra APY vs STARTER', () => {
            expect(calculatePotentialROI(10000, 'CREATOR', 12).vsStarter.extraAPY).toBe(6.25); // 18.75 - 12.5
            expect(calculatePotentialROI(10000, 'BUSINESS', 12).vsStarter.extraAPY).toBe(12.5); // 25 - 12.5
            expect(calculatePotentialROI(10000, 'ENTERPRISE', 12).vsStarter.extraAPY).toBe(18.75); // 31.25 - 12.5
        });

        test('should calculate extra reward BEZ vs STARTER', () => {
            const roiCreator = calculatePotentialROI(10000, 'CREATOR', 12);
            expect(roiCreator.vsStarter.extraRewardBEZ).toBe(625); // 10000 * (18.75%-12.5%)
        });

    });

    describe('Edge Cases', () => {

        test('should handle zero stake amount', () => {
            const roi = calculatePotentialROI(0, 'STARTER', 12);
            expect(roi.periodStakingReward).toBe(0);
            expect(roi.stakeAmount).toBe(0);
        });

        test('should handle very large stake amounts, incluso en BUSINESS con tope 500.000', () => {
            const roi = calculatePotentialROI(1000000, 'BUSINESS', 12);
            // El cálculo de ROI no aplica el tope de staking.maxStakeAmount por sí
            // solo — es la capa de negocio (StakingPool) la que debe rechazar el
            // exceso. Aquí sólo se confirma que el cálculo no explota ni da NaN/Infinity.
            expect(roi.periodStakingReward).toBe(250000); // 1M * 25%
            expect(Number.isFinite(roi.netProfitBEZ)).toBe(true);
            expect(roi.isProfitable).toBe(true);
        });

        test('should handle 1 month duration', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 1);
            expect(roi.periodStakingReward).toBeCloseTo(104.17, 1);
        });

        test('should handle 24 month duration', () => {
            const roi = calculatePotentialROI(10000, 'STARTER', 24);
            expect(roi.periodStakingReward).toBe(2500);
        });

    });

});

describe('compareROIAcrossTiers', () => {

    test('should return comparison for all 4 tiers', () => {
        const comparison = compareROIAcrossTiers(10000, 12);
        expect(comparison.comparison).toHaveProperty('STARTER');
        expect(comparison.comparison).toHaveProperty('CREATOR');
        expect(comparison.comparison).toHaveProperty('BUSINESS');
        expect(comparison.comparison).toHaveProperty('ENTERPRISE');
    });

    test('should include stake amount and duration', () => {
        const comparison = compareROIAcrossTiers(10000, 12);
        expect(comparison.stakeAmount).toBe(10000);
        expect(comparison.durationMonths).toBe(12);
    });

    test('should recommend a tier for small stakes', () => {
        const comparison = compareROIAcrossTiers(1000, 12);
        expect(TIER_HIERARCHY).toContain(comparison.recommendation.tier);
    });

    test('should recommend a tier for medium stakes', () => {
        const comparison = compareROIAcrossTiers(30000, 12);
        expect(TIER_HIERARCHY).toContain(comparison.recommendation.tier);
    });

    // A 200.000 BEZ, BUSINESS da el mejor neto de los 4 (verificado ejecutando
    // compareROIAcrossTiers de verdad) — CREATOR también es rentable a ese
    // nivel pero con menos margen; ENTERPRISE todavía no llega a su
    // break-even (1.919.232 BEZ) a este tamaño de stake.
    test('should recommend BUSINESS para 200.000 BEZ de stake', () => {
        const comparison = compareROIAcrossTiers(200000, 12);
        expect(comparison.recommendation.tier).toBe('BUSINESS');
        expect(comparison.comparison.ENTERPRISE.isProfitable).toBe(false);
    });

    test('should include recommendation reason', () => {
        const comparison = compareROIAcrossTiers(10000, 12);
        expect(typeof comparison.recommendation.reason).toBe('string');
        expect(comparison.recommendation.reason.length).toBeGreaterThan(0);
    });

});

describe('Feature Access', () => {

    test('STARTER should not have advanced features', () => {
        const config = getTierConfig('STARTER');
        expect(config.features.canCreateProposals).toBe(false);
        expect(config.features.advancedAIModels).toBe(false);
        expect(config.features.apiAccess).toBe(false);
    });

    test('CREATOR should have most features but not apiAccess', () => {
        const config = getTierConfig('CREATOR');
        expect(config.features.canCreateProposals).toBe(true);
        expect(config.features.advancedAIModels).toBe(true);
        expect(config.features.analytics).toBe(true);
        expect(config.features.apiAccess).toBe(false); // sólo desde BUSINESS
    });

    test('BUSINESS should have full API access', () => {
        const config = getTierConfig('BUSINESS');
        expect(config.features.apiAccess).toBe(true);
        expect(config.features.webhooks).toBe(true);
        expect(config.features.dedicatedManager).toBe(true);
    });

    // whiteLabel/dedicatedNode sólo existen en Enterprise — no están ni
    // definidos (undefined, no false) en los demás tiers.
    test('ENTERPRISE should have exclusive whiteLabel/dedicatedNode features', () => {
        const config = getTierConfig('ENTERPRISE');
        expect(config.features.whiteLabel).toBe(true);
        expect(config.features.dedicatedNode).toBe(true);
        expect(getTierConfig('BUSINESS').features.whiteLabel).toBeUndefined();
    });

});

describe('AI Limits', () => {

    test('STARTER should have 5 daily queries', () => {
        expect(getTierConfig('STARTER').ai.dailyQueries).toBe(5);
    });

    test('CREATOR should have 50 daily queries', () => {
        expect(getTierConfig('CREATOR').ai.dailyQueries).toBe(50);
    });

    // Acotado a 500 diarias / 15.000 mensuales — config/plans.js l.52
    // (aiActions: 15000). Infinity no tenía respaldo en el PDF aprobado.
    test('BUSINESS should have 500 daily / 15.000 monthly queries — no Infinity', () => {
        const config = getTierConfig('BUSINESS');
        expect(config.ai.dailyQueries).toBe(500);
        expect(config.ai.monthlyQueries).toBe(15000);
    });

    // ENTERPRISE SÍ es Infinity a propósito — config/plans.js l.73 tiene
    // aiActions: null, que es como el PDF representa "ilimitado" para este
    // tier en concreto. No es el mismo bug que Business.
    test('ENTERPRISE should have unlimited queries — sí respaldado por el PDF (aiActions: null)', () => {
        expect(getTierConfig('ENTERPRISE').ai.dailyQueries).toBe(Infinity);
        expect(getTierConfig('ENTERPRISE').ai.monthlyQueries).toBe(Infinity);
    });

    test('model access should be tier-based', () => {
        expect(getTierConfig('STARTER').ai.models).toEqual(['gpt-3.5-turbo']);
        expect(getTierConfig('CREATOR').ai.models).toContain('gpt-4');
        expect(getTierConfig('BUSINESS').ai.models).toEqual(['all']);
        expect(getTierConfig('ENTERPRISE').ai.models).toEqual(['all']);
    });

});

describe('Gas Subsidies', () => {

    test('STARTER should have 0% gas subsidy', () => {
        expect(getTierConfig('STARTER').gas.subsidyPercent).toBe(0);
    });

    test('CREATOR should have 25% gas subsidy', () => {
        expect(getTierConfig('CREATOR').gas.subsidyPercent).toBe(0.25);
    });

    // 50%, no 100% — el bug real que traía esta vuelta (config/plans.js
    // l.52: gasSubsidy: 50).
    test('BUSINESS should have 50% gas subsidy — no 100%, ese era el bug', () => {
        expect(getTierConfig('BUSINESS').gas.subsidyPercent).toBe(0.5);
    });

    test('ENTERPRISE should have 100% gas subsidy, con presupuesto mensual acotado', () => {
        const config = getTierConfig('ENTERPRISE');
        expect(config.gas.subsidyPercent).toBe(1.0);
        expect(config.gas.monthlySubsidyBudget).toBe(2000); // acotado; antes Infinity
    });

});
