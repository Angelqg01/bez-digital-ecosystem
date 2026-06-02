/**
 * Suite de Tests para Bridge API
 * Testing completo de todos los endpoints con diferentes escenarios
 */

const axios = require('axios');
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const API_KEY = process.argv[2];

if (!API_KEY) {
    console.error(`${colors.red}❌ Error: Debes proporcionar una API Key${colors.reset}`);
    console.log(`${colors.yellow}Uso: node bridge-tests.js <API_KEY>${colors.reset}`);
    process.exit(1);
}

console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bright}  🌉 BRIDGE API - SUITE DE TESTS COMPLETA${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.gray}Base URL: ${API_BASE}${colors.reset}`);
console.log(`${colors.gray}API Key:  ${API_KEY.substring(0, 10)}...${API_KEY.slice(-4)}${colors.reset}`);
console.log('');

// Configuración de axios
const axiosInstance = axios.create({
    baseURL: API_BASE,
    headers: {
        'X-Bridge-API-Key': API_KEY,
        'X-External-Platform': 'test',
        'Content-Type': 'application/json'
    },
    timeout: 10000
});

// Resultados globales
const results = {
    passed: 0,
    failed: 0,
    total: 0,
    tests: []
};

// Helper para registrar test
function test(name, passed, error = null) {
    results.total++;
    if (passed) {
        results.passed++;
        console.log(`${colors.green}  ✓${colors.reset} ${name}`);
    } else {
        results.failed++;
        console.log(`${colors.red}  ✗${colors.reset} ${name}`);
        if (error) {
            console.log(`${colors.red}    Error: ${error}${colors.reset}`);
        }
    }
    results.tests.push({ name, passed, error });
}

// Helper para sección
function section(name) {
    console.log('');
    console.log(`${colors.bright}${colors.blue}▶ ${name}${colors.reset}`);
    console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`);
}

// ====================
// TESTS: AUTENTICACIÓN
// ====================
async function testAuthentication() {
    section('AUTENTICACIÓN Y VALIDACIÓN');

    // Test 1: Sin API Key
    try {
        await axios.post(`${API_BASE}/api/v1/bridge/inventory/sync`, {}, {
            headers: { 'Content-Type': 'application/json' }
        });
        test('Rechaza requests sin API key', false, 'Debería haber fallado');
    } catch (error) {
        test('Rechaza requests sin API key', error.response?.status === 401);
    }

    // Test 2: API Key inválida
    try {
        await axios.post(`${API_BASE}/api/v1/bridge/inventory/sync`, {}, {
            headers: {
                'X-Bridge-API-Key': 'invalid_key_123',
                'Content-Type': 'application/json'
            }
        });
        test('Rechaza API keys con formato inválido', false);
    } catch (error) {
        test('Rechaza API keys con formato inválido', error.response?.status === 401 || error.response?.status === 403);
    }

    // Test 3: Sin plataforma externa
    try {
        await axios.post(`${API_BASE}/api/v1/bridge/inventory/sync`, {}, {
            headers: {
                'X-Bridge-API-Key': API_KEY,
                'Content-Type': 'application/json'
            }
        });
        test('Requiere header X-External-Platform', false);
    } catch (error) {
        test('Requiere header X-External-Platform', error.response?.status === 400);
    }

    // Test 4: API Key válida
    try {
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: []
        });
        test('Acepta API key válida', response.status === 200);
    } catch (error) {
        test('Acepta API key válida', false, error.message);
    }
}

// ====================
// TESTS: INVENTORY SYNC
// ====================
async function testInventorySync() {
    section('INVENTORY SYNC ENDPOINT');

    // Test 1: Sync con array vacío
    try {
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: []
        });
        test('Acepta array vacío de items', response.status === 200 && response.data.synchronized === 0);
    } catch (error) {
        test('Acepta array vacío de items', false, error.message);
    }

    // Test 2: Sync con 1 item válido
    try {
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [{
                externalId: 'test_item_' + Date.now(),
                title: 'Test Product',
                description: 'Test description',
                price: 29.99,
                currency: 'EUR',
                images: ['https://example.com/image.jpg'],
                category: 'clothing',
                condition: 'new',
                stock: 5,
                available: true
            }]
        });
        test('Sincroniza 1 item correctamente',
            response.status === 200 &&
            response.data.synchronized === 1 &&
            response.data.data.savedItems.length === 1
        );
    } catch (error) {
        test('Sincroniza 1 item correctamente', false, error.response?.data?.message || error.message);
    }

    // Test 3: Sync con múltiples items
    try {
        const timestamp = Date.now();
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [
                {
                    externalId: 'bulk_item_1_' + timestamp,
                    title: 'Bulk Product 1',
                    price: 19.99,
                    currency: 'EUR',
                    category: 'electronics',
                    condition: 'new'
                },
                {
                    externalId: 'bulk_item_2_' + timestamp,
                    title: 'Bulk Product 2',
                    price: 39.99,
                    currency: 'EUR',
                    category: 'clothing',
                    condition: 'like_new'
                },
                {
                    externalId: 'bulk_item_3_' + timestamp,
                    title: 'Bulk Product 3',
                    price: 59.99,
                    currency: 'USD',
                    category: 'shoes',
                    condition: 'used_excellent'
                }
            ]
        });
        test('Sincroniza múltiples items (bulk)',
            response.status === 200 &&
            response.data.synchronized === 3
        );
    } catch (error) {
        test('Sincroniza múltiples items (bulk)', false, error.response?.data?.message || error.message);
    }

    // Test 4: Upsert - actualizar item existente
    try {
        const externalId = 'upsert_test_' + Date.now();

        // Primera sincronización
        await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [{
                externalId,
                title: 'Original Title',
                price: 10.00,
                currency: 'EUR',
                category: 'other',
                condition: 'new'
            }]
        });

        // Segunda sincronización con mismo externalId (debería actualizar)
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [{
                externalId,
                title: 'Updated Title',
                price: 15.00,
                currency: 'EUR',
                category: 'other',
                condition: 'like_new'
            }]
        });

        test('Upsert: actualiza item existente',
            response.status === 200 &&
            response.data.synchronized === 1
        );
    } catch (error) {
        test('Upsert: actualiza item existente', false, error.response?.data?.message || error.message);
    }

    // Test 5: Validación - item sin campos requeridos
    try {
        await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [{
                externalId: 'invalid_item'
                // Faltan campos requeridos
            }]
        });
        test('Rechaza items sin campos requeridos', false);
    } catch (error) {
        test('Rechaza items sin campos requeridos',
            error.response?.status === 400 ||
            (error.response?.status === 200 && error.response?.data?.invalidItems > 0)
        );
    }

    // Test 6: Metadata personalizado
    try {
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [{
                externalId: 'metadata_test_' + Date.now(),
                title: 'Product with Metadata',
                price: 25.00,
                currency: 'EUR',
                category: 'clothing',
                condition: 'new',
                metadata: {
                    brand: 'Nike',
                    size: 'L',
                    color: 'Blue',
                    material: 'Cotton'
                }
            }]
        });
        test('Guarda metadata personalizado', response.status === 200 && response.data.synchronized === 1);
    } catch (error) {
        test('Guarda metadata personalizado', false, error.response?.data?.message || error.message);
    }
}

// ====================
// TESTS: LOGISTICS UPDATE
// ====================
async function testLogisticsUpdate() {
    section('LOGISTICS UPDATE ENDPOINT');

    // Test 1: Crear nuevo shipment
    try {
        const trackingNumber = 'TEST_TRACK_' + Date.now();
        const response = await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber,
            status: 'pending',
            provider: 'dhl',
            location: {
                city: 'Madrid',
                country: 'España'
            },
            description: 'Paquete creado'
        });
        test('Crea nuevo shipment',
            response.status === 200 &&
            response.data.data.trackingNumber === trackingNumber.toUpperCase()
        );
    } catch (error) {
        test('Crea nuevo shipment', false, error.response?.data?.message || error.message);
    }

    // Test 2: Actualizar shipment existente
    try {
        const trackingNumber = 'UPDATE_TEST_' + Date.now();

        // Crear
        await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber,
            status: 'picked_up',
            provider: 'fedex'
        });

        // Actualizar
        const response = await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber,
            status: 'in_transit',
            provider: 'fedex',
            location: {
                city: 'Barcelona',
                country: 'España'
            },
            description: 'En tránsito'
        });

        test('Actualiza shipment existente',
            response.status === 200 &&
            response.data.data.status === 'in_transit'
        );
    } catch (error) {
        test('Actualiza shipment existente', false, error.response?.data?.message || error.message);
    }

    // Test 3: Tracking con coordenadas GPS
    try {
        const response = await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber: 'GPS_TEST_' + Date.now(),
            status: 'in_transit',
            provider: 'dhl',
            location: {
                city: 'Valencia',
                country: 'España',
                coordinates: {
                    lat: 39.4699,
                    long: -0.3763
                }
            }
        });
        test('Guarda coordenadas GPS', response.status === 200);
    } catch (error) {
        test('Guarda coordenadas GPS', false, error.response?.data?.message || error.message);
    }

    // Test 4: Estimated delivery
    try {
        const response = await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber: 'ETA_TEST_' + Date.now(),
            status: 'out_for_delivery',
            provider: 'ups',
            estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
        });
        test('Acepta fecha estimada de entrega', response.status === 200);
    } catch (error) {
        test('Acepta fecha estimada de entrega', false, error.response?.data?.message || error.message);
    }

    // Test 5: Status delivered
    try {
        const response = await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber: 'DELIVERED_TEST_' + Date.now(),
            status: 'delivered',
            provider: 'fedex',
            description: 'Paquete entregado al cliente'
        });
        test('Marca shipment como entregado',
            response.status === 200 &&
            response.data.data.status === 'delivered'
        );
    } catch (error) {
        test('Marca shipment como entregado', false, error.response?.data?.message || error.message);
    }

    // Test 6: Validación - sin tracking number
    try {
        await axiosInstance.post('/api/v1/bridge/logistics/update', {
            status: 'in_transit',
            provider: 'dhl'
        });
        test('Requiere tracking number', false);
    } catch (error) {
        test('Requiere tracking number', error.response?.status === 400);
    }
}

// ====================
// TESTS: CREATE ORDER
// ====================
async function testCreateOrder() {
    section('CREATE ORDER ENDPOINT');

    // Test 1: Crear orden básica
    try {
        const response = await axiosInstance.post('/api/v1/bridge/orders/create', {
            externalOrderId: 'TEST_ORD_' + Date.now(),
            buyer: {
                externalId: 'buyer_' + Date.now(),
                email: 'buyer@test.com',
                username: 'testbuyer'
            },
            seller: {
                externalId: 'seller_' + Date.now(),
                email: 'seller@test.com',
                username: 'testseller'
            },
            items: [{
                externalId: 'item_123',
                title: 'Test Product',
                quantity: 1,
                price: 29.99,
                currency: 'EUR'
            }],
            shippingAddress: {
                street: 'Test Street 123',
                city: 'Madrid',
                postalCode: '28001',
                country: 'España'
            },
            shippingCost: 5.99
        });

        test('Crea orden básica correctamente',
            response.status === 200 &&
            response.data.data.beZhasOrderId.startsWith('BEZ_ORD_')
        );
    } catch (error) {
        test('Crea orden básica correctamente', false, error.response?.data?.message || error.message);
    }

    // Test 2: Orden con múltiples items
    try {
        const response = await axiosInstance.post('/api/v1/bridge/orders/create', {
            externalOrderId: 'MULTI_ORD_' + Date.now(),
            buyer: {
                externalId: 'buyer_multi',
                email: 'buyer@test.com'
            },
            seller: {
                externalId: 'seller_multi',
                email: 'seller@test.com'
            },
            items: [
                {
                    externalId: 'item_1',
                    title: 'Product 1',
                    quantity: 2,
                    price: 19.99,
                    currency: 'EUR'
                },
                {
                    externalId: 'item_2',
                    title: 'Product 2',
                    quantity: 1,
                    price: 39.99,
                    currency: 'EUR'
                }
            ],
            shippingAddress: {
                street: 'Test St',
                city: 'Barcelona',
                postalCode: '08001',
                country: 'España'
            },
            shippingCost: 7.99
        });

        test('Crea orden con múltiples items',
            response.status === 200 &&
            response.data.data.items.length === 2
        );
    } catch (error) {
        test('Crea orden con múltiples items', false, error.response?.data?.message || error.message);
    }

    // Test 3: Validación total con shipping
    try {
        const response = await axiosInstance.post('/api/v1/bridge/orders/create', {
            externalOrderId: 'TOTAL_TEST_' + Date.now(),
            buyer: {
                externalId: 'buyer_total',
                email: 'buyer@test.com'
            },
            seller: {
                externalId: 'seller_total',
                email: 'seller@test.com'
            },
            items: [{
                externalId: 'item_total',
                title: 'Product',
                quantity: 1,
                price: 100.00,
                currency: 'EUR'
            }],
            shippingAddress: {
                street: 'Test',
                city: 'Test',
                postalCode: '00000',
                country: 'Test'
            },
            shippingCost: 10.00
        });

        // Total debería ser 100.00 + 10.00 = 110.00
        test('Calcula total con shipping correctamente',
            response.status === 200 &&
            Math.abs(response.data.data.totalWithShipping - 110.00) < 0.01
        );
    } catch (error) {
        test('Calcula total con shipping correctamente', false, error.response?.data?.message || error.message);
    }

    // Test 4: Escrow status inicial
    try {
        const response = await axiosInstance.post('/api/v1/bridge/orders/create', {
            externalOrderId: 'ESCROW_TEST_' + Date.now(),
            buyer: {
                externalId: 'buyer_escrow',
                email: 'buyer@test.com'
            },
            seller: {
                externalId: 'seller_escrow',
                email: 'seller@test.com'
            },
            items: [{
                externalId: 'item_escrow',
                title: 'Product',
                quantity: 1,
                price: 50.00,
                currency: 'EUR'
            }],
            shippingAddress: {
                street: 'Test',
                city: 'Test',
                postalCode: '00000',
                country: 'Test'
            }
        });

        test('Inicializa escrow status como pending',
            response.status === 200 &&
            response.data.data.escrowStatus === 'pending'
        );
    } catch (error) {
        test('Inicializa escrow status como pending', false, error.response?.data?.message || error.message);
    }

    // Test 5: Validación - sin buyer
    try {
        await axiosInstance.post('/api/v1/bridge/orders/create', {
            externalOrderId: 'INVALID_' + Date.now(),
            seller: {
                externalId: 'seller',
                email: 'seller@test.com'
            },
            items: [{
                externalId: 'item',
                title: 'Product',
                quantity: 1,
                price: 10.00
            }]
        });
        test('Requiere buyer data', false);
    } catch (error) {
        test('Requiere buyer data', error.response?.status === 400);
    }

    // Test 6: Validación - items vacío
    try {
        await axiosInstance.post('/api/v1/bridge/orders/create', {
            externalOrderId: 'EMPTY_ITEMS_' + Date.now(),
            buyer: {
                externalId: 'buyer',
                email: 'buyer@test.com'
            },
            seller: {
                externalId: 'seller',
                email: 'seller@test.com'
            },
            items: []
        });
        test('Requiere al menos 1 item', false);
    } catch (error) {
        test('Requiere al menos 1 item', error.response?.status === 400);
    }
}

// ====================
// TESTS: EDGE CASES
// ====================
async function testEdgeCases() {
    section('EDGE CASES Y LÍMITES');

    // Test 1: Sync con item muy grande
    try {
        const largeDescription = 'A'.repeat(5000);
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [{
                externalId: 'large_desc_' + Date.now(),
                title: 'Product with Large Description',
                description: largeDescription,
                price: 10.00,
                currency: 'EUR',
                category: 'other',
                condition: 'new'
            }]
        });
        test('Maneja descripciones muy largas', response.status === 200);
    } catch (error) {
        test('Maneja descripciones muy largas', false, error.message);
    }

    // Test 2: Múltiples monedas
    try {
        const timestamp = Date.now();
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [
                {
                    externalId: 'currency_eur_' + timestamp,
                    title: 'EUR Product',
                    price: 10.00,
                    currency: 'EUR',
                    category: 'other',
                    condition: 'new'
                },
                {
                    externalId: 'currency_usd_' + timestamp,
                    title: 'USD Product',
                    price: 12.00,
                    currency: 'USD',
                    category: 'other',
                    condition: 'new'
                },
                {
                    externalId: 'currency_gbp_' + timestamp,
                    title: 'GBP Product',
                    price: 8.00,
                    currency: 'GBP',
                    category: 'other',
                    condition: 'new'
                }
            ]
        });
        test('Soporta múltiples monedas', response.status === 200 && response.data.synchronized === 3);
    } catch (error) {
        test('Soporta múltiples monedas', false, error.message);
    }

    // Test 3: Tracking number case insensitive
    try {
        const trackingLower = 'test_lower_' + Date.now();

        // Crear con lowercase
        await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber: trackingLower,
            status: 'pending',
            provider: 'dhl'
        });

        // Actualizar con uppercase
        const response = await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber: trackingLower.toUpperCase(),
            status: 'in_transit',
            provider: 'dhl'
        });

        test('Tracking number es case-insensitive', response.status === 200);
    } catch (error) {
        test('Tracking number es case-insensitive', false, error.message);
    }

    // Test 4: Caracteres especiales en nombres
    try {
        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items: [{
                externalId: 'special_chars_' + Date.now(),
                title: 'Product with émojis 🚀 and spëcial chàrs',
                price: 15.00,
                currency: 'EUR',
                category: 'other',
                condition: 'new'
            }]
        });
        test('Maneja caracteres especiales y emojis', response.status === 200);
    } catch (error) {
        test('Maneja caracteres especiales y emojis', false, error.message);
    }
}

// ====================
// MAIN EXECUTION
// ====================
async function runAllTests() {
    console.log(`${colors.bright}Iniciando suite de tests...${colors.reset}\n`);

    const startTime = Date.now();

    try {
        await testAuthentication();
        await testInventorySync();
        await testLogisticsUpdate();
        await testCreateOrder();
        await testEdgeCases();
    } catch (error) {
        console.error(`${colors.red}Error fatal durante tests:${colors.reset}`, error.message);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Resumen final
    console.log('');
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}  📊 RESUMEN DE RESULTADOS${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log('');
    console.log(`  ${colors.green}✓ Pasados:${colors.reset}   ${colors.bright}${results.passed}${colors.reset}`);
    console.log(`  ${colors.red}✗ Fallados:${colors.reset}  ${colors.bright}${results.failed}${colors.reset}`);
    console.log(`  ${colors.gray}━ Total:${colors.reset}     ${colors.bright}${results.total}${colors.reset}`);
    console.log('');
    console.log(`  ${colors.gray}Duración: ${duration}s${colors.reset}`);

    const successRate = ((results.passed / results.total) * 100).toFixed(1);
    const rateColor = successRate >= 90 ? colors.green : successRate >= 70 ? colors.yellow : colors.red;
    console.log(`  ${colors.gray}Tasa de éxito: ${rateColor}${successRate}%${colors.reset}`);

    console.log('');
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log('');

    // Exit code
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
    console.error(`${colors.red}Error fatal:${colors.reset}`, error);
    process.exit(1);
});
