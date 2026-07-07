/**
 * paymentWebhooks.js — outbound payment webhooks with retries.
 *
 * Registered apps subscribe a URL (POST /api/gateway/v1/webhooks/register);
 * payment events are enqueued in payment_webhook_deliveries and a dispatcher
 * loop POSTs them signed with:
 *
 *     X-BeZhas-Signature: sha256=<hex(hmacSha256(secret, rawBody))>
 *
 * — exactly the format @bezhas/connect `webhooks.verify` checks, so an
 * integrator's endpoint verifies deliveries with the SDK out of the box.
 *
 * Retry policy: exponential backoff (BASE_BACKOFF_MS × 2^attempts, capped),
 * up to max_attempts, then the delivery is parked as 'dead' (dead-letter) and
 * visible via GET /webhooks/deliveries for manual replay.
 */
const crypto = require('crypto');
const { query } = require('../db/pool');
const logger = require('pino')({ level: 'info', name: 'payment-webhooks' });

const BASE_BACKOFF_MS = parseInt(process.env.WEBHOOK_BACKOFF_BASE_MS || '30000', 10);   // 30s
const MAX_BACKOFF_MS = parseInt(process.env.WEBHOOK_BACKOFF_MAX_MS || '3600000', 10);   // 1h
const REQUEST_TIMEOUT_MS = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10);
const BATCH_SIZE = 20;

function sign(secret, rawBody) {
    return `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

/** Backoff for the NEXT attempt after `attempts` tries (capped exponential). */
function backoffMs(attempts) {
    return Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
}

/**
 * Enqueue an event for every active webhook of `appId` subscribed to it.
 * Returns the number of deliveries enqueued. Never throws on "no webhooks".
 */
async function emit(appId, eventName, data) {
    const { rows: hooks } = await query(
        `SELECT id, events FROM payment_webhooks
         WHERE app_id = $1 AND is_active = TRUE`,
        [appId]
    );
    const subscribed = hooks.filter((h) => {
        const events = Array.isArray(h.events) ? h.events : [];
        return events.includes(eventName) || events.includes('*');
    });
    if (subscribed.length === 0) return 0;

    const payload = {
        event: eventName,
        data,
        createdAt: new Date().toISOString(),
    };
    for (const hook of subscribed) {
        await query(
            `INSERT INTO payment_webhook_deliveries (webhook_id, event_name, payload)
             VALUES ($1, $2, $3::jsonb)`,
            [hook.id, eventName, JSON.stringify(payload)]
        );
    }
    logger.info({ appId, eventName, deliveries: subscribed.length }, 'Webhook event enqueued');
    return subscribed.length;
}

/**
 * Attempt one delivery. Exported for tests; processQueue drives it.
 * @returns {'delivered'|'retry'|'dead'}
 */
async function attemptDelivery(delivery, hook, fetchImpl = fetch) {
    const rawBody = JSON.stringify({ ...delivery.payload, deliveryId: delivery.id });
    let httpStatus = null;
    let error = null;
    try {
        const res = await fetchImpl(hook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BeZhas-Signature': sign(hook.secret, rawBody),
                'X-BeZhas-Event': delivery.event_name,
                'X-BeZhas-Delivery': String(delivery.id),
            },
            body: rawBody,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        httpStatus = res.status;
        if (res.ok) {
            await query(
                `UPDATE payment_webhook_deliveries
                 SET status = 'delivered', attempts = attempts + 1, last_http_status = $1, updated_at = NOW()
                 WHERE id = $2`,
                [httpStatus, delivery.id]
            );
            return 'delivered';
        }
        error = `HTTP ${res.status}`;
    } catch (err) {
        error = err.message;
    }

    const attempts = delivery.attempts + 1;
    const dead = attempts >= delivery.max_attempts;
    await query(
        `UPDATE payment_webhook_deliveries
         SET status = $1, attempts = $2, last_http_status = $3, last_error = $4,
             next_attempt_at = NOW() + ($5 || ' milliseconds')::interval, updated_at = NOW()
         WHERE id = $6`,
        [dead ? 'dead' : 'pending', attempts, httpStatus, error, String(backoffMs(attempts)), delivery.id]
    );
    if (dead) {
        logger.warn({ deliveryId: delivery.id, url: hook.url, attempts, error }, 'Webhook delivery dead-lettered');
    }
    return dead ? 'dead' : 'retry';
}

/** Process due deliveries once. Returns per-status counters (for tests/metrics). */
async function processQueue(fetchImpl = fetch) {
    const { rows } = await query(
        `SELECT d.id, d.webhook_id, d.event_name, d.payload, d.attempts, d.max_attempts,
                w.url, w.secret
         FROM payment_webhook_deliveries d
         JOIN payment_webhooks w ON w.id = d.webhook_id AND w.is_active = TRUE
         WHERE d.status = 'pending' AND d.next_attempt_at <= NOW()
         ORDER BY d.next_attempt_at ASC
         LIMIT ${BATCH_SIZE}`
    );
    const counters = { delivered: 0, retry: 0, dead: 0 };
    for (const row of rows) {
        const outcome = await attemptDelivery(row, { url: row.url, secret: row.secret }, fetchImpl);
        counters[outcome] += 1;
    }
    return counters;
}

let _timer = null;

/** Start the dispatcher loop (idempotent). Gate with PAYMENTS_WEBHOOKS_ENABLED. */
function startDispatcher(intervalMs = 15_000) {
    if (_timer) return _timer;
    _timer = setInterval(() => {
        processQueue().catch((err) => logger.error({ err: err.message }, 'Webhook queue tick failed'));
    }, intervalMs);
    _timer.unref?.();
    logger.info({ intervalMs }, 'Payment webhook dispatcher started');
    return _timer;
}

function stopDispatcher() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

function generateSecret() {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

module.exports = {
    emit,
    processQueue,
    attemptDelivery,
    startDispatcher,
    stopDispatcher,
    generateSecret,
    sign,
    backoffMs,
};
