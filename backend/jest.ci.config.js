/**
 * Configuración de Jest para CI.
 *
 * Hasta hace poco el job «Backend Tests» ejecutaba `pnpm test` en `./api`, un
 * paquete con `jest --passWithNoTests` y cero pruebas: pasaba en verde sin
 * ejecutar ni una sola de las pruebas de `backend/`. Ya no: se ejecutan todas.
 *
 * ─── Sobre las 17 suites que estaban rotas ───────────────────────────────────
 *
 * Al conectar las pruebas a la CI, 17 de las 42 suites fallaban por deriva
 * entre la prueba y el código que ejercita: mocks que ya no coincidían con la
 * forma real del módulo, precios de suscripción cambiados sin actualizar el
 * test, rutas de módulo con la mayúscula equivocada, un modelo de Mongoose
 * sustituido por un DAO de PostgreSQL, un script suelto que ni siquiera era
 * una suite de Jest. Quedaron listadas aquí, una a una, como deuda a la vista.
 *
 * Están todas reparadas. Esta lista está vacía a propósito: si vuelve a
 * llenarse, cada línea debe decir qué suite es y por qué, nunca un patrón
 * genérico que esconda el bulto.
 *
 * Las pruebas que necesitan PostgreSQL se saltan solas salvo que
 * `RUN_DB_TESTS=true` (lo pone la CI, que levanta el servicio y aplica las
 * migraciones). Así un desarrollador sin base de datos delante sigue pudiendo
 * ejecutar `pnpm test` sin fallos falsos.
 */
const base = require('./jest.config');

/** Suites rotas contra el código actual. Cada línea sería deuda pendiente. */
const SUITES_ROTAS = [];

module.exports = {
    ...base,
    testPathIgnorePatterns: [...base.testPathIgnorePatterns, ...SUITES_ROTAS],
    // En CI interesa el resumen, no el detalle de cada prueba.
    verbose: false,
};
