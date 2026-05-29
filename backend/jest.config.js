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
    // NOTE: Coverage disabled by default to allow fast CI pre-deploy tests.
    // Activate with: npx jest --coverage
    collectCoverage: false,
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

    // Coverage thresholds (only enforced when --coverage flag is used)
    coverageThreshold: {
        global: {
            branches: 30,
            functions: 30,
            lines: 30,
            statements: 30
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
    // NOTE: transform: {} means no Babel transform. This is intentional for CJS.
    // mongodb driver v6 ships TypeScript source in some imports - we mock those.
    transform: {},

    // Ignore transforming node_modules except none (all CJS)
    transformIgnorePatterns: [
        'node_modules/(?!nothing)'
    ],

    // Mock modules that are problematic in test environment
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@services/(.*)$': '<rootDir>/services/$1',
        '^@routes/(.*)$': '<rootDir>/routes/$1',
        '^@utils/(.*)$': '<rootDir>/utils/$1',
        '^@middleware/(.*)$': '<rootDir>/middleware/$1',
        // Map mongodb TypeScript sources to compiled CJS (fixes Jest resolution error)
        '^mongodb/(.+)\.ts$': '<rootDir>/node_modules/mongodb/$1'
    }
};
