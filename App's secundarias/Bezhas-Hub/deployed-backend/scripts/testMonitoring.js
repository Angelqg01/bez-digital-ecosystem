#!/usr/bin/env node

/**
 * Test Revenue Monitoring System
 * 
 * Ejecuta suite de tests para verificar todo el stack de monitoreo
 */

require('dotenv').config({ path: './backend/.env' });
const { getEventListener } = require('../services/revenueEventListener');
const { notificationService } = require('../services/notificationService');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEventListener() {
    log('\n━━━ Test 1: Event Listener ━━━', 'cyan');

    try {
        const listener = getEventListener();

        log('  ✓ Initializing event listener...', 'blue');
        await listener.initialize();
        log('  ✓ Event listener initialized', 'green');

        log('  ✓ Fetching contract stats...', 'blue');
        const stats = await listener.getStats();
        log(`  ✓ Stats fetched:`, 'green');
        log(`    - Total Volume: ${stats.totalVolume.toString()}`, 'green');
        log(`    - Total Fees: ${stats.totalFees.toString()}`, 'green');
        log(`    - Total Swaps: ${stats.totalSwaps.toString()}`, 'green');

        log('  ✓ Querying historical events...', 'blue');
        const events = await listener.queryHistoricalEvents(
            'PlatformFeeCollected',
            -10000,
            'latest'
        );
        log(`  ✓ Found ${events.length} historical events`, 'green');

        await listener.stop();
        log('  ✓ Event listener stopped', 'green');

        return true;
    } catch (error) {
        log(`  ✗ Event Listener Test Failed: ${error.message}`, 'red');
        return false;
    }
}

async function testNotifications() {
    log('\n━━━ Test 2: Notification Service ━━━', 'cyan');

    try {
        log('  ✓ Testing Discord webhook...', 'blue');
        if (process.env.DISCORD_WEBHOOK_URL) {
            await notificationService.sendDiscord({
                title: '🧪 Test Notification',
                description: 'This is a test from BeZhas Revenue Monitor',
                color: 0x3b82f6,
                fields: [
                    { name: 'Status', value: 'Testing' },
                    { name: 'System', value: 'Revenue Monitor' }
                ]
            });
            log('  ✓ Discord notification sent', 'green');
        } else {
            log('  ⊘ Discord webhook not configured (skipped)', 'yellow');
        }

        log('  ✓ Testing Slack webhook...', 'blue');
        if (process.env.SLACK_WEBHOOK_URL) {
            await notificationService.sendSlack({
                text: '🧪 Test Notification',
                attachments: [{
                    color: '#3b82f6',
                    fields: [
                        { title: 'Status', value: 'Testing', short: true },
                        { title: 'System', value: 'Revenue Monitor', short: true }
                    ]
                }]
            });
            log('  ✓ Slack notification sent', 'green');
        } else {
            log('  ⊘ Slack webhook not configured (skipped)', 'yellow');
        }

        log('  ✓ Testing Email...', 'blue');
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            await notificationService.sendEmail({
                to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
                subject: '🧪 Test Email - BeZhas Revenue Monitor',
                html: '<h1>Test Email</h1><p>This is a test from BeZhas Revenue Monitor</p>',
                text: 'Test Email - This is a test from BeZhas Revenue Monitor'
            });
            log('  ✓ Email sent', 'green');
        } else {
            log('  ⊘ Email SMTP not configured (skipped)', 'yellow');
        }

        return true;
    } catch (error) {
        log(`  ✗ Notification Test Failed: ${error.message}`, 'red');
        return false;
    }
}

async function testConfiguration() {
    log('\n━━━ Test 3: Configuration ━━━', 'cyan');

    const requiredVars = [
        'POLYGON_RPC_URL',
        'BEZ_LIQUIDITY_RAMP_ADDRESS'
    ];

    const optionalVars = [
        'DISCORD_WEBHOOK_URL',
        'SLACK_WEBHOOK_URL',
        'ALERT_EMAIL_TO',
        'SMTP_HOST',
        'SMTP_USER',
        'SMTP_PASS'
    ];

    let allRequired = true;

    for (const varName of requiredVars) {
        if (process.env[varName]) {
            log(`  ✓ ${varName} configured`, 'green');
        } else {
            log(`  ✗ ${varName} missing (required)`, 'red');
            allRequired = false;
        }
    }

    for (const varName of optionalVars) {
        if (process.env[varName]) {
            log(`  ✓ ${varName} configured`, 'green');
        } else {
            log(`  ⊘ ${varName} not configured (optional)`, 'yellow');
        }
    }

    return allRequired;
}

async function testRPCConnection() {
    log('\n━━━ Test 4: RPC Connection ━━━', 'cyan');

    try {
        const ethers = require('ethers');

        log('  ✓ Connecting to RPC...', 'blue');
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

        log('  ✓ Getting network info...', 'blue');
        const network = await provider.getNetwork();
        log(`  ✓ Connected to chain ID: ${network.chainId}`, 'green');

        log('  ✓ Getting latest block...', 'blue');
        const blockNumber = await provider.getBlockNumber();
        log(`  ✓ Latest block: ${blockNumber}`, 'green');

        return true;
    } catch (error) {
        log(`  ✗ RPC Connection Test Failed: ${error.message}`, 'red');
        return false;
    }
}

async function testContractConnection() {
    log('\n━━━ Test 5: Contract Connection ━━━', 'cyan');

    try {
        const ethers = require('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

        log('  ✓ Connecting to contract...', 'blue');

        // ABI mínimo para testing
        const minimalABI = [
            'function getStats() view returns (uint256, uint256, uint256)',
            'function treasury() view returns (address)',
            'function platformFeePercent() view returns (uint256)'
        ];

        const contract = new ethers.Contract(
            process.env.BEZ_LIQUIDITY_RAMP_ADDRESS,
            minimalABI,
            provider
        );

        log('  ✓ Reading contract data...', 'blue');
        const treasury = await contract.treasury();
        log(`  ✓ Treasury address: ${treasury}`, 'green');

        const feePercent = await contract.platformFeePercent();
        log(`  ✓ Platform fee: ${feePercent.toString()}%`, 'green');

        return true;
    } catch (error) {
        log(`  ✗ Contract Connection Test Failed: ${error.message}`, 'red');
        log(`  ℹ Make sure contract is deployed to: ${process.env.BEZ_LIQUIDITY_RAMP_ADDRESS}`, 'yellow');
        return false;
    }
}

async function runTests() {
    console.clear();
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log('  BeZhas Revenue Monitor - Test Suite', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');

    const results = [];

    // Run tests
    results.push({ name: 'Configuration', pass: await testConfiguration() });
    results.push({ name: 'RPC Connection', pass: await testRPCConnection() });
    results.push({ name: 'Contract Connection', pass: await testContractConnection() });
    results.push({ name: 'Event Listener', pass: await testEventListener() });
    results.push({ name: 'Notifications', pass: await testNotifications() });

    // Summary
    log('\n═══════════════════════════════════════════════════════════', 'cyan');
    log('  Test Results Summary', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;

    results.forEach(result => {
        if (result.pass) {
            log(`  ✓ ${result.name}`, 'green');
        } else {
            log(`  ✗ ${result.name}`, 'red');
        }
    });

    log('\n───────────────────────────────────────────────────────────', 'cyan');
    log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`, 'cyan');
    log('═══════════════════════════════════════════════════════════\n', 'cyan');

    if (failed === 0) {
        log('🎉 All tests passed! System is ready to deploy.\n', 'green');
        process.exit(0);
    } else {
        log('⚠️  Some tests failed. Please fix the issues before deploying.\n', 'yellow');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    log(`\n✗ Test suite failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
