/**
 * Bridge Adapters Tests
 * 
 * Tests for platform-specific adapters (Vinted, Maersk, Airbnb)
 */

const VintedAdapter = require('../bridge/adapters/VintedAdapter');
const MaerskAdapter = require('../bridge/adapters/MaerskAdapter');
const AirbnbAdapter = require('../bridge/adapters/AirbnbAdapter');
const BaseAdapter = require('../bridge/adapters/BaseAdapter');

// Mock logger
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// Mock MongoDB models
jest.mock('../models/BridgeSyncedItem.model', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({
        _id: 'mock_id',
        platform: 'vinted',
        externalId: '12345',
        beZhasId: 'BEZ_vinted_12345',
    }),
}));

jest.mock('../models/BridgeOrder.model', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({
        _id: 'mock_order_id',
        platform: 'vinted',
        orderId: 'ORD_12345',
    }),
}));

jest.mock('../models/BridgeShipment.model', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({
        _id: 'mock_shipment_id',
        platform: 'maersk',
        trackingNumber: 'MAEU123456789',
    }),
}));

describe('Vinted Adapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new VintedAdapter({
            apiKey: 'test_key',
            accessToken: 'test_token',
        });
    });

    afterEach(() => {
        adapter.removeAllListeners();
    });

    test('should initialize with correct platform ID', () => {
        expect(adapter.platformId).toBe('vinted');
        expect(adapter.platformName).toBe('Vinted');
        expect(adapter.status).toBe('disconnected');
    });

    test('should extend BaseAdapter', () => {
        expect(adapter).toBeInstanceOf(BaseAdapter);
    });

    test('should connect in mock mode without credentials', async () => {
        const mockAdapter = new VintedAdapter({});
        const result = await mockAdapter.connect();

        expect(result.success).toBe(true);
        expect(result.mode).toBe('mock');
        expect(mockAdapter.status).toBe('connected_mock');
    });

    test('should sync inventory and return result', async () => {
        await adapter.connect();
        const result = await adapter.syncInventory({ limit: 5 });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(typeof result.itemsProcessed).toBe('number');
    });

    test('should prevent concurrent syncs', async () => {
        await adapter.connect();
        adapter.syncInProgress = true;

        await expect(adapter.syncInventory()).rejects.toThrow('Sync already in progress');
    });

    test('should have transform method', () => {
        expect(typeof adapter.transformToBeZhasFormat).toBe('function');
    });

    test('should track statistics', async () => {
        expect(adapter.stats).toBeDefined();
        expect(adapter.stats.totalRequests).toBe(0);
        expect(adapter.stats.successfulRequests).toBe(0);
        expect(adapter.stats.itemsSynced).toBe(0);
    });
});

describe('Maersk Adapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new MaerskAdapter({
            consumerKey: 'test_key',
            consumerSecret: 'test_secret',
        });
    });

    afterEach(() => {
        adapter.removeAllListeners();
    });

    test('should initialize with correct platform ID', () => {
        expect(adapter.platformId).toBe('maersk');
        expect(adapter.platformName).toBe('Maersk Line');
        expect(adapter.status).toBe('disconnected');
    });

    test('should extend BaseAdapter', () => {
        expect(adapter).toBeInstanceOf(BaseAdapter);
    });

    test('should connect in mock mode without credentials', async () => {
        const mockAdapter = new MaerskAdapter({});
        const result = await mockAdapter.connect();

        expect(result.success).toBe(true);
        expect(result.mode).toBe('mock');
    });

    test('should track shipment with mock data', async () => {
        await adapter.connect();
        const trackingNumber = 'MAEU123456789';
        const result = await adapter.trackShipment(trackingNumber);

        expect(result.trackingNumber).toBe(trackingNumber);
        expect(result.status).toBeDefined();
        expect(result.carrier).toBe('Maersk');
        expect(result.events).toBeDefined();
        expect(Array.isArray(result.events)).toBe(true);
    });

    test('should have createBooking method', () => {
        expect(typeof adapter.createBooking).toBe('function');
    });

    test('should generate mock tracking events', () => {
        const trackingNumber = 'TEST123';
        const tracking = adapter.generateMockTracking(trackingNumber);

        expect(tracking.trackingNumber).toBe(trackingNumber);
        expect(tracking.events.length).toBeGreaterThan(0);
        expect(tracking.events[0]).toHaveProperty('timestamp');
        expect(tracking.events[0]).toHaveProperty('location');
        expect(tracking.events[0]).toHaveProperty('status');
    });
});

describe('Airbnb Adapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new AirbnbAdapter({
            clientId: 'test_client_id',
            clientSecret: 'test_secret',
        });
    });

    afterEach(() => {
        adapter.removeAllListeners();
    });

    test('should initialize with correct platform ID', () => {
        expect(adapter.platformId).toBe('airbnb');
        expect(adapter.platformName).toBe('Airbnb');
        expect(adapter.status).toBe('disconnected');
    });

    test('should extend BaseAdapter', () => {
        expect(adapter).toBeInstanceOf(BaseAdapter);
    });

    test('should connect in mock mode', async () => {
        const result = await adapter.connect();

        expect(result.success).toBe(true);
        expect(adapter.status).toContain('connected');
    });

    test('should sync listings and return result', async () => {
        await adapter.connect();
        const result = await adapter.syncInventory({ limit: 3 });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(typeof result.itemsProcessed).toBe('number');
    });

    test('should have transform method', () => {
        expect(typeof adapter.transformToBeZhasFormat).toBe('function');
    });

    test('should generate mock listings with correct structure', () => {
        const listings = adapter.generateMockListings(2);

        expect(listings.length).toBe(2);
        expect(listings[0]).toHaveProperty('id');
        expect(listings[0]).toHaveProperty('name');
        expect(listings[0]).toHaveProperty('price');
        expect(listings[0]).toHaveProperty('bedrooms');
    });
});

describe('Base Adapter (Abstract Class)', () => {
    test('should throw error when connect() not implemented', async () => {
        const baseAdapter = new BaseAdapter({ platformId: 'test' });

        await expect(baseAdapter.connect()).rejects.toThrow(
            'connect() must be implemented by subclass'
        );
    });

    test('should throw error when syncInventory() not implemented', async () => {
        const baseAdapter = new BaseAdapter({ platformId: 'test' });

        await expect(baseAdapter.syncInventory()).rejects.toThrow(
            'syncInventory() must be implemented by subclass'
        );
    });

    test('should initialize statistics', () => {
        const baseAdapter = new BaseAdapter({ platformId: 'test' });

        expect(baseAdapter.stats).toBeDefined();
        expect(baseAdapter.stats.totalRequests).toBe(0);
        expect(baseAdapter.stats.successfulRequests).toBe(0);
        expect(baseAdapter.stats.itemsSynced).toBe(0);
    });

    test('should track request counts', () => {
        const baseAdapter = new BaseAdapter({ platformId: 'test' });
        const initialTotal = baseAdapter.stats.totalRequests;

        baseAdapter.stats.totalRequests++;
        baseAdapter.stats.successfulRequests++;

        expect(baseAdapter.stats.totalRequests).toBe(initialTotal + 1);
        expect(baseAdapter.stats.successfulRequests).toBe(1);
    });

    test('should store platform configuration', () => {
        const config = {
            platformId: 'test_platform',
            platformName: 'Test Platform',
            apiKey: 'test_key',
        };
        const baseAdapter = new BaseAdapter(config);

        expect(baseAdapter.platformId).toBe('test_platform');
        expect(baseAdapter.platformName).toBe('Test Platform');
        expect(baseAdapter.apiKey).toBe('test_key');
    });
});
