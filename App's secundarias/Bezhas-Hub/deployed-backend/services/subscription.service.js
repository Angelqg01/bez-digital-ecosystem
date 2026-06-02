/**
 * ============================================================================
 * BEZHAS UNIFIED SUBSCRIPTION SERVICE
 * ============================================================================
 * 
 * Servicio que fusiona:
 * - Suscripciones SaaS (Stripe)
 * - DeFi Staking (APY por tier)
 * - Token Locking (alternativa a pago fiat)
 * - AI Credits Management
 * 
 * @version 2.0.0
 * @date 2026-01-27
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/user.model');
const {
    SUBSCRIPTION_TIERS,
    TIER_HIERARCHY,
    DEFAULT_TIER,
    TRIAL_PERIOD_DAYS,
    getTierConfig,
    tierHasAccess,
    calculatePotentialROI,
    getEffectiveAPY
} = require('../config/tier.config');
const tokenomicsService = require('./tokenomics.service');
const crypto = require('crypto');

// Logger
const logger = require('../utils/logger') || console;

class SubscriptionService {
    constructor() {
        this.signatureSecret = process.env.SUBSCRIPTION_SIGNATURE_SECRET ||
            crypto.randomBytes(32).toString('hex');
    }

    // ===========================================================================
    // SUBSCRIPTION MANAGEMENT
    // ===========================================================================

    /**
     * Obtener información de suscripción del usuario
     */
    async getUserSubscription(userId) {
        const user = await this._getUser(userId);
        const tier = user?.subscriptionTier || DEFAULT_TIER;
        const config = getTierConfig(tier);

        // Verificar si tiene tier por token lock
        const hasTokenLock = user?.tokenLockData?.active || false;
        const tokenLockTier = user?.tokenLockData?.tier || null;

        // Determinar tier efectivo (el mayor entre pago y lock)
        const effectiveTier = this._getHigherTier(tier, tokenLockTier);
        const effectiveConfig = getTierConfig(effectiveTier);

        return {
            // Tier info
            tier: effectiveTier,
            tierName: effectiveConfig.name,
            tierDisplayName: effectiveConfig.displayName,
            tierDescription: effectiveConfig.description,

            // Pricing
            price: effectiveConfig.price,

            // Subscription status
            source: hasTokenLock && tokenLockTier === effectiveTier ? 'token_lock' : 'subscription',
            isActive: this._isSubscriptionActive(user) || hasTokenLock,
            expiresAt: user?.subscriptionExpiresAt,

            // Token lock info
            tokenLock: hasTokenLock ? {
                active: true,
                tier: tokenLockTier,
                amount: user.tokenLockData.amount,
                lockedAt: user.tokenLockData.lockedAt,
                unlocksAt: user.tokenLockData.unlocksAt
            } : null,

            // Trial
            isTrial: user?.isTrialActive,
            trialEndsAt: user?.trialEndsAt,

            // Benefits
            staking: effectiveConfig.staking,
            gas: effectiveConfig.gas,
            ai: effectiveConfig.ai,
            limits: effectiveConfig.limits,
            features: effectiveConfig.features,

            // UI
            ui: effectiveConfig.ui
        };
    }

    /**
     * Verificar acceso a feature
     */
    async checkFeatureAccess(userId, feature) {
        const subscription = await this.getUserSubscription(userId);
        const config = getTierConfig(subscription.tier);

        const hasAccess = config.features[feature] === true;

        // Encontrar tier mínimo requerido
        let minTierRequired = null;
        for (const tierName of TIER_HIERARCHY) {
            if (SUBSCRIPTION_TIERS[tierName].features[feature]) {
                minTierRequired = tierName;
                break;
            }
        }

        return {
            hasAccess,
            currentTier: subscription.tier,
            requiredTier: minTierRequired,
            upgradeRequired: !hasAccess,
            feature
        };
    }

    /**
     * Verificar límite de uso
     */
    async checkLimit(userId, limitType) {
        const user = await this._getUser(userId);
        const subscription = await this.getUserSubscription(userId);
        const limit = subscription.limits[limitType];

        // Obtener uso actual
        const currentUsage = await this._getCurrentUsage(userId, limitType);

        // Calcular reset time
        const resetAt = this._getResetTime(limitType);

        const remaining = limit === Infinity ? Infinity : Math.max(0, limit - currentUsage);

        return {
            allowed: limit === Infinity || currentUsage < limit,
            current: currentUsage,
            limit: limit === Infinity ? 'unlimited' : limit,
            remaining: limit === Infinity ? 'unlimited' : remaining,
            percentUsed: limit === Infinity ? 0 : Math.round((currentUsage / limit) * 100),
            resetAt,
            limitType,
            tier: subscription.tier
        };
    }

    /**
     * Incrementar uso
     */
    async incrementUsage(userId, limitType, amount = 1) {
        const limitCheck = await this.checkLimit(userId, limitType);

        if (!limitCheck.allowed) {
            throw new Error(`Limit exceeded: ${limitType}`);
        }

        const usageKey = this._getUsageKey(userId, limitType);

        await User.findByIdAndUpdate(userId, {
            $inc: { [`usage.${usageKey}`]: amount }
        });

        return this.checkLimit(userId, limitType);
    }

    // ===========================================================================
    // STAKING INTEGRATION
    // ===========================================================================

    /**
     * Generar firma criptográfica para desbloquear APY en staking
     * Esta firma se usa en el frontend para verificar el tier sin hacer
     * llamadas adicionales al backend
     */
    generateStakingSignature(userId, tier, expiresAt) {
        const payload = {
            userId: userId.toString(),
            tier,
            multiplier: getTierConfig(tier).staking.multiplier,
            effectiveAPY: getEffectiveAPY(tier),
            expiresAt: expiresAt || Date.now() + 3600000, // 1 hora default
            nonce: crypto.randomBytes(16).toString('hex')
        };

        const payloadString = JSON.stringify(payload);
        const signature = crypto
            .createHmac('sha256', this.signatureSecret)
            .update(payloadString)
            .digest('hex');

        return {
            payload,
            signature,
            combined: Buffer.from(JSON.stringify({ payload, signature })).toString('base64')
        };
    }

    /**
     * Verificar firma de staking
     */
    verifyStakingSignature(signatureData) {
        try {
            const decoded = JSON.parse(Buffer.from(signatureData, 'base64').toString());
            const { payload, signature } = decoded;

            // Verificar firma
            const expectedSignature = crypto
                .createHmac('sha256', this.signatureSecret)
                .update(JSON.stringify(payload))
                .digest('hex');

            if (signature !== expectedSignature) {
                return { valid: false, error: 'Invalid signature' };
            }

            // Verificar expiración
            if (Date.now() > payload.expiresAt) {
                return { valid: false, error: 'Signature expired' };
            }

            return {
                valid: true,
                userId: payload.userId,
                tier: payload.tier,
                multiplier: payload.multiplier,
                effectiveAPY: payload.effectiveAPY
            };

        } catch (err) {
            return { valid: false, error: 'Invalid signature format' };
        }
    }

    /**
     * Obtener información de staking para un usuario
     */
    async getStakingInfo(userId) {
        const subscription = await this.getUserSubscription(userId);
        const tier = subscription.tier;
        const stakingConfig = subscription.staking;

        // Generar firma para el frontend
        const signature = this.generateStakingSignature(
            userId,
            tier,
            Date.now() + 3600000 // 1 hora
        );

        return {
            tier,
            baseAPY: 12.5,
            multiplier: stakingConfig.multiplier,
            effectiveAPY: stakingConfig.effectiveAPY,
            maxStakeAmount: stakingConfig.maxStakeAmount,
            earlyUnstakePenalty: stakingConfig.earlyUnstakePenalty,
            lockPeriodDays: stakingConfig.lockPeriodDays,
            compoundingEnabled: stakingConfig.compoundingEnabled,
            signature: signature.combined,

            // Para UI
            tierColor: subscription.ui.color,
            tierGradient: subscription.ui.gradient
        };
    }

    /**
     * Calcular ROI potencial
     */
    calculateROI(stakeAmount, tier, durationMonths = 12) {
        return calculatePotentialROI(stakeAmount, tier, durationMonths);
    }

    // ===========================================================================
    // STRIPE INTEGRATION
    // ===========================================================================

    /**
     * Crear sesión de checkout en Stripe
     */
    async createCheckoutSession(userId, tier, billingPeriod = 'monthly') {
        const config = getTierConfig(tier);

        if (!config || tier === 'STARTER') {
            throw new Error('Invalid tier for upgrade');
        }

        const priceId = config.price.stripePriceId[billingPeriod];
        if (!priceId || priceId.startsWith('price_')) {
            // Crear precio dinámico si no existe
            return this._createDynamicCheckout(userId, tier, billingPeriod, config);
        }

        const user = await this._getUser(userId);

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: user.email,
            line_items: [{
                price: priceId,
                quantity: 1
            }],
            success_url: `${process.env.FRONTEND_URL}/vip/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/vip/cancel`,
            metadata: {
                userId: userId.toString(),
                tier,
                billingPeriod,
                source: 'bezhas_subscription'
            }
        });

        return {
            success: true,
            checkoutUrl: session.url,
            sessionId: session.id
        };
    }

    /**
     * Crear checkout dinámico (sin Price ID pre-configurado)
     */
    async _createDynamicCheckout(userId, tier, billingPeriod, config) {
        const user = await this._getUser(userId);
        const price = billingPeriod === 'yearly' ? config.price.yearly : config.price.monthly;

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: user.email,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `BeZhas ${config.displayName}`,
                        description: config.description,
                        metadata: {
                            tier,
                            type: 'subscription'
                        }
                    },
                    unit_amount: Math.round(price * 100),
                    recurring: {
                        interval: billingPeriod === 'yearly' ? 'year' : 'month'
                    }
                },
                quantity: 1
            }],
            success_url: `${process.env.FRONTEND_URL}/vip/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/vip/cancel`,
            metadata: {
                userId: userId.toString(),
                tier,
                billingPeriod,
                source: 'bezhas_subscription'
            }
        });

        return {
            success: true,
            checkoutUrl: session.url,
            sessionId: session.id
        };
    }

    /**
     * Procesar webhook de Stripe
     */
    async handleStripeWebhook(event) {
        switch (event.type) {
            case 'checkout.session.completed':
                return this._handleCheckoutComplete(event.data.object);

            case 'customer.subscription.updated':
                return this._handleSubscriptionUpdate(event.data.object);

            case 'customer.subscription.deleted':
                return this._handleSubscriptionCanceled(event.data.object);

            case 'invoice.payment_failed':
                return this._handlePaymentFailed(event.data.object);

            default:
                logger.info(`[Subscription] Unhandled event: ${event.type}`);
        }
    }

    async _handleCheckoutComplete(session) {
        const { userId, tier, billingPeriod } = session.metadata;

        if (!userId || !tier) {
            logger.warn('[Subscription] Checkout session missing metadata');
            return;
        }

        const expiresAt = new Date();
        if (billingPeriod === 'yearly') {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        await User.findByIdAndUpdate(userId, {
            subscriptionTier: tier.toUpperCase(),
            subscriptionExpiresAt: expiresAt,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            isTrialActive: false,
            subscriptionStartedAt: new Date(),
            subscriptionSource: 'stripe'
        });

        logger.info(`[Subscription] User ${userId} upgraded to ${tier}`);
    }

    async _handleSubscriptionCanceled(subscription) {
        const user = await User.findOne({ stripeSubscriptionId: subscription.id });
        if (!user) return;

        // Verificar si tiene token lock activo
        if (user.tokenLockData?.active) {
            // Mantener tier del token lock
            await User.findByIdAndUpdate(user._id, {
                subscriptionTier: user.tokenLockData.tier,
                subscriptionSource: 'token_lock',
                stripeSubscriptionId: null
            });
        } else {
            await User.findByIdAndUpdate(user._id, {
                subscriptionTier: DEFAULT_TIER,
                subscriptionExpiresAt: null,
                stripeSubscriptionId: null,
                subscriptionSource: null
            });
        }

        logger.info(`[Subscription] Subscription canceled for user ${user._id}`);
    }

    async _handlePaymentFailed(invoice) {
        const user = await User.findOne({ stripeCustomerId: invoice.customer });
        if (!user) return;

        logger.warn(`[Subscription] Payment failed for user ${user._id}`);
        // TODO: Enviar notificación al usuario
    }

    // ===========================================================================
    // TOKEN LOCK (ALTERNATIVA A PAGO FIAT)
    // ===========================================================================

    /**
     * Registrar lock de tokens para obtener tier
     * (Llamado después de verificar TX en blockchain)
     */
    async registerTokenLock(userId, tier, amount, txHash) {
        const config = getTierConfig(tier);

        if (amount < config.tokenLock.amount) {
            throw new Error(`Insufficient lock amount. Required: ${config.tokenLock.amount} BEZ`);
        }

        const lockedAt = new Date();
        const unlocksAt = new Date();
        unlocksAt.setDate(unlocksAt.getDate() + config.tokenLock.durationDays);

        await User.findByIdAndUpdate(userId, {
            tokenLockData: {
                active: true,
                tier: tier.toUpperCase(),
                amount,
                txHash,
                lockedAt,
                unlocksAt
            },
            // Actualizar tier si es mayor que el actual
            $max: { subscriptionTierLevel: TIER_HIERARCHY.indexOf(tier.toUpperCase()) }
        });

        // Actualizar tier efectivo
        const user = await this._getUser(userId);
        const currentTier = user.subscriptionTier || DEFAULT_TIER;
        const effectiveTier = this._getHigherTier(currentTier, tier.toUpperCase());

        if (effectiveTier !== currentTier) {
            await User.findByIdAndUpdate(userId, {
                subscriptionTier: effectiveTier
            });
        }

        return {
            success: true,
            tier: effectiveTier,
            lockedAmount: amount,
            unlocksAt
        };
    }

    /**
     * Liberar tokens lockeados (después de período mínimo)
     */
    async releaseTokenLock(userId) {
        const user = await this._getUser(userId);

        if (!user.tokenLockData?.active) {
            throw new Error('No active token lock found');
        }

        if (new Date() < new Date(user.tokenLockData.unlocksAt)) {
            throw new Error(`Tokens locked until ${user.tokenLockData.unlocksAt}`);
        }

        await User.findByIdAndUpdate(userId, {
            tokenLockData: {
                active: false,
                tier: null,
                amount: 0,
                releasedAt: new Date()
            }
        });

        // Revertir al tier de pago o default
        const paidTier = user.stripeSubscriptionId ? user.subscriptionTier : DEFAULT_TIER;
        await User.findByIdAndUpdate(userId, {
            subscriptionTier: paidTier
        });

        return {
            success: true,
            releasedAmount: user.tokenLockData.amount,
            newTier: paidTier
        };
    }

    // ===========================================================================
    // TRIAL
    // ===========================================================================

    /**
     * Iniciar período de prueba
     */
    async startTrial(userId, tier = 'CREATOR') {
        const user = await this._getUser(userId);

        // Verificar si ya usó trial
        if (user.trialUsed) {
            throw new Error('Trial period already used');
        }

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_PERIOD_DAYS);

        await User.findByIdAndUpdate(userId, {
            subscriptionTier: tier.toUpperCase(),
            isTrialActive: true,
            trialEndsAt,
            trialStartedAt: new Date(),
            trialUsed: true
        });

        return {
            success: true,
            tier,
            trialEndsAt,
            daysRemaining: TRIAL_PERIOD_DAYS
        };
    }

    // ===========================================================================
    // UTILITY METHODS
    // ===========================================================================

    /**
     * Obtener todos los tiers para mostrar en UI
     */
    getAllTiers() {
        return TIER_HIERARCHY.map(tierKey => ({
            ...SUBSCRIPTION_TIERS[tierKey],
            tierKey,
            isPopular: tierKey === 'CREATOR'
        }));
    }

    /**
     * Obtener comparativa de tiers
     */
    getTierComparison() {
        const comparison = {};

        for (const tierKey of TIER_HIERARCHY) {
            const config = SUBSCRIPTION_TIERS[tierKey];
            comparison[tierKey] = {
                name: config.displayName,
                price: config.price.monthly,
                priceYearly: config.price.yearly,
                tokenLockAlternative: config.tokenLock.amount,
                stakingAPY: getEffectiveAPY(tierKey),
                stakingMultiplier: config.staking.multiplier,
                gasSubsidy: config.gas.subsidyPercent * 100,
                aiQueriesPerDay: config.ai.dailyQueries,
                features: Object.entries(config.features)
                    .filter(([_, v]) => v === true)
                    .map(([k, _]) => k)
            };
        }

        return comparison;
    }

    // ===========================================================================
    // PRIVATE HELPERS
    // ===========================================================================

    async _getUser(userId) {
        return await User.findById(userId).lean();
    }

    _getHigherTier(tierA, tierB) {
        if (!tierA && !tierB) return DEFAULT_TIER;
        if (!tierA) return tierB;
        if (!tierB) return tierA;

        const indexA = TIER_HIERARCHY.indexOf(tierA.toUpperCase());
        const indexB = TIER_HIERARCHY.indexOf(tierB.toUpperCase());

        return indexA >= indexB ? tierA : tierB;
    }

    _isSubscriptionActive(user) {
        if (!user) return false;
        if (user.subscriptionTier === 'STARTER') return true;
        if (user.isTrialActive && new Date(user.trialEndsAt) > new Date()) return true;
        if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date()) return true;
        return false;
    }

    async _getCurrentUsage(userId, limitType) {
        const user = await User.findById(userId).lean();
        if (!user?.usage) return 0;

        const usageKey = this._getUsageKey(userId, limitType);
        return user.usage[usageKey] || 0;
    }

    _getUsageKey(userId, limitType) {
        const period = this._getUsagePeriod(limitType);
        const periodKey = this._getPeriodKey(period);
        return `${limitType}_${periodKey}`;
    }

    _getUsagePeriod(limitType) {
        if (limitType.includes('PerDay')) return 'day';
        if (limitType.includes('PerMonth')) return 'month';
        if (limitType.includes('PerYear')) return 'year';
        return 'month';
    }

    _getPeriodKey(period) {
        const now = new Date();
        switch (period) {
            case 'day':
                return now.toISOString().split('T')[0];
            case 'month':
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            case 'year':
                return now.getFullYear().toString();
            default:
                return now.toISOString().split('T')[0];
        }
    }

    _getResetTime(limitType) {
        const period = this._getUsagePeriod(limitType);
        const now = new Date();

        switch (period) {
            case 'day':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            case 'month':
                return new Date(now.getFullYear(), now.getMonth() + 1, 1);
            case 'year':
                return new Date(now.getFullYear() + 1, 0, 1);
            default:
                return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        }
    }
}

// Exportar instancia singleton
const subscriptionService = new SubscriptionService();

module.exports = subscriptionService;
module.exports.SubscriptionService = SubscriptionService;
