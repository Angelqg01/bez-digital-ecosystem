/**
 * Jest Configuration for BeZhas Backend
 * @type {import('jest').Config}
 */
module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Root directory
    rootDir: '.',

    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.js',
        '**/test/**/*.test.js',
        '**/__tests__/**/*.js'
    ],

    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/coverage/'
    ],

    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    collectCoverageFrom: [
        'services/**/*.js',
        'routes/**/*.js',
        'controllers/**/*.js',
        'middleware/**/*.js',
        'utils/**/*.js',
        '!**/node_modules/**',
        '!**/*.test.js',
        '!**/test*/**'
    ],

    // Coverage thresholds for critical paths
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60
        },
        './services/stripe.service.js': {
            branches: 70,
            functions: 80,
            lines: 75,
            statements: 75
        },
        './services/blockchain.service.js': {
            branches: 65,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    // Timeouts
    testTimeout: 30000,

    // Module paths
    moduleDirectories: ['node_modules', '<rootDir>'],

    // Clear mocks between tests
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,

    // Verbose output
    verbose: true,

    // Fail on console errors/warnings in tests
    errorOnDeprecated: true,

    // Max workers
    maxWorkers: '50%',

    // Detect open handles (useful for debugging)
    detectOpenHandles: true,

    // Force exit after tests complete
    forceExit: true,

    // Global setup/teardown
    globalSetup: undefined,
    globalTeardown: undefined,

    // Transform configuration
    transform: {},

    // Module name mapper for path aliases
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@services/(.*)$': '<rootDir>/services/$1',
        '^@routes/(.*)$': '<rootDir>/routes/$1',
        '^@utils/(.*)$': '<rootDir>/utils/$1',
        '^@middleware/(.*)$': '<rootDir>/middleware/$1'
    }
};
