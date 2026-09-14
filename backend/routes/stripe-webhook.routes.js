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
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pool = require('../db/pool');

// El cliente de Stripe se crea una sola vez, no en cada petición: instanciarlo
// por evento desperdicia trabajo en el camino crítico del webhook.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ============================================================================
// LÍMITE DE PETICIONES
// ============================================================================
//
// El limitador global de `server.js` está pensado para navegadores (500 cada
// 15 minutos por IP) y se salta esta ruta a propósito: a Stripe un 429 le
// sabe a fallo y reintenta, así que limitar el webhook con ese cubo convierte
// un pico de eventos en una tormenta de reintentos que se alimenta sola.
//
// Aun así la ruta queda protegida, con un techo acorde a lo que de verdad
// manda Stripe. Es deliberadamente holgado: aquí el objetivo es frenar un
// abuso, no modelar el tráfico legítimo.
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.STRIPE_WEBHOOK_RATE_LIMIT_PER_MINUTE || 600),
    standardHeaders: true,
    legacyHeaders: false,
    // La firma ya autentica al emisor; la IP solo reparte cubos.
    handler: (req, res) => res.status(429).json({ error: 'Too many webhook requests' }),
});

// ============================================================================
// IDEMPOTENCIA
// ============================================================================
//
// Stripe entrega cada evento **al menos una vez**: reintenta ante 5xx, 429,
// timeout o respuesta ausente, escalonando durante hasta tres días. Sin
// registro de lo ya procesado, un `checkout.session.completed` reintentado
// vuelve a ejecutar la transferencia y manda los BEZ dos veces.
//
// El INSERT sobre la clave primaria es lo que decide quién procesa: si choca,
// otra entrega ya se hizo cargo.

/** Un evento que lleva demasiado en 'processing' se da por muerto y se reclama. */
const MINUTOS_PARA_RECLAMAR = 15;

/**
 * Intenta quedarse con el evento.
 * @returns {'nuevo'|'duplicado'|'reclamado'|'sin-registro'}
 *
 * 'sin-registro' es el caso en que la tabla no responde. Se devuelve para que
 * quien llama corte con un 5xx, no para seguir adelante: sin deduplicar, un
 * reintento transfiere los BEZ por segunda vez, y eso no tiene vuelta atrás.
 * Un 5xx solo retrasa el pago —Stripe reintenta durante tres días— y deja un
 * fallo ruidoso en vez de un duplicado silencioso.
 */
async function claimEvent(event, digest) {
    try {
        const insertado = await pool.query(
            `INSERT INTO stripe_webhook_events (event_id, event_type, status, payload_digest)
             VALUES ($1, $2, 'processing', $3)
             ON CONFLICT (event_id) DO NOTHING
             RETURNING event_id`,
            [event.id, event.type, digest]
        );

        if (insertado.rows.length > 0) return 'nuevo';

        // Ya existe. Tres casos distintos:
        //
        //   - 'processed': terminado. Es una repetición: no se toca.
        //   - 'failed': falló por algo pasajero y le dijimos a Stripe que
        //     volviera. Su reintento se procesa YA; hacerle esperar la ventana
        //     de reclamo sería descartar justo lo que le pedimos que mandara.
        //   - 'processing' reciente: otra entrega lo tiene ahora mismo entre
        //     manos. Se deja estar, para no duplicar la transferencia.
        //   - 'processing' viejo: el proceso que lo cogió murió a medias
        //     (despliegue, OOM). Pasada la ventana, se reclama.
        const reclamado = await pool.query(
            `UPDATE stripe_webhook_events
                SET status = 'processing',
                    attempts = attempts + 1,
                    updated_at = CURRENT_TIMESTAMP
              WHERE event_id = $1
                AND (
                      status = 'failed'
                      OR (status = 'processing'
                          AND updated_at < CURRENT_TIMESTAMP - INTERVAL '${MINUTOS_PARA_RECLAMAR} minutes')
                    )
              RETURNING event_id`,
            [event.id]
        );

        return reclamado.rows.length > 0 ? 'reclamado' : 'duplicado';
    } catch (error) {
        console.error(`[STRIPE WEBHOOK] Registro de idempotencia inaccesible: ${error.message}`);
        return 'sin-registro';
    }
}

/** Marca el resultado. Un fallo aquí no debe cambiar la respuesta a Stripe. */
async function markEvent(eventId, status, error) {
    try {
        await pool.query(
            `UPDATE stripe_webhook_events
                SET status = $2, last_error = $3, updated_at = CURRENT_TIMESTAMP
              WHERE event_id = $1`,
            [eventId, status, error ? String(error).slice(0, 2000) : null]
        );
    } catch (err) {
        console.warn(`[STRIPE WEBHOOK] No se pudo registrar el estado de ${eventId}: ${err.message}`);
    }
}

/**
 * ¿Merece la pena que Stripe reintente este fallo?
 *
 * Sí para lo transitorio —red, base de datos caída, RPC de la cadena sin
 * responder, límite de un tercero—: contestamos 5xx y Stripe vuelve con
 * reintentos escalonados. No para lo que fallará igual la próxima vez
 * (metadatos ausentes, tipo desconocido): ahí un reintento solo repite el
 * error durante tres días.
 */
const ERRORES_TRANSITORIOS = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE|socket hang up|timeout|rate limit|too many requests|temporarily unavailable|service unavailable|connection terminated|server selection/i;

function esTransitorio(error) {
    if (!error) return false;
    const codigo = error.code ? String(error.code) : '';
    const estado = error.status || error.statusCode || error?.response?.status;
    if (estado === 429 || (estado >= 500 && estado <= 599)) return true;
    return ERRORES_TRANSITORIOS.test(`${codigo} ${error.message || ''}`);
}

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
router.post('/webhook', webhookLimiter, express.raw({ type: 'application/json' }), async (req, res) => {
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
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // -----------------------------------------------------------------------
    // Idempotencia: ¿es la primera vez que vemos este evento?
    // -----------------------------------------------------------------------
    const digest = crypto.createHash('sha256').update(req.body).digest('hex');
    const reclamo = await claimEvent(event, digest);

    if (reclamo === 'sin-registro') {
        // Sin poder deduplicar no se procesa: ver `claimEvent`.
        return res.status(503).json({
            received: false,
            eventType: event.type,
            error: 'Idempotency store unavailable',
            retryable: true,
        });
    }

    if (reclamo === 'duplicado') {
        // Entrega repetida de algo ya procesado (o en curso ahora mismo).
        // 200 y nada más: repetir la transferencia mandaría los BEZ dos veces.
        console.log(`[STRIPE WEBHOOK] Evento repetido, se ignora: ${event.type} (${event.id})`);
        return res.json({ received: true, eventType: event.type, duplicate: true });
    }

    if (reclamo === 'reclamado') {
        console.warn(`[STRIPE WEBHOOK] Se retoma un evento que quedó a medias: ${event.type} (${event.id})`);
    }

    console.log(`[STRIPE WEBHOOK] Received event: ${event.type} (${event.id})`);

    // -----------------------------------------------------------------------
    // Dispatch event to the appropriate service handler(s)
    // -----------------------------------------------------------------------
    try {
        const results = await dispatchEvent(event);

        // Los handlers capturan sus propios errores y los devuelven en el
        // resultado en vez de lanzarlos, así que un fallo no llega como
        // excepción: hay que buscarlo aquí. Antes no se miraba, y un pago que
        // no se había procesado se despachaba con un 200 alegre.
        const fallos = results.filter((r) => r && r.error);

        if (fallos.length > 0) {
            const transitorio = fallos.some((f) => esTransitorio(f.cause || new Error(f.error)));
            const detalle = fallos.map((f) => `${f.source}: ${f.error}`).join('; ');

            await markEvent(event.id, transitorio ? 'failed' : 'processed', detalle);

            if (transitorio) {
                return res.status(503).json({
                    received: false,
                    eventType: event.type,
                    error: detalle,
                    retryable: true,
                });
            }

            return res.status(200).json({
                received: true,
                eventType: event.type,
                error: detalle,
            });
        }

        await markEvent(event.id, 'processed', null);

        res.json({
            received: true,
            eventType: event.type,
            // `=== true` y no `!== false`: un resultado sin la propiedad (o una
            // promesa, como pasaba antes) no debe contar como gestionado.
            handled: results.some(r => r && r.handled === true)
        });

    } catch (error) {
        console.error(`[STRIPE WEBHOOK] Error processing ${event.type}:`, error);

        // Antes esto respondía 200 SIEMPRE, «para que Stripe no reintente en
        // bucle». Suena prudente y es justo al revés: ante un fallo pasajero
        // —la RPC de la cadena caída, la base de datos sin responder— un 200
        // le dice a Stripe que todo fue bien y el evento no vuelve nunca. El
        // cliente paga y no recibe sus tokens, y nadie se entera.
        //
        // Stripe no reintenta en bucle: escalona los reintentos y se rinde a
        // los tres días. Así que lo transitorio merece un 5xx —que vuelva— y
        // lo que fallará igual la próxima vez merece un 200, para no repetir
        // el mismo error durante tres días.
        const transitorio = esTransitorio(error);
        await markEvent(event.id, transitorio ? 'failed' : 'processed', error.message);

        if (transitorio) {
            return res.status(503).json({
                received: false,
                eventType: event.type,
                error: error.message,
                retryable: true,
            });
        }

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
                // OJO: aquí había un fallo de precedencia de operadores.
                //
                //   const result = await svc.handleStripeWebhook.__dispatchOnly
                //       ? svc.handleStripeWebhook(event)
                //       : handleViaStripeService(svc, event);
                //
                // `await` liga más fuerte que `?:`, así que eso se evaluaba como
                // `(await ...__dispatchOnly) ? A : B`: se esperaba a una
                // propiedad `undefined` y la rama elegida se quedaba SIN await.
                // Consecuencias reales, las tres malas:
                //
                //   1. `results` recibía una Promesa, no un resultado. El
                //      `results.some(r => r.handled !== false)` de abajo leía
                //      `undefined !== false` y respondía siempre `handled: true`,
                //      aunque no se hubiera gestionado nada.
                //   2. Se contestaba 200 a Stripe ANTES de terminar de procesar.
                //      Un pago podía darse por bueno mientras su procesamiento
                //      fallaba en silencio.
                //   3. Cualquier rechazo que escapara al try/catch interno de
                //      `handleViaStripeService` quedaba sin capturar, fuera ya
                //      del try/catch de esta ruta, que había respondido antes.
                //
                // `handleStripeWebhook` espera (rawBody, signature) y vuelve a
                // verificar la firma; aquí el evento ya viene verificado, así
                // que se despacha por `handleViaStripeService`, que usa
                // `handleVerifiedEvent`.
                const result = await handleViaStripeService(stripeService, event);
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
        // `cause` lleva el error tal cual para que quien responda a Stripe
        // pueda mirarle el `code`/`status` y decidir si merece un reintento.
        // Sin esto el fallo quedaba enterrado aquí: la ruta contestaba 200 y
        // ni Stripe ni nadie se enteraba de que el pago no se había procesado.
        return { handled: false, source: 'stripe', error: error.message, cause: error };
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
        return { handled: false, source: 'billing', error: error.message, cause: error };
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
