/**
 * Universal Bridge Test Script
 * 
 * Verifies that the bridge system loads correctly and all adapters work.
 * Run with: node scripts/test-universal-bridge.js
 */

const path = require('path');

// Set up environment
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log('🧪 Universal Bridge Test Suite\n');
console.log('='.repeat(60));

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, testFn) {
    process.stdout.write(`  ➤ ${name}... `);
    try {
        await testFn();
        console.log('✅ PASS');
        testsPassed++;
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log('\n📦 1. Module Loading Tests\n');

    // Test 1: Load bridge core
    await runTest('Load bridgeCore module', async () => {
        const { bridgeCore, BRIDGE_EVENTS, BRIDGE_STATUS } = require('../bridge/core/bridgeCore');
        if (!bridgeCore) throw new Error('bridgeCore is undefined');
        if (!BRIDGE_EVENTS) throw new Error('BRIDGE_EVENTS is undefined');
        if (!BRIDGE_STATUS) throw new Error('BRIDGE_STATUS is undefined');
    });

    // Test 2: Load BaseAdapter
    await runTest('Load BaseAdapter class', async () => {
        const BaseAdapter = require('../bridge/adapters/BaseAdapter');
        if (!BaseAdapter) throw new Error('BaseAdapter is undefined');
        if (typeof BaseAdapter !== 'function') throw new Error('BaseAdapter is not a class');
    });

    // Test 3: Load VintedAdapter
    await runTest('Load VintedAdapter class', async () => {
        const VintedAdapter = require('../bridge/adapters/VintedAdapter');
        if (!VintedAdapter) throw new Error('VintedAdapter is undefined');
    });

    // Test 4: Load MaerskAdapter
    await runTest('Load MaerskAdapter class', async () => {
        const MaerskAdapter = require('../bridge/adapters/MaerskAdapter');
        if (!MaerskAdapter) throw new Error('MaerskAdapter is undefined');
    });

    // Test 5: Load AirbnbAdapter
    await runTest('Load AirbnbAdapter class', async () => {
        const AirbnbAdapter = require('../bridge/adapters/AirbnbAdapter');
        if (!AirbnbAdapter) throw new Error('AirbnbAdapter is undefined');
    });

    // Test 6: Load adapters index
    await runTest('Load adapters index with factory', async () => {
        const { createAdapter, getAvailableAdapters } = require('../bridge/adapters');
        if (typeof createAdapter !== 'function') throw new Error('createAdapter is not a function');
        if (typeof getAvailableAdapters !== 'function') throw new Error('getAvailableAdapters is not a function');

        const available = getAvailableAdapters();
        if (!Array.isArray(available)) throw new Error('getAvailableAdapters should return array');
        if (!available.includes('vinted')) throw new Error('vinted adapter not in registry');
    });

    // Test 7: Load main bridge module
    await runTest('Load main bridge module', async () => {
        const bridge = require('../bridge');
        if (!bridge.initialize) throw new Error('initialize function not found');
        if (!bridge.registerAdapter) throw new Error('registerAdapter function not found');
        if (!bridge.syncInventory) throw new Error('syncInventory function not found');
    });

    // Test 8: Load webhooks router
    await runTest('Load webhooks router', async () => {
        const webhooksRouter = require('../bridge/webhooks/webhooks.routes');
        if (!webhooksRouter) throw new Error('webhooksRouter is undefined');
    });

    // Test 9: Load API routes
    await runTest('Load bridge API routes', async () => {
        const apiRoutes = require('../bridge/routes/bridge.api.routes');
        if (!apiRoutes) throw new Error('apiRoutes is undefined');
    });

    // Test 10: Load sync jobs
    await runTest('Load sync jobs module', async () => {
        const syncJobs = require('../bridge/jobs/syncJobs');
        if (!syncJobs.initializeSyncJobs) throw new Error('initializeSyncJobs not found');
        if (!syncJobs.registerJob) throw new Error('registerJob not found');
    });

    console.log('\n🔧 2. Adapter Instantiation Tests\n');

    // Test 11: Create VintedAdapter instance
    await runTest('Create VintedAdapter instance', async () => {
        const VintedAdapter = require('../bridge/adapters/VintedAdapter');
        const adapter = new VintedAdapter({ apiKey: 'test' });
        if (adapter.platformId !== 'vinted') throw new Error('Wrong platformId');
        if (adapter.platformName !== 'Vinted') throw new Error('Wrong platformName');
    });

    // Test 12: Create MaerskAdapter instance
    await runTest('Create MaerskAdapter instance', async () => {
        const MaerskAdapter = require('../bridge/adapters/MaerskAdapter');
        const adapter = new MaerskAdapter({});
        if (adapter.platformId !== 'maersk') throw new Error('Wrong platformId');
    });

    // Test 13: Create AirbnbAdapter instance
    await runTest('Create AirbnbAdapter instance', async () => {
        const AirbnbAdapter = require('../bridge/adapters/AirbnbAdapter');
        const adapter = new AirbnbAdapter({});
        if (adapter.platformId !== 'airbnb') throw new Error('Wrong platformId');
    });

    // Test 14: Use createAdapter factory
    await runTest('Use createAdapter factory for vinted', async () => {
        const { createAdapter } = require('../bridge/adapters');
        const adapter = createAdapter('vinted', {});
        if (adapter.platformId !== 'vinted') throw new Error('Factory created wrong adapter');
    });

    // Test 15: Factory error for unknown adapter
    await runTest('createAdapter throws for unknown platform', async () => {
        const { createAdapter } = require('../bridge/adapters');
        let threw = false;
        try {
            createAdapter('unknown_platform', {});
        } catch (e) {
            threw = true;
        }
        if (!threw) throw new Error('Should have thrown for unknown platform');
    });

    console.log('\n🔄 3. Adapter Functionality Tests\n');

    // Test 16: VintedAdapter connect (mock mode)
    await runTest('VintedAdapter connect in mock mode', async () => {
        const VintedAdapter = require('../bridge/adapters/VintedAdapter');
        const adapter = new VintedAdapter({});
        const result = await adapter.connect();
        if (!result.success) throw new Error('Connect failed');
        if (result.mode !== 'mock') throw new Error('Should be in mock mode');
        if (adapter.status !== 'connected_mock') throw new Error('Wrong status');
    });

    // Test 17: VintedAdapter generate mock items
    await runTest('VintedAdapter generate mock items', async () => {
        const VintedAdapter = require('../bridge/adapters/VintedAdapter');
        const adapter = new VintedAdapter({});
        const items = adapter.generateMockItems(5);
        if (!Array.isArray(items)) throw new Error('Should return array');
        if (items.length !== 5) throw new Error('Should return 5 items');
        if (!items[0].id) throw new Error('Items should have id');
        if (!items[0].title) throw new Error('Items should have title');
    });

    // Test 18: VintedAdapter transform to BeZhas format
    await runTest('VintedAdapter transform to BeZhas format', async () => {
        const VintedAdapter = require('../bridge/adapters/VintedAdapter');
        const adapter = new VintedAdapter({});
        const mockItem = {
            id: 'test123',
            title: 'Test Item',
            description: 'Test Description',
            price: '25.00',
            currency: 'EUR',
            photos: [{ url: 'http://example.com/img.jpg' }],
            catalog_id: '1',
            brand_title: 'Nike',
            size_title: 'M',
        };
        const transformed = adapter.transformToBeZhasFormat(mockItem);
        if (!transformed.title) throw new Error('Missing title');
        if (!transformed.price) throw new Error('Missing price');
        if (!transformed.metadata) throw new Error('Missing metadata');
    });

    // Test 19: MaerskAdapter generate mock tracking
    await runTest('MaerskAdapter generate mock tracking', async () => {
        const MaerskAdapter = require('../bridge/adapters/MaerskAdapter');
        const adapter = new MaerskAdapter({});
        const tracking = adapter.generateMockTracking('TEST123456');
        if (!tracking.trackingNumber) throw new Error('Missing trackingNumber');
        if (!tracking.status) throw new Error('Missing status');
        if (!tracking.events) throw new Error('Missing events');
    });

    // Test 20: AirbnbAdapter generate mock listings
    await runTest('AirbnbAdapter generate mock listings', async () => {
        const AirbnbAdapter = require('../bridge/adapters/AirbnbAdapter');
        const adapter = new AirbnbAdapter({});
        const listings = adapter.generateMockListings(3);
        if (!Array.isArray(listings)) throw new Error('Should return array');
        if (listings.length !== 3) throw new Error('Should return 3 listings');
        if (!listings[0].name) throw new Error('Listings should have name');
    });

    console.log('\n🌐 4. Bridge Core Tests\n');

    // Test 21: Initialize bridge core
    await runTest('Initialize bridge core', async () => {
        const { bridgeCore } = require('../bridge/core/bridgeCore');
        await bridgeCore.initialize();
        if (!bridgeCore.initialized) throw new Error('Should be initialized');
    });

    // Test 22: Register adapter in bridge core
    await runTest('Register adapter in bridge core', async () => {
        const { bridgeCore } = require('../bridge/core/bridgeCore');
        const VintedAdapter = require('../bridge/adapters/VintedAdapter');
        const adapter = new VintedAdapter({});
        await adapter.connect();
        bridgeCore.registerAdapter('test_vinted', adapter);
        const retrieved = bridgeCore.getAdapter('test_vinted');
        if (!retrieved) throw new Error('Adapter not found after registration');
    });

    // Test 23: Get bridge stats
    await runTest('Get bridge stats', async () => {
        const { bridgeCore } = require('../bridge/core/bridgeCore');
        const stats = bridgeCore.getStats();
        if (typeof stats.totalSyncs !== 'number') throw new Error('Missing totalSyncs');
        if (!stats.adapters) throw new Error('Missing adapters in stats');
    });

    // Test 24: Unregister adapter
    await runTest('Unregister adapter from bridge core', async () => {
        const { bridgeCore } = require('../bridge/core/bridgeCore');
        bridgeCore.unregisterAdapter('test_vinted');
        const retrieved = bridgeCore.getAdapter('test_vinted');
        if (retrieved) throw new Error('Adapter should be removed');
    });

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed\n`);

    if (testsFailed > 0) {
        console.log('❌ Some tests failed. Please check the errors above.\n');
        process.exit(1);
    } else {
        console.log('✅ All tests passed! Universal Bridge is ready.\n');
        process.exit(0);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n💥 Test runner crashed:', error);
    process.exit(1);
});
