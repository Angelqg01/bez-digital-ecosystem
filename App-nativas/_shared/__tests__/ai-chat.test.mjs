/**
 * Lógica compartida del chat de las SubApps (_shared/ai-chat/ai-workspace.js). Ejecutar: node --test App-nativas/_shared/__tests__
 *
 * El renderizado Markdown se comprueba con los MISMOS casos que la copia de control-center
 * (control-center/frontend/__tests__/lib/ai-workspace-parity.test.ts): si divergen, falla uno de los dos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    classifyLink, createAiClient, createSseParser, describeUsage, esApp, renderChatMarkdown,
} from '../ai-chat/ai-workspace.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(aqui, 'fixtures', 'chat-markdown.json'), 'utf8'));

test('Markdown: los casos comunes con control-center dan la misma salida', () => {
    for (const c of fixture.casos) assert.equal(renderChatMarkdown(c.entrada), c.esperado, c.nombre);
});

test('Markdown: nunca deja pasar una etiqueta, un manejador ni un enlace ajeno', () => {
    const sucio = '<script>x</script> <img src=x onerror=1> [a](https://evil.example) [b](javascript:alert(1)) ![c](https://evil.example/p.png)';
    const html = renderChatMarkdown(sucio);
    assert.doesNotMatch(html, /<(script|img)|href="(https:\/\/evil|javascript)/i); // «onerror=1» queda como TEXTO escapado, no como atributo
});

test('enlaces: sólo rutas internas y bezhas.com', () => {
    assert.equal(classifyLink('/dashboard').type, 'internal');
    assert.equal(classifyLink('//evil.example').type, 'blocked');
    assert.equal(classifyLink('https://www.bezhas.com/x').type, 'external');
    assert.equal(classifyLink('https://mcp.bezhas.com/mcp').type, 'external');
    assert.equal(classifyLink('http://bezhas.com').type, 'blocked');
    assert.equal(classifyLink('https://bezhas.com.evil.example').type, 'blocked');
    assert.equal(classifyLink('https://bezhas.com:444/x').type, 'blocked');
});

test('SSE: junta trozos partidos y entrega cada evento una vez', () => {
    const visto = [];
    const parse = createSseParser((e) => visto.push(e));
    const texto = 'event: meta\ndata: {"conversationId":"c1"}\n\nevent: delta\ndata: {"text":"Ho"}\n\nevent: delta\ndata: {"text":"la"}\n\n';
    for (let i = 0; i < texto.length; i += 7) parse(texto.slice(i, i + 7));
    assert.deepEqual(visto.map((e) => e.event), ['meta', 'delta', 'delta']);
    assert.equal(visto[0].data.conversationId, 'c1');
    assert.equal(visto.slice(1).map((e) => e.data.text).join(''), 'Hola');
});

test('SSE: ignora bloques que no son JSON y acepta \\r\\n', () => {
    const visto = [];
    createSseParser((e) => visto.push(e))('event: x\r\ndata: no-json\r\n\r\nevent: ok\r\ndata: {"a":1}\r\n\r\n');
    assert.deepEqual(visto, [{ event: 'ok', data: { a: 1 } }]);
});

test('uso: acciones del mes y créditos de pago por uso', () => {
    assert.equal(describeUsage({ used: 3, limit: 15000, payg: false }), '3 de 15000 acciones de IA este mes');
    assert.equal(describeUsage({ used: 3, limit: null, payg: false }), '3 acciones de IA este mes');
    assert.match(describeUsage({ used: 1, limit: 150, payg: true, credits: 3, billableEUR: 0.0025 }), /3 créditos/);
});

test('cliente: la base se normaliza (con o sin /api) y la ruta es /api/ai-workspace', () => {
    for (const base of ['https://api.bezhas.com', 'https://api.bezhas.com/', 'https://api.bezhas.com/api', 'https://api.bezhas.com/api/']) {
        assert.equal(createAiClient(base).AI_BASE, 'https://api.bezhas.com/api/ai-workspace');
    }
    assert.equal(createAiClient('').AI_BASE, '/api/ai-workspace'); // SubApps con proxy de Vite
});

test('cliente: aiFetch manda el Bearer y propaga el error del servidor con su código', async () => {
    const original = globalThis.fetch;
    try {
        let visto;
        globalThis.fetch = async (url, init) => { visto = { url, init }; return { ok: true, json: async () => ({ plans: [] }) }; };
        const { aiFetch } = createAiClient('https://api.bezhas.com/api');
        assert.deepEqual(await aiFetch('/plans', 'TOKEN'), { plans: [] });
        assert.equal(visto.url, 'https://api.bezhas.com/api/ai-workspace/plans');
        assert.equal(visto.init.headers.Authorization, 'Bearer TOKEN');

        globalThis.fetch = async () => ({ ok: false, status: 402, json: async () => ({ error: 'Necesitas un plan', upgradeActionId: 'plans' }) });
        await assert.rejects(() => aiFetch('/chat', 'T'), (e) => e.status === 402 && e.message === 'Necesitas un plan' && e.upgradeActionId === 'plans');
    } finally { globalThis.fetch = original; }
});

test('esApp distingue las tarjetas de apps', () => {
    assert.equal(esApp({ kind: 'app' }), true);
    assert.equal(esApp({ kind: 'navigate' }), false);
    assert.ok(!esApp(null));
});
