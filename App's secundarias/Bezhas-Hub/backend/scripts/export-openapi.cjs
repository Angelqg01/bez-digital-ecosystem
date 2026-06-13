#!/usr/bin/env node
/**
 * export-openapi.cjs — Exporta y VALIDA el contrato OpenAPI del Hub.
 *
 * - Carga backend/swagger.config.js (la misma fuente que sirve /api-docs).
 * - Valida el spec con swagger-parser (estructura + $refs).
 * - Comprueba invariantes mínimas (paths > 0, securitySchemes presentes).
 * - Escribe backend/openapi.json (artefacto versionado para SubApps, SDK y devs).
 *
 * Uso:  pnpm openapi:export   (o: node scripts/export-openapi.cjs)
 * Sale con código != 0 si el contrato es inválido → apto para CI.
 */
const path = require('path');
const fs = require('fs');

// swagger-jsdoc resuelve los globs de `apis` relativo a cwd → fijar backend/
process.chdir(path.resolve(__dirname, '..'));

const SwaggerParser = require('swagger-parser');

async function main() {
    const spec = require('../swagger.config.js');

    // --- Invariantes mínimas del contrato ---
    const pathCount = Object.keys(spec.paths || {}).length;
    if (pathCount === 0) {
        throw new Error('El spec no contiene ningún path. ¿Faltan anotaciones @swagger o falló el glob `apis`?');
    }
    if (!spec.components?.securitySchemes?.ApiKeyAuth) {
        throw new Error('Falta securityScheme ApiKeyAuth — el contrato público requiere X-API-Key.');
    }

    // --- Validación estructural completa (clon: validate muta el objeto) ---
    const clone = JSON.parse(JSON.stringify(spec));
    await SwaggerParser.validate(clone);

    // --- Export ---
    const out = path.resolve(__dirname, '..', 'openapi.json');
    fs.writeFileSync(out, JSON.stringify(spec, null, 2) + '\n', 'utf8');

    const ops = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0);
    console.log(`✅ OpenAPI ${spec.openapi} válido — ${pathCount} paths / ${ops} operaciones`);
    console.log(`   Título: ${spec.info.title} v${spec.info.version}`);
    console.log(`   Export: ${out}`);
}

main().catch((err) => {
    console.error(`❌ Contrato OpenAPI inválido: ${err.message}`);
    process.exit(1);
});
