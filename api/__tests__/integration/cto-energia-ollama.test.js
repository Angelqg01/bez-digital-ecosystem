/**
 * Las 13 tareas del CTO energético contra un Ollama REAL y la ruta completa del chat (RAG + escudo + citas + cifras +
 * respuestas deterministas). Se salta sin OLLAMA_TEST_URL:
 *
 *   OLLAMA_TEST_URL=http://127.0.0.1:11435 OLLAMA_TEST_MODEL=qwen3.5:4b CTO_OUT=/ruta/resultado.json \
 *     pnpm exec jest __tests__/integration/cto-energia-ollama.test.js
 *
 * `requerido` / `prohibido` salen de __tests__/fixtures/rag-eval/cto-energia.json (los errores que se vieron en la prueba
 * del 2026-10-15). Un modelo local pequeño puede variar la redacción: si falla un `requerido` de una tarea no
 * determinista, mirar la respuesta antes de culpar al código.
 */
const fs = require('fs');
const URL = process.env.OLLAMA_TEST_URL;
const d = URL ? describe : describe.skip;

process.env.KNOWLEDGE_STORE = 'memory';
if (URL) {
    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_URL = URL;
    process.env.AI_MODEL_OLLAMA = process.env.OLLAMA_TEST_MODEL || 'qwen3.5:4b';
    process.env.AI_TIMEOUT_MS = '120000';
    delete process.env.ANTHROPIC_API_KEY; delete process.env.GEMINI_API_KEY;
}
process.env.NATIVE_APPS_PROBE = 'false';

const express = require('express');
const request = require('supertest');
const { mockQuery, makeToken } = require('../helpers');
const rutas = require('../../routes/ai-workspace');
const { _cache } = require('../../services/ai-workspace/principal');
const { tareas } = require('../fixtures/rag-eval/cto-energia.json');

const app = () => { const a = express(); a.use('/api/ai-workspace', rutas); return a; };
const tk = makeToken({ userId: 1, role: 'user' });
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

d('13 tareas del CTO energético con modelo local real', () => {
    jest.setTimeout(600000);
    const resultados = [];
    beforeAll(() => {
        _cache.clear(); rutas.facturacion._filas.clear(); mockQuery.mockReset();
        mockQuery.mockImplementation(async (sql) => (/FROM organization_members/.test(sql)
            ? { rows: [{ organization_id: 'org-a', role: 'owner', plan: 'business', app_id: 'app-a' }] } : { rows: [], rowCount: 0 }));
    });
    afterAll(() => { if (process.env.CTO_OUT) fs.writeFileSync(process.env.CTO_OUT, JSON.stringify(resultados, null, 2)); });

    it.each(tareas.map((t) => [t.id, t]))('%s', async (_, t) => {
        const res = await request(app()).post('/api/ai-workspace/chat').set('Authorization', `Bearer ${tk}`).send({ message: t.q });
        expect(res.status).toBe(200);
        const reply = res.body.reply;
        const faltan = (t.requerido || []).filter((r) => !new RegExp(r.includes('|') ? r : esc(r), 'i').test(reply));
        const sobran = (t.prohibido || []).filter((p) => new RegExp(esc(p), 'i').test(reply));
        resultados.push({ id: t.id, provider: res.body.provider, determinista: res.body.provider === 'facts', faltan, sobran, reply });
        expect({ id: t.id, faltan, sobran }).toEqual({ id: t.id, faltan: [], sobran: [] });
        if (t.determinista) expect(res.body.provider).toBe('facts');
    });
});
