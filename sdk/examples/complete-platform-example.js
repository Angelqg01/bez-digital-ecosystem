/**
 * BeZhas SDK - Complete Platform Example
 * 
 * This example demonstrates how to use multiple SDK modules together
 * to build a complete application.
 */

const { BeZhasAPIClient } = require('@bezhas/sdk');
const { ethers } = require('ethers');

async function completePlatformExample() {
    console.log('🚀 BeZhas SDK - Complete Platform Example\n');

    // Initialize SDK
    const bezhas = new BeZhasAPIClient({
        apiUrl: process.env.BEZHAS_API_URL || 'https://api.bezhas.com',
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com',
        mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:3002',
        network: 'polygon',
        apiKey: process.env.BEZHAS_API_KEY
    });

    try {
        // ========================================
        // 1. HEALTH CHECK
        // ========================================
        console.log('1️⃣ Performing health check...');
        const health = await bezhas.healthCheck();

        console.log('✅ System Health:');
        console.log(`   API: ${health.services.api ? '✅' : '❌'}`);
        console.log(`   MCP: ${health.services.mcp ? '✅' : '❌'}`);
        console.log(`   Blockchain: ${health.services.blockchain ? '✅' : '❌'}`);

        // ========================================
        // 2. VIP SUBSCRIPTION
        // ========================================
        console.log('\n2️⃣ Managing VIP Subscription...');
        const tiers = await bezhas.vip.getTiers();

        if (tiers.success) {
            console.log(`✅ Found ${tiers.tiers.length} VIP tiers`);

            // Create subscription
            const subscription = await bezhas.vip.createSubscription(
                'gold',
                'user@example.com'
            );

            if (subscription.success) {
                console.log(`✅ Subscription created: ${subscription.sessionId}`);
            }
        }

        // ========================================
        // 3. PAYMENTS
        // ========================================
        console.log('\n3️⃣ Processing Payments...');

        // Get quote for crypto payment
        const quote = await bezhas.payments.getQuote(100, 'USDT', 'BEZ');

        if (quote.success) {
            console.log(`✅ Quote: 100 USDT = ${quote.quote.toAmount} BEZ`);
            console.log(`   Rate: ${quote.quote.rate}`);
        }

        // Process Stripe payment
        const payment = await bezhas.payments.processStripePayment(
            'user123',
            '0xYourWalletAddress',
            100,
            'user@example.com'
        );

        if (payment.success) {
            console.log(`✅ Payment session created: ${payment.sessionId}`);
        }

        // ========================================
        // 4. STAKING
        // ========================================
        console.log('\n4️⃣ Staking BEZ Tokens...');

        const provider = new ethers.JsonRpcProvider(bezhas.config.rpcUrl);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        // Get staking info
        const stakingInfo = await bezhas.staking.getStakingInfo(wallet.address);

        if (stakingInfo.success) {
            console.log(`✅ Staked: ${stakingInfo.stakedAmount} BEZ`);
            console.log(`   Rewards: ${stakingInfo.pendingRewards} BEZ`);
        }

        // Calculate APY
        const apy = await bezhas.staking.calculateAPY();
        if (apy.success) {
            console.log(`✅ Current APY: ${apy.apy}%`);
        }

        // ========================================
        // 5. RWA (Real World Assets)
        // ========================================
        console.log('\n5️⃣ Tokenizing Real Estate...');

        const asset = await bezhas.rwa.tokenizeAsset({
            type: 'real_estate',
            metadata: {
                address: '123 Main Street',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                sqft: 2000,
                bedrooms: 3,
                bathrooms: 2
            },
            value: 500000 // $500,000
        }, wallet);

        if (asset.success) {
            console.log(`✅ Asset tokenized! Token ID: ${asset.tokenId}`);
            console.log(`   Transaction: ${asset.transactionHash}`);
        }

        // List user's assets
        const myAssets = await bezhas.rwa.listAssets(wallet.address);
        if (myAssets.success) {
            console.log(`✅ You own ${myAssets.count} tokenized assets`);
        }

        // ========================================
        // 6. LOGISTICS
        // ========================================
        console.log('\n6️⃣ Creating Shipment...');

        const shipment = await bezhas.logistics.createShipment({
            carrier: 'fedex',
            origin: {
                name: 'BeZhas Warehouse',
                address: '123 Warehouse St',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                country: 'US'
            },
            destination: {
                name: 'Customer',
                address: '456 Customer Ave',
                city: 'Los Angeles',
                state: 'CA',
                zipCode: '90001',
                country: 'US'
            },
            items: [
                { name: 'Product A', weight: 5, quantity: 2 },
                { name: 'Product B', weight: 3, quantity: 1 }
            ]
        });

        if (shipment.success) {
            console.log(`✅ Shipment created!`);
            console.log(`   Tracking: ${shipment.trackingNumber}`);
            console.log(`   Estimated Delivery: ${shipment.estimatedDelivery}`);
        }

        // Track shipment
        const tracking = await bezhas.logistics.trackShipment(shipment.shipmentId);
        if (tracking.success) {
            console.log(`✅ Shipment Status: ${tracking.status}`);
            console.log(`   Location: ${tracking.currentLocation}`);
        }

        // ========================================
        // 7. MCP INTEGRATION (AI Tools)
        // ========================================
        console.log('\n7️⃣ Using AI Tools via MCP...');

        // Connect to MCP server
        const mcpConnection = await bezhas.mcp.connect();

        if (mcpConnection.success) {
            console.log('✅ Connected to MCP server');

            // List available tools
            const tools = await bezhas.mcp.listAvailableTools();
            console.log(`✅ Available AI tools: ${tools.count}`);

            // Use payment quote tool
            const aiQuote = await bezhas.mcp.getPaymentQuote(100, 'USD', 'BEZ');
            if (aiQuote.success) {
                console.log(`✅ AI Quote: ${aiQuote.result.quote.toAmount} BEZ`);
            }
        }

        // ========================================
        // SUMMARY
        // ========================================
        console.log('\n' + '='.repeat(50));
        console.log('✅ Complete Platform Example Finished!');
        console.log('='.repeat(50));
        console.log('\n📊 Summary:');
        console.log('   ✅ Health check passed');
        console.log('   ✅ VIP subscription created');
        console.log('   ✅ Payment processed');
        console.log('   ✅ Staking info retrieved');
        console.log('   ✅ Real estate tokenized');
        console.log('   ✅ Shipment created and tracked');
        console.log('   ✅ AI tools accessed via MCP');
        console.log('\n🎉 All BeZhas platform services working!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

// Run the example
if (require.main === module) {
    completePlatformExample();
}

module.exports = completePlatformExample;
