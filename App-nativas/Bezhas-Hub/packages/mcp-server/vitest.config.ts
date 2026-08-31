import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
            thresholds: {
                branches: 60,
                functions: 70,
                lines: 70,
                statements: 70,
            },
        },
        testTimeout: 15000,
        mockReset: true,
        restoreMocks: true,
    },
});
