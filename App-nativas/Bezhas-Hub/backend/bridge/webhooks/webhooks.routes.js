/**
 * Bridge Webhooks Router
 * 
 * Centralized webhook receiver for all external platforms.
 * Routes webhooks to the appropriate adapter based on platform.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../../utils/logger');
const { bridgeCore } = require('../core/bridgeCore');

// Rate limiting
const rateLimit = require('express-rate-limit');
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // 200 webhooks per minute
    message: { error: 'Too many webhook requests' },
});

/**
 * Middleware to capture raw body for signature verification
 */
const captureRawBody = (req, res, next) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
        req.rawBody = data;
        next();
    });
};

/**
 * POST /webhooks/:platform
 * Universal webhook receiver
 */
router.post('/:platform', webhookLimiter, captureRawBody, async (req, res) => {
    const { platform } = req.params;

    try {
        logger.info({ platform, headers: req.headers }, 'Webhook received');

        // Get the adapter for this platform
        const adapter = bridgeCore.getAdapter(platform);

        if (!adapter) {
            logger.warn({ platform }, 'Webhook for unregistered platform');
            return res.status(404).json({
                success: false,
                error: `Platform ${platform} not registered`,
            });
        }

        // Validate webhook signature (if implemented by adapter)
        if (!adapter.validateWebhookSignature(req.headers, req.rawBody)) {
            logger.warn({ platform }, 'Invalid webhook signature');
            return res.status(401).json({
                success: false,
                error: 'Invalid webhook signature',
            });
        }

        // Determine event type from headers or body
        const eventType = extractEventType(platform, req);

        // Process webhook through adapter
        const result = await bridgeCore.processWebhook(platform, eventType, req.body);

        logger.info({ platform, eventType, result }, 'Webhook processed');

        res.status(200).json({
            success: true,
            ...result,
        });

    } catch (error) {
        logger.error({ error, platform }, 'Webhook processing error');
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed',
            message: error.message,
        });
    }
});

/**
 * POST /webhooks/vinted
 * Dedicated Vinted webhook endpoint
 */
router.post('/vinted', webhookLimiter, express.json(), async (req, res) => {
    try {
        const eventType = req.headers['x-vinted-event'] || req.body.event_type;

        const result = await bridgeCore.processWebhook('vinted', eventType, req.body);

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        logger.error({ error }, 'Vinted webhook error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /webhooks/maersk
 * Dedicated Maersk webhook endpoint
 */
router.post('/maersk', webhookLimiter, express.json(), async (req, res) => {
    try {
        const eventType = req.body.eventType || req.body.type || 'shipment.status.changed';

        const result = await bridgeCore.processWebhook('maersk', eventType, req.body);

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        logger.error({ error }, 'Maersk webhook error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /webhooks/airbnb
 * Dedicated Airbnb webhook endpoint
 */
router.post('/airbnb', webhookLimiter, express.json(), async (req, res) => {
    try {
        const eventType = req.body.event || req.body.type;

        const result = await bridgeCore.processWebhook('airbnb', eventType, req.body);

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        logger.error({ error }, 'Airbnb webhook error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /webhooks/health
 * Webhook system health check
 */
router.get('/health', async (req, res) => {
    const health = await bridgeCore.healthCheck();

    res.status(200).json({
        success: true,
        status: 'operational',
        adapters: health,
        timestamp: new Date(),
    });
});

/**
 * Extract event type from request based on platform conventions
 */
function extractEventType(platform, req) {
    switch (platform) {
        case 'vinted':
            return req.headers['x-vinted-event'] || req.body.event_type;
        case 'maersk':
            return req.body.eventType || req.body.type;
        case 'airbnb':
            return req.body.event || req.body.type;
        case 'stripe':
            return req.body.type;
        case 'paypal':
            return req.body.event_type;
        default:
            return req.body.event || req.body.type || req.body.eventType || 'unknown';
    }
}

module.exports = router;
