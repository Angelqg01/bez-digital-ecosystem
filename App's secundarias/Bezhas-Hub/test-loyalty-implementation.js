/**
 * Test Script para verificar la implementación de Loyalty & Gamification
 * Ejecutar: node test-loyalty-implementation.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando Tests de Implementación de Loyalty & Gamification\n');

const tests = {
    passed: 0,
    failed: 0,
    results: []
};

function test(name, condition, message) {
    if (condition) {
        tests.passed++;
        tests.results.push(`✅ ${name}: PASS`);
        console.log(`✅ ${name}: PASS`);
    } else {
        tests.failed++;
        tests.results.push(`❌ ${name}: FAIL - ${message}`);
        console.error(`❌ ${name}: FAIL - ${message}`);
    }
}

// Test 1: Verificar modelo ApiKey actualizado
console.log('\n📦 Test 1: Verificando modelo ApiKey...');
try {
    const apiKeyModel = fs.readFileSync(
        path.join(__dirname, 'backend', 'models', 'ApiKey.model.js'),
        'utf8'
    );

    test(
        'ApiKey Model - smartContractCalls field',
        apiKeyModel.includes('smartContractCalls'),
        'Campo smartContractCalls no encontrado en el modelo'
    );

    test(
        'ApiKey Model - identityValidations field',
        apiKeyModel.includes('identityValidations'),
        'Campo identityValidations no encontrado en el modelo'
    );

    test(
        'ApiKey Model - achievements array',
        apiKeyModel.includes('achievements:'),
        'Array de achievements no encontrado en el modelo'
    );
} catch (error) {
    test('ApiKey Model - File exists', false, error.message);
}

// Test 2: Verificar controlador VIP
console.log('\n🎮 Test 2: Verificando controlador VIP...');
try {
    const vipController = fs.readFileSync(
        path.join(__dirname, 'backend', 'controllers', 'vip.controller.js'),
        'utf8'
    );

    test(
        'VIP Controller - getLoyaltyStats function',
        vipController.includes('exports.getLoyaltyStats'),
        'Función getLoyaltyStats no encontrada'
    );

    test(
        'VIP Controller - TIERS definition',
        vipController.includes('const TIERS'),
        'Definición de TIERS no encontrada'
    );

    test(
        'VIP Controller - Achievements logic',
        vipController.includes('speed-demon') || vipController.includes('Speed Demon'),
        'Lógica de achievements no encontrada'
    );

    test(
        'VIP Controller - getRewardsEarnings function',
        vipController.includes('exports.getRewardsEarnings'),
        'Función getRewardsEarnings no encontrada'
    );
} catch (error) {
    test('VIP Controller - File exists', false, error.message);
}

// Test 3: Verificar rutas VIP
console.log('\n🛣️ Test 3: Verificando rutas VIP...');
try {
    const vipRoutes = fs.readFileSync(
        path.join(__dirname, 'backend', 'routes', 'vip.routes.js'),
        'utf8'
    );

    test(
        'VIP Routes - loyalty-stats endpoint',
        vipRoutes.includes('/loyalty-stats'),
        'Endpoint /loyalty-stats no encontrado'
    );

    test(
        'VIP Routes - rewards-earnings endpoint',
        vipRoutes.includes('/rewards-earnings'),
        'Endpoint /rewards-earnings no encontrado'
    );

    test(
        'VIP Routes - Controller import',
        vipRoutes.includes("require('../controllers/vip.controller')"),
        'Import del controlador VIP no encontrado'
    );
} catch (error) {
    test('VIP Routes - File exists', false, error.message);
}

// Test 4: Verificar Frontend BeVIP
console.log('\n🎨 Test 4: Verificando página BeVIP...');
try {
    const beVipPage = fs.readFileSync(
        path.join(__dirname, 'frontend', 'src', 'pages', 'BeVIP.jsx'),
        'utf8'
    );

    test(
        'BeVIP Page - loyaltyData state',
        beVipPage.includes('loyaltyData'),
        'State loyaltyData no encontrado'
    );

    test(
        'BeVIP Page - fetchLoyaltyStats function',
        beVipPage.includes('fetchLoyaltyStats') || beVipPage.includes('/api/vip/loyalty-stats'),
        'Función fetchLoyaltyStats no encontrada'
    );

    test(
        'BeVIP Page - Loyalty Dashboard component',
        beVipPage.includes('Tu Nivel VIP') || beVipPage.includes('LOYALTY DASHBOARD'),
        'Dashboard de Loyalty no encontrado'
    );

    test(
        'BeVIP Page - TrendingUp icon import',
        beVipPage.includes('TrendingUp'),
        'Import de TrendingUp icon no encontrado'
    );
} catch (error) {
    test('BeVIP Page - File exists', false, error.message);
}

// Test 5: Verificar Frontend RewardsPage
console.log('\n🏆 Test 5: Verificando página Rewards...');
try {
    const rewardsPage = fs.readFileSync(
        path.join(__dirname, 'frontend', 'src', 'pages', 'RewardsPage.jsx'),
        'utf8'
    );

    test(
        'Rewards Page - loyaltyData state',
        rewardsPage.includes('loyaltyData'),
        'State loyaltyData no encontrado'
    );

    test(
        'Rewards Page - fetchLoyaltyData function',
        rewardsPage.includes('fetchLoyaltyData'),
        'Función fetchLoyaltyData no encontrada'
    );

    test(
        'Rewards Page - earnings tab',
        rewardsPage.includes("'earnings'"),
        'Tab de earnings no encontrado'
    );

    test(
        'Rewards Page - Mis Ganancias section',
        rewardsPage.includes('Mis Ganancias') || rewardsPage.includes('Desglose de Ganancias'),
        'Sección Mis Ganancias no encontrada'
    );
} catch (error) {
    test('Rewards Page - File exists', false, error.message);
}

// Test 6: Verificar estructura de datos
console.log('\n📊 Test 6: Verificando estructura de datos...');
try {
    const vipController = fs.readFileSync(
        path.join(__dirname, 'backend', 'controllers', 'vip.controller.js'),
        'utf8'
    );

    test(
        'Data Structure - Bronze tier (0-50k)',
        vipController.includes('min: 0') && vipController.includes('max: 50000'),
        'Tier Bronze no configurado correctamente'
    );

    test(
        'Data Structure - Silver tier (50k-500k)',
        vipController.includes('min: 50000') && vipController.includes('max: 500000'),
        'Tier Silver no configurado correctamente'
    );

    test(
        'Data Structure - Gold tier (500k-2M)',
        vipController.includes('min: 500000') && vipController.includes('max: 2000000'),
        'Tier Gold no configurado correctamente'
    );

    test(
        'Data Structure - Platinum tier (2M+)',
        vipController.includes('min: 2000000') && vipController.includes('max: Infinity'),
        'Tier Platinum no configurado correctamente'
    );
} catch (error) {
    test('Data Structure - Verification', false, error.message);
}

// Resumen
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE TESTS');
console.log('='.repeat(60));
console.log(`Total Tests: ${tests.passed + tests.failed}`);
console.log(`✅ Pasados: ${tests.passed}`);
console.log(`❌ Fallados: ${tests.failed}`);
console.log(`Éxito: ${((tests.passed / (tests.passed + tests.failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (tests.failed === 0) {
    console.log('\n🎉 ¡TODOS LOS TESTS PASARON! La implementación está completa.\n');
    console.log('✨ Próximos pasos:');
    console.log('   1. Iniciar el backend: cd backend && pnpm start');
    console.log('   2. Iniciar el frontend: cd frontend && pnpm run dev');
    console.log('   3. Visitar http://localhost:5173/be-vip');
    console.log('   4. Visitar http://localhost:5173/rewards');
    console.log('   5. Conectar wallet y verificar el dashboard de loyalty\n');
} else {
    console.log('\n⚠️  Algunos tests fallaron. Revisar los detalles arriba.\n');
}

// Salir con código apropiado
process.exit(tests.failed === 0 ? 0 : 1);
