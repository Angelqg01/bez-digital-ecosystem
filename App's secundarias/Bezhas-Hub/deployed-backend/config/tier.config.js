/**
 * ============================================================================
 * BEZHAS UNIFIED TIER CONFIGURATION
 * ============================================================================
 * 
 * Configuración unificada que fusiona:
 * - Suscripciones SaaS (Stripe/Fiat)
 * - DeFi Staking (APY Multipliers)
 * - AI Credits (Tokenomics)
 * - Gas Subsidies
 * 
 * @version 2.0.0
 * @date 2026-01-27
 */

/**
 * Tasa de conversión BEZ ↔ USD
 */
const BEZ_TO_USD_RATE = parseFloat(process.env.BEZ_TO_USD_RATE) || 0.05;

/**
 * Base APY del staking pool (sin multiplicador)
 */
const BASE_STAKING_APY = parseFloat(process.env.BASE_STAKING_APY) || 12.5;

/**
 * Configuración de Gas Oracle
 */
const GAS_CONFIG = {
    POLYGON_GAS_STATION_URL: 'https://gasstation.polygon.technology/v2',
    DEFAULT_GAS_PRICE_GWEI: 30,
    MAX_GAS_PRICE_GWEI: 500,
    CACHE_TTL_MS: 10000 // 10 segundos
};

/**
 * =============================================================================
 * TIER CONFIGURATION MATRIX
 * =============================================================================
 * 
 * Cada tier define:
 * - priceFiat: Precio mensual en USD
 * - priceTokenLock: BEZ a bloquear para tier gratis (alternativa)
 * - stakingMultiplier: Multiplicador de APY (1.0 = base, 2.0 = doble)
 * - gasSubsidy: % de subsidio en gas (0 = 0%, 1 = 100%)
 * - aiCredits: Límites de uso de IA
 */
const SUBSCRIPTION_TIERS = {
    // =========================================================================
    // STARTER (Gratis)
    // =========================================================================
    STARTER: {
        id: 'starter',
        name: 'Starter',
        displayName: 'Starter',
        description: 'Plan gratuito para comenzar en BeZhas',

        // === PRECIOS ===
        price: {
            monthly: 0,
            yearly: 0,
            currency: 'USD',
            stripePriceId: {
                monthly: null,
                yearly: null
            }
        },

        // === ALTERNATIVA: Token Lock para tier gratis ===
        tokenLock: {
            amount: 0,           // No requiere lock
            durationDays: 0,
            contractMethod: null
        },

        // === DEFI: STAKING ===
        staking: {
            multiplier: 1.0,              // APY base (12.5%)
            effectiveAPY: BASE_STAKING_APY * 1.0,
            maxStakeAmount: 10000,        // Máximo 10k BEZ
            earlyUnstakePenalty: 0.10,    // 10% penalización
            lockPeriodDays: 0,            // Sin lock obligatorio
            compoundingEnabled: false
        },

        // === GAS SUBSIDY ===
        gas: {
            subsidyPercent: 0,            // 0% subsidio
            maxSubsidyPerTx: 0,           // Sin límite
            monthlySubsidyBudget: 0,      // Sin presupuesto
            priorityFee: false            // Sin priority fee
        },

        // === AI CREDITS ===
        ai: {
            dailyQueries: 5,
            monthlyQueries: 100,
            models: ['gpt-3.5-turbo'],
            maxTokensPerQuery: 1000,
            imageGeneration: 0,           // Sin generación de imágenes
            voiceMinutes: 0,
            customPrompts: false,
            priority: 'low'
        },

        // === LÍMITES GENERALES ===
        limits: {
            postsPerMonth: 10,
            postsWithMediaPerMonth: 5,
            commentsPerMonth: 50,
            storageGB: 0.1,
            oracleValidationsPerMonth: 0,
            daoProposalsPerMonth: 0,
            daoVotesPerMonth: Infinity
        },

        // === FEATURES ===
        features: {
            // Blockchain
            canCreateProposals: false,
            qualityOracleAccess: false,
            priorityValidation: false,

            // AI
            advancedAIModels: false,
            customPrompts: false,
            aiPersonality: false,

            // Platform
            apiAccess: false,
            webhooks: false,
            analytics: false,
            exportData: false,

            // Support
            prioritySupport: false,
            dedicatedManager: false,

            // Social
            verifiedBadge: false,
            customProfile: false,
            scheduledPosts: false
        },

        // === UI ===
        ui: {
            badge: null,
            color: '#6B7280',
            gradient: 'from-gray-500 to-gray-600',
            icon: 'user'
        }
    },

    // =========================================================================
    // CREATOR (Pro)
    // =========================================================================
    CREATOR: {
        id: 'creator',
        name: 'Creator',
        displayName: 'Creator Pro',
        description: 'Para creadores activos que quieren destacar',

        // === PRECIOS ===
        price: {
            monthly: 14.99,
            yearly: 149.99,  // 17% ahorro
            currency: 'USD',
            stripePriceId: {
                monthly: process.env.STRIPE_PRICE_CREATOR_MONTHLY || 'price_creator_monthly',
                yearly: process.env.STRIPE_PRICE_CREATOR_YEARLY || 'price_creator_yearly'
            }
        },

        // === ALTERNATIVA: Token Lock para tier gratis ===
        tokenLock: {
            amount: 5000,                 // Lock 5000 BEZ = tier gratis
            durationDays: 90,             // Mínimo 90 días
            contractMethod: 'lockForTier'
        },

        // === DEFI: STAKING ===
        staking: {
            multiplier: 1.5,              // 1.5x APY (18.75%)
            effectiveAPY: BASE_STAKING_APY * 1.5,
            maxStakeAmount: 100000,       // Máximo 100k BEZ
            earlyUnstakePenalty: 0.05,    // 5% penalización
            lockPeriodDays: 7,            // 7 días mínimo
            compoundingEnabled: true
        },

        // === GAS SUBSIDY ===
        gas: {
            subsidyPercent: 0.25,         // 25% subsidio
            maxSubsidyPerTx: 5,           // Máx $5 USD por TX
            monthlySubsidyBudget: 50,     // $50 USD/mes
            priorityFee: false
        },

        // === AI CREDITS ===
        ai: {
            dailyQueries: 50,
            monthlyQueries: 1000,
            models: ['gpt-3.5-turbo', 'gpt-4', 'gemini-pro'],
            maxTokensPerQuery: 4000,
            imageGeneration: 10,          // 10 imágenes/mes
            voiceMinutes: 30,
            customPrompts: true,
            priority: 'medium'
        },

        // === LÍMITES GENERALES ===
        limits: {
            postsPerMonth: 100,
            postsWithMediaPerMonth: 50,
            commentsPerMonth: Infinity,
            storageGB: 5,
            oracleValidationsPerMonth: 20,
            daoProposalsPerMonth: 5,
            daoVotesPerMonth: Infinity
        },

        // === FEATURES ===
        features: {
            canCreateProposals: true,
            qualityOracleAccess: true,
            priorityValidation: false,
            advancedAIModels: true,
            customPrompts: true,
            aiPersonality: false,
            apiAccess: false,
            webhooks: false,
            analytics: true,
            exportData: true,
            prioritySupport: true,
            dedicatedManager: false,
            verifiedBadge: true,
            customProfile: true,
            scheduledPosts: true
        },

        // === UI ===
        ui: {
            badge: 'creator',
            color: '#8B5CF6',
            gradient: 'from-purple-500 to-pink-500',
            icon: 'star'
        }
    },

    // =========================================================================
    // BUSINESS (Enterprise)
    // =========================================================================
    BUSINESS: {
        id: 'business',
        name: 'Business',
        displayName: 'Business Enterprise',
        description: 'Acceso completo para organizaciones y power users',

        // === PRECIOS ===
        price: {
            monthly: 99.99,
            yearly: 999.99,  // 17% ahorro
            currency: 'USD',
            stripePriceId: {
                monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || 'price_business_monthly',
                yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || 'price_business_yearly'
            }
        },

        // === ALTERNATIVA: Token Lock para tier gratis ===
        tokenLock: {
            amount: 50000,                // Lock 50000 BEZ = tier gratis
            durationDays: 180,            // Mínimo 180 días
            contractMethod: 'lockForTier'
        },

        // === DEFI: STAKING ===
        staking: {
            multiplier: 2.5,              // 2.5x APY (31.25%)
            effectiveAPY: BASE_STAKING_APY * 2.5,
            maxStakeAmount: Infinity,     // Sin límite
            earlyUnstakePenalty: 0,       // Sin penalización
            lockPeriodDays: 0,            // Sin lock obligatorio
            compoundingEnabled: true
        },

        // === GAS SUBSIDY ===
        gas: {
            subsidyPercent: 1.0,          // 100% subsidio (gas gratis)
            maxSubsidyPerTx: Infinity,    // Sin límite por TX
            monthlySubsidyBudget: 500,    // $500 USD/mes
            priorityFee: true             // Priority fee incluido
        },

        // === AI CREDITS ===
        ai: {
            dailyQueries: Infinity,
            monthlyQueries: Infinity,
            models: ['all'],              // Todos los modelos
            maxTokensPerQuery: 8000,
            imageGeneration: Infinity,
            voiceMinutes: Infinity,
            customPrompts: true,
            priority: 'high'
        },

        // === LÍMITES GENERALES ===
        limits: {
            postsPerMonth: Infinity,
            postsWithMediaPerMonth: Infinity,
            commentsPerMonth: Infinity,
            storageGB: 100,
            oracleValidationsPerMonth: Infinity,
            daoProposalsPerMonth: Infinity,
            daoVotesPerMonth: Infinity
        },

        // === FEATURES ===
        features: {
            canCreateProposals: true,
            qualityOracleAccess: true,
            priorityValidation: true,
            advancedAIModels: true,
            customPrompts: true,
            aiPersonality: true,
            apiAccess: true,
            webhooks: true,
            analytics: true,
            exportData: true,
            prioritySupport: true,
            dedicatedManager: true,
            verifiedBadge: true,
            customProfile: true,
            scheduledPosts: true
        },

        // === UI ===
        ui: {
            badge: 'business',
            color: '#F59E0B',
            gradient: 'from-amber-400 to-orange-500',
            icon: 'building'
        }
    }
};

/**
 * Jerarquía de tiers (para comparaciones de acceso)
 */
const TIER_HIERARCHY = ['STARTER', 'CREATOR', 'BUSINESS'];

/**
 * Tier por defecto para nuevos usuarios
 */
const DEFAULT_TIER = 'STARTER';

/**
 * Período de prueba gratuito (días)
 */
const TRIAL_PERIOD_DAYS = 14;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Obtener configuración completa de un tier
 * @param {string} tierName - Nombre del tier (STARTER, CREATOR, BUSINESS)
 * @returns {Object} Configuración del tier
 */
const getTierConfig = (tierName) => {
    const tier = tierName?.toUpperCase() || DEFAULT_TIER;
    return SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS[DEFAULT_TIER];
};

/**
 * Verificar si un tier tiene acceso a otro (jerarquía)
 * @param {string} userTier - Tier del usuario
 * @param {string} requiredTier - Tier requerido
 * @returns {boolean}
 */
const tierHasAccess = (userTier, requiredTier) => {
    const userIndex = TIER_HIERARCHY.indexOf(userTier?.toUpperCase() || DEFAULT_TIER);
    const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier?.toUpperCase() || DEFAULT_TIER);
    return userIndex >= requiredIndex;
};

/**
 * Calcular APY efectivo según tier
 * @param {string} tierName - Nombre del tier
 * @returns {number} APY efectivo (ej: 18.75 para 18.75%)
 */
const getEffectiveAPY = (tierName) => {
    const config = getTierConfig(tierName);
    return BASE_STAKING_APY * config.staking.multiplier;
};

/**
 * Calcular ROI potencial considerando suscripción
 * @param {number} stakeAmount - Cantidad a stakear en BEZ
 * @param {string} tierName - Nombre del tier
 * @param {number} durationMonths - Duración en meses
 * @returns {Object} Análisis de ROI
 */
const calculatePotentialROI = (stakeAmount, tierName, durationMonths = 12) => {
    const config = getTierConfig(tierName);
    const effectiveAPY = getEffectiveAPY(tierName);

    // Calcular ganancias de staking
    const yearlyStakingReward = stakeAmount * (effectiveAPY / 100);
    const periodStakingReward = yearlyStakingReward * (durationMonths / 12);

    // Costo de suscripción
    const monthlySubscriptionCost = config.price.monthly;
    const totalSubscriptionCost = monthlySubscriptionCost * durationMonths;
    const subscriptionCostInBEZ = totalSubscriptionCost / BEZ_TO_USD_RATE;

    // Valor del gas subsidio (estimado)
    const estimatedGasSavings = config.gas.monthlySubsidyBudget * durationMonths;
    const gasSavingsInBEZ = estimatedGasSavings / BEZ_TO_USD_RATE;

    // Valor de AI credits (estimado a $0.01 por query)
    const aiCreditsValue = (config.ai.monthlyQueries === Infinity ? 10000 : config.ai.monthlyQueries) * 0.01 * durationMonths;
    const aiValueInBEZ = aiCreditsValue / BEZ_TO_USD_RATE;

    // Calcular beneficio neto
    const grossBenefit = periodStakingReward + gasSavingsInBEZ + aiValueInBEZ;
    const netProfit = grossBenefit - subscriptionCostInBEZ;
    const netProfitUSD = netProfit * BEZ_TO_USD_RATE;

    // ROI porcentual
    const investmentCost = subscriptionCostInBEZ > 0 ? subscriptionCostInBEZ : 1;
    const roiPercent = (netProfit / investmentCost) * 100;

    // Punto de equilibrio (break-even)
    let breakEvenStake = 0;
    if (monthlySubscriptionCost > 0 && effectiveAPY > 0) {
        // Stake necesario para que rewards >= subscription cost
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
        aiValueInBEZ: Math.round(aiValueInBEZ * 100) / 100,

        // Net Profit
        grossBenefitBEZ: Math.round(grossBenefit * 100) / 100,
        netProfitBEZ: Math.round(netProfit * 100) / 100,
        netProfitUSD: Math.round(netProfitUSD * 100) / 100,
        roiPercent: Math.round(roiPercent * 100) / 100,

        // Break-even
        breakEvenStake: Math.round(breakEvenStake),
        isProfitable: netProfit > 0,

        // Comparisons
        vsStarter: {
            extraAPY: effectiveAPY - BASE_STAKING_APY,
            extraRewardBEZ: periodStakingReward - (stakeAmount * (BASE_STAKING_APY / 100) * (durationMonths / 12))
        }
    };
};

/**
 * Obtener todos los tiers para mostrar en UI
 * @returns {Array} Lista de tiers con metadata
 */
const getAllTiersForDisplay = () => {
    return TIER_HIERARCHY.map(tierKey => ({
        ...SUBSCRIPTION_TIERS[tierKey],
        tierKey,
        isPopular: tierKey === 'CREATOR'
    }));
};

/**
 * Comparar dos tiers
 * @param {string} tierA - Primer tier
 * @param {string} tierB - Segundo tier
 * @returns {Object} Diferencias entre tiers
 */
const compareTiers = (tierA, tierB) => {
    const configA = getTierConfig(tierA);
    const configB = getTierConfig(tierB);

    return {
        priceDifference: configB.price.monthly - configA.price.monthly,
        apyDifference: getEffectiveAPY(tierB) - getEffectiveAPY(tierA),
        gasSubsidyDifference: configB.gas.subsidyPercent - configA.gas.subsidyPercent,
        aiCreditsDifference: (configB.ai.dailyQueries === Infinity ? 1000 : configB.ai.dailyQueries) -
            (configA.ai.dailyQueries === Infinity ? 1000 : configA.ai.dailyQueries),
        additionalFeatures: Object.keys(configB.features).filter(
            key => configB.features[key] && !configA.features[key]
        )
    };
};

/**
 * Comparar ROI entre todos los tiers
 * @param {number} stakeAmount - Cantidad a stakear
 * @param {number} durationMonths - Duración en meses
 * @returns {Object} Comparación de todos los tiers
 */
const compareROIAcrossTiers = (stakeAmount, durationMonths = 12) => {
    const comparison = {};

    for (const tier of TIER_HIERARCHY) {
        comparison[tier] = calculatePotentialROI(stakeAmount, tier, durationMonths);
    }

    // Encontrar el mejor tier
    let bestTier = 'STARTER';
    let bestNetProfit = comparison.STARTER.netProfitBEZ;

    for (const tier of TIER_HIERARCHY) {
        if (comparison[tier].isProfitable && comparison[tier].netProfitBEZ > bestNetProfit) {
            bestTier = tier;
            bestNetProfit = comparison[tier].netProfitBEZ;
        }
    }

    return {
        stakeAmount,
        durationMonths,
        comparison,
        recommendation: {
            tier: bestTier,
            reason: bestTier === 'STARTER'
                ? 'For small amounts, the free tier is most profitable'
                : `${bestTier} offers the best net ROI`,
            netProfit: bestNetProfit,
            minimumForUpgrade: comparison.CREATOR?.breakEvenStake || 5000
        }
    };
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // Config
    SUBSCRIPTION_TIERS,
    TIER_HIERARCHY,
    DEFAULT_TIER,
    TRIAL_PERIOD_DAYS,
    BASE_STAKING_APY,
    BEZ_TO_USD_RATE,
    GAS_CONFIG,

    // Functions
    getTierConfig,
    tierHasAccess,
    getEffectiveAPY,
    calculatePotentialROI,
    compareROIAcrossTiers,
    getAllTiersForDisplay,
    compareTiers
};

