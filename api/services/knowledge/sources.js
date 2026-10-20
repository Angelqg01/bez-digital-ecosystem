'use strict';

/**
 * Fuentes de conocimiento público además de los textos fijos de seed.js:
 *
 *   - El catálogo de herramientas del MCP, generado de config/mcp-tools.js: lo
 *     que un cliente puede pedirle a su IA nunca se desfasa del servidor real.
 *   - Las notas del vault marcadas como públicas (vault-public.json, ver
 *     vaultPublic.js).
 *
 * Todo pasa assertPublicable antes de devolverse.
 */
const fs = require('fs');
const path = require('path');
const { PLANS } = require('../../config/plans');
const { assertPublicable } = require('./publicSafety');

const VAULT_JSON = path.join(__dirname, 'vault-public.json');

const nombrePlan = (id) => (PLANS.find((p) => p.id === id) || {}).name || id;

const ALCANCES = {
    token: 'token (datos de BEZ-Coin y mercado)',
    contracts: 'contracts (contratos, red, tokenización y ERP)',
    wallet: 'wallet (suscripción, costes, pagos y cobros)',
};

function docCatalogoMcp() {
    // Diferido: config/mcp-tools → knowledge/search → seed → aquí. Requerirlo arriba
    // devolvería el módulo a medio cargar (TOOLS undefined).
    const { TOOLS } = require('../../config/mcp-tools');
    // Una línea por herramienta, sin repetir el plan en cada una: un catálogo que dice
    // dieciocho veces «plan Starter» gana en BM25 las preguntas de precios a bz_planes.
    const lineas = TOOLS.map((t) => `- ${t.name} (${(t.nivelRiesgo || 0) === 0 ? 'lectura' : 'prepara, no ejecuta'}): ${t.title}. ${t.description}`);
    const porPlan = new Map();
    for (const t of TOOLS) {
        const plan = nombrePlan(t.planMinimo || 'starter');
        porPlan.set(plan, [...(porPlan.get(plan) || []), t.name]);
    }
    const content = 'El servidor MCP ofrece estas herramientas a la IA del cliente (Claude, ChatGPT, Codex, Gemini…). '
        + 'Cada una exige un permiso concedido al conectar: '
        + `${Object.values(ALCANCES).join('; ')}. `
        + 'Ninguna herramienta firma transacciones ni mueve dinero: las operaciones con fondos sólo se preparan y '
        + 'requieren la aprobación de una persona fuera de la IA. '
        + `Plan mínimo de cada herramienta: ${[...porPlan].map(([plan, nombres]) => `${plan}: ${nombres.join(', ')}`).join('. ')}.\n`
        + lineas.join('\n');
    return ['bz_mcp_herramientas', 'Herramientas del servidor MCP', content];
}

function docsVault() {
    let lista = [];
    try {
        lista = JSON.parse(fs.readFileSync(VAULT_JSON, 'utf8'));
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
    return lista.map((d) => [d.id, d.title, d.content]);
}

/** Documentos públicos adicionales como [id, título, contenido]. */
function documentosAdicionales() {
    // El catálogo del MCP (docCatalogoMcp) NO se indexa: menciona a la vez ERP, cobros, costes y
    // planes, y en la evaluación (scripts/rag-eval.js) le quitaba el primer puesto a los documentos
    // curados en 18 preguntas. Los clientes MCP ya reciben esas descripciones en tools/list; se
    // conserva para exponerlo aparte si hace falta.
    const docs = [...docsVault()];
    for (const [id, title, content] of docs) assertPublicable(`${title}\n${content}`, id);
    return docs;
}

module.exports = { documentosAdicionales, docCatalogoMcp, docsVault, VAULT_JSON };
