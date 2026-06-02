module.exports = {
    testEnvironment: 'node',
    setupFiles: ['./jest.setup.js'],
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'routes/**/*.js',
        'services/**/*.js',
        'middleware/**/*.js',
        '!**/node_modules/**',
    ],
    coverageThreshold: {
        global: { branches: 60, functions: 70, lines: 75, statements: 75 },
    },
    testTimeout: 30000,
};
