/**
 * ============================================================================
 * QUICK SYSTEM VERIFICATION
 * ============================================================================
 * 
 * Verificación rápida de todas las implementaciones
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 BEZHAS PLATFORM - QUICK VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

function check(name, condition, critical = true) {
    if (condition) {
        console.log(`✅ ${name}`);
        passed++;
    } else {
        console.log(`${critical ? '❌' : '⚠️ '} ${name}`);
        if (critical) failed++;
    }
}

// ============================================================================
// 1. PRIORIDAD 1: STRIPE → BLOCKCHAIN
// ============================================================================
console.log('\n💳 PRIORIDAD 1: SISTEMA DE PAGOS');
console.log('─'.repeat(60));

check(
    'stripe.service.js modificado con fiatGateway',
    fs.existsSync('backend/services/stripe.service.js') &&
    fs.readFileSync('backend/services/stripe.service.js', 'utf8')
        .includes('fiatGatewayService')
);

check(
    'fiatGateway.service.js existe',
    fs.existsSync('backend/services/fiatGateway.service.js')
);

check(
    'BuyTokensButton.jsx creado',
    fs.existsSync('frontend/src/components/payments/BuyTokensButton.jsx')
);

check(
    'TokenPurchaseModal.jsx creado',
    fs.existsSync('frontend/src/components/payments/TokenPurchaseModal.jsx')
);

check(
    'PaymentSuccess.jsx creado',
    fs.existsSync('frontend/src/pages/PaymentSuccess.jsx')
);

check(
    'check-hot-wallet.js script creado',
    fs.existsSync('backend/scripts/check-hot-wallet.js')
);

check(
    'HOT_WALLET_PRIVATE_KEY configurada',
    process.env.HOT_WALLET_PRIVATE_KEY && process.env.HOT_WALLET_PRIVATE_KEY.length > 20
);

check(
    'STRIPE_SECRET_KEY configurada',
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')
);

// ============================================================================
// 2. PRIORIDAD 2: AI ORACLE & AUTOMATIZACIONES
// ============================================================================
console.log('\n🤖 PRIORIDAD 2: AI ORACLE & AUTOMATIZACIONES');
console.log('─'.repeat(60));

check(
    'oracle.service.js creado',
    fs.existsSync('backend/services/oracle.service.js')
);

const oracleContent = fs.existsSync('backend/services/oracle.service.js')
    ? fs.readFileSync('backend/services/oracle.service.js', 'utf8')
    : '';

check(
    'Oracle: analyzeContent function',
    oracleContent.includes('analyzeContent')
);

check(
    'Oracle: validateContentOnChain function',
    oracleContent.includes('validateContentOnChain')
);

check(
    'Oracle: processContent function',
    oracleContent.includes('processContent')
);

check(
    'Oracle: distributeRewards function',
    oracleContent.includes('distributeRewards')
);

check(
    'automationEngine.service.js creado',
    fs.existsSync('backend/services/automationEngine.service.js')
);

const automationContent = fs.existsSync('backend/services/automationEngine.service.js')
    ? fs.readFileSync('backend/services/automationEngine.service.js', 'utf8')
    : '';

check(
    'Automation: autoAnalyzeNewContent',
    automationContent.includes('autoAnalyzeNewContent')
);

check(
    'Automation: distributeDailyRewards',
    automationContent.includes('distributeDailyRewards')
);

check(
    'Automation: cleanLowQualityContent',
    automationContent.includes('cleanLowQualityContent')
);

check(
    'Automation: checkAndNotifyAchievements',
    automationContent.includes('checkAndNotifyAchievements')
);

check(
    'server.js integra AI Oracle',
    fs.existsSync('backend/server.js') &&
    fs.readFileSync('backend/server.js', 'utf8').includes('oracle.service')
);

check(
    'server.js integra Automation Engine',
    fs.existsSync('backend/server.js') &&
    fs.readFileSync('backend/server.js', 'utf8').includes('automationEngine.service')
);

check(
    'GEMINI_API_KEY configurada',
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20
);

// ============================================================================
// 3. PRIORIDAD 3: RWA DEPLOYMENT
// ============================================================================
console.log('\n🏠 PRIORIDAD 3: RWA CONTRACTS');
console.log('─'.repeat(60));

check(
    'BeZhasRealEstate.sol existe',
    fs.existsSync('contracts/BeZhasRealEstate.sol')
);

check(
    'LogisticsContainer.sol existe',
    fs.existsSync('contracts/LogisticsContainer.sol')
);

check(
    'deploy-rwa-contracts.js script creado',
    fs.existsSync('scripts/deploy-rwa-contracts.js')
);

check(
    'deploy-realestate-mainnet.js creado',
    fs.existsSync('scripts/deploy-realestate-mainnet.js')
);

check(
    'deploy-logistics-mainnet.js creado',
    fs.existsSync('scripts/deploy-logistics-mainnet.js')
);

check(
    'BeZhasRealEstate compilado',
    fs.existsSync('artifacts/contracts/BeZhasRealEstate.sol/BeZhasRealEstate.json')
);

check(
    'LogisticsContainer compilado',
    fs.existsSync('artifacts/contracts/LogisticsContainer.sol/LogisticsContainer.json')
);

const realEstateDeployed = process.env.REALESTATE_CONTRACT_ADDRESS &&
    !process.env.REALESTATE_CONTRACT_ADDRESS.includes('DIRECCION') &&
    process.env.REALESTATE_CONTRACT_ADDRESS !== 'PENDING';

const logisticsDeployed = process.env.LOGISTICS_CONTRACT_ADDRESS &&
    !process.env.LOGISTICS_CONTRACT_ADDRESS.includes('DIRECCION') &&
    process.env.LOGISTICS_CONTRACT_ADDRESS !== 'PENDING';

check(
    'RealEstate desplegado en Mainnet',
    realEstateDeployed,
    false
);

check(
    'Logistics desplegado en Mainnet',
    logisticsDeployed,
    false
);

// ============================================================================
// 4. TESTS CREADOS
// ============================================================================
console.log('\n🧪 TESTS IMPLEMENTADOS');
console.log('─'.repeat(60));

check(
    'comprehensive-system-test.js',
    fs.existsSync('tests/comprehensive-system-test.js')
);

check(
    'test-payment-system.js',
    fs.existsSync('tests/test-payment-system.js')
);

check(
    'test-ai-oracle.js',
    fs.existsSync('tests/test-ai-oracle.js')
);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📊 RESUMEN DE VERIFICACIÓN');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Verificaciones exitosas: ${passed}`);
console.log(`❌ Verificaciones fallidas: ${failed}`);
console.log('═══════════════════════════════════════════════════════════');

if (failed === 0) {
    console.log('\n🎉 ¡TODAS LAS IMPLEMENTACIONES VERIFICADAS!');
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('   1. Fondear Hot Wallet:');
    console.log('      node backend/scripts/check-hot-wallet.js');
    console.log('   ');
    console.log('   2. Desplegar contratos RWA (opcional):');
    console.log('      npx hardhat run scripts/deploy-rwa-contracts.js --network polygon');
    console.log('   ');
    console.log('   3. Iniciar backend:');
    console.log('      pnpm run start:backend');
    console.log('   ');
    console.log('   4. Iniciar frontend:');
    console.log('      pnpm run dev');
} else {
    console.log('\n⚠️  Algunas verificaciones fallaron. Revisa los errores arriba.');
}

console.log('\n═══════════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
