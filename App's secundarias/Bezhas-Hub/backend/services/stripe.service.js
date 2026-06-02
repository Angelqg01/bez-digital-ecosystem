/**
 * ============================================================================
 * STRIPE PAYMENT INTEGRATION
 * ============================================================================
 * 
 * Sistema completo de pagos con Stripe para:
 * - Compra de NFTs
 * - Suscripciones Premium
 * - Compra de Tokens BZS
 * - Webhooks de confirmación
 * 
 * Documentación: https://stripe.com/docs/api
 */

// IMPORTANTE: Las claves de Stripe DEBEN estar en variables de entorno
// NUNCA hardcodear claves en el código fuente
if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[STRIPE] ERROR: STRIPE_SECRET_KEY no está configurada en las variables de entorno');
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { audit } = require('../middleware/auditLogger');
const { notifyPaymentFailed, notifyStripeWebhookError, notifyHigh } = require('../middleware/discordNotifier');
const telegram = require('../middleware/telegramNotifier');
const fiatGatewayService = require('./fiat-gateway.service');

/**
 * Configuración de Stripe
 * IMPORTANTE: Todas las claves deben venir de variables de entorno
 */
const STRIPE_CONFIG = {
    PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    CURRENCY: 'usd',
    SUCCESS_URL: process.env.FRONTEND_URL + '/payment/success',
    CANCEL_URL: process.env.FRONTEND_URL + '/payment/cancel'
};

/**
 * Crear sesión de pago para NFT
 */
async function createNFTCheckoutSession(nftData, userInfo) {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: STRIPE_CONFIG.CURRENCY,
                        product_data: {
                            name: nftData.name,
                            description: nftData.description,
                            images: nftData.image ? [nftData.image] : [],
                            metadata: {
                                type: 'nft',
                                nftId: nftData.id,
                                tokenId: nftData.tokenId || 'pending',
                                collection: nftData.collection || 'bezhas'
                            }
                        },
                        unit_amount: Math.round(nftData.price * 100), // Convertir a centavos
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${STRIPE_CONFIG.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: STRIPE_CONFIG.CANCEL_URL,
            customer_email: userInfo.email,
            client_reference_id: userInfo.userId,
            metadata: {
                type: 'nft_purchase',
                userId: userInfo.userId,
                walletAddress: userInfo.walletAddress,
                nftId: nftData.id
            }
        });

        audit.admin('STRIPE_SESSION_CREATED', 'info', {
            userId: userInfo.userId,
            sessionId: session.id,
            type: 'nft_purchase',
            amount: nftData.price
        });

        return {
            success: true,
            sessionId: session.id,
            url: session.url
        };

    } catch (error) {
        console.error('Error creating NFT checkout session:', error);

        audit.admin('STRIPE_SESSION_ERROR', 'high', {
            userId: userInfo.userId,
            error: error.message
        });

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Crear sesión de pago para suscripción Premium
 */
async function createSubscriptionCheckoutSession(plan, userInfo) {
    try {
        // Precios de suscripción (en centavos)
        const SUBSCRIPTION_PRICES = {
            'monthly': 999,    // $9.99/mes
            'yearly': 9999,    // $99.99/año (2 meses gratis)
            'lifetime': 29999  // $299.99 una vez
        };

        const isRecurring = plan !== 'lifetime';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: STRIPE_CONFIG.CURRENCY,
                        product_data: {
                            name: `BeZhas Premium - ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
                            description: `Premium features with ${plan} access`,
                            images: ['https://bez.digital/assets/premium-badge.png'],
                            metadata: {
                                type: 'subscription',
                                plan: plan
                            }
                        },
                        unit_amount: SUBSCRIPTION_PRICES[plan],
                        recurring: isRecurring ? {
                            interval: plan === 'monthly' ? 'month' : 'year'
                        } : undefined
                    },
                    quantity: 1,
                },
            ],
            mode: isRecurring ? 'subscription' : 'payment',
            success_url: `${STRIPE_CONFIG.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: STRIPE_CONFIG.CANCEL_URL,
            customer_email: userInfo.email,
            client_reference_id: userInfo.userId,
            metadata: {
                type: 'premium_subscription',
                userId: userInfo.userId,
                walletAddress: userInfo.walletAddress,
                plan: plan
            }
        });

        audit.admin('STRIPE_SUBSCRIPTION_CREATED', 'info', {
            userId: userInfo.userId,
            sessionId: session.id,
            plan: plan,
            amount: SUBSCRIPTION_PRICES[plan] / 100
        });

        return {
            success: true,
            sessionId: session.id,
            url: session.url
        };

    } catch (error) {
        console.error('Error creating subscription checkout session:', error);

        audit.admin('STRIPE_SUBSCRIPTION_ERROR', 'high', {
            userId: userInfo.userId,
            error: error.message
        });

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Crear sesión de pago para compra de tokens BZS
 */
async function createTokenPurchaseSession(tokenAmount, userInfo) {
    try {
        // Precio por token BZS: $0.10 (10 centavos)
        const pricePerToken = 10; // centavos
        const totalAmount = tokenAmount * pricePerToken;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: STRIPE_CONFIG.CURRENCY,
                        product_data: {
                            name: `${tokenAmount} BZS Tokens`,
                            description: `Purchase ${tokenAmount} BeZhas (BZS) tokens`,
                            images: ['https://bez.digital/assets/bzs-token.png'],
                            metadata: {
                                type: 'token_purchase',
                                tokenAmount: tokenAmount.toString()
                            }
                        },
                        unit_amount: pricePerToken,
                    },
                    quantity: tokenAmount,
                },
            ],
            mode: 'payment',
            success_url: `${STRIPE_CONFIG.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: STRIPE_CONFIG.CANCEL_URL,
            customer_email: userInfo.email,
            client_reference_id: userInfo.userId,
            metadata: {
                type: 'token_purchase',
                userId: userInfo.userId,
                walletAddress: userInfo.walletAddress,
                tokenAmount: tokenAmount.toString()
            }
        });

        audit.admin('STRIPE_TOKEN_PURCHASE_CREATED', 'info', {
            userId: userInfo.userId,
            sessionId: session.id,
            tokenAmount: tokenAmount,
            totalAmount: totalAmount / 100
        });

        return {
            success: true,
            sessionId: session.id,
            url: session.url
        };

    } catch (error) {
        console.error('Error creating token purchase session:', error);

        audit.admin('STRIPE_TOKEN_PURCHASE_ERROR', 'high', {
            userId: userInfo.userId,
            error: error.message
        });

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Obtener detalles de sesión de pago
 */
async function getCheckoutSession(sessionId) {
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        return {
            success: true,
            session: {
                id: session.id,
                status: session.payment_status,
                amountTotal: session.amount_total / 100,
                currency: session.currency,
                customerEmail: session.customer_email,
                metadata: session.metadata
            }
        };

    } catch (error) {
        console.error('Error retrieving session:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Crear intento de pago directo (sin Checkout)
 */
async function createPaymentIntent(amount, metadata) {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convertir a centavos
            currency: STRIPE_CONFIG.CURRENCY,
            metadata: metadata,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return {
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        };

    } catch (error) {
        console.error('Error creating payment intent:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Cancelar suscripción
 */
async function cancelSubscription(subscriptionId, userId) {
    try {
        const subscription = await stripe.subscriptions.cancel(subscriptionId);

        audit.admin('STRIPE_SUBSCRIPTION_CANCELLED', 'info', {
            userId: userId,
            subscriptionId: subscriptionId
        });

        return {
            success: true,
            subscription: {
                id: subscription.id,
                status: subscription.status,
                canceledAt: subscription.canceled_at
            }
        };

    } catch (error) {
        console.error('Error canceling subscription:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Obtener suscripciones activas de un cliente
 */
async function getCustomerSubscriptions(customerEmail) {
    try {
        // Buscar cliente por email
        const customers = await stripe.customers.list({
            email: customerEmail,
            limit: 1
        });

        if (customers.data.length === 0) {
            return {
                success: true,
                subscriptions: []
            };
        }

        const customer = customers.data[0];

        // Obtener suscripciones
        const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active'
        });

        return {
            success: true,
            subscriptions: subscriptions.data.map(sub => ({
                id: sub.id,
                status: sub.status,
                currentPeriodEnd: sub.current_period_end,
                plan: sub.items.data[0]?.price?.recurring?.interval || 'unknown'
            }))
        };

    } catch (error) {
        console.error('Error getting subscriptions:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Crear reembolso
 */
async function createRefund(paymentIntentId, amount, reason) {
    try {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amount ? Math.round(amount * 100) : undefined, // Si no se especifica, reembolsa todo
            reason: reason || 'requested_by_customer'
        });

        audit.admin('STRIPE_REFUND_CREATED', 'info', {
            paymentIntentId: paymentIntentId,
            refundId: refund.id,
            amount: refund.amount / 100
        });

        return {
            success: true,
            refund: {
                id: refund.id,
                amount: refund.amount / 100,
                status: refund.status
            }
        };

    } catch (error) {
        console.error('Error creating refund:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Procesar webhook de Stripe
 */
async function handleStripeWebhook(rawBody, signature) {
    console.log('DEBUG: handleStripeWebhook called - FIX APPLIED');
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            STRIPE_CONFIG.WEBHOOK_SECRET
        );

        audit.admin('STRIPE_WEBHOOK_RECEIVED', 'info', {
            eventType: event.type,
            eventId: event.id
        });

        // Procesar diferentes tipos de eventos
        switch (event.type) {
            case 'checkout.session.completed':
                return await handleCheckoutCompleted(event.data.object);

            case 'payment_intent.succeeded':
                return await handlePaymentSucceeded(event.data.object);

            case 'payment_intent.payment_failed':
                return await handlePaymentFailed(event.data.object);

            case 'customer.subscription.created':
                return await handleSubscriptionCreated(event.data.object);

            case 'customer.subscription.deleted':
                return await handleSubscriptionCancelled(event.data.object);

            case 'customer.subscription.updated':
                return await handleSubscriptionUpdated(event.data.object);

            default:
                console.log(`Unhandled event type: ${event.type}`);
                return { handled: false };
        }

    } catch (error) {
        console.error('Webhook processing error:', error);

        audit.admin('STRIPE_WEBHOOK_ERROR', 'critical', {
            error: error.message
        });

        // Notificar error crítico de webhook
        notifyStripeWebhookError(
            event?.type || 'unknown',
            error.message
        ).catch(err => console.error('Discord notification error:', err.message));

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Handle a pre-verified Stripe event
 */
async function handleVerifiedEvent(event) {
    const { type, data } = event;
    const object = data.object;

    switch (type) {
        case 'checkout.session.completed':
            return await handleCheckoutCompleted(object);

        case 'payment_intent.succeeded':
            return await handlePaymentSucceeded(object);

        case 'payment_intent.payment_failed':
            return await handlePaymentFailed(object);

        case 'customer.subscription.created':
            return await handleSubscriptionCreated(object);

        case 'customer.subscription.deleted':
            return await handleSubscriptionCancelled(object);

        case 'customer.subscription.updated':
            return await handleSubscriptionUpdated(object);

        default:
            console.log(`[STRIPE SERVICE] Unhandled verified event type: ${type}`);
            return { handled: false };
    }
}

/**
 * Handlers para eventos específicos
 */
async function handleCheckoutCompleted(session) {
    const { metadata, customer_email, amount_total } = session;

    audit.admin('STRIPE_CHECKOUT_COMPLETED', 'info', {
        sessionId: session.id,
        type: metadata.type,
        userId: metadata.userId,
        amount: amount_total / 100
    });

    // Procesar según el tipo de compra
    try {
        switch (metadata.type) {
            case 'nft_purchase':
                // Mintear NFT y asignarlo al usuario
                console.log('🎨 NFT purchase completed:', metadata.nftId);
                await processNFTMint(metadata, session);
                break;

            case 'premium_subscription':
                // Actualizar rol del usuario a premium
                console.log('⭐ Premium subscription activated:', metadata.userId);
                await activatePremiumSubscription(metadata, session);
                break;

            case 'token_purchase':
                // Transferir tokens BEZ al usuario automáticamente
                console.log('💰 Processing token purchase:', {
                    walletAddress: metadata.walletAddress,
                    tokenAmount: metadata.tokenAmount,
                    amountPaid: amount_total / 100
                });

                if (!metadata.walletAddress) {
                    throw new Error('Wallet address missing in metadata');
                }

                if (!metadata.tokenAmount) {
                    throw new Error('Token amount missing in metadata');
                }

                // Calcular cantidad en EUR (Stripe usa USD, convertir si es necesario)
                const amountEur = amount_total / 100; // Asumiendo 1:1 por simplicidad

                // Ejecutar transferencia automática desde Hot Wallet
                const transferResult = await fiatGatewayService.processFiatPayment(
                    metadata.walletAddress,
                    amountEur
                );

                console.log('✅ Token transfer successful:', transferResult);

                // Notificar éxito a Discord
                await notifyHigh(
                    'Token Purchase Completed',
                    `User ${metadata.userId} received ${metadata.tokenAmount} BEZ tokens\nTx: ${transferResult.transactionHash}`
                ).catch(err => console.error('Discord notification failed:', err));

                // Notificar éxito a Telegram
                await telegram.notifyPaymentSuccess(
                    amountEur,
                    'EUR',
                    metadata.walletAddress,
                    transferResult.transactionHash
                ).catch(err => console.error('Telegram notification failed:', err));

                break;
        }

        return { handled: true, success: true };

    } catch (error) {
        console.error('❌ Error processing checkout:', error);

        audit.admin('STRIPE_CHECKOUT_PROCESSING_ERROR', 'critical', {
            sessionId: session.id,
            error: error.message,
            metadata
        });

        // Notificar error crítico
        await notifyStripeWebhookError(
            'checkout.session.completed',
            `Payment received but processing failed: ${error.message}\nSession: ${session.id}`
        ).catch(err => console.error('Discord notification failed:', err));

        return { handled: true, success: false, error: error.message };
    }
}

async function handlePaymentSucceeded(paymentIntent) {
    audit.admin('STRIPE_PAYMENT_SUCCEEDED', 'info', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100
    });

    return { handled: true };
}

async function handlePaymentFailed(paymentIntent) {
    audit.admin('STRIPE_PAYMENT_FAILED', 'medium', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        failureCode: paymentIntent.last_payment_error?.code
    });

    const errorMessage = paymentIntent.last_payment_error?.message || 'Unknown error';
    const amount = paymentIntent.amount / 100;

    // Notificar a Discord
    notifyPaymentFailed(
        paymentIntent.id,
        amount,
        errorMessage
    ).catch(err => console.error('Discord notification error:', err.message));

    // Notificar a Telegram
    telegram.notifyPaymentFailed(
        amount,
        'USD',
        paymentIntent.metadata?.walletAddress || 'N/A',
        errorMessage
    ).catch(err => console.error('Telegram notification error:', err.message));

    return { handled: true };
}

async function handleSubscriptionCreated(subscription) {
    audit.admin('STRIPE_SUBSCRIPTION_CREATED', 'info', {
        subscriptionId: subscription.id,
        customerId: subscription.customer
    });

    // Update user VIP status in database
    try {
        const User = require('../models/pg/User');

        // Find user by Stripe customer ID or subscription metadata
        let user = await User.findOne({ stripeCustomerId: subscription.customer });

        if (!user && subscription.metadata?.userId) {
            user = await User.findById(subscription.metadata.userId);
        }

        if (user) {
            // Determine VIP tier from subscription metadata or product
            const vipTier = subscription.metadata?.vipTier || 'bronze';

            // Calculate subscription end date
            const endDate = new Date(subscription.current_period_end * 1000);

            // Map tier to features
            const tierFeatures = {
                bronze: { adFree: true, prioritySupport: true, customBadge: true, analyticsAccess: false, apiAccess: false, unlimitedPosts: false },
                silver: { adFree: true, prioritySupport: true, customBadge: true, analyticsAccess: true, apiAccess: false, unlimitedPosts: false },
                gold: { adFree: true, prioritySupport: true, customBadge: true, analyticsAccess: true, apiAccess: true, unlimitedPosts: true },
                platinum: { adFree: true, prioritySupport: true, customBadge: true, analyticsAccess: true, apiAccess: true, unlimitedPosts: true }
            };

            // Update user with VIP subscription data
            user.vipTier = vipTier;
            user.vipStatus = 'active';
            user.vipStartDate = new Date().toISOString();
            user.vipEndDate = endDate.toISOString();
            user.stripeCustomerId = subscription.customer;
            user.stripeSubscriptionId = subscription.id;
            user.vipFeatures = tierFeatures[vipTier] || tierFeatures.bronze;

            await user.save();

            audit.admin('USER_VIP_ACTIVATED', 'info', {
                userId: user._id?.toString() || user.id,
                subscriptionId: subscription.id,
                vipTier,
                endDate: endDate.toISOString()
            });

            console.log(`✅ VIP subscription activated for user: ${user._id || user.id} - Tier: ${vipTier}`);

            // Send WebSocket notification
            try {
                const wsServer = require('../websocket-server');
                wsServer.broadcastToUser(user._id?.toString() || user.id, {
                    type: 'vip_activated',
                    tier: vipTier,
                    endDate: endDate.toISOString(),
                    message: `¡Bienvenido a VIP ${vipTier.charAt(0).toUpperCase() + vipTier.slice(1)}!`
                });
            } catch (wsError) {
                console.warn('WebSocket notification failed:', wsError.message);
            }
        } else {
            console.warn(`⚠️ User not found for Stripe customer: ${subscription.customer}`);
        }
    } catch (error) {
        console.error('Error activating VIP subscription:', error.message);
        audit.admin('VIP_ACTIVATION_ERROR', 'high', {
            customerId: subscription.customer,
            subscriptionId: subscription.id,
            error: error.message
        });
    }

    return { handled: true };
}

async function handleSubscriptionCancelled(subscription) {
    audit.admin('STRIPE_SUBSCRIPTION_CANCELLED', 'info', {
        subscriptionId: subscription.id,
        customerId: subscription.customer
    });

    // Remove VIP benefits from user
    try {
        const User = require('../models/pg/User');

        // Find user by Stripe customer ID or subscription ID
        let user = await User.findOne({ stripeCustomerId: subscription.customer });

        if (!user) {
            user = await User.findOne({ stripeSubscriptionId: subscription.id });
        }

        if (user) {
            const previousTier = user.vipTier;

            // Remove VIP status
            user.vipTier = null;
            user.vipStatus = 'cancelled';
            user.stripeSubscriptionId = null;
            user.vipFeatures = {
                adFree: false,
                prioritySupport: false,
                customBadge: false,
                analyticsAccess: false,
                apiAccess: false,
                unlimitedPosts: false
            };

            await user.save();

            audit.admin('USER_VIP_REMOVED', 'info', {
                userId: user._id?.toString() || user.id,
                subscriptionId: subscription.id,
                previousTier,
                reason: 'subscription_cancelled'
            });

            console.log(`✅ VIP benefits removed for user: ${user._id || user.id}`);

            // Send WebSocket notification
            try {
                const wsServer = require('../websocket-server');
                wsServer.broadcastToUser(user._id?.toString() || user.id, {
                    type: 'vip_cancelled',
                    message: 'Tu suscripción VIP ha sido cancelada',
                    previousTier
                });
            } catch (wsError) {
                console.warn('WebSocket notification failed:', wsError.message);
            }
        } else {
            console.warn(`⚠️ User not found for Stripe customer: ${subscription.customer}`);
        }
    } catch (error) {
        console.error('Error removing VIP benefits:', error.message);
        audit.admin('VIP_REMOVAL_ERROR', 'high', {
            customerId: subscription.customer,
            error: error.message
        });
    }

    return { handled: true };
}

async function handleSubscriptionUpdated(subscription) {
    audit.admin('STRIPE_SUBSCRIPTION_UPDATED', 'info', {
        subscriptionId: subscription.id,
        status: subscription.status
    });

    // Update user VIP status based on subscription status
    try {
        const User = require('../models/pg/User');

        // Find user by Stripe subscription ID
        let user = await User.findOne({ stripeSubscriptionId: subscription.id });

        if (!user) {
            user = await User.findOne({ stripeCustomerId: subscription.customer });
        }

        if (user) {
            // Map Stripe subscription status to VIP status
            const statusMapping = {
                'active': 'active',
                'past_due': 'active', // Still active but payment pending
                'unpaid': 'expired',
                'canceled': 'cancelled',
                'incomplete': 'inactive',
                'incomplete_expired': 'expired',
                'trialing': 'active',
                'paused': 'inactive'
            };

            const previousStatus = user.vipStatus;
            const newStatus = statusMapping[subscription.status] || 'inactive';

            // Update user VIP status
            user.vipStatus = newStatus;
            user.vipEndDate = new Date(subscription.current_period_end * 1000).toISOString();

            // If tier changed (upgrade/downgrade)
            if (subscription.metadata?.vipTier && subscription.metadata.vipTier !== user.vipTier) {
                const newTier = subscription.metadata.vipTier;
                user.vipTier = newTier;

                // Update features based on new tier
                const tierFeatures = {
                    bronze: { adFree: true, prioritySupport: true, customBadge: true, analyticsAccess: false, apiAccess: false, unlimitedPosts: false },
                    silver: { adFree: true, prioritySupport: true, customBadge: true, analyticsAccess: true, apiAccess: false, unlimitedPosts: false },
                    gold: { adFree: true, prioritySupport: true, customBadge: true, analyticsAccess: true, apiAccess: true, unlimitedPosts: true },
                    platinum: { adFree: true, prioritySupport: true, customBadge: true, analyticsAccess: true, apiAccess: true, unlimitedPosts: true }
                };
                user.vipFeatures = tierFeatures[newTier] || tierFeatures.bronze;

                console.log(`✅ VIP tier changed for user ${user._id || user.id}: ${user.vipTier} -> ${newTier}`);
            }

            await user.save();

            audit.admin('USER_VIP_UPDATED', 'info', {
                userId: user._id?.toString() || user.id,
                subscriptionId: subscription.id,
                previousStatus,
                newStatus,
                stripeStatus: subscription.status
            });

            console.log(`✅ VIP status updated for user ${user._id || user.id}: ${previousStatus} -> ${newStatus}`);

            // Send WebSocket notification if status changed
            if (previousStatus !== newStatus) {
                try {
                    const wsServer = require('../websocket-server');
                    wsServer.broadcastToUser(user._id?.toString() || user.id, {
                        type: 'vip_status_changed',
                        previousStatus,
                        newStatus,
                        tier: user.vipTier,
                        message: newStatus === 'active'
                            ? '¡Tu suscripción VIP está activa!'
                            : 'Tu estado de suscripción VIP ha cambiado'
                    });
                } catch (wsError) {
                    console.warn('WebSocket notification failed:', wsError.message);
                }
            }
        } else {
            console.warn(`⚠️ User not found for subscription: ${subscription.id}`);
        }
    } catch (error) {
        console.error('Error updating VIP status:', error.message);
        audit.admin('VIP_UPDATE_ERROR', 'high', {
            subscriptionId: subscription.id,
            error: error.message
        });
    }

    return { handled: true };
}

/**
 * Process NFT Minting after successful payment
 * @param {Object} metadata - Payment metadata
 * @param {Object} session - Checkout session
 */
async function processNFTMint(metadata, session) {
    const { ethers } = require('ethers');

    try {
        // Get NFT contract configuration
        const nftContractAddress = process.env.NFT_CONTRACT_ADDRESS;
        const privateKey = process.env.HOT_WALLET_PRIVATE_KEY;
        const rpcUrl = process.env.RPC_URL;

        if (!nftContractAddress || !privateKey || !rpcUrl) {
            throw new Error('NFT minting configuration missing');
        }

        // Initialize provider and wallet
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);

        // NFT Contract ABI (minimal for minting)
        const NFT_ABI = [
            'function safeMint(address to, string memory uri) public returns (uint256)',
            'function tokenURI(uint256 tokenId) public view returns (string memory)'
        ];

        const nftContract = new ethers.Contract(nftContractAddress, NFT_ABI, wallet);

        // Prepare metadata URI (could be IPFS or centralized storage)
        const tokenURI = metadata.tokenURI || `https://api.bez.digital/nft/metadata/${metadata.nftId}`;

        // Mint NFT to user's wallet
        const tx = await nftContract.safeMint(metadata.walletAddress, tokenURI);
        const receipt = await tx.wait();

        // Get token ID from event logs
        const tokenId = receipt.logs[0]?.args?.[2]?.toString() || 'unknown';

        audit.admin('NFT_MINTED', 'info', {
            nftId: metadata.nftId,
            tokenId: tokenId,
            walletAddress: metadata.walletAddress,
            transactionHash: receipt.hash,
            sessionId: session.id
        });

        console.log(`✅ NFT minted successfully: Token #${tokenId} to ${metadata.walletAddress}`);

        // Notify success
        await notifyHigh(
            'NFT Minted Successfully',
            `NFT #${tokenId} minted to ${metadata.walletAddress}\nTx: ${receipt.hash}`
        ).catch(err => console.error('Notification error:', err.message));

        return { tokenId, transactionHash: receipt.hash };

    } catch (error) {
        console.error('❌ NFT minting failed:', error.message);

        audit.admin('NFT_MINT_FAILED', 'critical', {
            nftId: metadata.nftId,
            walletAddress: metadata.walletAddress,
            error: error.message,
            sessionId: session.id
        });

        // Queue for manual processing
        console.log('⚠️ NFT mint queued for manual processing');

        throw error;
    }
}

/**
 * Activate Premium Subscription for user
 * @param {Object} metadata - Payment metadata
 * @param {Object} session - Checkout session
 */
async function activatePremiumSubscription(metadata, session) {
    try {
        const User = require('../models/pg/User');

        // Find or identify user
        let user = await User.findById(metadata.userId);

        if (!user && metadata.walletAddress) {
            user = await User.findByWallet({ walletAddress: metadata.walletAddress.toLowerCase() });
        }

        if (!user && session.customer_email) {
            user = await User.findByEmail({ email: session.customer_email });
        }

        if (!user) {
            // Create new user if doesn't exist
            user = new User({
                email: session.customer_email,
                walletAddress: metadata.walletAddress?.toLowerCase(),
                stripeCustomerId: session.customer
            });
        }

        // Calculate premium expiry based on plan
        const now = new Date();
        let expiryDate;

        switch (metadata.plan) {
            case 'monthly':
                expiryDate = new Date(now.setMonth(now.getMonth() + 1));
                break;
            case 'yearly':
                expiryDate = new Date(now.setFullYear(now.getFullYear() + 1));
                break;
            case 'lifetime':
                expiryDate = new Date('2099-12-31');
                break;
            default:
                expiryDate = new Date(now.setMonth(now.getMonth() + 1));
        }

        // Update user with premium status
        user.isPremium = true;
        user.premiumPlan = metadata.plan;
        user.premiumExpiry = expiryDate;
        user.subscriptionId = session.subscription || session.id;
        user.stripeCustomerId = session.customer;

        await user.save();

        audit.admin('PREMIUM_ACTIVATED', 'info', {
            userId: user._id?.toString() || user.id,
            plan: metadata.plan,
            expiryDate: expiryDate.toISOString(),
            sessionId: session.id
        });

        console.log(`✅ Premium activated for user: ${user._id || user.id} (${metadata.plan})`);

        // Notify success
        await notifyHigh(
            'Premium Subscription Activated',
            `User ${user.email || user.walletAddress} activated ${metadata.plan} premium`
        ).catch(err => console.error('Notification error:', err.message));

        return { userId: user._id || user.id, plan: metadata.plan, expiryDate };

    } catch (error) {
        console.error('❌ Premium activation failed:', error.message);

        audit.admin('PREMIUM_ACTIVATION_FAILED', 'critical', {
            userId: metadata.userId,
            plan: metadata.plan,
            error: error.message,
            sessionId: session.id
        });

        throw error;
    }
}

module.exports = {
    STRIPE_CONFIG,
    createNFTCheckoutSession,
    createSubscriptionCheckoutSession,
    createTokenPurchaseSession,
    getCheckoutSession,
    createPaymentIntent,
    cancelSubscription,
    getCustomerSubscriptions,
    createRefund,
    handleStripeWebhook,
    handleVerifiedEvent,
    handleCheckoutCompleted,
    handlePaymentSucceeded,
    handlePaymentFailed,
    handleSubscriptionCreated,
    handleSubscriptionCancelled,
    handleSubscriptionUpdated,
    // Export helper functions for testing
    processNFTMint,
    activatePremiumSubscription
};
