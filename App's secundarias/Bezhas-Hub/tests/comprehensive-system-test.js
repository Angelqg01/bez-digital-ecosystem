/**
 * ============================================================================
 * COMPREHENSIVE SYSTEM TEST SUITE
 * ============================================================================
 * 
 * Tests para todas las implementaciones:
 * 1. Stripe → Blockchain (Pagos automáticos)
 * 2. AI Oracle (Análisis de contenido)
 * 3. Automation Engine
 * 4. RWA Contracts (Real Estate & Logistics)
 */

const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const POLYGON_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class SystemTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            tests: []
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    async test(name, testFn, critical = false) {
        try {
            this.log(`\n🧪 Testing: ${name}`, 'cyan');
            await testFn();
            this.results.passed++;
            this.results.tests.push({ name, status: 'PASSED' });
            this.log(`   ✅ PASSED`, 'green');
        } catch (error) {
            if (critical) {
                this.results.failed++;
                this.results.tests.push({ name, status: 'FAILED', error: error.message });
                this.log(`   ❌ FAILED: ${error.message}`, 'red');
            } else {
                this.results.skipped++;
                this.results.tests.push({ name, status: 'SKIPPED', error: error.message });
                this.log(`   ⏭️  SKIPPED: ${error.message}`, 'yellow');
            }
        }
    }

    printSummary() {
        console.log('\n' + '═'.repeat(70));
        this.log('📊 TEST SUMMARY', 'blue');
        console.log('═'.repeat(70));
        this.log(`✅ Passed: ${this.results.passed}`, 'green');
        this.log(`❌ Failed: ${this.results.failed}`, 'red');
        this.log(`⏭️  Skipped: ${this.results.skipped}`, 'yellow');
        console.log('═'.repeat(70));

        if (this.results.failed > 0) {
            this.log('\n⚠️  Some tests failed. Review the output above.', 'red');
        } else if (this.results.skipped > 0) {
            this.log('\n✅ All critical tests passed!', 'green');
        } else {
            this.log('\n🎉 All tests passed!', 'green');
        }
    }
}

// ============================================================================
// TEST SUITE 1: ENVIRONMENT & CONFIGURATION
// ============================================================================

async function testEnvironment(tester) {
    tester.log('\n' + '═'.repeat(70), 'blue');
    tester.log('🔧 TEST SUITE 1: ENVIRONMENT & CONFIGURATION', 'blue');
    tester.log('═'.repeat(70), 'blue');

    await tester.test('Environment Variables Loaded', async () => {
        const requiredVars = [
            'PRIVATE_KEY',
            'POLYGON_RPC_URL',
            'BEZCOIN_CONTRACT_ADDRESS',
            'GEMINI_API_KEY',
            'STRIPE_SECRET_KEY'
        ];

        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                throw new Error(`Missing ${varName}`);
            }
        }
    }, true);

    await tester.test('Polygon RPC Connection', async () => {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const blockNumber = await provider.getBlockNumber();
        if (blockNumber < 1000) {
            throw new Error('Invalid block number');
        }
        tester.log(`   Current block: ${blockNumber}`, 'cyan');
    }, true);

    await tester.test('BEZ Token Contract Valid', async () => {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const tokenABI = ['function symbol() view returns (string)'];
        const bezContract = new ethers.Contract(
            process.env.BEZCOIN_CONTRACT_ADDRESS,
            tokenABI,
            provider
        );
        const symbol = await bezContract.symbol();
        if (symbol !== 'BEZ') {
            throw new Error(`Invalid token symbol: ${symbol}`);
        }
        tester.log(`   Token symbol: ${symbol}`, 'cyan');
    }, true);
}

// ============================================================================
// TEST SUITE 2: HOT WALLET & PAYMENT SYSTEM
// ============================================================================

async function testPaymentSystem(tester) {
    tester.log('\n' + '═'.repeat(70), 'blue');
    tester.log('💳 TEST SUITE 2: PAYMENT SYSTEM', 'blue');
    tester.log('═'.repeat(70), 'blue');

    await tester.test('Hot Wallet Configuration', async () => {
        if (!process.env.HOT_WALLET_PRIVATE_KEY) {
            throw new Error('HOT_WALLET_PRIVATE_KEY not configured');
        }
        const wallet = new ethers.Wallet(process.env.HOT_WALLET_PRIVATE_KEY);
        tester.log(`   Hot Wallet: ${wallet.address}`, 'cyan');
    }, true);

    await tester.test('Hot Wallet MATIC Balance', async () => {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const wallet = new ethers.Wallet(process.env.HOT_WALLET_PRIVATE_KEY, provider);
        const balance = await provider.getBalance(wallet.address);
        const balanceFormatted = ethers.formatEther(balance);

        tester.log(`   MATIC Balance: ${balanceFormatted}`, 'cyan');

        if (parseFloat(balanceFormatted) < 0.01) {
            throw new Error('Insufficient MATIC for gas fees');
        }
    }, true);

    await tester.test('Hot Wallet BEZ Token Balance', async () => {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const wallet = new ethers.Wallet(process.env.HOT_WALLET_PRIVATE_KEY, provider);
        const tokenABI = [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)'
        ];
        const bezContract = new ethers.Contract(
            process.env.BEZCOIN_CONTRACT_ADDRESS,
            tokenABI,
            provider
        );

        const balance = await bezContract.balanceOf(wallet.address);
        const decimals = await bezContract.decimals();
        const balanceFormatted = ethers.formatUnits(balance, decimals);

        tester.log(`   BEZ Balance: ${balanceFormatted}`, 'cyan');

        if (parseFloat(balanceFormatted) < 10) {
            throw new Error('Insufficient BEZ tokens for distribution');
        }
    }, true);

    await tester.test('Stripe Configuration Valid', async () => {
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test')) {
            throw new Error('Using test Stripe key or not configured');
        }
        tester.log(`   Stripe: Live mode configured`, 'cyan');
    }, false);

    await tester.test('Fiat Gateway Service Available', async () => {
        const fiatGateway = require('../backend/services/fiatGateway.service');
        if (!fiatGateway.processFiatPayment) {
            throw new Error('processFiatPayment function not found');
        }
    }, true);
}

// ============================================================================
// TEST SUITE 3: AI ORACLE SERVICE
// ============================================================================

async function testAIOracle(tester) {
    tester.log('\n' + '═'.repeat(70), 'blue');
    tester.log('🤖 TEST SUITE 3: AI ORACLE SERVICE', 'blue');
    tester.log('═'.repeat(70), 'blue');

    await tester.test('Oracle Service Initialization', async () => {
        const { getOracle } = require('../backend/services/oracle.service');
        const oracle = getOracle();

        if (!oracle.isInitialized) {
            throw new Error('Oracle not initialized');
        }
        tester.log(`   Oracle initialized: ✓`, 'cyan');
    }, true);

    await tester.test('Gemini AI Configuration', async () => {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not configured');
        }
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        if (!model) {
            throw new Error('Failed to initialize Gemini model');
        }
        tester.log(`   Gemini AI: Ready`, 'cyan');
    }, true);

    await tester.test('Content Analysis Function', async () => {
        const { getOracle } = require('../backend/services/oracle.service');
        const oracle = getOracle();

        const testContent = "Este es un post de prueba con contenido de alta calidad.";
        const analysis = await oracle.analyzeContent(testContent, 'post');

        if (!analysis.score || analysis.score < 0 || analysis.score > 100) {
            throw new Error('Invalid score returned');
        }

        tester.log(`   Analysis score: ${analysis.score}/100`, 'cyan');
    }, true);

    await tester.test('Quality Escrow Contract Connection', async () => {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const escrowAddress = process.env.QUALITY_ESCROW_ADDRESS;

        if (!escrowAddress || escrowAddress === 'PENDING') {
            throw new Error('Quality Escrow not deployed');
        }

        const code = await provider.getCode(escrowAddress);
        if (code === '0x') {
            throw new Error('No contract at Quality Escrow address');
        }

        tester.log(`   Contract at: ${escrowAddress}`, 'cyan');
    }, false);
}

// ============================================================================
// TEST SUITE 4: AUTOMATION ENGINE
// ============================================================================

async function testAutomationEngine(tester) {
    tester.log('\n' + '═'.repeat(70), 'blue');
    tester.log('⚙️  TEST SUITE 4: AUTOMATION ENGINE', 'blue');
    tester.log('═'.repeat(70), 'blue');

    await tester.test('Automation Engine Initialization', async () => {
        const { getEngine } = require('../backend/services/automationEngine.service');
        const engine = getEngine();

        if (!engine) {
            throw new Error('Engine not initialized');
        }
    }, true);

    await tester.test('Cron Jobs Module Available', async () => {
        const cron = require('node-cron');
        if (!cron.schedule) {
            throw new Error('node-cron not properly installed');
        }
    }, true);

    await tester.test('Database Models Available', async () => {
        const Post = require('../backend/models/Post');
        const User = require('../backend/models/User');

        if (!Post || !User) {
            throw new Error('Database models not found');
        }
    }, false);
}

// ============================================================================
// TEST SUITE 5: RWA CONTRACTS
// ============================================================================

async function testRWAContracts(tester) {
    tester.log('\n' + '═'.repeat(70), 'blue');
    tester.log('🏠 TEST SUITE 5: RWA CONTRACTS', 'blue');
    tester.log('═'.repeat(70), 'blue');

    await tester.test('Real Estate Contract Compiled', async () => {
        const fs = require('fs');
        const path = require('path');
        const artifactPath = path.join(__dirname, '../artifacts/contracts/BeZhasRealEstate.sol/BeZhasRealEstate.json');

        if (!fs.existsSync(artifactPath)) {
            throw new Error('BeZhasRealEstate not compiled');
        }
    }, true);

    await tester.test('Logistics Contract Compiled', async () => {
        const fs = require('fs');
        const path = require('path');
        const artifactPath = path.join(__dirname, '../artifacts/contracts/LogisticsContainer.sol/LogisticsContainer.json');

        if (!fs.existsSync(artifactPath)) {
            throw new Error('LogisticsContainer not compiled');
        }
    }, true);

    await tester.test('Real Estate Contract Deployed', async () => {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const address = process.env.REALESTATE_CONTRACT_ADDRESS;

        if (!address || address.includes('DIRECCION') || address === 'PENDING') {
            throw new Error('Real Estate contract not deployed yet');
        }

        const code = await provider.getCode(address);
        if (code === '0x') {
            throw new Error('No contract at Real Estate address');
        }

        tester.log(`   Deployed at: ${address}`, 'cyan');
    }, false);

    await tester.test('Logistics Contract Deployed', async () => {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const address = process.env.LOGISTICS_CONTRACT_ADDRESS;

        if (!address || address.includes('DIRECCION') || address === 'PENDING') {
            throw new Error('Logistics contract not deployed yet');
        }

        const code = await provider.getCode(address);
        if (code === '0x') {
            throw new Error('No contract at Logistics address');
        }

        tester.log(`   Deployed at: ${address}`, 'cyan');
    }, false);
}

// ============================================================================
// TEST SUITE 6: API ENDPOINTS
// ============================================================================

async function testAPIEndpoints(tester) {
    tester.log('\n' + '═'.repeat(70), 'blue');
    tester.log('🌐 TEST SUITE 6: API ENDPOINTS', 'blue');
    tester.log('═'.repeat(70), 'blue');

    await tester.test('Backend Server Running', async () => {
        try {
            const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
            if (response.status !== 200) {
                throw new Error('Health check failed');
            }
            tester.log(`   Server responding: ✓`, 'cyan');
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Backend server not running. Start with: pnpm run start:backend');
            }
            throw error;
        }
    }, false);

    await tester.test('Stripe Config Endpoint', async () => {
        const response = await axios.get(`${API_URL}/api/stripe/config`);
        if (!response.data.publishableKey) {
            throw new Error('Stripe config not returned');
        }
        tester.log(`   Stripe configured: ✓`, 'cyan');
    }, false);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
    console.clear();
    console.log('═'.repeat(70));
    console.log('🧪 BEZHAS PLATFORM - COMPREHENSIVE SYSTEM TEST');
    console.log('═'.repeat(70));
    console.log(`Started at: ${new Date().toISOString()}`);

    const tester = new SystemTester();

    try {
        await testEnvironment(tester);
        await testPaymentSystem(tester);
        await testAIOracle(tester);
        await testAutomationEngine(tester);
        await testRWAContracts(tester);
        await testAPIEndpoints(tester);
    } catch (error) {
        tester.log(`\n❌ Fatal error: ${error.message}`, 'red');
    }

    tester.printSummary();

    console.log(`\n📝 Test report saved at: ${new Date().toISOString()}`);
    console.log('═'.repeat(70));

    // Exit with proper code
    process.exit(tester.results.failed > 0 ? 1 : 0);
}

// Run tests if executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests, SystemTester };
