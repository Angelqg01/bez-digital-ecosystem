/**
 * ============================================================================
 * BEZHAS VIP SUBSCRIPTION SERVICE
 * ============================================================================
 * 
 * Gestión de suscripciones VIP mensuales con Stripe (LIVE KEYS)
 * - Creación de productos y precios recurrentes
 * - Gestión de suscripciones activas
 * - Webhooks de renovación automática
 * - Actualización y cancelación de suscripciones
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/user.model');
const logger = require('../utils/logger');

// Import WebSocket server for notifications
let wsServer = null;
try {
    const wsModule = require('../websocket-server');
    wsServer = wsModule.broadcastToUser || null;
} catch (error) {
    logger.warn('WebSocket server not available, VIP notifications disabled');
}

// VIP Subscription Tiers
const VIP_TIERS = {
    bronze: {
        id: 'bronze',
        name: 'Bronze VIP',
        price: 14.99, // Actualizado de 9.99
        bezPrice: 300, // Actualizado de 200 BEZ/month
        features: [
            '5% descuento en compras',
            '10% descuento en envíos',
            'Badge NFT Bronze',
            'Soporte prioritario',
            'Acceso a eventos Bronze'
        ],
        color: 'orange',
        stripePriceId: null // Will be created on first use
    },
    silver: {
        id: 'silver',
        name: 'Silver VIP',
        price: 29.99, // Actualizado de 19.99
        bezPrice: 600, // Actualizado de 400
        features: [
            '10% descuento en compras',
            '20% descuento en envíos',
            'Badge NFT Silver',
            'Soporte 24/7',
            '10% bonus en BEZ-Coin',
            'Acceso eventos Silver'
        ],
        color: 'gray',
        stripePriceId: null
    },
    gold: {
        id: 'gold',
        name: 'Gold VIP',
        price: 69.99, // Actualizado de 49.99
        bezPrice: 1400, // Actualizado de 1000
        features: [
            '15% descuento en compras',
            'Envío gratis',
            'Badge NFT Gold animado',
            'Gestor de cuenta dedicado',
            '25% bonus en BEZ-Coin',
            'Acceso eventos Gold',
            '1 NFT exclusivo mensual'
        ],
        color: 'yellow',
        stripePriceId: null
    },
    platinum: {
        id: 'platinum',
        name: 'Platinum VIP',
        price: 149.99, // Actualizado de 99.99
        bezPrice: 3000, // Actualizado de 2000
        features: [
            '20% descuento en compras',
            'Envío express gratis',
            'Badge NFT Platinum exclusivo',
            'Concierge Web3 24/7',
            '50% bonus en BEZ-Coin',
            'Acceso a todos los eventos',
            '3 NFTs exclusivos mensuales',
            'Votación doble en DAO'
        ],
        color: 'purple',
        stripePriceId: null
    }
};

/**
 * Obtener o crear producto de Stripe para un tier VIP
 */
async function getOrCreateStripeProduct(tierId) {
    const tier = VIP_TIERS[tierId];
    if (!tier) {
        throw new Error(`Invalid VIP tier: ${tierId}`);
    }

    // Check if we already have a price ID cached (in production, store in DB)
    if (tier.stripePriceId) {
        return tier.stripePriceId;
    }

    try {
        // Search for existing product
        const products = await stripe.products.search({
            query: `name:'${tier.name}' AND active:'true'`,
        });

        let product;
        if (products.data.length > 0) {
            product = products.data[0];
        } else {
            // Create new product
            product = await stripe.products.create({
                name: tier.name,
                description: `BeZhas VIP ${tier.name} - Monthly Subscription`,
                metadata: {
                    tier: tierId,
                    type: 'vip_subscription'
                }
            });
        }

        // Get or create recurring price
        const prices = await stripe.prices.list({
            product: product.id,
            active: true,
            type: 'recurring'
        });

        let price;
        if (prices.data.length > 0) {
            price = prices.data[0];
        } else {
            // Create recurring price
            price = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(tier.price * 100), // Convert to cents
                currency: 'usd',
                recurring: {
                    interval: 'month'
                },
                metadata: {
                    tier: tierId
                }
            });
        }

        // Cache the price ID (in production, store in DB)
        tier.stripePriceId = price.id;

        return price.id;

    } catch (error) {
        console.error(`Error creating Stripe product for ${tierId}:`, error);
        throw error;
    }
}

/**
 * Crear sesión de checkout de Stripe para suscripción VIP
 */
async function createVIPSubscriptionSession(tierId, userInfo) {
    try {
        const tier = VIP_TIERS[tierId];
        if (!tier) {
            throw new Error(`Invalid VIP tier: ${tierId}`);
        }

        // Get or create Stripe product/price
        const priceId = await getOrCreateStripeProduct(tierId);

        // Preparar configuración de sesión
        const sessionConfig = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                }
            ],
            success_url: `${process.env.FRONTEND_URL}/vip/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/vip`,
            client_reference_id: userInfo.userId,
            metadata: {
                userId: userInfo.userId,
                walletAddress: userInfo.walletAddress || '',
                tier: tierId,
                type: 'vip_subscription'
            },
            subscription_data: {
                metadata: {
                    userId: userInfo.userId,
                    walletAddress: userInfo.walletAddress || '',
                    tier: tierId
                }
            }
        };

        // Solo agregar customer_email si existe
        if (userInfo.email && userInfo.email.trim() !== '') {
            sessionConfig.customer_email = userInfo.email;
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create(sessionConfig);

        console.log(`✅ VIP Subscription session created: ${session.id} for tier: ${tierId}`);

        return {
            success: true,
            sessionId: session.id,
            url: session.url,
            tier: tier.name,
            price: tier.price
        };

    } catch (error) {
        console.error('Error creating VIP subscription session:', error);
        throw error;
    }
}

/**
 * Obtener suscripciones activas de un usuario
 */
async function getUserSubscriptions(userId) {
    try {
        // In production, query your DB for subscriptions linked to this userId
        // For now, we'll search Stripe directly
        const subscriptions = await stripe.subscriptions.list({
            limit: 100,
        });

        const userSubs = subscriptions.data.filter(sub =>
            sub.metadata?.userId === userId &&
            sub.status === 'active'
        );

        return userSubs.map(sub => ({
            id: sub.id,
            tier: sub.metadata.tier,
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            created: new Date(sub.created * 1000)
        }));

    } catch (error) {
        console.error('Error getting user subscriptions:', error);
        throw error;
    }
}

/**
 * Cancelar suscripción VIP
 */
async function cancelVIPSubscription(subscriptionId, cancelImmediately = false) {
    try {
        const subscription = await stripe.subscriptions.update(
            subscriptionId,
            {
                cancel_at_period_end: !cancelImmediately
            }
        );

        if (cancelImmediately) {
            await stripe.subscriptions.cancel(subscriptionId);
        }

        return {
            success: true,
            message: cancelImmediately
                ? 'Subscription cancelled immediately'
                : 'Subscription will cancel at period end',
            subscription: {
                id: subscription.id,
                status: subscription.status,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000)
            }
        };

    } catch (error) {
        console.error('Error cancelling subscription:', error);
        throw error;
    }
}

/**
 * Actualizar tier de suscripción VIP
 */
async function upgradeVIPSubscription(subscriptionId, newTierId) {
    try {
        const newPriceId = await getOrCreateStripeProduct(newTierId);

        // Get current subscription
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Update subscription with new price (proration enabled by default)
        const updatedSubscription = await stripe.subscriptions.update(
            subscriptionId,
            {
                items: [
                    {
                        id: subscription.items.data[0].id,
                        price: newPriceId,
                    }
                ],
                proration_behavior: 'always_invoice', // Charge/credit difference immediately
                metadata: {
                    ...subscription.metadata,
                    tier: newTierId
                }
            }
        );

        return {
            success: true,
            message: 'Subscription upgraded successfully',
            subscription: {
                id: updatedSubscription.id,
                tier: newTierId,
                status: updatedSubscription.status,
                currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000)
            }
        };

    } catch (error) {
        console.error('Error upgrading subscription:', error);
        throw error;
    }
}

/**
 * Verificar si un usuario tiene suscripción VIP activa
 */
async function checkUserVIPStatus(userId) {
    try {
        const subscriptions = await getUserSubscriptions(userId);

        if (subscriptions.length === 0) {
            return {
                hasVIP: false,
                tier: null
            };
        }

        // Return highest tier if multiple subscriptions (shouldn't happen normally)
        const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
        const highestSub = subscriptions.sort((a, b) =>
            tierOrder.indexOf(b.tier) - tierOrder.indexOf(a.tier)
        )[0];

        return {
            hasVIP: true,
            tier: highestSub.tier,
            subscriptionId: highestSub.id,
            currentPeriodEnd: highestSub.currentPeriodEnd,
            cancelAtPeriodEnd: highestSub.cancelAtPeriodEnd
        };

    } catch (error) {
        console.error('Error checking VIP status:', error);
        return {
            hasVIP: false,
            tier: null,
            error: error.message
        };
    }
}

/**
 * Helper: Actualizar features VIP del usuario en DB
 */
async function updateUserVIPFeatures(userId, tier, status = 'active') {
    const tierConfig = VIP_TIERS[tier];
    if (!tierConfig) {
        throw new Error(`Invalid VIP tier: ${tier}`);
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            logger.error({ userId }, 'User not found for VIP update');
            return null;
        }

        // Update VIP fields
        user.vipTier = tier;
        user.vipStatus = status;
        user.vipFeatures = { ...tierConfig.features };

        if (status === 'active') {
            if (!user.vipStartDate) {
                user.vipStartDate = new Date().toISOString();
            }
            // Set end date to 1 month from now
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
            user.vipEndDate = endDate.toISOString();
        }

        await user.save();
        logger.info({ userId, tier, status }, 'User VIP features updated successfully');
        return user;

    } catch (error) {
        logger.error({
            error: error.message,
            userId,
            tier
        }, 'Error updating user VIP features');
        throw error;
    }
}

/**
 * Handle Stripe webhook events for subscriptions
 */
async function handleSubscriptionWebhook(event) {
    const subscription = event.data.object;
    const userId = subscription.metadata?.userId;
    const tier = subscription.metadata?.tier;

    if (!userId) {
        logger.warn({ subscriptionId: subscription.id }, 'No userId in subscription metadata');
        return { received: true, processed: false, error: 'Missing userId' };
    }

    logger.info({
        eventType: event.type,
        userId,
        tier,
        subscriptionId: subscription.id
    }, 'Processing Stripe webhook event');

    try {
        switch (event.type) {
            case 'customer.subscription.created':
                // ✅ Subscription created successfully - Activate VIP
                logger.info({ userId, tier, subscriptionId: subscription.id }, 'New VIP subscription created');

                await updateUserVIPFeatures(userId, tier, 'active');

                // Update User with Stripe IDs
                const user = await User.findById(userId);
                if (user) {
                    user.stripeCustomerId = subscription.customer;
                    user.stripeSubscriptionId = subscription.id;
                    await user.save();
                }

                // Notify user
                notifyUser(userId, 'vip-activated', {
                    tier,
                    subscriptionId: subscription.id,
                    message: `¡Bienvenido a VIP ${tier.toUpperCase()}!`,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'customer.subscription.updated':
                // ✅ Subscription updated (tier change, payment method, etc.)
                logger.info({ userId, tier, subscriptionId: subscription.id }, 'VIP subscription updated');

                const newTier = subscription.metadata?.tier;
                const newStatus = subscription.status === 'active' ? 'active' :
                    subscription.status === 'canceled' ? 'cancelled' : 'inactive';

                await updateUserVIPFeatures(userId, newTier || tier, newStatus);

                notifyUser(userId, 'vip-updated', {
                    tier: newTier || tier,
                    status: newStatus,
                    message: 'Tu suscripción VIP ha sido actualizada',
                    timestamp: new Date().toISOString()
                });
                break;

            case 'customer.subscription.deleted':
                // ✅ Subscription cancelled/expired - Deactivate VIP
                logger.info({ userId, subscriptionId: subscription.id }, 'VIP subscription cancelled');

                const userToCancel = await User.findById(userId);
                if (userToCancel) {
                    userToCancel.vipStatus = 'cancelled';
                    userToCancel.vipFeatures = {
                        adFree: false,
                        prioritySupport: false,
                        customBadge: false,
                        analyticsAccess: false,
                        apiAccess: false,
                        unlimitedPosts: false
                    };
                    await userToCancel.save();
                }

                notifyUser(userId, 'vip-cancelled', {
                    message: 'Tu suscripción VIP ha sido cancelada',
                    tier: tier || 'unknown',
                    timestamp: new Date().toISOString()
                });
                break;

            case 'invoice.payment_succeeded':
                // ✅ Monthly payment succeeded (renewal) - Extend subscription
                logger.info({ userId, subscriptionId: subscription.id }, 'VIP payment succeeded');

                const userToRenew = await User.findById(userId);
                if (userToRenew) {
                    // Extend VIP end date by 1 month
                    const currentEndDate = userToRenew.vipEndDate ? new Date(userToRenew.vipEndDate) : new Date();
                    currentEndDate.setMonth(currentEndDate.getMonth() + 1);
                    userToRenew.vipEndDate = currentEndDate.toISOString();
                    userToRenew.vipStatus = 'active';
                    await userToRenew.save();
                }

                notifyUser(userId, 'vip-renewed', {
                    tier,
                    message: 'Tu suscripción VIP ha sido renovada exitosamente',
                    nextBillingDate: subscription.current_period_end * 1000,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'invoice.payment_failed':
                // ✅ Monthly payment failed - Notify and suspend VIP
                logger.warn({ userId, subscriptionId: subscription.id }, 'VIP payment failed');

                const userWithFailedPayment = await User.findById(userId);
                if (userWithFailedPayment) {
                    userWithFailedPayment.vipStatus = 'payment_failed';
                    await userWithFailedPayment.save();
                }

                notifyUser(userId, 'vip-payment-failed', {
                    tier,
                    message: 'El pago de tu suscripción VIP ha fallado. Por favor actualiza tu método de pago.',
                    subscriptionId: subscription.id,
                    timestamp: new Date().toISOString()
                });
                break;

            default:
                logger.info({ eventType: event.type }, 'Unhandled webhook event');
        }

        return { received: true, processed: true };

    } catch (error) {
        logger.error({
            error: error.message,
            eventType: event.type,
            userId,
            subscriptionId: subscription.id
        }, 'Error processing webhook event');

        return { received: true, processed: false, error: error.message };
    }
}

/**
 * Helper: Enviar notificación WebSocket al usuario
 */
function notifyUser(userId, eventType, data) {
    if (wsServer) {
        try {
            wsServer.broadcastToUser(userId, eventType, data);
            logger.info({
                userId,
                eventType
            }, 'VIP notification sent via WebSocket');
        } catch (error) {
            logger.error({
                error: error.message,
                userId,
                eventType
            }, 'Error sending VIP notification');
        }
    }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
    VIP_TIERS,
    createVIPSubscriptionSession,
    getUserSubscriptions,
    cancelVIPSubscription,
    upgradeVIPSubscription,
    checkUserVIPStatus,
    handleSubscriptionWebhook,
    getOrCreateStripeProduct
};
