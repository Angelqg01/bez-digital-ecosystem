/**
 * Configuración de Jest para CI.
 *
 * Hasta ahora el job «Backend Tests» ejecutaba `pnpm test` en `./api`, un
 * paquete con `jest --passWithNoTests` y cero pruebas: pasaba en verde sin
 * ejecutar ni una sola de las 600 pruebas de `backend/`. Este fichero conecta
 * esas pruebas de verdad.
 *
 * ─── Por qué hay exclusiones ─────────────────────────────────────────────────
 *
 * De las 42 suites, 17 llevan tiempo rotas por deriva entre las pruebas y el
 * código que ejercitan: mocks que ya no coinciden con la forma real del módulo,
 * precios de suscripción cambiados sin actualizar el test, modelos de Mongoose
 * con otra interfaz, servidores que se importan mal. No es un problema de
 * entorno: fallan igual con base de datos delante.
 *
 * Activarlas todas de golpe dejaría la CI en rojo permanente, que es peor que
 * tenerla apagada: una señal que siempre está roja deja de leerse, y entonces
 * ya no avisa de lo que sí importa. Esa es exactamente la enfermedad que este
 * repositorio acaba de curar en el humo E2E.
 *
 * Así que se conectan las 25 que pasan —protegen desde hoy— y las 17 rotas
 * quedan aquí, **nombradas una a una y a la vista**, no escondidas tras un
 * patrón genérico. Reparar cada una es trabajo aparte; según se arreglen, se
 * borran de esta lista.
 *
 * Ninguna de estas exclusiones apaga una prueba que la CI estuviera ejecutando
 * antes: hasta este cambio no se ejecutaba ninguna.
 */
const base = require('./jest.config');

/** Suites rotas contra el código actual. Cada línea es deuda pendiente. */
const SUITES_ROTAS = [
    // Mocks que ya no encajan con la forma real del módulo.
    '<rootDir>/tests/unit/sdkAdmin.service.test.js',   // SDKConfig.getConfig no es un mock
    '<rootDir>/tests/unit/ml.service.test.js',
    '<rootDir>/tests/bridge.core.test.js',             // BridgeSyncedItem.findOneAndUpdate no existe
    '<rootDir>/tests/automation/diagnosticSystem.test.js',
    '<rootDir>/tests/automation/rewardSystem.test.js',
    '<rootDir>/tests/automation/thirdPartyAnalyzer.test.js',

    // Valores esperados que el código ya no produce.
    '<rootDir>/tests/subscription-roi.test.js',        // espera 14.99, el código da 99
    '<rootDir>/tests/token-distribution.test.js',      // el servicio no exporta lo que se espera
    '<rootDir>/tests/qualityReputationSystem.test.js',

    // Necesitan el servidor HTTP en marcha o rutas que ya no responden igual.
    '<rootDir>/tests/admin.v1.test.js',
    '<rootDir>/tests/ads.test.js',
    '<rootDir>/tests/feed.test.js',
    '<rootDir>/tests/globalSettings.test.js',
    '<rootDir>/tests/integration/full-system-integration.test.js',
    '<rootDir>/tests/payment-flow-e2e.test.js',

    // No es una suite de Jest: es un script que se ejecuta solo al importarse,
    // abre un websocket y agota su propio timeout de 5 s.
    '<rootDir>/tests/security.test.js',

    // Prueba de contrato (Hardhat/Foundry), no de backend. La cubre el job de
    // Solidity, y aquí solo entra porque `testMatch` incluye `**/test/**`.
    '<rootDir>/test/BezLiquidityRamp.test.js',
];

module.exports = {
    ...base,
    testPathIgnorePatterns: [...base.testPathIgnorePatterns, ...SUITES_ROTAS],
    // En CI interesa el resumen, no el detalle de cada prueba.
    verbose: false,
};
