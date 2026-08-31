/**
 * ============================================================================
 * BEZHAS SDK - UNIFIED WEB3 + SAAS INTEGRATION
 * ============================================================================
 * 
 * SDK wrapper que unifica:
 * - Subscription Management (Stripe)
 * - DeFi Operations (Staking, Farming)
 * - AI/ML Services
 * - Tokenomics (BEZ-Coin)
 * - Gas Management
 * 
 * @version 2.0.0
 * @date 2026-01-27
 * 
 * @example
 * const bezhas = require('./bezhas-sdk');
 * 
 * // Initialize
 * await bezhas.init({ apiKey: 'xxx', userId: 'yyy' });
 * 
 * // Get subscription info
 * const sub = await bezhas.subscription.getInfo();
 * 
 * // Calculate staking ROI
 * const roi = bezhas.staking.calculateROI(10000, 12);
 * 
 * // Use AI with cost tracking
 * const result = await bezhas.ai.chat('Hello', { model: 'gpt-4' });
 */

const {
    SUBSCRIPTION_TIERS,
    TIER_HIERARCHY,
    getTierConfig,
    tierHasAccess,
    calculatePotentialROI,
    getEffectiveAPY,
    BASE_STAKING_APY,
    BEZ_TO_USD_RATE
} = require('./config/tier.config');

const tokenomicsService = require('./services/tokenomics.service');
const subscriptionService = require('./services/subscription.service');

/**
 * BeZhas SDK Main Class
 */
class BeZhasSDK {
    constructor() {
        this.initialized = false;
        this.config = {
            apiKey: null,
            userId: null,
            tier: 'STARTER',
            baseUrl: process.env.BEZHAS_API_URL || 'http://localhost:5000/api/v1'
        };

        // Sub-modules
        this.subscription = new SubscriptionModule(this);
        this.staking = new StakingModule(this);
        this.ai = new AIModule(this);
        this.tokenomics = new TokenomicsModule(this);
        this.gas = new GasModule(this);
    }

    /**
     * Initialize SDK
     */
    async init(options = {}) {
        this.config = {
            ...this.config,
            ...options
        };

        if (this.config.userId) {
            try {
                const subscription = await subscriptionService.getUserSubscription(this.config.userId);
                this.config.tier = subscription.tier;
                this.config.subscription = subscription;
            } catch (err) {
                console.warn('[BeZhasSDK] Could not fetch subscription:', err.message);
            }
        }

        this.initialized = true;
        return this;
    }

    /**
     * Get current user tier
     */
    getTier() {
        return this.config.tier;
    }

    /**
     * Get tier configuration
     */
    getTierConfig(tierName = null) {
        return getTierConfig(tierName || this.config.tier);
    }

    /**
     * Check if initialized
     */
    _checkInit() {
        if (!this.initialized) {
            throw new Error('BeZhasSDK not initialized. Call init() first.');
        }
    }
}

/**
 * Subscription Module
 */
class SubscriptionModule {
    constructor(sdk) {
        this.sdk = sdk;
    }

    /**
     * Get user subscription info
     */
    async getInfo() {
        this.sdk._checkInit();
        return subscriptionService.getUserSubscription(this.sdk.config.userId);
    }

    /**
     * Get all available tiers
     */
    getAllTiers() {
        return subscriptionService.getAllTiers();
    }

    /**
     * Get tier comparison
     */
    getComparison() {
        return subscriptionService.getTierComparison();
    }

    /**
     * Check feature access
     */
    async checkFeature(feature) {
        this.sdk._checkInit();
        return subscriptionService.checkFeatureAccess(this.sdk.config.userId, feature);
    }

    /**
     * Check usage limit
     */
    async checkLimit(limitType) {
        this.sdk._checkInit();
        return subscriptionService.checkLimit(this.sdk.config.userId, limitType);
    }

    /**
     * Create checkout session for upgrade
     */
    async createCheckout(tier, billingPeriod = 'monthly') {
        this.sdk._checkInit();
        return subscriptionService.createCheckoutSession(this.sdk.config.userId, tier, billingPeriod);
    }

    /**
     * Start trial
     */
    async startTrial(tier = 'CREATOR') {
        this.sdk._checkInit();
        return subscriptionService.startTrial(this.sdk.config.userId, tier);
    }

    /**
     * Get staking signature for frontend
     */
    async getStakingSignature() {
        this.sdk._checkInit();
        return subscriptionService.getStakingInfo(this.sdk.config.userId);
    }
}

/**
 * Staking Module
 */
class StakingModule {
    constructor(sdk) {
        this.sdk = sdk;
    }

    /**
     * Get staking info for current user
     */
    async getInfo() {
        this.sdk._checkInit();
        return subscriptionService.getStakingInfo(this.sdk.config.userId);
    }

    /**
     * Get effective APY for tier
     */
    getAPY(tier = null) {
        return getEffectiveAPY(tier || this.sdk.config.tier);
    }

    /**
     * Get staking multiplier for tier
     */
    getMultiplier(tier = null) {
        const config = getTierConfig(tier || this.sdk.config.tier);
        return config.staking.multiplier;
    }

    /**
     * Calculate staking rewards
     */
    calculateRewards(stakeAmount, durationDays = 365) {
        return tokenomicsService.calculateStakingRewards(
            stakeAmount,
            this.sdk.config.tier,
            durationDays
        );
    }

    /**
     * Calculate potential ROI considering subscription cost
     */
    calculateROI(stakeAmount, durationMonths = 12, tier = null) {
        return calculatePotentialROI(
            stakeAmount,
            tier || this.sdk.config.tier,
            durationMonths
        );
    }

    /**
     * Compare ROI across tiers
     */
    compareROIAcrossTiers(stakeAmount, durationMonths = 12) {
        const results = {};

        for (const tier of TIER_HIERARCHY) {
            results[tier] = calculatePotentialROI(stakeAmount, tier, durationMonths);
        }

        return {
            stakeAmount,
            durationMonths,
            comparison: results,
            recommendation: this._getRecommendedTier(results, stakeAmount)
        };
    }

    /**
     * Get recommended tier based on stake amount
     */
    _getRecommendedTier(results, stakeAmount) {
        let bestTier = 'STARTER';
        let bestNetProfit = results.STARTER.netProfitBEZ;

        for (const tier of TIER_HIERARCHY) {
            if (results[tier].isProfitable && results[tier].netProfitBEZ > bestNetProfit) {
                bestTier = tier;
                bestNetProfit = results[tier].netProfitBEZ;
            }
        }

        // Si el stake es bajo, puede que ningún tier de pago sea rentable
        if (bestTier === 'STARTER' && stakeAmount < 1000) {
            return {
                tier: 'STARTER',
                reason: 'Para montos pequeños, el tier gratuito es más rentable',
                minimumForUpgrade: results.CREATOR?.breakEvenStake || 5000
            };
        }

        return {
            tier: bestTier,
            reason: `${bestTier} ofrece el mejor ROI neto`,
            netProfit: bestNetProfit
        };
    }

    /**
     * Get token lock requirements for free tier access
     */
    getTokenLockRequirements(tier) {
        const config = getTierConfig(tier);
        return config.tokenLock;
    }
}

/**
 * AI Module
 */
class AIModule {
    constructor(sdk) {
        this.sdk = sdk;
    }

    /**
     * Get available AI models for current tier
     */
    getAvailableModels() {
        return tokenomicsService.getAvailableModels(this.sdk.config.tier);
    }

    /**
     * Check rate limit
     */
    async checkRateLimit() {
        this.sdk._checkInit();
        return tokenomicsService.checkAIRateLimit(
            this.sdk.config.userId,
            this.sdk.config.tier
        );
    }

    /**
     * Estimate cost for AI operation
     */
    estimateCost(model, usage) {
        return tokenomicsService.calculateAICost(model, usage, this.sdk.config.tier);
    }

    /**
     * Get cached inference result
     */
    async getCached(model, input) {
        return tokenomicsService.getCachedInference(model, input);
    }

    /**
     * Cache inference result
     */
    async cache(model, input, result, ttlSeconds = 3600) {
        return tokenomicsService.cacheInference(model, input, result, ttlSeconds);
    }

    /**
     * Execute AI query with caching and cost tracking
     */
    async query(model, input, options = {}) {
        this.sdk._checkInit();

        // Check rate limit first
        const rateLimit = await this.checkRateLimit();
        if (!rateLimit.allowed) {
            throw new Error(`Rate limit exceeded. Resets at ${rateLimit.resetAt}`);
        }

        // Check cache
        if (options.useCache !== false) {
            const cached = await this.getCached(model, input);
            if (cached) {
                return { ...cached, fromCache: true, cost: { finalCost: 0 } };
            }
        }

        // Estimate cost before execution
        const estimatedUsage = {
            inputTokens: this._estimateTokens(input),
            outputTokens: options.maxTokens || 500
        };

        const costEstimate = this.estimateCost(model, estimatedUsage);

        // Here would be the actual API call
        // For now, return structure for integration
        return {
            model,
            input,
            estimatedCost: costEstimate,
            execute: async (apiCall) => {
                const result = await apiCall();

                // Cache result
                if (options.useCache !== false) {
                    await this.cache(model, input, result, options.cacheTTL || 3600);
                }

                // Increment rate limit
                await tokenomicsService.incrementAIRateLimit(this.sdk.config.userId);

                return result;
            }
        };
    }

    /**
     * Estimate tokens from input
     */
    _estimateTokens(input) {
        if (typeof input === 'string') {
            return Math.ceil(input.length / 4); // Rough estimate: 4 chars per token
        }
        return Math.ceil(JSON.stringify(input).length / 4);
    }
}

/**
 * Tokenomics Module
 */
class TokenomicsModule {
    constructor(sdk) {
        this.sdk = sdk;
    }

    /**
     * Convert BEZ to USD
     */
    bezToUSD(bezAmount) {
        return tokenomicsService.bezToUSD(bezAmount);
    }

    /**
     * Convert USD to BEZ
     */
    usdToBEZ(usdAmount) {
        return tokenomicsService.usdToBEZ(usdAmount);
    }

    /**
     * Get current BEZ/USD rate
     */
    getRate() {
        return BEZ_TO_USD_RATE;
    }

    /**
     * Calculate total operation cost
     */
    async calculateOperationCost(operation) {
        return tokenomicsService.calculateTotalCost(operation, this.sdk.config.tier);
    }

    /**
     * Get tier discounts
     */
    getDiscounts(tier = null) {
        const config = getTierConfig(tier || this.sdk.config.tier);
        return {
            bezCoinDiscount: tier === 'BUSINESS' ? 50 : tier === 'CREATOR' ? 25 : 0,
            gasSubsidy: config.gas.subsidyPercent * 100,
            platformFee: tier === 'BUSINESS' ? 1.25 : 2.5 // Platform fee %
        };
    }
}

/**
 * Gas Module
 */
class GasModule {
    constructor(sdk) {
        this.sdk = sdk;
    }

    /**
     * Get current gas price
     */
    async getPrice() {
        return tokenomicsService.getGasPrice();
    }

    /**
     * Estimate gas cost with tier subsidy
     */
    async estimateCost(gasLimit) {
        return tokenomicsService.estimateGasCost(gasLimit, this.sdk.config.tier);
    }

    /**
     * Check if gas is free for current tier
     */
    isGasFree() {
        const config = getTierConfig(this.sdk.config.tier);
        return config.gas.subsidyPercent >= 1.0;
    }

    /**
     * Get gas subsidy percentage
     */
    getSubsidyPercent() {
        const config = getTierConfig(this.sdk.config.tier);
        return config.gas.subsidyPercent * 100;
    }
}

// ============================================================================
// FRONTEND INTEGRATION HELPERS
// ============================================================================

/**
 * Create frontend-safe configuration object
 * (No sensitive data, can be sent to client)
 */
function createFrontendConfig(userId, subscription) {
    return {
        userId,
        tier: subscription.tier,
        tierName: subscription.tierName,
        tierDisplayName: subscription.tierDisplayName,

        // Staking
        staking: {
            multiplier: subscription.staking.multiplier,
            effectiveAPY: subscription.staking.effectiveAPY,
            compoundingEnabled: subscription.staking.compoundingEnabled
        },

        // Gas
        gas: {
            subsidyPercent: subscription.gas.subsidyPercent * 100,
            gasFree: subscription.gas.subsidyPercent >= 1.0
        },

        // AI
        ai: {
            dailyQueries: subscription.ai.dailyQueries,
            models: subscription.ai.models,
            priority: subscription.ai.priority
        },

        // UI
        ui: subscription.ui,

        // Features (boolean flags)
        features: subscription.features,

        // Limits
        limits: subscription.limits,

        // Status
        isActive: subscription.isActive,
        expiresAt: subscription.expiresAt,
        isTrial: subscription.isTrial
    };
}

/**
 * Validate tier from frontend
 */
function validateTier(tierName) {
    return TIER_HIERARCHY.includes(tierName?.toUpperCase());
}

// ============================================================================
// EXPORTS
// ============================================================================

// Singleton instance
const bezhasSDK = new BeZhasSDK();

module.exports = bezhasSDK;
module.exports.BeZhasSDK = BeZhasSDK;
module.exports.createFrontendConfig = createFrontendConfig;
module.exports.validateTier = validateTier;

// Re-export useful functions
module.exports.getTierConfig = getTierConfig;
module.exports.tierHasAccess = tierHasAccess;
module.exports.calculatePotentialROI = calculatePotentialROI;
module.exports.getEffectiveAPY = getEffectiveAPY;
module.exports.TIER_HIERARCHY = TIER_HIERARCHY;
module.exports.SUBSCRIPTION_TIERS = SUBSCRIPTION_TIERS;
