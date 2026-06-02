/**
 * Bridge Core Tests
 * 
 * Tests for the Universal Bridge Core module
 */

const { bridgeCore, BRIDGE_EVENTS, BRIDGE_STATUS } = require('../bridge/core/bridgeCore');
const { createAdapter, VintedAdapter, MaerskAdapter, AirbnbAdapter } = require('../bridge/adapters');

// Mock logger to avoid console spam
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// Mock MongoDB models
jest.mock('../models/BridgeSyncedItem.model', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'mock_id' }),
}));

jest.mock('../models/BridgeOrder.model', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'mock_order' }),
}));

jest.mock('../models/BridgeShipment.model', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'mock_shipment' }),
}));

describe('Bridge Core - Universal Bridge Controller', () => {
    beforeEach(() => {
        // Reset bridge state before each test
        bridgeCore.adapters.clear();
    });

    afterEach(() => {
        // Cleanup
        bridgeCore.removeAllListeners();
    });

    describe('Adapter Registration', () => {
        test('should register Vinted adapter successfully', async () => {
            const adapter = createAdapter('vinted', {
                apiKey: 'test_key',
                accessToken: 'test_token',
            });
            await adapter.connect();

            bridgeCore.registerAdapter('vinted', adapter);

            expect(adapter).toBeInstanceOf(VintedAdapter);
            expect(bridgeCore.adapters.has('vinted')).toBe(true);
            expect(adapter.platformId).toBe('vinted');
        });

        test('should register Maersk adapter successfully', async () => {
            const adapter = createAdapter('maersk', {
                consumerKey: 'test_key',
                consumerSecret: 'test_secret',
            });
            await adapter.connect();

            bridgeCore.registerAdapter('maersk', adapter);

            expect(adapter).toBeInstanceOf(MaerskAdapter);
            expect(bridgeCore.adapters.has('maersk')).toBe(true);
            expect(adapter.platformId).toBe('maersk');
        });

        test('should register Airbnb adapter successfully', async () => {
            const adapter = createAdapter('airbnb', {
                clientId: 'test_client_id',
                clientSecret: 'test_secret',
            });
            await adapter.connect();

            bridgeCore.registerAdapter('airbnb', adapter);

            expect(adapter).toBeInstanceOf(AirbnbAdapter);
            expect(bridgeCore.adapters.has('airbnb')).toBe(true);
            expect(adapter.platformId).toBe('airbnb');
        });

        test('should throw error for unknown platform in createAdapter', () => {
            expect(() => createAdapter('unknown_platform', {})).toThrow(
                /Unknown adapter: unknown_platform/
            );
        });

        test('should replace duplicate adapter registration with warning', async () => {
            const adapter1 = createAdapter('vinted', {});
            await adapter1.connect();
            bridgeCore.registerAdapter('vinted', adapter1);

            const adapter2 = createAdapter('vinted', { accessToken: 'new_token' });
            await adapter2.connect();
            bridgeCore.registerAdapter('vinted', adapter2);

            // Should have replaced the adapter
            expect(bridgeCore.adapters.has('vinted')).toBe(true);
            expect(bridgeCore.adapters.size).toBe(1);
        });
    });

    describe('Adapter Management', () => {
        beforeEach(async () => {
            // Register test adapters using createAdapter
            const vintedAdapter = createAdapter('vinted', {});
            await vintedAdapter.connect();
            bridgeCore.registerAdapter('vinted', vintedAdapter);

            const maerskAdapter = createAdapter('maersk', {});
            await maerskAdapter.connect();
            bridgeCore.registerAdapter('maersk', maerskAdapter);
        });

        test('should get registered adapter', () => {
            const adapter = bridgeCore.getAdapter('vinted');
            expect(adapter).toBeDefined();
            expect(adapter.platformId).toBe('vinted');
        });

        test('should return null for non-existent adapter', () => {
            const adapter = bridgeCore.getAdapter('nonexistent');
            expect(adapter).toBeNull();
        });

        test('should get all registered adapters', () => {
            const adapters = bridgeCore.getAllAdapters();
            expect(adapters.size).toBe(2);
            expect(adapters.has('vinted')).toBe(true);
            expect(adapters.has('maersk')).toBe(true);
        });

        test('should unregister adapter', () => {
            bridgeCore.unregisterAdapter('vinted');
            expect(bridgeCore.adapters.has('vinted')).toBe(false);
        });
    });

    describe('Inventory Sync', () => {
        beforeEach(async () => {
            const vintedAdapter = createAdapter('vinted', {});
            await vintedAdapter.connect();
            bridgeCore.registerAdapter('vinted', vintedAdapter);

            const airbnbAdapter = createAdapter('airbnb', {});
            await airbnbAdapter.connect();
            bridgeCore.registerAdapter('airbnb', airbnbAdapter);
        });

        test('should sync inventory for Vinted adapter', async () => {
            const result = await bridgeCore.syncInventory('vinted', { limit: 5 });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.itemsProcessed).toBeGreaterThanOrEqual(0);
        });

        test('should sync inventory for Airbnb adapter', async () => {
            const result = await bridgeCore.syncInventory('airbnb', { limit: 3 });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        test('should throw error for non-existent adapter', async () => {
            await expect(
                bridgeCore.syncInventory('nonexistent')
            ).rejects.toThrow(/Adapter not found/);
        });
    });

    describe('Bridge Statistics', () => {
        test('should return bridge stats', async () => {
            const vintedAdapter = createAdapter('vinted', {});
            await vintedAdapter.connect();
            bridgeCore.registerAdapter('vinted', vintedAdapter);

            const stats = bridgeCore.getStats();

            expect(stats).toBeDefined();
            expect(stats.activeConnections).toBe(1);
            expect(stats.adapters).toBeDefined();
            expect(stats.adapters.vinted).toBeDefined();
        });

        test('should perform health check on adapters', async () => {
            const vintedAdapter = createAdapter('vinted', {});
            await vintedAdapter.connect();
            bridgeCore.registerAdapter('vinted', vintedAdapter);

            const health = await bridgeCore.healthCheck();

            expect(health).toBeDefined();
            expect(health.vinted).toBeDefined();
            expect(health.vinted.healthy).toBeDefined();
        });
    });

    describe('Event Handling', () => {
        test('should emit ADAPTER_CONNECTED event on registration', (done) => {
            bridgeCore.once(BRIDGE_EVENTS.ADAPTER_CONNECTED, (data) => {
                expect(data).toBeDefined();
                expect(data.platformId).toBe('vinted');
                done();
            });

            const adapter = createAdapter('vinted', {});
            adapter.connect().then(() => {
                bridgeCore.registerAdapter('vinted', adapter);
            });
        });

        test('should emit ADAPTER_DISCONNECTED on unregister', (done) => {
            const adapter = createAdapter('vinted', {});
            adapter.connect().then(() => {
                bridgeCore.registerAdapter('vinted', adapter);

                bridgeCore.once(BRIDGE_EVENTS.ADAPTER_DISCONNECTED, (data) => {
                    expect(data.platformId).toBe('vinted');
                    done();
                });

                bridgeCore.unregisterAdapter('vinted');
            });
        });
    });
});
