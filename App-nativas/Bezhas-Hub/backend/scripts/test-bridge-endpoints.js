/**
 * Test de endpoints del Bridge API
 * Ejecutar con: node test-bridge-endpoints.js <API_KEY>
 */

const axios = require('axios');

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const API_KEY = process.argv[2];

if (!API_KEY) {
    console.error('❌ Error: Debes proporcionar una API Key');
    console.log('Uso: node test-bridge-endpoints.js <API_KEY>');
    process.exit(1);
}

console.log('🚀 Iniciando tests del Bridge API...');
console.log(`📍 Base URL: ${API_BASE}`);
console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...${API_KEY.slice(-4)}`);
console.log('');

const axiosInstance = axios.create({
    baseURL: API_BASE,
    headers: {
        'X-Bridge-API-Key': API_KEY,
        'X-External-Platform': 'test',
        'Content-Type': 'application/json'
    }
});

async function test1_InventorySync() {
    console.log('📦 TEST 1: Inventory Sync');
    console.log('━'.repeat(50));

    try {
        const items = [
            {
                externalId: 'test_item_001',
                title: 'Camiseta Nike Original',
                description: 'Camiseta deportiva de alta calidad',
                price: 29.99,
                currency: 'EUR',
                images: ['https://example.com/image1.jpg'],
                category: 'clothing',
                condition: 'new',
                stock: 10,
                available: true,
                metadata: {
                    brand: 'Nike',
                    size: 'M',
                    color: 'Azul'
                }
            },
            {
                externalId: 'test_item_002',
                title: 'Zapatillas Adidas Running',
                description: 'Zapatillas perfectas para correr',
                price: 79.99,
                currency: 'EUR',
                images: ['https://example.com/image2.jpg'],
                category: 'shoes',
                condition: 'like_new',
                stock: 5,
                available: true,
                metadata: {
                    brand: 'Adidas',
                    size: '42',
                    color: 'Negro'
                }
            }
        ];

        const response = await axiosInstance.post('/api/v1/bridge/inventory/sync', {
            items
        });

        console.log('✅ Status:', response.status);
        console.log('✅ Sincronizados:', response.data.synchronized);
        console.log('✅ IDs guardados:', response.data.data.savedItems);
        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        console.log('');
        return false;
    }
}

async function test2_LogisticsUpdate() {
    console.log('🚚 TEST 2: Logistics Update');
    console.log('━'.repeat(50));

    try {
        const response = await axiosInstance.post('/api/v1/bridge/logistics/update', {
            trackingNumber: 'TEST123456789',
            status: 'in_transit',
            provider: 'dhl',
            location: {
                city: 'Madrid',
                country: 'España',
                coordinates: {
                    lat: 40.4168,
                    long: -3.7038
                }
            },
            description: 'Paquete en tránsito hacia el centro de distribución',
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        });

        console.log('✅ Status:', response.status);
        console.log('✅ Tracking:', response.data.data.trackingNumber);
        console.log('✅ Estado:', response.data.data.status);
        console.log('✅ Proveedor:', response.data.data.provider);
        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        console.log('');
        return false;
    }
}

async function test3_CreateOrder() {
    console.log('📋 TEST 3: Create Order');
    console.log('━'.repeat(50));

    try {
        const response = await axiosInstance.post('/api/v1/bridge/orders/create', {
            externalOrderId: 'EXT_ORD_' + Date.now(),
            buyer: {
                externalId: 'buyer_123',
                email: 'buyer@example.com',
                username: 'testbuyer'
            },
            seller: {
                externalId: 'seller_456',
                email: 'seller@example.com',
                username: 'testseller'
            },
            items: [
                {
                    externalId: 'test_item_001',
                    title: 'Camiseta Nike Original',
                    quantity: 2,
                    price: 29.99,
                    currency: 'EUR'
                }
            ],
            shippingAddress: {
                street: 'Calle Mayor 123',
                city: 'Madrid',
                state: 'Madrid',
                postalCode: '28001',
                country: 'España'
            },
            shippingCost: 5.99
        });

        console.log('✅ Status:', response.status);
        console.log('✅ Order ID:', response.data.data.beZhasOrderId);
        console.log('✅ Total:', response.data.data.totalWithShipping);
        console.log('✅ Payment Status:', response.data.data.paymentStatus);
        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        console.log('');
        return false;
    }
}

async function runTests() {
    console.log('');

    const results = {
        inventory: await test1_InventorySync(),
        logistics: await test2_LogisticsUpdate(),
        orders: await test3_CreateOrder()
    };

    console.log('');
    console.log('📊 RESULTADOS');
    console.log('━'.repeat(50));
    console.log(`Inventory Sync: ${results.inventory ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Logistics Update: ${results.logistics ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Create Order: ${results.orders ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.values(results).length;

    console.log(`Total: ${passed}/${total} tests pasaron`);
    console.log('');

    process.exit(passed === total ? 0 : 1);
}

runTests();
