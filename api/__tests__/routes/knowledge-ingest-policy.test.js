/**
 * Política: el RAG sólo contiene el conocimiento público sembrado; la ingesta de texto de tenants está apagada por defecto.
 */
process.env.KNOWLEDGE_STORE = 'memory';
process.env.AI_PROVIDER = 'extractive';
process.env.NATIVE_APPS_PROBE = 'false';
delete process.env.KNOWLEDGE_TENANT_INGEST;

const express = require('express');
const request = require('supertest');
const { mockQuery, makeToken } = require('../helpers');
const rutas = require('../../routes/ai-workspace');
const { _cache } = require('../../services/ai-workspace/principal');
const { KnowledgeService, MemoryStore } = require('../../services/knowledge');
const { seedPublicKnowledge } = require('../../services/knowledge/seed');

const app = () => { const a = express(); a.use('/api/ai-workspace', rutas); return a; };
const tk = (id) => makeToken({ userId: id, role: 'user' });
const A = { userId: 'a', tenantId: 'org:a', roles: ['USER'], plan: 'business' };

beforeEach(() => {
    _cache.clear();
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql, params) => (/FROM organization_members/.test(sql)
        ? { rows: [{ organization_id: 'org-a', role: 'owner', plan: 'business', app_id: 'app-a' }] } : { rows: [], rowCount: 0 }));
});
afterEach(() => { delete process.env.KNOWLEDGE_TENANT_INGEST; });

describe('ingesta de texto de tenants (apagada por defecto)', () => {
    it('POST /knowledge → 403 TENANT_INGEST_DISABLED aunque tenga plan', async () => {
        const res = await request(app()).post('/api/ai-workspace/knowledge').set('Authorization', `Bearer ${tk(1)}`)
            .send({ title: 'Manual', content: 'texto', classification: 'INTERNAL' });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('TENANT_INGEST_DISABLED');
    });
    it('tampoco con global:true (ni siendo admin de plataforma)', async () => {
        const res = await request(app()).post('/api/ai-workspace/knowledge').set('Authorization', `Bearer ${makeToken({ userId: 3, role: 'admin' })}`)
            .send({ title: 'g', content: 'texto', classification: 'PUBLIC', global: true });
        expect(res.status).toBe(403);
    });
    it('el listado informa de que la ingesta está desactivada', async () => {
        const res = await request(app()).get('/api/ai-workspace/knowledge').set('Authorization', `Bearer ${tk(1)}`);
        expect(res.status).toBe(200);
        expect(res.body.ingestEnabled).toBe(false);
    });
    it('con KNOWLEDGE_TENANT_INGEST=true se permite de nuevo', async () => {
        process.env.KNOWLEDGE_TENANT_INGEST = 'true';
        const res = await request(app()).post('/api/ai-workspace/knowledge').set('Authorization', `Bearer ${tk(1)}`)
            .send({ title: 'Manual', content: 'texto de prueba', classification: 'INTERNAL' });
        expect(res.status).toBe(201);
    });
});

describe('la búsqueda sólo devuelve conocimiento público sembrado', () => {
    it('un documento de tenant que ya estuviera guardado no se recupera con la ingesta apagada', async () => {
        const k = new KnowledgeService({ store: new MemoryStore() });
        await seedPublicKnowledge(k);
        process.env.KNOWLEDGE_TENANT_INGEST = 'true';
        await k.ingest(A, { id: 'previo', title: 'Contrato Zafiro', content: 'El contrato Zafiro vence en marzo.', classification: 'INTERNAL' });
        expect((await k.search(A, 'contrato Zafiro vence')).map((c) => c.document_id)).toContain('previo');
        delete process.env.KNOWLEDGE_TENANT_INGEST;
        expect((await k.search(A, 'contrato Zafiro vence')).map((c) => c.document_id)).not.toContain('previo');
        expect((await k.search(A, '¿Cómo compro BEZ con tarjeta?')).map((c) => c.document_id)).toContain('bz_comprar_bez');
    });
    it('el seed (global, PUBLIC) sigue funcionando con la ingesta apagada', async () => {
        const k = new KnowledgeService({ store: new MemoryStore() });
        expect(await seedPublicKnowledge(k)).toBeGreaterThan(0);
    });
});
