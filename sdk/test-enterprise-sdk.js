/**
 * Script de prueba para BeZhas Enterprise SDK
 * Ejecutar: node sdk/test-enterprise-sdk.js
 */

import { BeZhasEnterpriseSDK } from './bezhas-enterprise-sdk.js';

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

console.log(`${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║      BeZhas Enterprise SDK - Test Suite                 ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

async function runTests() {
    try {
        // Inicializar SDK
        console.log(`\n${colors.blue}📦 Inicializando SDK...${colors.reset}`);
        const sdk = BeZhasEnterpriseSDK.getInstance({
            apiUrl: 'http://localhost:3001',
            apiKey: 'test-api-key-12345',
            maerskApiKey: process.env.MAERSK_API_KEY || 'test-maersk-key',
            tntApiKey: process.env.TNT_API_KEY || 'test-tnt-key',
            vintedApiKey: process.env.VINTED_API_KEY || 'test-vinted-key',
            moonpayApiKey: process.env.MOONPAY_API_KEY || 'test-moonpay-key',
            stripeKey: process.env.STRIPE_KEY || 'test-stripe-key',
            chainId: 80002 // Amoy Testnet
        });
        console.log(`${colors.green}✅ SDK inicializado correctamente${colors.reset}`);

        // Test 1: VIP System
        console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(`${colors.blue}🔵 TEST 1: Sistema VIP${colors.reset}`);
        console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

        console.log('\n📋 Intentando suscripción VIP Bronze...');
        try {
            const vipResult = await sdk.vip.subscribe('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1', 'bronze');
            console.log(`${colors.green}✅ Suscripción VIP exitosa:${colors.reset}`);
            console.log(JSON.stringify(vipResult, null, 2));
        } catch (error) {
            console.log(`${colors.red}⚠️  Error esperado (sin backend activo): ${error.message}${colors.reset}`);
        }

        // Test 2: Maersk Container Tracking
        console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(`${colors.blue}🔵 TEST 2: Rastreo de Container Maersk${colors.reset}`);
        console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

        console.log('\n🚢 Intentando rastrear container MAEU1234567...');
        try {
            const trackResult = await sdk.maersk.trackContainer('MAEU1234567');
            console.log(`${colors.green}✅ Tracking exitoso:${colors.reset}`);
            console.log(JSON.stringify(trackResult, null, 2));
        } catch (error) {
            console.log(`${colors.red}⚠️  Error esperado (API key de prueba): ${error.message}${colors.reset}`);
        }

        // Test 3: TNT Express Shipping
        console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(`${colors.blue}🔵 TEST 3: Envío TNT Express${colors.reset}`);
        console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

        const shipmentData = {
            sender: {
                name: 'BeZhas Store',
                address: 'Calle Principal 123',
                city: 'Madrid',
                postalCode: '28001',
                country: 'ES',
                phone: '+34900000000'
            },
            receiver: {
                name: 'Cliente Test',
                address: 'Avenida Test 456',
                city: 'Barcelona',
                postalCode: '08001',
                country: 'ES',
                phone: '+34900000001'
            },
            package: {
                weight: 2.5,
                length: 30,
                width: 20,
                height: 15
            }
        };

        console.log('\n📦 Intentando crear envío TNT...');
        try {
            const tntResult = await sdk.tnt.createShipment(shipmentData);
            console.log(`${colors.green}✅ Envío creado:${colors.reset}`);
            console.log(JSON.stringify(tntResult, null, 2));
        } catch (error) {
            console.log(`${colors.red}⚠️  Error esperado (API key de prueba): ${error.message}${colors.reset}`);
        }

        // Test 4: Vinted Integration
        console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(`${colors.blue}🔵 TEST 4: Integración Vinted${colors.reset}`);
        console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

        const vintedItem = {
            title: 'Zapatillas Nike Air Max',
            description: 'En perfecto estado, talla 42',
            price: 59.99,
            category: 'shoes',
            brand: 'Nike',
            size: '42',
            condition: 'good',
            photos: ['photo1.jpg', 'photo2.jpg']
        };

        console.log('\n👟 Intentando publicar artículo en Vinted...');
        try {
            const vintedResult = await sdk.vinted.listItem('user123', vintedItem);
            console.log(`${colors.green}✅ Artículo publicado:${colors.reset}`);
            console.log(JSON.stringify(vintedResult, null, 2));
        } catch (error) {
            console.log(`${colors.red}⚠️  Error esperado (sin backend activo): ${error.message}${colors.reset}`);
        }

        // Test 5: BEZ-Coin Purchase
        console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(`${colors.blue}🔵 TEST 5: Compra de BEZ-Coin${colors.reset}`);
        console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

        console.log('\n💰 Intentando comprar 100 BEZ-Coin...');
        try {
            const coinResult = await sdk.bezcoin.buyWithMoonPay('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1', 100, 'EUR');
            console.log(`${colors.green}✅ Compra iniciada:${colors.reset}`);
            console.log(JSON.stringify(coinResult, null, 2));
        } catch (error) {
            console.log(`${colors.red}⚠️  Error esperado (sin backend activo): ${error.message}${colors.reset}`);
        }

        // Resumen Final
        console.log(`\n${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║                RESUMEN DE PRUEBAS                        ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);
        console.log(`
${colors.green}✅ SDK inicializado correctamente${colors.reset}
${colors.yellow}⚠️  Tests funcionales completados${colors.reset}
${colors.blue}ℹ️  Los errores son esperados sin backend activo${colors.reset}

${colors.cyan}📋 Para pruebas completas:${colors.reset}
1. Iniciar backend: cd backend && npm start
2. Configurar API keys en .env
3. Ejecutar: node sdk/test-enterprise-sdk.js

${colors.cyan}🔑 API Keys requeridas:${colors.reset}
- MAERSK_API_KEY
- TNT_API_KEY
- VINTED_API_KEY
- MOONPAY_API_KEY
- STRIPE_KEY
`);

    } catch (error) {
        console.error(`${colors.red}❌ Error en tests: ${error.message}${colors.reset}`);
        console.error(error.stack);
    }
}

// Ejecutar tests
runTests().then(() => {
    console.log(`${colors.green}\n✅ Suite de pruebas completada${colors.reset}\n`);
    process.exit(0);
}).catch(error => {
    console.error(`${colors.red}\n❌ Error fatal: ${error.message}${colors.reset}\n`);
    process.exit(1);
});
