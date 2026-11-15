#!/usr/bin/env node
'use strict';
/**
 * Genera docs/reference/CATALOGO_MCP.md a partir de los dos catálogos de herramientas MCP:
 *   config/mcp-tools.js            (cliente: sólo lectura o `_prepare`, exige api-key)
 *   config/mcp-onboarding-tools.js (alta y despliegue, algunas anónimas)
 * El fichero se escribe aquí y se comprueba en __tests__/docs/catalogo-mcp.test.js: si añades o
 * cambias una herramienta, ejecuta `node scripts/generar-catalogo-mcp.js` y commitea el resultado.
 */
const fs = require('fs');
const path = require('path');

const DESTINO = path.resolve(__dirname, '..', '..', 'docs', 'reference', 'CATALOGO_MCP.md');

function generar() {
    const cliente = require('../config/mcp-tools').TOOLS;
    const alta = require('../config/mcp-onboarding-tools').TOOLS;
    const celda = (s) => String(s || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
    const primera = (s) => celda(s).split(/(?<=[.!?])\s/)[0];
    const filas = [];
    filas.push('---', 'estado: vigente', 'dominio: api', '---', '');
    filas.push('# Catálogo de herramientas MCP', '');
    filas.push('> **Generado** por `api/scripts/generar-catalogo-mcp.js`. No editar a mano: un test falla si no',
        '> coincide con el código. Detalle, ejemplos y precios en `docs/BEZHAS_MCP_GUIA_INTEGRACION.md`.', '');
    filas.push(`Son **${cliente.length + alta.length}** herramientas en dos catálogos separados a propósito`,
        '(ver la cabecera de `api/config/mcp-onboarding-tools.js`): un control de acceso con excepciones es cómo',
        'se sirve por error una herramienta de cliente a un desconocido.', '');
    filas.push(`## Cliente (\`config/mcp-tools.js\`, ${cliente.length}) — api-key, sin firmar nada`, '');
    filas.push('| Herramienta | Scope | Plan mínimo | Qué hace |', '|---|---|---|---|');
    for (const t of [...cliente].sort((a, b) => a.name.localeCompare(b.name))) {
        filas.push(`| \`${t.name}\` | \`${t.scope}\` | ${t.planMinimo} | ${primera(t.description || t.title)} |`);
    }
    filas.push('', `## Alta y despliegue (\`config/mcp-onboarding-tools.js\`, ${alta.length})`, '');
    filas.push('| Herramienta | Acceso | Qué hace |', '|---|---|---|');
    for (const t of [...alta].sort((a, b) => a.name.localeCompare(b.name))) {
        filas.push(`| \`${t.name}\` | ${t.anonimo ? 'anónimo' : 'api-key'} | ${primera(t.description || t.title)} |`);
    }
    return `${filas.join('\n')}\n`;
}

if (require.main === module) {
    fs.writeFileSync(DESTINO, generar());
    console.log(`Escrito ${path.relative(process.cwd(), DESTINO)}`);
}
module.exports = { generar, DESTINO };
