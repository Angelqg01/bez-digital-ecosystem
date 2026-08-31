/**
 * Test de contrato OpenAPI (Fase 1.3 — Conexión API-Hub)
 *
 * Garantiza que el contrato público del Hub (servido en /api-docs y exportado
 * a openapi.json) es estructuralmente válido y mantiene sus invariantes.
 * Si una anotación @swagger rompe el spec, este test falla en CI antes de
 * llegar a producción.
 */
const path = require('path');

describe('OpenAPI contract (swagger.config.js)', () => {
    let spec;

    beforeAll(() => {
        // swagger-jsdoc resuelve `apis` relativo a cwd → asegurar backend/
        const backendRoot = path.resolve(__dirname, '..');
        const prevCwd = process.cwd();
        process.chdir(backendRoot);
        try {
            spec = require('../swagger.config.js');
        } finally {
            process.chdir(prevCwd);
        }
    });

    test('genera un documento OpenAPI 3.x', () => {
        expect(spec.openapi).toMatch(/^3\./);
        expect(spec.info?.title).toBeTruthy();
        expect(spec.info?.version).toBeTruthy();
    });

    test('contiene paths (las anotaciones @swagger se resolvieron)', () => {
        const paths = Object.keys(spec.paths || {});
        expect(paths.length).toBeGreaterThan(0);
    });

    test('expone el securityScheme ApiKeyAuth (X-API-Key)', () => {
        expect(spec.components?.securitySchemes?.ApiKeyAuth).toMatchObject({
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
        });
    });

    test('ningún path duplica el prefijo /api (la base del server ya lo incluye)', () => {
        const offenders = Object.keys(spec.paths || {}).filter(p => p.startsWith('/api/'));
        expect(offenders).toEqual([]);
    });

    test('toda operación declara responses (requerido por OpenAPI 3.0)', () => {
        const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
        const missing = [];
        for (const [p, item] of Object.entries(spec.paths || {})) {
            for (const m of HTTP_METHODS) {
                if (item[m] && !item[m].responses) missing.push(`${m.toUpperCase()} ${p}`);
            }
        }
        expect(missing).toEqual([]);
    });

    test('el spec completo pasa la validación de swagger-parser', async () => {
        const SwaggerParser = require('swagger-parser');
        // validate() muta el objeto → clonar
        const clone = JSON.parse(JSON.stringify(spec));
        await expect(SwaggerParser.validate(clone)).resolves.toBeDefined();
    }, 30000);
});
