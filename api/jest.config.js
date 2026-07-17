module.exports = {
    testEnvironment: 'node',
    setupFiles: ['./jest.setup.js'],
    testMatch: ['**/__tests__/**/*.test.js'],
    // @noble/post-quantum (+ its @noble deps) is ESM-only: transpile ONLY those
    // packages to CJS so jest can load the real implementation (no mocks).
    transform: {
        '^.+\\.[cm]?js$': ['babel-jest', { plugins: ['@babel/plugin-transform-modules-commonjs'] }],
    },
    transformIgnorePatterns: [
        '[\\\\/]node_modules[\\\\/](?!\\.pnpm)(?!@noble)',
        '[\\\\/]node_modules[\\\\/]\\.pnpm[\\\\/](?!@noble\\+)',
    ],
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
