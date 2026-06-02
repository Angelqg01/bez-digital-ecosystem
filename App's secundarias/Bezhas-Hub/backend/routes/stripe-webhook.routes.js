/**
 * ============================================================================
 * UNIFIED STRIPE WEBHOOK ROUTER
 * ============================================================================
 * 
 * Single canonical endpoint for ALL Stripe webhook events.
 * 
 * CRITICAL: This router MUST be mounted BEFORE express.json() in server.js
 * so that the raw request body is preserved for signature verification.
 * 
 * Consolidates webhook handling from:
 *   - stripe.routes.js    (checkout, payments, subscriptions)
 *   - payment.routes.js   (checkout, payments)
 *   - vip.routes.js       (VIP subscription events)
 *   - subscription.routes.js (unified subscription events)
 *   - billing.routes.js   (ad billing payment intents)
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

/**
 * POST /api/stripe/webhook
 * 
 * Receives ALL Stripe webhook events, verifies the signature,
 * and dispatches to the appropriate service handler.
 * 
 * Uses express.raw() — no other body parser should run before this.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
        console.error('[STRIPE WEBHOOK] Missing stripe-signature header');
        return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;

    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    console.log(`[STRIPE WEBHOOK] Received event: ${event.type} (${event.id})`);

    // -----------------------------------------------------------------------
    // Dispatch event to the appropriate service handler(s)
    // -----------------------------------------------------------------------
    try {
        const results = await dispatchEvent(event);

        res.json({
            received: true,
            eventType: event.type,
            handled: results.some(r => r.handled !== false)
        });

    } catch (error) {
        console.error(`[STRIPE WEBHOOK] Error processing ${event.type}:`, error);

        // Still return 200 to prevent Stripe from retrying indefinitely
        // The error is logged for investigation
        res.status(200).json({
            received: true,
            eventType: event.type,
            error: error.message
        });
    }
});

// ============================================================================
// EVENT DISPATCHER
// ============================================================================

/**
 * Routes each Stripe event to the correct service handler(s).
 * Some events may be relevant to multiple services (e.g. checkout.session.completed
 * could be for a VIP subscription, a token purchase, or an ad billing top-up).
 */
async function dispatchEvent(event) {
    const results = [];

    switch (event.type) {
        // ----- Checkout & Payment Events (stripe.service.js) -----
        case 'checkout.session.completed':
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed': {
            const stripeService = safeRequire('../services/stripe.service');
            if (stripeService?.handleStripeWebhook) {
                // handleStripeWebhook does its own event-type switching internally
                const result = await stripeService.handleStripeWebhook.__dispatchOnly
                    ? stripeService.handleStripeWebhook(event)
                    : handleViaStripeService(stripeService, event);
                results.push(result);
            }

            // Also handle billing ad-balance top-ups for payment_intent.succeeded
            if (event.type === 'payment_intent.succeeded') {
                const billingResult = await handleBillingPayment(event.data.object);
                if (billingResult) results.push(billingResult);
            }
            break;
        }

        // ----- Subscription Lifecycle -----
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            // VIP subscription handler
            const vipService = safeRequire('../services/vip.service');
            if (vipService?.handleSubscriptionWebhook) {
                const result = await vipService.handleSubscriptionWebhook(event);
                results.push({ handled: true, source: 'vip', result });
            }

            // Unified subscription handler (tier-based staking + AI)
            const subscriptionService = safeRequire('../services/subscription.service');
            if (subscriptionService?.handleStripeWebhook) {
                const result = await subscriptionService.handleStripeWebhook(event);
                results.push({ handled: true, source: 'subscription', result });
            }

            // Also dispatch to stripe.service for its own sub handlers
            const stripeService = safeRequire('../services/stripe.service');
            if (stripeService?.handleStripeWebhook) {
                const result = await handleViaStripeService(stripeService, event);
                results.push(result);
            }
            break;
        }

        // ----- Invoice Events (subscription billing) -----
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed': {
            const subscriptionService = safeRequire('../services/subscription.service');
            if (subscriptionService?.handleStripeWebhook) {
                const result = await subscriptionService.handleStripeWebhook(event);
                results.push({ handled: true, source: 'subscription', result });
            }
            break;
        }

        default:
            console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
            results.push({ handled: false });
    }

    return results;
}

// ============================================================================
// HELPER: Call stripe.service.handleStripeWebhook with raw body reconstruction
// ============================================================================

/**
 * stripe.service.js's handleStripeWebhook expects (rawBody, signature) and
 * does its own constructEvent internally. Since we've already verified the
 * event, we pass the event object directly by calling the individual handlers.
 */
async function handleViaStripeService(stripeService, event) {
    try {
        // The stripe service has individual handler functions exported or
        // we can call handleStripeWebhook which does its own dispatch.
        // Since we already verified the signature, we pass the pre-verified event.

        // Check if the service has a direct event handler
        if (typeof stripeService.handleVerifiedEvent === 'function') {
            return await stripeService.handleVerifiedEvent(event);
        }

        // Fallback: call the internal handlers directly based on event type
        switch (event.type) {
            case 'checkout.session.completed':
                if (stripeService.handleCheckoutCompleted) {
                    return { handled: true, source: 'stripe', result: await stripeService.handleCheckoutCompleted(event.data.object) };
                }
                break;
            case 'payment_intent.succeeded':
                if (stripeService.handlePaymentSucceeded) {
                    return { handled: true, source: 'stripe', result: await stripeService.handlePaymentSucceeded(event.data.object) };
                }
                break;
            case 'payment_intent.payment_failed':
                if (stripeService.handlePaymentFailed) {
                    return { handled: true, source: 'stripe', result: await stripeService.handlePaymentFailed(event.data.object) };
                }
                break;
            case 'customer.subscription.created':
                if (stripeService.handleSubscriptionCreated) {
                    return { handled: true, source: 'stripe', result: await stripeService.handleSubscriptionCreated(event.data.object) };
                }
                break;
            case 'customer.subscription.deleted':
                if (stripeService.handleSubscriptionCancelled) {
                    return { handled: true, source: 'stripe', result: await stripeService.handleSubscriptionCancelled(event.data.object) };
                }
                break;
            case 'customer.subscription.updated':
                if (stripeService.handleSubscriptionUpdated) {
                    return { handled: true, source: 'stripe', result: await stripeService.handleSubscriptionUpdated(event.data.object) };
                }
                break;
        }

        return { handled: false, source: 'stripe' };
    } catch (error) {
        console.error(`[STRIPE WEBHOOK] stripe.service error for ${event.type}:`, error.message);
        return { handled: false, source: 'stripe', error: error.message };
    }
}

// ============================================================================
// HELPER: Handle billing ad-balance top-ups
// ============================================================================

async function handleBillingPayment(paymentIntent) {
    try {
        // Only process if this is an ad balance top-up
        if (paymentIntent.metadata?.purpose !== 'ad_balance_topup') {
            return null;
        }

        const AdBalance = safeRequire('../models/adBalance.model');
        const BillingTransaction = safeRequire('../models/billingTransaction.model');

        if (!AdBalance || !BillingTransaction) {
            console.warn('[STRIPE WEBHOOK] Billing models not available, skipping billing handler');
            return null;
        }

        // Find the transaction
        const transaction = await BillingTransaction.findOne({
            stripePaymentIntentId: paymentIntent.id
        });

        if (!transaction) {
            console.warn(`[STRIPE WEBHOOK] No billing transaction found for PI: ${paymentIntent.id}`);
            return null;
        }

        // Update transaction status
        transaction.status = 'completed';
        transaction.processedAt = new Date();
        await transaction.save();

        // Update ad balance
        let balance = await AdBalance.findOne({
            $or: [
                { userId: transaction.userId },
                { walletAddress: transaction.walletAddress }
            ]
        });

        if (!balance) {
            balance = new AdBalance({
                userId: transaction.userId,
                walletAddress: transaction.walletAddress
            });
        }

        balance.fiatBalance += transaction.amount;
        balance.totalDeposited += transaction.amount;
        balance.lastDepositAt = new Date();
        balance.updatedAt = new Date();
        await balance.save();

        console.log(`[STRIPE WEBHOOK] Billing: Balance updated for user ${transaction.userId}: +€${transaction.amount}`);

        return { handled: true, source: 'billing' };
    } catch (error) {
        console.error('[STRIPE WEBHOOK] Billing handler error:', error.message);
        return { handled: false, source: 'billing', error: error.message };
    }
}

// ============================================================================
// HELPER: Safe require (don't crash if a service is not available)
// ============================================================================

function safeRequire(modulePath) {
    try {
        return require(modulePath);
    } catch (error) {
        console.warn(`[STRIPE WEBHOOK] Could not load ${modulePath}: ${error.message}`);
        return null;
    }
}

module.exports = router;
