/**
 * Jest Test Setup for BeZhas Backend
 * This file runs before each test suite
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.MONGODB_URI = 'mongodb://localhost:27017/bezhas_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Mock console methods to reduce noise
const originalConsole = { ...console };

beforeAll(() => {
    // Suppress console.log and console.debug in tests
    console.log = jest.fn();
    console.debug = jest.fn();
    // Keep error and warn for debugging
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
});

afterAll(() => {
    // Restore console
    Object.assign(console, originalConsole);
});

// Global test timeout
jest.setTimeout(30000);

// Mock Redis service for tests that don't need it
jest.mock('../services/redis.service', () => ({
    getClient: jest.fn(() => null),
    isConnected: jest.fn(() => false),
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve('OK')),
    del: jest.fn(() => Promise.resolve(1)),
    hget: jest.fn(() => Promise.resolve(null)),
    hset: jest.fn(() => Promise.resolve(1)),
    incr: jest.fn(() => Promise.resolve(1)),
    expire: jest.fn(() => Promise.resolve(1)),
    publish: jest.fn(() => Promise.resolve(1)),
    subscribe: jest.fn(() => Promise.resolve()),
    quit: jest.fn(() => Promise.resolve())
}));

// Mock telemetry service
jest.mock('../services/telemetry.service', () => ({
    trackEvent: jest.fn(),
    trackMetric: jest.fn(),
    trackError: jest.fn(),
    flush: jest.fn(() => Promise.resolve())
}));

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection in test:', reason);
});

// Cleanup function for after all tests
afterAll(async () => {
    // Clean up any remaining connections
    await new Promise(resolve => setTimeout(resolve, 100));
});

// Custom matchers
expect.extend({
    toBeValidHexAddress(received) {
        const pass = /^0x[a-fA-F0-9]{40}$/.test(received);
        return {
            message: () => `expected ${received} to be a valid Ethereum address`,
            pass
        };
    },
    toBeValidTransactionHash(received) {
        const pass = /^0x[a-fA-F0-9]{64}$/.test(received);
        return {
            message: () => `expected ${received} to be a valid transaction hash`,
            pass
        };
    }
});
