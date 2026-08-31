/**
 * Test de sincronía SDK ↔ Contrato OpenAPI (Fase 3B — Conexión API-Hub)
 *
 * Garantiza cobertura bidireccional:
 *  - Todo endpoint del manifest del SDK existe en el contrato (no inventa rutas).
 *  - Toda operación del contrato está cubierta por el SDK (no se queda corto).
 *
 * Si alguien añade una ruta @swagger sin método SDK (o al revés), CI falla.
 */
const path = require('path');

describe('SDK ↔ OpenAPI contract sync', () => {
    let contractOps; // Set("GET /health", ...)
    let sdkOps;      // Map("GET /health" -> "health.get")

    beforeAll(() => {
        // Contrato: regenerar desde la fuente (no depender del openapi.json exportado)
        const backendRoot = path.resolve(__dirname, '..');
        const prevCwd = process.cwd();
        process.chdir(backendRoot);
        let spec;
        try {
            spec = require('../swagger.config.js');
        } finally {
            process.chdir(prevCwd);
        }

        const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
        contractOps = new Set();
        for (const [p, item] of Object.entries(spec.paths || {})) {
            for (const m of HTTP_METHODS) {
                if (item[m]) contractOps.add(`${m.toUpperCase()} ${p}`);
            }
        }

        const { ENDPOINTS } = require('../../sdk/index.js');
        sdkOps = new Map();
        for (const [key, def] of Object.entries(ENDPOINTS)) {
            sdkOps.set(`${def.method.toUpperCase()} ${def.path}`, key);
        }
    });

    test('el contrato y el SDK no están vacíos', () => {
        expect(contractOps.size).toBeGreaterThan(0);
        expect(sdkOps.size).toBeGreaterThan(0);
    });

    test('todo método del SDK apunta a una operación existente del contrato', () => {
        const phantom = [...sdkOps.entries()]
            .filter(([op]) => !contractOps.has(op))
            .map(([op, key]) => `${key} → ${op}`);
        expect(phantom).toEqual([]);
    });

    test('toda operación del contrato está cubierta por el SDK', () => {
        const uncovered = [...contractOps].filter((op) => !sdkOps.has(op));
        expect(uncovered).toEqual([]);
    });

    test('no hay métodos SDK duplicados sobre la misma operación', () => {
        const { ENDPOINTS } = require('../../sdk/index.js');
        const seen = new Map();
        const dupes = [];
        for (const [key, def] of Object.entries(ENDPOINTS)) {
            const op = `${def.method.toUpperCase()} ${def.path}`;
            if (seen.has(op)) dupes.push(`${key} duplica a ${seen.get(op)} (${op})`);
            seen.set(op, key);
        }
        expect(dupes).toEqual([]);
    });
});
