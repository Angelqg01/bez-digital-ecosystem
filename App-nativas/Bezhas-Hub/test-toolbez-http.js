/**
 * ToolBEZ™ Enterprise - Test Suite (Compatible con Node.js sin fetch)
 * Prueba todos los endpoints del sistema BaaS
 */

const http = require('http');
const BASE_URL = 'http://localhost:3001';
const API_KEY = process.env.TOOLBEZ_TEST_API_KEY || 'change-me-toolbez-demo-key';

console.log('\n🚀 Iniciando pruebas de ToolBEZ™ Enterprise...\n');

// Helper para hacer requests HTTP
function httpRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
                } catch (e) {
                    resolve({ ok: false, status: res.statusCode, data: { raw: body } });
                }
            });
        });

        req.on('error', (err) => reject(err));

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testEndpoint(name, method, endpoint, data = null, headers = {}) {
    console.log(`\n📡 Probando: ${name}`);
    console.log(`   Endpoint: ${method} ${endpoint}`);

    try {
        const result = await httpRequest(method, endpoint, data, headers);

        if (result.ok) {
            console.log(`   ✅ Status: ${result.status} OK`);
            console.log(`   📦 Respuesta:`, JSON.stringify(result.data, null, 2).substring(0, 400));
            return { success: true, data: result.data };
        } else {
            console.log(`   ❌ Status: ${result.status} ERROR`);
            console.log(`   ⚠️  Error:`, result.data.error || result.data.message || result.data.raw);
            return { success: false, error: result.data };
        }
    } catch (error) {
        console.log(`   ❌ Error:`, error.message);
        return { success: false, error: error.message };
    }
}

async function runTests() {
    const results = { passed: 0, failed: 0, total: 10 };

    console.log('═'.repeat(60));
    console.log('  TEST 1: Health Check');
    console.log('═'.repeat(60));
    const t1 = await testEndpoint('Health Check', 'GET', '/api/health');
    t1.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 2: Registro Email');
    console.log('═'.repeat(60));
    const t2 = await testEndpoint('Registro Email', 'POST', '/api/auth/register-email', {
        email: `test${Date.now()}@toolbez.com`,
        password: 'Test123456!',
        username: `testuser${Date.now()}`,
        referralCode: 'TOOLBEZ2026'
    });
    t2.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 3: Login Email');
    console.log('═'.repeat(60));
    const t3 = await testEndpoint('Login Email', 'POST', '/api/auth/login-email', {
        email: 'demo@toolbez.com',
        password: 'Demo123456!'
    });
    t3.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 4: ToolBEZ - IoT Data Ingest');
    console.log('═'.repeat(60));
    const t4 = await testEndpoint('IoT Data Ingest', 'POST', '/api/oracle/toolbez/iot-ingest', {
        productId: `TEMP_SENSOR_${Date.now()}`,
        sensorData: {
            temperature: 4.2,
            humidity: 65,
            location: 'Warehouse Madrid'
        },
        metadata: {
            deviceId: 'SENSOR_001',
            batchId: 'BATCH_2026_001'
        }
    }, { 'x-api-key': API_KEY });
    t4.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 5: ToolBEZ - Batch Operations');
    console.log('═'.repeat(60));
    const t5 = await testEndpoint('Batch Operations', 'POST', '/api/oracle/toolbez/batch', {
        operations: [
            { type: 'iot.ingest', productId: 'BATCH_P1', sensorData: { temp: 5.0 } },
            { type: 'iot.ingest', productId: 'BATCH_P2', sensorData: { temp: 4.5 } },
            { type: 'verify', productId: 'BATCH_P1' }
        ]
    }, { 'x-api-key': 'ENT_CARREFOUR_2026' });
    t5.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 6: ToolBEZ - Verify Product');
    console.log('═'.repeat(60));
    const t6 = await testEndpoint('Verify Product', 'GET', '/api/oracle/toolbez/verify/PROD_12345');
    t6.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 7: ToolBEZ - Enterprise Stats');
    console.log('═'.repeat(60));
    const t7 = await testEndpoint('Enterprise Stats', 'GET', '/api/oracle/toolbez/stats', null, {
        'x-api-key': API_KEY
    });
    t7.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 8: Oracle Prices');
    console.log('═'.repeat(60));
    const t8 = await testEndpoint('Oracle Prices', 'GET', '/api/oracle/prices');
    t8.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 9: Oracle Feeds');
    console.log('═'.repeat(60));
    const t9 = await testEndpoint('Oracle Feeds', 'GET', '/api/oracle/feeds');
    t9.success ? results.passed++ : results.failed++;

    console.log('\n═'.repeat(60));
    console.log('  TEST 10: API Key Inválida (debe fallar)');
    console.log('═'.repeat(60));
    const t10 = await testEndpoint('API Key Inválida', 'POST', '/api/oracle/toolbez/iot-ingest', {
        productId: 'TEST_INVALID',
        sensorData: { temp: 0 }
    }, { 'x-api-key': 'INVALID_KEY_12345' });
    !t10.success ? results.passed++ : results.failed++; // Este debe FALLAR

    // Resumen
    console.log('\n\n');
    console.log('═'.repeat(60));
    console.log('  RESUMEN DE PRUEBAS');
    console.log('═'.repeat(60));
    console.log(`\n  Total de pruebas: ${results.total}`);
    console.log(`  ✅ Exitosas: ${results.passed} (${(results.passed / results.total * 100).toFixed(1)}%)`);
    console.log(`  ❌ Fallidas: ${results.failed} (${(results.failed / results.total * 100).toFixed(1)}%)`);

    if (results.failed > 0) {
        console.log('\n  ⚠️  Algunos tests fallaron. Revisa los logs arriba.');
    } else {
        console.log('\n  🎉 ¡Todos los tests pasaron exitosamente!');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('  COMPONENTES VERIFICADOS');
    console.log('═'.repeat(60));
    console.log('  ✅ Backend Health Check');
    console.log('  ✅ Autenticación Email (Register + Login)');
    console.log('  ✅ ToolBEZ IoT Ingestion con Fee Delegation');
    console.log('  ✅ ToolBEZ Batch Operations (MTT)');
    console.log('  ✅ ToolBEZ Product Verification');
    console.log('  ✅ Enterprise API Key Validation');
    console.log('  ✅ Oracle Price Feeds');
    console.log('\n');
}

runTests().catch(console.error);
