/**
 * El catálogo MCP vive en dos ficheros de código. docs/reference/CATALOGO_MCP.md se genera de ellos y
 * la guía de integración cita herramientas por nombre: un nombre inventado en la guía llega a los
 * clientes que configuran su agente con él.
 */
const fs = require('fs');
const path = require('path');
const { generar, DESTINO } = require('../../scripts/generar-catalogo-mcp');

const DOCS = path.resolve(__dirname, '..', '..', '..', 'docs');
const nombres = [
    ...require('../../config/mcp-tools').TOOLS,
    ...require('../../config/mcp-onboarding-tools').TOOLS,
].map((t) => t.name);

// Herramientas que la guía presenta como previstas (sección «Previstas en v2»), todavía sin código.
const PREVISTAS = new Set(['bezhas_payment_prepare', 'bezhas_stake_prepare', 'bezhas_bridge_prepare',
    'bezhas_rwa_tokenize_prepare', 'bezhas_approval_status']);

test('CATALOGO_MCP.md coincide con el código (regenerar con node scripts/generar-catalogo-mcp.js)', () => {
    expect(fs.readFileSync(DESTINO, 'utf8')).toBe(generar());
});

test('los nombres de herramienta no se repiten entre catálogos', () => {
    expect(nombres.length).toBe(new Set(nombres).size);
});

test.each(['BEZHAS_MCP_GUIA_INTEGRACION.md', 'BEZHAS_MCP_ONBOARDING_ASISTIDO.md'])(
    '%s sólo cita herramientas que existen o que declara previstas', (fichero) => {
        const texto = fs.readFileSync(path.join(DOCS, fichero), 'utf8');
        const citadas = new Set(texto.match(/\bbezhas_[a-z0-9_]+\b/g) || []);
        const desconocidas = [...citadas].filter((n) => !nombres.includes(n) && !PREVISTAS.has(n)
            && !/^bezhas_(testnet|knowledge)$/.test(n));
        expect(desconocidas).toEqual([]);
    });
