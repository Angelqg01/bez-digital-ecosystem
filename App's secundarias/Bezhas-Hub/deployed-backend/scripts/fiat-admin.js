/**
 * Fiat Gateway Admin Script
 * Useful commands to manage the Fiat Gateway system
 * 
 * Usage:
 * node backend/scripts/fiat-admin.js <command>
 * 
 * Commands:
 * - status: Check Safe Wallet and Hot Wallet status
 * - confirm <userWallet> <amountEur>: Confirm a bank transfer and disperse tokens
 * - price: Get current BEZ price in EUR
 */

require('dotenv').config();
const { processFiatPayment, getSafeStatus, getBezPriceInEur, calculateBezOutput } = require('../services/fiat-gateway.service');

const args = process.argv.slice(2);
const command = args[0];

async function main() {
    console.log('🏦 BeZhas Fiat Gateway Admin Tool\n');

    try {
        switch (command) {
            case 'status':
                await checkStatus();
                break;

            case 'confirm':
                const userWallet = args[1];
                const amountEur = parseFloat(args[2]);

                if (!userWallet || !amountEur) {
                    console.error('❌ Usage: node fiat-admin.js confirm <userWallet> <amountEur>');
                    console.error('Example: node fiat-admin.js confirm 0x123...abc 100');
                    process.exit(1);
                }

                await confirmPayment(userWallet, amountEur);
                break;

            case 'price':
                await checkPrice();
                break;

            case 'calculate':
                const eurAmount = parseFloat(args[1]);
                if (!eurAmount) {
                    console.error('❌ Usage: node fiat-admin.js calculate <amountEur>');
                    process.exit(1);
                }
                await calculateTokens(eurAmount);
                break;

            default:
                printHelp();
                break;
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

async function checkStatus() {
    console.log('📊 Checking system status...\n');

    const status = await getSafeStatus();

    console.log('═══════════════════════════════════════════════');
    console.log('🏦 SAFE WALLET STATUS');
    console.log('═══════════════════════════════════════════════');
    console.log(`Address:       ${status.safeAddress}`);
    console.log(`BEZ Balance:   ${status.bezBalance} BEZ`);
    console.log(`Allowance:     ${status.allowance} BEZ`);
    console.log('');
    console.log('🔥 HOT WALLET STATUS');
    console.log('═══════════════════════════════════════════════');
    console.log(`Address:       ${status.hotWalletAddress}`);
    console.log(`MATIC Balance: ${status.hotWalletMaticBalance} MATIC`);
    console.log(`Configured:    ${status.isConfigured ? '✅ YES' : '❌ NO'}`);
    console.log('');

    if (status.needsApproval) {
        console.log('⚠️  WARNING: Hot Wallet needs approval from Safe!');
        console.log('Run this transaction from the Safe Wallet:');
        console.log(`approve(${status.hotWalletAddress}, <large_amount>)`);
    } else {
        console.log('✅ System ready to process payments!');
    }

    if (parseFloat(status.hotWalletMaticBalance) < 0.1) {
        console.log('');
        console.log('⚠️  WARNING: Hot Wallet is low on MATIC!');
        console.log('Send MATIC to the Hot Wallet to cover gas fees.');
    }
}

async function confirmPayment(userWallet, amountEur) {
    console.log('💸 Processing Payment...\n');
    console.log(`User Wallet: ${userWallet}`);
    console.log(`Amount EUR:  ${amountEur} €`);
    console.log('');

    // Calculate tokens first
    const bezAmount = await calculateBezOutput(amountEur);
    console.log(`Tokens to send: ${bezAmount.toFixed(4)} BEZ\n`);

    console.log('🚀 Executing blockchain transaction...');

    const result = await processFiatPayment(userWallet, amountEur);

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('✅ PAYMENT CONFIRMED!');
    console.log('═══════════════════════════════════════════════');
    console.log(`TX Hash:       ${result.txHash}`);
    console.log(`Block:         ${result.blockNumber}`);
    console.log(`Tokens Sent:   ${result.tokensSent} BEZ`);
    console.log(`Rate:          1 BEZ = ${result.rate} EUR`);
    console.log(`EUR Processed: ${result.eurProcessed} €`);
    console.log('');
    console.log(`🔗 View on Explorer:`);
    console.log(result.explorerUrl);
}

async function checkPrice() {
    console.log('💰 Fetching current BEZ price...\n');

    const price = await getBezPriceInEur();

    console.log('═══════════════════════════════════════════════');
    console.log('BEZ TOKEN PRICE');
    console.log('═══════════════════════════════════════════════');
    console.log(`1 BEZ = ${price} EUR`);
    console.log(`1 EUR = ${(1 / price).toFixed(2)} BEZ`);
    console.log('');
    console.log('Sample Conversions:');
    console.log(`   10 EUR = ${(10 / price).toFixed(2)} BEZ`);
    console.log(`  100 EUR = ${(100 / price).toFixed(2)} BEZ`);
    console.log(` 1000 EUR = ${(1000 / price).toFixed(2)} BEZ`);
}

async function calculateTokens(eurAmount) {
    console.log(`💱 Calculating tokens for ${eurAmount} EUR...\n`);

    const bezAmount = await calculateBezOutput(eurAmount);
    const price = await getBezPriceInEur();

    console.log('═══════════════════════════════════════════════');
    console.log('CONVERSION RESULT');
    console.log('═══════════════════════════════════════════════');
    console.log(`Input:  ${eurAmount} EUR`);
    console.log(`Output: ${bezAmount.toFixed(4)} BEZ`);
    console.log(`Rate:   1 BEZ = ${price} EUR`);
}

function printHelp() {
    console.log('Usage: node fiat-admin.js <command> [args]\n');
    console.log('Available Commands:');
    console.log('  status                             Check Safe & Hot Wallet status');
    console.log('  confirm <wallet> <amount>          Confirm payment and disperse tokens');
    console.log('  price                              Get current BEZ price in EUR');
    console.log('  calculate <amount>                 Calculate BEZ tokens for EUR amount');
    console.log('');
    console.log('Examples:');
    console.log('  node fiat-admin.js status');
    console.log('  node fiat-admin.js confirm 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 100');
    console.log('  node fiat-admin.js price');
    console.log('  node fiat-admin.js calculate 250');
}

main();
