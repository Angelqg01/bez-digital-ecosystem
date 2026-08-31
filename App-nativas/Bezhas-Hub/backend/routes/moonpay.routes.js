/**
 * MoonPay Integration Routes
 * Backend endpoints for MoonPay transaction tracking
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { protect } = require('../middleware/auth.middleware');

// MoonPay API Configuration
const MOONPAY_SECRET_KEY = process.env.MOONPAY_SECRET_KEY || '';
const MOONPAY_API_BASE = 'https://api.moonpay.com';

// Webhook signing key from the MoonPay dashboard (distinct from the API
// secret). Read per-request so key rotation doesn't require a code reload.
function getWebhookKey() {
    return process.env.MOONPAY_WEBHOOK_KEY || process.env.MOONPAY_SECRET_KEY || '';
}

/**
 * Raw bytes MoonPay signed. If this router is mounted before express.json()
 * the route-level express.raw() gives us the exact Buffer; if a global JSON
 * parser already consumed the body we fall back to re-serializing (mount this
 * router before express.json() to avoid that fallback).
 */
function rawBodyOf(req) {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body);
    return Buffer.from(JSON.stringify(req.body || {}));
}

function timingSafeEqual(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a MoonPay webhook signature. Supports both formats:
 *  - v2 header `Moonpay-Signature-V2`: "t=<timestamp>,s=<hex>" where
 *    <hex> = HMAC-SHA256(webhookKey, `${timestamp}.${rawBody}`)
 *  - legacy header `Moonpay-Signature`: base64 HMAC-SHA256(webhookKey, rawBody)
 * https://dev.moonpay.com/docs/webhooks
 */
function verifyMoonPayWebhook(req) {
    const key = getWebhookKey();
    if (!key) return false;
    const raw = rawBodyOf(req);
    const v2 = req.headers['moonpay-signature-v2'];
    if (v2) {
        const parts = Object.fromEntries(
            String(v2).split(',').map((kv) => kv.split('=').map((s) => s.trim()))
        );
        if (!parts.t || !parts.s) return false;
        const expected = crypto
            .createHmac('sha256', key)
            .update(`${parts.t}.${raw.toString('utf8')}`)
            .digest('hex');
        return timingSafeEqual(parts.s, expected);
    }
    const v1 = req.headers['moonpay-signature'];
    if (v1) {
        const expected = crypto
            .createHmac('sha256', key)
            .update(raw)
            .digest('base64');
        return timingSafeEqual(String(v1), expected);
    }
    return false;
}

/**
 * GET /api/moonpay/transaction/:id
 * Get MoonPay transaction status
 */
router.get('/transaction/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        if (!MOONPAY_SECRET_KEY) {
            return res.status(503).json({
                error: 'MoonPay not configured',
                message: 'MoonPay secret key is not set in environment variables'
            });
        }

        // Fetch transaction from MoonPay API
        const response = await axios.get(
            `${MOONPAY_API_BASE}/v3/transactions/${id}`,
            {
                headers: {
                    'Authorization': `Api-Key ${MOONPAY_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            transaction: response.data
        });

    } catch (error) {
        console.error('Error fetching MoonPay transaction:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch transaction',
            message: error.response?.data?.message || error.message
        });
    }
});

/**
 * GET /api/moonpay/transactions
 * Get user's MoonPay transactions
 */
router.get('/transactions', protect, async (req, res) => {
    try {
        const { walletAddress } = req.query;

        if (!walletAddress) {
            return res.status(400).json({
                error: 'Missing wallet address',
                message: 'walletAddress query parameter is required'
            });
        }

        if (!MOONPAY_SECRET_KEY) {
            return res.status(503).json({
                error: 'MoonPay not configured',
                message: 'MoonPay secret key is not set in environment variables'
            });
        }

        // Fetch transactions from MoonPay API
        const response = await axios.get(
            `${MOONPAY_API_BASE}/v3/transactions`,
            {
                params: {
                    walletAddress,
                    limit: 50
                },
                headers: {
                    'Authorization': `Api-Key ${MOONPAY_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            transactions: response.data
        });

    } catch (error) {
        console.error('Error fetching MoonPay transactions:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch transactions',
            message: error.response?.data?.message || error.message
        });
    }
});

/**
 * POST /api/moonpay/webhook
 * Handle MoonPay webhook notifications
 */
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    try {
        // Fail closed: without a signing key anyone could forge payment events.
        if (!getWebhookKey()) {
            console.error('❌ MoonPay webhook rejected: MOONPAY_WEBHOOK_KEY not configured');
            return res.status(503).json({ error: 'MoonPay webhook not configured' });
        }
        if (!verifyMoonPayWebhook(req)) {
            console.warn('❌ MoonPay webhook rejected: invalid or missing signature');
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const webhookData = JSON.parse(rawBodyOf(req).toString('utf8'));

        console.log('📡 MoonPay Webhook received:', {
            type: webhookData.type,
            transactionId: webhookData.data?.id,
            status: webhookData.data?.status
        });

        // Handle different webhook events
        switch (webhookData.type) {
            case 'transaction_created':
                // Transaction initiated
                console.log('✅ Transaction created:', webhookData.data.id);
                break;

            case 'transaction_updated':
                // Transaction status changed
                console.log('🔄 Transaction updated:', webhookData.data.id, webhookData.data.status);
                break;

            case 'transaction_completed':
                // Transaction successful
                console.log('✅ Transaction completed:', webhookData.data.id);
                // TODO: Update user balance, send notification, etc.
                break;

            case 'transaction_failed':
                // Transaction failed
                console.log('❌ Transaction failed:', webhookData.data.id);
                // TODO: Send notification to user
                break;

            default:
                console.log('ℹ️  Unknown webhook type:', webhookData.type);
        }

        // Always respond with 200 to acknowledge receipt
        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Error processing MoonPay webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * GET /api/moonpay/currencies
 * Get supported cryptocurrencies
 */
router.get('/currencies', async (req, res) => {
    try {
        const response = await axios.get(
            `${MOONPAY_API_BASE}/v3/currencies`,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            currencies: response.data
        });

    } catch (error) {
        console.error('Error fetching currencies:', error.message);
        res.status(500).json({
            error: 'Failed to fetch currencies',
            message: error.message
        });
    }
});

module.exports = router;
