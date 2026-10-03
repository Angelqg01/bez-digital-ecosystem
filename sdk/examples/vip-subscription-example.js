/**
 * BeZhas SDK - VIP Subscription Example
 * 
 * This example demonstrates how to use the VIP Subscription module
 * to create and manage VIP subscriptions.
 */

const { BeZhasAPIClient } = require('@bezhas/sdk');

// Initialize the SDK
const bezhas = new BeZhasAPIClient({
    apiUrl: process.env.BEZHAS_API_URL || 'https://api.bezhas.com',
    network: 'polygon',
    apiKey: process.env.BEZHAS_API_KEY
});

async function vipSubscriptionExample() {
    console.log('🎯 BeZhas SDK - VIP Subscription Example\n');

    try {
        // 1. Get available VIP tiers
        console.log('1️⃣ Fetching VIP tiers...');
        const tiers = await bezhas.vip.getTiers();

        if (tiers.success) {
            console.log('✅ Available VIP Tiers:');
            tiers.tiers.forEach(tier => {
                console.log(`   - ${tier.name}: $${tier.price}/month`);
                console.log(`     Benefits: ${tier.benefits.join(', ')}`);
            });
        }

        // 2. Create a subscription
        console.log('\n2️⃣ Creating VIP subscription...');
        const subscription = await bezhas.vip.createSubscription(
            'gold', // tier
            'user@example.com' // email
        );

        if (subscription.success) {
            console.log('✅ Subscription created!');
            console.log(`   Checkout URL: ${subscription.checkoutUrl}`);
            console.log(`   Session ID: ${subscription.sessionId}`);
            console.log('\n   👉 Redirect user to checkout URL to complete payment');
        }

        // 3. Check VIP status (after payment)
        console.log('\n3️⃣ Checking VIP status...');
        const status = await bezhas.vip.checkVIPStatus();

        if (status.success) {
            console.log('✅ VIP Status:');
            console.log(`   Is VIP: ${status.isVIP}`);
            console.log(`   Tier: ${status.tier || 'None'}`);
            console.log(`   Expires: ${status.expiresAt || 'N/A'}`);
        }

        // 4. Get subscription history
        console.log('\n4️⃣ Fetching subscription history...');
        const subscriptions = await bezhas.vip.getMySubscriptions();

        if (subscriptions.success) {
            console.log('✅ Your Subscriptions:');
            subscriptions.subscriptions.forEach(sub => {
                console.log(`   - ${sub.tier}: ${sub.status}`);
                console.log(`     Started: ${new Date(sub.createdAt).toLocaleDateString()}`);
            });
        }

        // 5. Upgrade subscription
        console.log('\n5️⃣ Upgrading subscription to Platinum...');
        const upgrade = await bezhas.vip.upgradeSubscription('platinum');

        if (upgrade.success) {
            console.log('✅ Upgrade initiated!');
            console.log(`   New tier: ${upgrade.newTier}`);
            console.log(`   Effective: ${upgrade.effectiveDate}`);
        }

        // 6. Get payment history
        console.log('\n6️⃣ Fetching payment history...');
        const payments = await bezhas.vip.getPaymentHistory();

        if (payments.success) {
            console.log('✅ Payment History:');
            payments.payments.forEach(payment => {
                console.log(`   - $${payment.amount} on ${new Date(payment.date).toLocaleDateString()}`);
                console.log(`     Status: ${payment.status}`);
            });
        }

        console.log('\n✅ VIP Subscription example completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the example
if (require.main === module) {
    vipSubscriptionExample();
}

module.exports = vipSubscriptionExample;
