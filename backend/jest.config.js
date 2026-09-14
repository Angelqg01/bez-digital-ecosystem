/**
 * Jest Configuration for BeZhas Backend
 * @type {import('jest').Config}
 */

/**
 * Dependencias publicadas como ESM puro (`"type": "module"`).
 *
 * Son las únicas que se transforman con Babel; el resto de node_modules, y
 * nuestro propio código CJS, se cargan tal cual. Si aparece un
 * «Unexpected token 'export'» al cargar un paquete nuevo, se añade aquí.
 */
const ESM_DEPS = ['afinn-165', 'uuid'];
module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Root directory
    rootDir: '.',

    // Test file patterns
    //
    // Ojo con `**/test/**`: lo incluía el patrón anterior y arrastraba
    // `test/BezLiquidityRamp.test.js`, que es una prueba de contrato escrita
    // para Hardhat (`require('hardhat')`, `chai`). Jest la cargaba, reventaba
    // al no encontrar el runtime de Hardhat y contaba como suite rota del
    // backend. Las pruebas del backend viven en `tests/`; `test/` es el
    // directorio de Hardhat y no le corresponde a Jest.
    testMatch: [
        '**/tests/**/*.test.js',
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
    //
    // Nuestro código es CJS y no necesita Babel: no se transforma, es más
    // rápido y evita sorpresas. La excepción son unas pocas dependencias
    // publicadas como ESM puro que `natural` arrastra para el análisis de
    // sentimiento; sin transformarlas, Jest revienta al cargarlas con
    // «Unexpected token 'export'».
    transform: {
        '\\.[mc]?js$': ['babel-jest', {
            presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
            babelrc: false,
            configFile: false,
        }],
    },

    // Todo node_modules queda sin transformar salvo esos paquetes ESM. El
    // patrón busca el nombre en cualquier punto de la ruta: pnpm resuelve a
    // rutas con dos `node_modules/` (.pnpm/<pkg>@<ver>/node_modules/<pkg>), y
    // un patrón anclado al primero dejaba el segundo sin excepción.
    transformIgnorePatterns: [
        `node_modules/(?!.*(${ESM_DEPS.join('|')}))`,
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
