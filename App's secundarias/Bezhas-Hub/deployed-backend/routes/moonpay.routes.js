/**
 * MoonPay Integration Routes
 * Backend endpoints for MoonPay transaction tracking
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/auth.middleware');

// MoonPay API Configuration
const MOONPAY_SECRET_KEY = process.env.MOONPAY_SECRET_KEY || '';
const MOONPAY_API_BASE = 'https://api.moonpay.com';

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
router.post('/webhook', express.json(), async (req, res) => {
    try {
        const webhookData = req.body;

        // Verify webhook signature (if configured)
        const signature = req.headers['moonpay-signature'];

        // TODO: Implement signature verification
        // https://dev.moonpay.com/docs/webhooks

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
