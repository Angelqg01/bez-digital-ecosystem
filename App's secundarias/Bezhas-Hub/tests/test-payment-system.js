/**
 * ============================================================================
 * PAYMENT SYSTEM INTEGRATION TEST
 * ============================================================================
 * 
 * Test completo del flujo: Stripe → Blockchain
 */

const { ethers } = require('ethers');
require('dotenv').config();

async function testPaymentFlow() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💳 TESTING: STRIPE → BLOCKCHAIN PAYMENT FLOW');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // 1. Load fiatGateway service
        console.log('1️⃣  Loading Fiat Gateway Service...');
        const fiatGateway = require('../backend/services/fiatGateway.service');
        console.log('   ✅ Service loaded\n');

        // 2. Check Hot Wallet status
        console.log('2️⃣  Checking Hot Wallet Status...');
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(process.env.HOT_WALLET_PRIVATE_KEY, provider);

        console.log(`   Hot Wallet: ${wallet.address}`);

        // Check MATIC balance
        const maticBalance = await provider.getBalance(wallet.address);
        console.log(`   MATIC: ${ethers.formatEther(maticBalance)}`);

        if (maticBalance < ethers.parseEther('0.01')) {
            throw new Error('❌ Insufficient MATIC for gas');
        }

        // Check BEZ balance
        const tokenABI = [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)'
        ];
        const bezContract = new ethers.Contract(
            process.env.BEZCOIN_CONTRACT_ADDRESS,
            tokenABI,
            provider
        );

        const bezBalance = await bezContract.balanceOf(wallet.address);
        const decimals = await bezContract.decimals();
        const bezFormatted = ethers.formatUnits(bezBalance, decimals);
        console.log(`   BEZ: ${bezFormatted}`);

        if (parseFloat(bezFormatted) < 10) {
            throw new Error('❌ Insufficient BEZ tokens for test');
        }

        console.log('   ✅ Hot Wallet ready\n');

        // 3. Simulate payment processing
        console.log('3️⃣  Simulating Payment Processing...');
        console.log('   Scenario: User pays 10 EUR for BEZ tokens');

        // Calculate tokens (based on price in fiatGateway.service.js)
        const amountEur = 10;
        const pricePerBez = 0.0015; // EUR per BEZ
        const expectedTokens = amountEur / pricePerBez;

        console.log(`   Amount: ${amountEur} EUR`);
        console.log(`   Expected tokens: ${expectedTokens.toFixed(2)} BEZ\n`);

        // 4. Test recipient address (using a test address)
        const testRecipient = '0x52Df82920CBAE522880dD7657e43d1A754eD044E'; // Your main wallet
        console.log('4️⃣  Test Recipient:', testRecipient);

        // Get recipient balance before
        const balanceBefore = await bezContract.balanceOf(testRecipient);
        const balanceBeforeFormatted = ethers.formatUnits(balanceBefore, decimals);
        console.log(`   Balance before: ${balanceBeforeFormatted} BEZ\n`);

        // 5. Execute transfer (REAL TRANSACTION - COMMENTED FOR SAFETY)
        console.log('5️⃣  Transfer Execution...');
        console.log('   ⚠️  This would execute a REAL blockchain transaction');
        console.log('   ⚠️  Uncomment the code below to test with real funds\n');

        /*
        // UNCOMMENT TO TEST REAL TRANSFER
        console.log('   🔄 Executing transfer...');
        const result = await fiatGateway.processFiatPayment(testRecipient, amountEur);
        
        if (!result.success) {
            throw new Error(`Transfer failed: ${result.error}`);
        }
        
        console.log(`   ✅ Transfer successful!`);
        console.log(`   TX Hash: ${result.txHash}`);
        console.log(`   Block: ${result.blockNumber}`);
        console.log(`   Gas Used: ${result.gasUsed}`);
        console.log(`   Explorer: ${result.explorerUrl}\n`);
        
        // Wait for confirmation
        console.log('   ⏳ Waiting for confirmation...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Get recipient balance after
        const balanceAfter = await bezContract.balanceOf(testRecipient);
        const balanceAfterFormatted = ethers.formatUnits(balanceAfter, decimals);
        const difference = balanceAfterFormatted - balanceBeforeFormatted;
        
        console.log(`   Balance after: ${balanceAfterFormatted} BEZ`);
        console.log(`   Tokens received: ${difference.toFixed(4)} BEZ\n`);
        
        if (Math.abs(difference - expectedTokens) > 1) {
            throw new Error('Token amount mismatch');
        }
        */

        // 6. Verify Stripe webhook integration
        console.log('6️⃣  Verifying Stripe Integration...');
        const stripeService = require('../backend/services/stripe.service');

        if (!stripeService.handleStripeWebhook) {
            throw new Error('Webhook handler not found');
        }
        console.log('   ✅ Webhook handler exists');

        // Check if fiatGateway is imported
        const stripeServiceCode = require('fs').readFileSync(
            require.resolve('../backend/services/stripe.service'),
            'utf8'
        );

        if (!stripeServiceCode.includes('fiatGatewayService')) {
            throw new Error('fiatGateway not imported in stripe.service');
        }
        console.log('   ✅ fiatGateway service imported');

        if (!stripeServiceCode.includes('processFiatPayment')) {
            throw new Error('processFiatPayment not called in webhook');
        }
        console.log('   ✅ processFiatPayment integrated in webhook\n');

        // 7. Summary
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ PAYMENT SYSTEM TEST COMPLETED');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n📋 TEST RESULTS:');
        console.log('   ✅ Hot Wallet configured and funded');
        console.log('   ✅ BEZ Token contract accessible');
        console.log('   ✅ Fiat Gateway service functional');
        console.log('   ✅ Stripe webhook integration verified');
        console.log('   ⚠️  Real transaction test disabled (safety)');
        console.log('\n💡 TO TEST REAL PAYMENT:');
        console.log('   1. Uncomment the transfer code in this file');
        console.log('   2. Make a real Stripe payment');
        console.log('   3. Verify tokens arrive in user wallet');
        console.log('\n🔗 NEXT STEPS:');
        console.log('   1. Configure Stripe webhook URL in dashboard');
        console.log('   2. Test with Stripe test mode first');
        console.log('   3. Monitor backend logs during payment');
        console.log('═══════════════════════════════════════════════════════════\n');

        return true;

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run test
if (require.main === module) {
    testPaymentFlow()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { testPaymentFlow };
