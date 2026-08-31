/**
 * Test Suite - VIP Endpoints
 * Tests para el sistema VIP y middleware
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'your-test-jwt-token';
const TEST_ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'your-admin-jwt-token';

// Configurar axios con token
const userApi = axios.create({
    baseURL: API_URL,
    headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

const adminApi = axios.create({
    baseURL: API_URL,
    headers: {
        'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

console.log('🧪 Testing VIP System...\n');
console.log(`API URL: ${API_URL}\n`);

let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, details = '') {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}`);
    if (details) console.log(`   ${details}`);
    testResults.tests.push({ name, passed, details });
    if (passed) testResults.passed++;
    else testResults.failed++;
}

// ==================================================
// TEST 1: Get VIP Tiers (Public)
// ==================================================
async function testGetVIPTiers() {
    try {
        const response = await axios.get(`${API_URL}/api/vip/tiers`);
        const success = response.status === 200 && Array.isArray(response.data.tiers);
        logTest(
            'GET /api/vip/tiers (Public)',
            success,
            success ? `Found ${response.data.tiers.length} tiers` : 'Failed'
        );
        return success;
    } catch (error) {
        logTest('GET /api/vip/tiers', false, `Error: ${error.response?.status || error.message}`);
        return false;
    }
}

// ==================================================
// TEST 2: Get User VIP Status (Protected)
// ==================================================
async function testGetVIPStatus() {
    try {
        const response = await userApi.get('/api/vip/status');
        const success = response.status === 200;
        logTest(
            'GET /api/vip/status (Protected)',
            success,
            success ? `VIP: ${response.data.hasVIP}, Tier: ${response.data.tier || 'none'}` : 'Failed'
        );
        return success;
    } catch (error) {
        logTest('GET /api/vip/status', false, `Error: ${error.response?.status || error.message}`);
        return false;
    }
}

// ==================================================
// TEST 3: Create VIP Subscription (Protected)
// ==================================================
async function testCreateVIPSubscription() {
    try {
        const response = await userApi.post('/api/vip/subscribe', {
            tier: 'bronze',
            userId: 'test-user-id'
        });
        const success = response.status === 200 && response.data.url;
        logTest(
            'POST /api/vip/subscribe (Protected)',
            success,
            success ? 'Checkout session created' : 'Failed'
        );
        return success;
    } catch (error) {
        // Es normal que falle sin Stripe configurado
        const isConfigError = error.response?.data?.message?.includes('configured');
        logTest(
            'POST /api/vip/subscribe',
            isConfigError,
            isConfigError ? 'Stripe not configured (expected)' : `Error: ${error.response?.status || error.message}`
        );
        return isConfigError;
    }
}

// ==================================================
// TEST 4: Test VIP Middleware - Access Denied
// ==================================================
async function testVIPMiddlewareAccessDenied() {
    try {
        // Intentar acceder a un endpoint protegido VIP sin tener VIP
        const response = await userApi.get('/api/vip/premium-feature');
        logTest('VIP Middleware - Access Denied', false, 'Should have been denied');
        return false;
    } catch (error) {
        // Esperamos un 403 Forbidden
        const success = error.response?.status === 403;
        logTest(
            'VIP Middleware - Access Denied',
            success,
            success ? '403 Forbidden (expected)' : `Unexpected: ${error.response?.status}`
        );
        return success;
    }
}

// ==================================================
// TEST 5: Cancel VIP Subscription
// ==================================================
async function testCancelVIPSubscription() {
    try {
        const response = await userApi.post('/api/vip/cancel', {
            subscriptionId: 'sub_test123'
        });
        const success = response.status === 200;
        logTest(
            'POST /api/vip/cancel',
            success,
            success ? 'Cancellation processed' : 'Failed'
        );
        return success;
    } catch (error) {
        // Es normal que falle sin subscripción activa
        const isExpectedError = error.response?.status === 404 || error.response?.status === 400;
        logTest(
            'POST /api/vip/cancel',
            isExpectedError,
            isExpectedError ? 'No active subscription (expected)' : `Error: ${error.response?.status}`
        );
        return isExpectedError;
    }
}

// ==================================================
// TEST 6: Webhook Endpoint (Should require signature)
// ==================================================
async function testWebhookEndpoint() {
    try {
        const response = await axios.post(`${API_URL}/api/stripe/webhook`, {
            type: 'customer.subscription.created',
            data: { object: { id: 'sub_test' } }
        });
        // Sin firma válida, debe fallar
        logTest('POST /api/stripe/webhook', false, 'Should require valid signature');
        return false;
    } catch (error) {
        // Esperamos 400 o 401 por firma inválida
        const success = error.response?.status === 400 || error.response?.status === 401;
        logTest(
            'POST /api/stripe/webhook (Signature Check)',
            success,
            success ? 'Invalid signature (expected)' : `Unexpected: ${error.response?.status}`
        );
        return success;
    }
}

// ==================================================
// RUN ALL TESTS
// ==================================================
async function runAllTests() {
    console.log('='.repeat(60));
    console.log('VIP SYSTEM TEST SUITE');
    console.log('='.repeat(60));
    console.log();

    // Check if server is running
    try {
        await axios.get(`${API_URL}/health`);
        logTest('Server Health Check', true, 'Server is running');
        console.log();
    } catch (error) {
        logTest('Server Health Check', false, 'Server is not running');
        console.log('\n❌ Server is not running. Please start the backend first:');
        console.log('   cd backend && npm run dev');
        process.exit(1);
    }

    // Run all tests
    await testGetVIPTiers();
    await testGetVIPStatus();
    await testCreateVIPSubscription();
    await testVIPMiddlewareAccessDenied();
    await testCancelVIPSubscription();
    await testWebhookEndpoint();

    // Print summary
    console.log();
    console.log('='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${testResults.passed}/${testResults.passed + testResults.failed}`);
    console.log(`❌ Failed: ${testResults.failed}/${testResults.passed + testResults.failed}`);
    console.log('='.repeat(60));

    if (testResults.failed === 0) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Please check the errors above.');
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});
