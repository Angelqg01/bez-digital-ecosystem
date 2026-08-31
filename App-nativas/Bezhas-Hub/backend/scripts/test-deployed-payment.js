/**
 * Test Deployed Payment System
 * Runs E2E tests against the production URL
 */

require('dotenv').config(); // Load environment variables from .env
const axios = require('axios');
const { ethers } = require('ethers');

const BASE_URL = process.env.API_URL || 'https://totemic-bonus-479312-c6.ew.r.appspot.com';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY; // Must be set to run this locally

if (!STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY is required to run this test');
    process.exit(1);
}

const stripe = require('stripe')(STRIPE_SECRET_KEY);

async function runTest() {
    console.log(`🚀 Starting payment test against ${BASE_URL}`);

    try {
        // 1. Check Health
        console.log('1️⃣ Checking Health...');
        try {
            const health = await axios.get(`${BASE_URL}/api/health`);
            console.log('✅ Health Check Passed:', health.data);
        } catch (err) {
            console.error('❌ Health Check Failed:', err.message);
            if (err.response) console.error('   Status:', err.response.status);
        }

        // 2. Diagnostic Route
        console.log('\n2️⃣ Checking Diagnostic Route...');
        try {
            const diag = await axios.get(`${BASE_URL}/api/diagnostic?key=debug123`);
            console.log('✅ Diagnostic Check Passed:', JSON.stringify(diag.data, null, 2));

            if (diag.data.checks?.database?.status !== 'ok') {
                console.error('❌ Database is NOT connected remotely!');
            }
        } catch (err) {
            console.error('❌ Diagnostic Check Failed:', err.message);
            if (err.response) console.error('   Status:', err.response.status);
        }

        // 3. Simulate Webhook (if we can)
        console.log('\n3️⃣ Simulating Stripe Webhook (Local -> Remote)...');
        // This simulates Stripe sending a webhook to our server
        const payload = {
            id: 'evt_test_webhook_' + Date.now(),
            object: 'event',
            type: 'payment_intent.succeeded',
            data: {
                object: {
                    id: 'pi_test_' + Date.now(),
                    amount: 1000,
                    currency: 'usd',
                    metadata: {
                        userId: 'test_user_generic',
                        type: 'token_purchase',
                        tokenAmount: '10'
                    }
                }
            }
        };

        const payloadString = JSON.stringify(payload);
        const secret = process.env.STRIPE_WEBHOOK_SECRET;

        if (secret) {
            const signature = stripe.webhooks.generateTestHeaderString({
                payload: payloadString,
                secret,
            });

            try {
                const res = await axios.post(`${BASE_URL}/api/stripe/webhook`, payload, {
                    headers: {
                        'stripe-signature': signature,
                        'Content-Type': 'application/json'
                    }
                });
                console.log('✅ Webhook Test Passed:', res.data);
            } catch (err) {
                console.error('❌ Webhook Test Failed:', err.message);
                if (err.response) console.error('   Data:', err.response.data);
            }
        } else {
            console.log('⚠️ Skipping webhook test: STRIPE_WEBHOOK_SECRET not set locally');
        }

    } catch (error) {
        console.error('❌ Test Suite Failed:', error);
    }
}

runTest();
