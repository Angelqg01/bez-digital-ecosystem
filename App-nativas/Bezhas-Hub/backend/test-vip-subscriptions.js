/**
 * ============================================================================
 * VIP SUBSCRIPTIONS - QUICK TEST SCRIPT
 * ============================================================================
 * 
 * Script para probar rápidamente el sistema de suscripciones VIP
 * 
 * Uso:
 *   node test-vip-subscriptions.js
 */

// IMPORTANTE: Asegurate de tener STRIPE_SECRET_KEY en tu .env
if (!process.env.STRIPE_SECRET_KEY) {
    console.error('ERROR: STRIPE_SECRET_KEY no esta configurada. Configura tu .env');
    process.exit(1);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

console.log('\n🧪 Testing VIP Subscriptions System...\n');

async function testStripeConnection() {
    try {
        console.log('1️⃣ Testing Stripe Connection...');
        const account = await stripe.accounts.retrieve();
        console.log(`   ✅ Connected to Stripe account: ${account.id}`);
        console.log(`   📧 Email: ${account.email || 'Not set'}`);
        console.log(`   🌍 Country: ${account.country}`);
        return true;
    } catch (error) {
        console.error('   ❌ Stripe connection failed:', error.message);
        return false;
    }
}

async function testProductCreation() {
    try {
        console.log('\n2️⃣ Testing Product Creation...');

        // Test creating a VIP product
        const product = await stripe.products.create({
            name: 'BeZhas VIP Test Product',
            description: 'Test product for VIP subscriptions',
            metadata: {
                tier: 'test',
                type: 'vip_subscription'
            }
        });

        console.log(`   ✅ Product created: ${product.id}`);

        // Create a recurring price
        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: 999, // $9.99
            currency: 'usd',
            recurring: {
                interval: 'month'
            },
            metadata: {
                tier: 'test'
            }
        });

        console.log(`   ✅ Price created: ${price.id} ($9.99/month)`);

        // Cleanup test product
        await stripe.products.update(product.id, { active: false });
        console.log('   🗑️  Test product archived');

        return true;
    } catch (error) {
        console.error('   ❌ Product creation failed:', error.message);
        return false;
    }
}

async function testCheckoutSession() {
    try {
        console.log('\n3️⃣ Testing Checkout Session Creation...');

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Test VIP Subscription',
                        },
                        unit_amount: 999,
                        recurring: {
                            interval: 'month'
                        }
                    },
                    quantity: 1,
                }
            ],
            success_url: 'http://localhost:5173/vip/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:5173/vip',
            metadata: {
                userId: 'test-user-123',
                tier: 'test'
            }
        });

        console.log(`   ✅ Checkout session created: ${session.id}`);
        console.log(`   🔗 URL: ${session.url.substring(0, 50)}...`);

        return true;
    } catch (error) {
        console.error('   ❌ Checkout session creation failed:', error.message);
        return false;
    }
}

async function testWebhookEndpoint() {
    console.log('\n4️⃣ Testing Webhook Configuration...');

    if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== 'whsec_dev_placeholder_change_in_production') {
        console.log(`   ✅ Webhook secret configured`);
        console.log(`   🔑 Secret: ${process.env.STRIPE_WEBHOOK_SECRET.substring(0, 20)}...`);
    } else {
        console.log('   ⚠️  Webhook secret not configured (using placeholder)');
        console.log('   ℹ️  Configure webhook at: https://dashboard.stripe.com/webhooks');
    }
}

async function runTests() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  BeZhas VIP Subscriptions - Integration Test');
    console.log('═══════════════════════════════════════════════════════════\n');

    const results = {
        stripeConnection: await testStripeConnection(),
        productCreation: await testProductCreation(),
        checkoutSession: await testCheckoutSession(),
    };

    await testWebhookEndpoint();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Test Results Summary');
    console.log('═══════════════════════════════════════════════════════════\n');

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.values(results).length;

    Object.entries(results).forEach(([test, result]) => {
        const emoji = result ? '✅' : '❌';
        const status = result ? 'PASSED' : 'FAILED';
        console.log(`   ${emoji} ${test}: ${status}`);
    });

    console.log(`\n   Total: ${passed}/${total} tests passed\n`);

    if (passed === total) {
        console.log('🎉 All tests passed! VIP Subscription system is ready.\n');
        console.log('Next steps:');
        console.log('  1. Start backend: pnpm run start:backend');
        console.log('  2. Start frontend: pnpm run dev (in frontend folder)');
        console.log('  3. Visit: http://localhost:5173/vip');
        console.log('  4. Test with card: 4242 4242 4242 4242\n');
    } else {
        console.log('⚠️  Some tests failed. Please check configuration.\n');
        console.log('Troubleshooting:');
        console.log('  - Verify STRIPE_SECRET_KEY in backend/.env');
        console.log('  - Ensure Stripe account is active');
        console.log('  - Check internet connection\n');
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n💥 Fatal error during testing:', error);
    process.exit(1);
});
