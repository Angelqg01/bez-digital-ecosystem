const nextJest = require('next/jest');

// next/jest carga next.config.mjs, los .env y los paths de tsconfig ("@/..."),
// y aplica la misma transformación SWC que usa el build. Sin él habría que
// duplicar aquí el mapeo de alias y un transform de TS/JSX.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

    // Por defecto jsdom (contextos y hooks de React). Los route handlers de
    // app/api necesitan el runtime real de Node para NextResponse y crypto, y
    // lo piden fichero a fichero con el docblock @jest-environment node.
    testEnvironment: 'jest-environment-jsdom',

    // Sólo ficheros *.test.*: así __tests__ puede alojar helpers sin que Jest
    // los tome por suites vacías.
    testMatch: ['<rootDir>/__tests__/**/*.test.[jt]s?(x)'],

    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],

    // .next/standalone reempaqueta un package.json con el mismo "name" que el de
    // la raíz, y el haste map de Jest lo denuncia como colisión en cada arranque.
    // testPathIgnorePatterns no basta: sólo filtra el descubrimiento de suites.
    modulePathIgnorePatterns: ['<rootDir>/.next/'],

    // next/jest ya deriva los alias de tsconfig para los imports, pero jest.mock()
    // resuelve por su cuenta y no los ve. Declararlo aquí hace que mockear
    // '@/lib/api' funcione igual que importarlo.
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },

    // El alcance de la cobertura es deliberadamente estrecho: auth y pagos. El
    // resto del frontend todavía no tiene tests y meterlo aquí sólo produciría
    // un porcentaje global desmoralizante que nadie mira.
    collectCoverageFrom: [
        'lib/auth-context.tsx',
        'lib/auth-secrets.ts',
        'lib/demo-users.ts',
        'lib/api.ts',
        'lib/sdk/bezhas-pay-engine.ts',
        'lib/stripe-payment-links.ts',
        'lib/bank-transfer-details.ts',
        'app/api/auth/**/*.ts',
    ],
};

module.exports = createJestConfig(customJestConfig);
