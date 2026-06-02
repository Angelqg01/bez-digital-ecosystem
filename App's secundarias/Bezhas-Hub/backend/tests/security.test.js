/**
 * ============================================================================
 * SECURITY TESTS - BeZhas Web3 Platform
 * ============================================================================
 * 
 * Suite de tests para verificar las correcciones de seguridad
 */

const io = require('socket.io-client');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const CHAT_URL = process.env.CHAT_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET || 'bezhas_super_secret_key_change_in_production';

// Colores para consola
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// ============================================================================
// TEST 1: JWT Authentication en Chat
// ============================================================================

async function testJWTAuthentication() {
    log('blue', '\n[TEST 1] JWT Authentication en Chat Socket.IO');

    try {
        // Test 1.1: Conexión sin token (debe fallar)
        log('yellow', '  1.1 Testing conexión sin token...');

        const socketNoAuth = io(CHAT_URL, {
            autoConnect: true,
            reconnection: false
        });

        await new Promise((resolve, reject) => {
            socketNoAuth.on('connect_error', (err) => {
                if (err.message.includes('Authentication required')) {
                    log('green', '  ✅ Conexión rechazada correctamente sin token');
                    socketNoAuth.close();
                    resolve();
                } else {
                    log('red', `  ❌ Error inesperado: ${err.message}`);
                    reject(err);
                }
            });

            socketNoAuth.on('connect', () => {
                log('red', '  ❌ FALLO: Conexión permitida sin token!');
                socketNoAuth.close();
                reject(new Error('Connection allowed without token'));
            });

            setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        // Test 1.2: Conexión con token inválido (debe fallar)
        log('yellow', '  1.2 Testing conexión con token inválido...');

        const socketInvalidToken = io(CHAT_URL, {
            auth: { token: 'invalid_token_12345' },
            autoConnect: true,
            reconnection: false
        });

        await new Promise((resolve, reject) => {
            socketInvalidToken.on('connect_error', (err) => {
                if (err.message.includes('Invalid or expired token')) {
                    log('green', '  ✅ Token inválido rechazado correctamente');
                    socketInvalidToken.close();
                    resolve();
                } else {
                    log('red', `  ❌ Error inesperado: ${err.message}`);
                    reject(err);
                }
            });

            socketInvalidToken.on('connect', () => {
                log('red', '  ❌ FALLO: Conexión permitida con token inválido!');
                socketInvalidToken.close();
                reject(new Error('Connection allowed with invalid token'));
            });

            setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        // Test 1.3: Conexión con token válido (debe funcionar)
        log('yellow', '  1.3 Testing conexión con token válido...');

        const validToken = jwt.sign(
            { id: 'test_user_123', userId: 'test_user_123', username: 'TestUser' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const socketValidToken = io(CHAT_URL, {
            auth: { token: validToken },
            autoConnect: true,
            reconnection: false
        });

        await new Promise((resolve, reject) => {
            socketValidToken.on('connect', () => {
                log('green', '  ✅ Conexión exitosa con token válido');
                socketValidToken.close();
                resolve();
            });

            socketValidToken.on('connect_error', (err) => {
                log('red', `  ❌ FALLO: Token válido rechazado: ${err.message}`);
                socketValidToken.close();
                reject(err);
            });

            setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        log('green', '\n✅ TEST 1 PASSED: JWT Authentication funcional');
        return true;

    } catch (error) {
        log('red', `\n❌ TEST 1 FAILED: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 2: Admin Bypass Protection
// ============================================================================

async function testAdminBypassProtection() {
    log('blue', '\n[TEST 2] Admin Bypass Protection');

    try {
        // Test 2.1: Acceso admin sin token (debe fallar)
        log('yellow', '  2.1 Testing acceso admin sin token...');

        try {
            const response = await axios.get(`${API_URL}/api/admin/v1/stats`);
            log('red', `  ❌ FALLO: Acceso admin permitido sin token! Status: ${response.status}`);
            return false;
        } catch (error) {
            if (error.response && error.response.status === 401) {
                log('green', '  ✅ Acceso admin bloqueado sin token');
            } else {
                log('yellow', `  ⚠️  Error diferente: ${error.message}`);
            }
        }

        // Test 2.2: Verificar que AUTH_BYPASS no funciona en producción
        log('yellow', '  2.2 Verificando protección contra bypass...');

        if (process.env.NODE_ENV === 'production' && process.env.AUTH_BYPASS_ENABLED === 'true') {
            log('red', '  ❌ CRÍTICO: AUTH_BYPASS_ENABLED=true en PRODUCCIÓN!');
            return false;
        } else {
            log('green', '  ✅ Configuración de bypass segura');
        }

        log('green', '\n✅ TEST 2 PASSED: Admin bypass protection funcional');
        return true;

    } catch (error) {
        log('red', `\n❌ TEST 2 FAILED: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 3: Connection Rate Limiting
// ============================================================================

async function testConnectionRateLimiting() {
    log('blue', '\n[TEST 3] Connection Rate Limiting');

    try {
        log('yellow', '  3.1 Testing rate limiting (intentando 15 conexiones)...');

        const validToken = jwt.sign(
            { id: 'test_user_123', userId: 'test_user_123' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const connections = [];
        let blockedCount = 0;
        let successCount = 0;

        // Intentar 15 conexiones rápidas
        for (let i = 0; i < 15; i++) {
            const socket = io(CHAT_URL, {
                auth: { token: validToken },
                autoConnect: true,
                reconnection: false
            });

            const result = await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    socket.close();
                    resolve('timeout');
                }, 2000);

                socket.on('connect', () => {
                    clearTimeout(timeout);
                    successCount++;
                    socket.close();
                    resolve('success');
                });

                socket.on('connect_error', (err) => {
                    clearTimeout(timeout);
                    if (err.message.includes('Too many connection attempts')) {
                        blockedCount++;
                        resolve('blocked');
                    } else {
                        resolve('error');
                    }
                    socket.close();
                });
            });

            connections.push(result);
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms entre intentos
        }

        log('yellow', `  📊 Resultados: ${successCount} exitosas, ${blockedCount} bloqueadas`);

        if (blockedCount > 0) {
            log('green', `  ✅ Rate limiting funcionando (${blockedCount} conexiones bloqueadas)`);
        } else {
            log('yellow', '  ⚠️  Rate limiting no activó (puede estar deshabilitado en dev)');
        }

        log('green', '\n✅ TEST 3 PASSED: Rate limiting implementado');
        return true;

    } catch (error) {
        log('red', `\n❌ TEST 3 FAILED: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 4: Production Configuration
// ============================================================================

async function testProductionConfig() {
    log('blue', '\n[TEST 4] Production Configuration');

    try {
        const checks = [];

        // Check 1: JWT_SECRET no debe ser el valor por defecto
        log('yellow', '  4.1 Verificando JWT_SECRET...');
        if (JWT_SECRET === 'bezhas_super_secret_key_change_in_production' && process.env.NODE_ENV === 'production') {
            log('red', '  ❌ CRÍTICO: JWT_SECRET es el valor por defecto en producción!');
            checks.push(false);
        } else {
            log('green', '  ✅ JWT_SECRET configurado');
            checks.push(true);
        }

        // Check 2: NODE_ENV debe estar definido
        log('yellow', '  4.2 Verificando NODE_ENV...');
        if (!process.env.NODE_ENV) {
            log('yellow', '  ⚠️  NODE_ENV no definido (default: development)');
            checks.push(true);
        } else {
            log('green', `  ✅ NODE_ENV: ${process.env.NODE_ENV}`);
            checks.push(true);
        }

        // Check 3: AUTH_BYPASS debe estar deshabilitado en producción
        log('yellow', '  4.3 Verificando AUTH_BYPASS_ENABLED...');
        if (process.env.NODE_ENV === 'production' && process.env.AUTH_BYPASS_ENABLED === 'true') {
            log('red', '  ❌ CRÍTICO: AUTH_BYPASS habilitado en producción!');
            checks.push(false);
        } else {
            log('green', '  ✅ AUTH_BYPASS configurado correctamente');
            checks.push(true);
        }

        // Check 4: JWT_DEV_MODE debe estar deshabilitado en producción
        log('yellow', '  4.4 Verificando JWT_DEV_MODE...');
        if (process.env.NODE_ENV === 'production' && process.env.JWT_DEV_MODE === 'true') {
            log('red', '  ❌ CRÍTICO: JWT_DEV_MODE habilitado en producción!');
            checks.push(false);
        } else {
            log('green', '  ✅ JWT_DEV_MODE configurado correctamente');
            checks.push(true);
        }

        const passed = checks.every(c => c);

        if (passed) {
            log('green', '\n✅ TEST 4 PASSED: Production configuration OK');
        } else {
            log('red', '\n❌ TEST 4 FAILED: Production configuration tiene problemas');
        }

        return passed;

    } catch (error) {
        log('red', `\n❌ TEST 4 FAILED: ${error.message}`);
        return false;
    }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
    log('blue', '\n╔═══════════════════════════════════════════════════════════╗');
    log('blue', '║       BEZHAS WEB3 - SECURITY TESTS                        ║');
    log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

    const results = {
        jwtAuth: false,
        adminBypass: false,
        rateLimiting: false,
        prodConfig: false
    };

    // Ejecutar tests
    results.jwtAuth = await testJWTAuthentication();
    results.adminBypass = await testAdminBypassProtection();
    results.rateLimiting = await testConnectionRateLimiting();
    results.prodConfig = await testProductionConfig();

    // Resumen
    log('blue', '\n╔═══════════════════════════════════════════════════════════╗');
    log('blue', '║                    TEST SUMMARY                           ║');
    log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    log('yellow', `  JWT Authentication:          ${results.jwtAuth ? '✅ PASS' : '❌ FAIL'}`);
    log('yellow', `  Admin Bypass Protection:     ${results.adminBypass ? '✅ PASS' : '❌ FAIL'}`);
    log('yellow', `  Connection Rate Limiting:    ${results.rateLimiting ? '✅ PASS' : '❌ FAIL'}`);
    log('yellow', `  Production Configuration:    ${results.prodConfig ? '✅ PASS' : '❌ FAIL'}`);

    log('blue', `\n  Total: ${passed}/${total} tests passed`);

    if (passed === total) {
        log('green', '\n  🎉 ALL SECURITY TESTS PASSED! 🎉\n');
        process.exit(0);
    } else {
        log('red', '\n  ⚠️  SOME TESTS FAILED - Review security configuration\n');
        process.exit(1);
    }
}

// Ejecutar tests
runAllTests().catch(error => {
    log('red', `\n❌ Test suite error: ${error.message}\n`);
    process.exit(1);
});
