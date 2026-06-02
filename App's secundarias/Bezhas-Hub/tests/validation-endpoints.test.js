/**
 * Test Suite - Validation Endpoints
 * Tests para el sistema de validaciones
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'your-test-jwt-token';
const TEST_WALLET = process.env.TEST_WALLET || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

// Configurar axios con token
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

console.log('🧪 Testing Validation Endpoints...\n');
console.log(`API URL: ${API_URL}`);
console.log(`Test Wallet: ${TEST_WALLET}\n`);

let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

// Helper function
function logTest(name, passed, details = '') {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}`);
    if (details) console.log(`   ${details}`);
    testResults.tests.push({ name, passed, details });
    if (passed) testResults.passed++;
    else testResults.failed++;
}

// ==================================================
// TEST 1: Health Check
// ==================================================
async function testHealthCheck() {
    try {
        const response = await axios.get(`${API_URL}/health`);
        logTest('Health Check', response.status === 200, `Status: ${response.status}`);
        return true;
    } catch (error) {
        logTest('Health Check', false, `Error: ${error.message}`);
        return false;
    }
}

// ==================================================
// TEST 2: Get Validation History (Protected)
// ==================================================
async function testGetValidationHistory() {
    try {
        const response = await api.get('/api/validation/history?limit=10');
        const success = response.status === 200 && Array.isArray(response.data.validations);
        logTest(
            'GET /api/validation/history',
            success,
            `Status: ${response.status}, Count: ${response.data.count || 0}`
        );
        return success;
    } catch (error) {
        logTest(
            'GET /api/validation/history',
            false,
            `Error: ${error.response?.status || error.message}`
        );
        return false;
    }
}

// ==================================================
// TEST 3: Get Validation Stats (Protected)
// ==================================================
async function testGetValidationStats() {
    try {
        const response = await api.get('/api/validation/stats');
        const success = response.status === 200 && response.data.stats;
        logTest(
            'GET /api/validation/stats',
            success,
            success ? `Total: ${response.data.stats.total}, Success Rate: ${response.data.stats.successRate}%` : 'No stats'
        );
        return success;
    } catch (error) {
        logTest(
            'GET /api/validation/stats',
            false,
            `Error: ${error.response?.status || error.message}`
        );
        return false;
    }
}

// ==================================================
// TEST 4: Check Validation (Public - No Auth)
// ==================================================
async function testCheckValidation() {
    try {
        const testHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        const response = await axios.get(`${API_URL}/api/validation/check/${testHash}`);
        const success = response.status === 200;
        logTest(
            'GET /api/validation/check/:hash (Public)',
            success,
            `Status: ${response.status}, Validated: ${response.data.isValidated}`
        );
        return success;
    } catch (error) {
        logTest(
            'GET /api/validation/check/:hash',
            false,
            `Error: ${error.response?.status || error.message}`
        );
        return false;
    }
}

// ==================================================
// TEST 5: Get Specific Validation (Protected)
// ==================================================
async function testGetSpecificValidation() {
    try {
        const testHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        const response = await api.get(`/api/validation/${testHash}`);
        // Puede devolver 404 si no existe, eso está bien
        const success = response.status === 200 || response.status === 404;
        logTest(
            'GET /api/validation/:contentHash',
            success,
            `Status: ${response.status}`
        );
        return success;
    } catch (error) {
        // 404 es esperado si la validación no existe
        const success = error.response?.status === 404;
        logTest(
            'GET /api/validation/:contentHash',
            success,
            success ? 'Not found (expected)' : `Error: ${error.response?.status || error.message}`
        );
        return success;
    }
}

// ==================================================
// TEST 6: Validation Initiate Endpoint
// ==================================================
async function testValidationInitiate() {
    try {
        const response = await api.post('/api/validation/initiate', {
            contentData: {
                title: 'Test Post',
                content: 'This is a test post for validation',
                tags: ['test']
            },
            contentType: 'post',
            authorAddress: TEST_WALLET
        });
        const success = response.status === 200;
        logTest(
            'POST /api/validation/initiate',
            success,
            success ? `Content Hash: ${response.data.contentHash?.substring(0, 20)}...` : 'Failed'
        );
        return success;
    } catch (error) {
        logTest(
            'POST /api/validation/initiate',
            false,
            `Error: ${error.response?.status || error.message}`
        );
        return false;
    }
}

// ==================================================
// TEST 7: Queue Stats (if queue is enabled)
// ==================================================
async function testQueueStats() {
    try {
        const response = await api.get('/api/validation/queue-stats');
        const success = response.status === 200;
        logTest(
            'GET /api/validation/queue-stats',
            success,
            success ? `Waiting: ${response.data.waiting}, Active: ${response.data.active}` : 'Failed'
        );
        return success;
    } catch (error) {
        // Si la ruta no existe o la cola está deshabilitada, es normal
        const success = error.response?.status === 404 || error.response?.data?.message?.includes('disabled');
        logTest(
            'GET /api/validation/queue-stats',
            success,
            success ? 'Queue disabled (expected)' : `Error: ${error.response?.status || error.message}`
        );
        return success;
    }
}

// ==================================================
// RUN ALL TESTS
// ==================================================
async function runAllTests() {
    console.log('='.repeat(60));
    console.log('VALIDATION ENDPOINTS TEST SUITE');
    console.log('='.repeat(60));
    console.log();

    // Check if server is running
    const serverUp = await testHealthCheck();
    console.log();

    if (!serverUp) {
        console.log('❌ Server is not running. Please start the backend first:');
        console.log('   cd backend && npm run dev');
        process.exit(1);
    }

    // Run all tests
    await testGetValidationHistory();
    await testGetValidationStats();
    await testCheckValidation();
    await testGetSpecificValidation();
    await testValidationInitiate();
    await testQueueStats();

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
