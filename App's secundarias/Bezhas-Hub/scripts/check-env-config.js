/**
 * Check Environment Configuration
 * Verifica que todas las variables de entorno estén configuradas
 */

require('dotenv').config();

console.log('═══════════════════════════════════════════════════════════');
console.log('🔐 VERIFICACIÓN DE CONFIGURACIÓN (.env)');
console.log('═══════════════════════════════════════════════════════════\n');

const checks = [
    {
        name: 'PRIVATE_KEY',
        value: process.env.PRIVATE_KEY,
        critical: true,
        validate: (val) => val && val.length === 66
    },
    {
        name: 'HOT_WALLET_PRIVATE_KEY',
        value: process.env.HOT_WALLET_PRIVATE_KEY,
        critical: true,
        validate: (val) => val && val.length >= 64
    },
    {
        name: 'POLYGON_RPC_URL',
        value: process.env.POLYGON_RPC_URL,
        critical: true,
        validate: (val) => val && val.includes('http')
    },
    {
        name: 'BEZCOIN_CONTRACT_ADDRESS',
        value: process.env.BEZCOIN_CONTRACT_ADDRESS,
        critical: true,
        validate: (val) => val && val.startsWith('0x') && val.length === 42
    },
    {
        name: 'GEMINI_API_KEY',
        value: process.env.GEMINI_API_KEY,
        critical: true,
        validate: (val) => val && val.startsWith('AIza') && val.length > 20
    },
    {
        name: 'STRIPE_SECRET_KEY',
        value: process.env.STRIPE_SECRET_KEY,
        critical: true,
        validate: (val) => val && val.startsWith('sk_') && val.length > 20
    },
    {
        name: 'STRIPE_PUBLISHABLE_KEY',
        value: process.env.STRIPE_PUBLISHABLE_KEY,
        critical: false,
        validate: (val) => val && val.startsWith('pk_')
    },
    {
        name: 'STRIPE_WEBHOOK_SECRET',
        value: process.env.STRIPE_WEBHOOK_SECRET,
        critical: false,
        validate: (val) => val && val.startsWith('whsec_')
    },
    {
        name: 'QUALITY_ESCROW_ADDRESS',
        value: process.env.QUALITY_ESCROW_ADDRESS,
        critical: false,
        validate: (val) => val && val.startsWith('0x')
    },
    {
        name: 'REALESTATE_CONTRACT_ADDRESS',
        value: process.env.REALESTATE_CONTRACT_ADDRESS,
        critical: false,
        validate: (val) => val && !val.includes('DIRECCION') && val !== 'PENDING'
    },
    {
        name: 'LOGISTICS_CONTRACT_ADDRESS',
        value: process.env.LOGISTICS_CONTRACT_ADDRESS,
        critical: false,
        validate: (val) => val && !val.includes('DIRECCION') && val !== 'PENDING'
    }
];

let passed = 0;
let failed = 0;
let optional = 0;

console.log('🔍 Variables Críticas:\n');

checks.forEach(check => {
    const isValid = check.validate(check.value);
    const symbol = isValid ? '✅' : (check.critical ? '❌' : '⚠️ ');

    if (check.critical) {
        if (isValid) {
            passed++;
            console.log(`${symbol} ${check.name}`);
            if (check.value.length > 50) {
                console.log(`   ${check.value.substring(0, 20)}...${check.value.substring(check.value.length - 10)}`);
            } else if (check.value.length > 20) {
                console.log(`   ${check.value.substring(0, 30)}...`);
            }
        } else {
            failed++;
            console.log(`${symbol} ${check.name} - NO CONFIGURADA`);
        }
    } else {
        if (isValid) {
            optional++;
            console.log(`${symbol} ${check.name} (opcional)`);
        } else {
            console.log(`${symbol} ${check.name} (opcional) - Pendiente`);
        }
    }
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('📊 RESUMEN');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Variables críticas OK: ${passed}/6`);
console.log(`❌ Variables críticas faltantes: ${failed}/6`);
console.log(`⚠️  Variables opcionales OK: ${optional}/5`);
console.log('═══════════════════════════════════════════════════════════');

if (failed === 0) {
    console.log('\n🎉 ¡Configuración completa!');
    console.log('\n✨ Sistema listo para:');
    console.log('   • Procesar pagos automáticos');
    console.log('   • Analizar contenido con IA');
    console.log('   • Ejecutar automatizaciones');
    console.log('   • Interactuar con blockchain');
} else {
    console.log('\n⚠️  Configuración incompleta');
    console.log('\n📝 Acciones requeridas:');
    console.log('   1. Edita el archivo .env');
    console.log('   2. Agrega las variables faltantes');
    console.log('   3. Vuelve a ejecutar este script');
    console.log('\n💡 Ejemplo de .env:');
    console.log('   GEMINI_API_KEY="AIzaSyB..."');
    console.log('   STRIPE_SECRET_KEY="sk_live_..."');
    console.log('   HOT_WALLET_PRIVATE_KEY="0x..."');
}

console.log('\n═══════════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
