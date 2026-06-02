/**
 * ============================================================================
 * TIER CONFIGURATION - FRONTEND
 * ============================================================================
 * 
 * Configuración de tiers sincronizada con el backend.
 * Usada por componentes de frontend para:
 * - Mostrar precios y features
 * - Calcular ROI de staking
 * - Mostrar comparativas
 * 
 * @version 2.0.0
 * @date 2026-01-27
 */

/**
 * Tasa de conversión BEZ ↔ USD
 */
export const BEZ_TO_USD_RATE = 0.05;

/**
 * Base APY del staking pool
 */
export const BASE_STAKING_APY = 12.5;

/**
 * Configuración de Tiers
 */
export const SUBSCRIPTION_TIERS = {
    STARTER: {
        id: 'starter',
        name: 'Starter',
        displayName: 'Starter',
        description: 'Plan gratuito para comenzar en BeZhas',

        price: {
            monthly: 0,
            yearly: 0,
            currency: 'USD'
        },

        tokenLock: {
            amount: 0,
            durationDays: 0
        },

        staking: {
            multiplier: 1.0,
            effectiveAPY: BASE_STAKING_APY * 1.0,
            maxStakeAmount: 10000,
            compoundingEnabled: false
        },

        gas: {
            subsidyPercent: 0,
            gasFree: false
        },

        ai: {
            dailyQueries: 5,
            monthlyQueries: 100,
            models: ['gpt-3.5-turbo']
        },

        features: {
            canCreateProposals: false,
            qualityOracleAccess: false,
            advancedAIModels: false,
            apiAccess: false,
            analytics: false,
            verifiedBadge: false,
            prioritySupport: false
        },

        ui: {
            badge: null,
            color: '#6B7280',
            gradient: 'from-gray-500 to-gray-600',
            icon: 'User'
        }
    },

    CREATOR: {
        id: 'creator',
        name: 'Creator',
        displayName: 'Creator Pro',
        description: 'Para creadores activos que quieren destacar',
        popular: true,

        price: {
            monthly: 99,
            yearly: 990,
            currency: 'EUR',
            savings: 200 // vs monthly
        },

        tokenLock: {
            amount: 5000,
            durationDays: 90
        },

        staking: {
            multiplier: 1.5,
            effectiveAPY: BASE_STAKING_APY * 1.5,
            maxStakeAmount: 100000,
            compoundingEnabled: true
        },

        gas: {
            subsidyPercent: 0.25,
            gasFree: false
        },

        ai: {
            dailyQueries: 50,
            monthlyQueries: 1000,
            models: ['gpt-3.5-turbo', 'gpt-4', 'gemini-pro']
        },

        features: {
            canCreateProposals: true,
            qualityOracleAccess: true,
            advancedAIModels: true,
            apiAccess: false,
            analytics: true,
            verifiedBadge: true,
            prioritySupport: true
        },

        ui: {
            badge: 'creator',
            color: '#8B5CF6',
            gradient: 'from-purple-500 to-pink-500',
            icon: 'Star'
        }
    },

    BUSINESS: {
        id: 'business',
        name: 'Business',
        displayName: 'Business Enterprise',
        description: 'Acceso completo para organizaciones y power users',

        price: {
            monthly: 499,
            yearly: 4990,
            currency: 'EUR',
            savings: 998
        },

        tokenLock: {
            amount: 50000,
            durationDays: 180
        },

        staking: {
            multiplier: 2.5,
            effectiveAPY: BASE_STAKING_APY * 2.5,
            maxStakeAmount: Infinity,
            compoundingEnabled: true
        },

        gas: {
            subsidyPercent: 1.0,
            gasFree: true
        },

        ai: {
            dailyQueries: Infinity,
            monthlyQueries: Infinity,
            models: ['all']
        },

        features: {
            canCreateProposals: true,
            qualityOracleAccess: true,
            advancedAIModels: true,
            apiAccess: true,
            analytics: true,
            verifiedBadge: true,
            prioritySupport: true,
            dedicatedManager: true,
            webhooks: true
        },

        ui: {
            badge: 'business',
            color: '#F59E0B',
            gradient: 'from-amber-400 to-orange-500',
            icon: 'Building'
        }
    },

    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise VIP',
        displayName: 'Enterprise VIP',
        description: 'BeZhas se convierte en el motor blockchain de tu organización',

        price: {
            monthly: 2499,
            yearly: 24990,
            currency: 'EUR',
            savings: 4998
        },

        tokenLock: {
            amount: 100000,
            durationDays: 180
        },

        staking: {
            multiplier: 3.5,
            effectiveAPY: BASE_STAKING_APY * 2.5,
            maxStakeAmount: Infinity,
            compoundingEnabled: true
        },

        gas: {
            subsidyPercent: 1.0,
            gasFree: true
        },

        ai: {
            dailyQueries: Infinity,
            monthlyQueries: Infinity,
            models: ['all']
        },

        features: {
            canCreateProposals: true,
            qualityOracleAccess: true,
            advancedAIModels: true,
            apiAccess: true,
            analytics: true,
            verifiedBadge: true,
            prioritySupport: true,
            dedicatedManager: true,
            webhooks: true,
            whiteLabel: true,
            dedicatedNode: true
        },

        ui: {
            badge: 'enterprise',
            color: '#FBBF24',
            gradient: 'from-yellow-400 to-yellow-600',
            icon: 'Crown'
        }
    }
};

export const TIER_HIERARCHY = ['STARTER', 'CREATOR', 'BUSINESS', 'ENTERPRISE'];

/**
 * Obtener configuración de un tier
 */
export const getTierConfig = (tierName) => {
    const tier = tierName?.toUpperCase() || 'STARTER';
    return SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.STARTER;
};

/**
 * Calcular APY efectivo
 */
export const getEffectiveAPY = (tierName) => {
    const config = getTierConfig(tierName);
    return BASE_STAKING_APY * config.staking.multiplier;
};

/**
 * Calcular ROI potencial
 */
export const calculatePotentialROI = (stakeAmount, tierName, durationMonths = 12) => {
    const config = getTierConfig(tierName);
    const effectiveAPY = getEffectiveAPY(tierName);

    // Calcular ganancias de staking
    const yearlyStakingReward = stakeAmount * (effectiveAPY / 100);
    const periodStakingReward = yearlyStakingReward * (durationMonths / 12);

    // Costo de suscripción
    const monthlySubscriptionCost = config.price.monthly;
    const totalSubscriptionCost = monthlySubscriptionCost * durationMonths;
    const subscriptionCostInBEZ = totalSubscriptionCost / BEZ_TO_USD_RATE;

    // Valor del gas subsidio estimado
    const estimatedMonthlyTxs = 20; // Estimación de TXs por mes
    const avgGasCostUSD = 0.50; // Costo promedio por TX
    const gasSavingsUSD = estimatedMonthlyTxs * avgGasCostUSD * config.gas.subsidyPercent * durationMonths;
    const gasSavingsInBEZ = gasSavingsUSD / BEZ_TO_USD_RATE;

    // Calcular beneficio neto
    const grossBenefit = periodStakingReward + gasSavingsInBEZ;
    const netProfit = grossBenefit - subscriptionCostInBEZ;
    const netProfitUSD = netProfit * BEZ_TO_USD_RATE;

    // Break-even stake
    let breakEvenStake = 0;
    if (monthlySubscriptionCost > 0 && effectiveAPY > 0) {
        const yearlySubscriptionCost = monthlySubscriptionCost * 12;
        breakEvenStake = (yearlySubscriptionCost / BEZ_TO_USD_RATE) / (effectiveAPY / 100);
    }

    return {
        tier: tierName,
        stakeAmount,
        durationMonths,

        // Staking
        effectiveAPY,
        stakingMultiplier: config.staking.multiplier,
        periodStakingReward: Math.round(periodStakingReward * 100) / 100,
        periodStakingRewardUSD: Math.round(periodStakingReward * BEZ_TO_USD_RATE * 100) / 100,

        // Subscription Cost
        monthlySubscriptionCost,
        totalSubscriptionCost,
        subscriptionCostInBEZ: Math.round(subscriptionCostInBEZ * 100) / 100,

        // Savings
        gasSavingsInBEZ: Math.round(gasSavingsInBEZ * 100) / 100,
        gasSavingsUSD: Math.round(gasSavingsUSD * 100) / 100,

        // Net Profit
        grossBenefitBEZ: Math.round(grossBenefit * 100) / 100,
        netProfitBEZ: Math.round(netProfit * 100) / 100,
        netProfitUSD: Math.round(netProfitUSD * 100) / 100,

        // Analysis
        breakEvenStake: Math.round(breakEvenStake),
        isProfitable: netProfit > 0,

        // Comparisons vs STARTER
        vsStarter: {
            extraAPY: effectiveAPY - BASE_STAKING_APY,
            extraRewardBEZ: periodStakingReward - (stakeAmount * (BASE_STAKING_APY / 100) * (durationMonths / 12))
        }
    };
};

/**
 * Comparar ROI entre todos los tiers
 */
export const compareROIAcrossTiers = (stakeAmount, durationMonths = 12) => {
    const results = {};

    for (const tier of TIER_HIERARCHY) {
        results[tier] = calculatePotentialROI(stakeAmount, tier, durationMonths);
    }

    // Encontrar el mejor tier
    let bestTier = 'STARTER';
    let bestNetProfit = results.STARTER.netProfitBEZ;

    for (const tier of TIER_HIERARCHY) {
        if (results[tier].isProfitable && results[tier].netProfitBEZ > bestNetProfit) {
            bestTier = tier;
            bestNetProfit = results[tier].netProfitBEZ;
        }
    }

    return {
        stakeAmount,
        durationMonths,
        comparison: results,
        recommendation: {
            tier: bestTier,
            reason: bestTier === 'STARTER'
                ? 'Para montos pequeños, el tier gratuito es más rentable'
                : `${bestTier} ofrece el mejor ROI neto`,
            netProfit: bestNetProfit,
            minimumForUpgrade: results.CREATOR?.breakEvenStake || 5000
        }
    };
};

/**
 * Obtener todos los tiers para UI
 */
export const getAllTiersForDisplay = () => {
    return TIER_HIERARCHY.map(tierKey => ({
        ...SUBSCRIPTION_TIERS[tierKey],
        tierKey,
        isPopular: tierKey === 'CREATOR'
    }));
};

/**
 * Feature descriptions para UI
 */
export const FEATURE_DESCRIPTIONS = {
    canCreateProposals: 'Crear propuestas en el DAO',
    qualityOracleAccess: 'Validación de contenido on-chain',
    advancedAIModels: 'Acceso a GPT-4 y modelos avanzados',
    apiAccess: 'Acceso completo a la API',
    analytics: 'Dashboard de analytics',
    verifiedBadge: 'Badge de verificación',
    prioritySupport: 'Soporte prioritario',
    dedicatedManager: 'Account manager dedicado',
    webhooks: 'Webhooks personalizados'
};
