const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { body, validationResult } = require('express-validator');
const { verifyAdminToken } = require('../middleware/admin.middleware');

const configFilePath = path.join(__dirname, '..', 'config.json');

async function readConfig() {
    try {
        const data = await fs.readFile(configFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

async function writeConfig(newConfig) {
    await fs.writeFile(configFilePath, JSON.stringify(newConfig, null, 2));
}

function maskSecret(secret) {
    if (!secret || typeof secret !== 'string') return '';
    if (secret.length <= 8) return '••••';
    return `${secret.slice(0, 3)}••••••••${secret.slice(-4)}`;
}

// Get current Stripe/admin settings (masked)
router.get('/payments/stripe', verifyAdminToken, async (req, res) => {
    try {
        const cfg = await readConfig();
        const payments = cfg.payments || {};
        const stripe = payments.stripe || {};
        const frontendUrl = cfg.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';

        res.json({
            success: true,
            settings: {
                stripe: {
                    secretKey: maskSecret(stripe.secretKey || process.env.STRIPE_SECRET_KEY || ''),
                    webhookSecret: maskSecret(stripe.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || ''),
                },
                frontendUrl,
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to read settings' });
    }
});

// Update Stripe/admin settings
router.put('/payments/stripe',
    verifyAdminToken,
    [
        body('stripe.secretKey').optional().isString().custom(v => v.startsWith('sk_')),
        body('stripe.webhookSecret').optional().isString().custom(v => v.startsWith('whsec_')),
        body('frontendUrl').optional().isURL()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        try {
            const cfg = await readConfig();
            cfg.payments = cfg.payments || {};
            cfg.payments.stripe = cfg.payments.stripe || {};

            const { stripe, frontendUrl } = req.body;
            if (stripe && stripe.secretKey) cfg.payments.stripe.secretKey = stripe.secretKey;
            if (stripe && stripe.webhookSecret) cfg.payments.stripe.webhookSecret = stripe.webhookSecret;
            if (frontendUrl) cfg.frontendUrl = frontendUrl;

            await writeConfig(cfg);

            res.json({
                success: true,
                settings: {
                    stripe: {
                        secretKey: maskSecret(cfg.payments.stripe.secretKey),
                        webhookSecret: maskSecret(cfg.payments.stripe.webhookSecret),
                    },
                    frontendUrl: cfg.frontendUrl
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, error: 'Failed to update settings' });
        }
    }
);

// Test current Stripe secret by fetching account info
router.post('/payments/stripe/test', verifyAdminToken, async (req, res) => {
    try {
        const cfg = await readConfig();
        const secret = (cfg.payments && cfg.payments.stripe && cfg.payments.stripe.secretKey) || process.env.STRIPE_SECRET_KEY;
        if (!secret) return res.status(400).json({ success: false, error: 'Stripe secret not configured' });
        const stripe = require('stripe')(secret);
        const account = await stripe.accounts.retrieve();
        res.json({ success: true, account: { id: account.id, business_type: account.business_type } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message || 'Stripe test failed' });
    }
});

module.exports = router;
