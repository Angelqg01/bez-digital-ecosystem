/**
 * Knowledge Plane contra un Postgres REAL (migraciones 062 + 065). Se salta si no hay base de pruebas:
 *
 *   docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54329:5432 postgres:16-alpine
 *   KNOWLEDGE_TEST_PG_URL=postgres://postgres:test@localhost:54329/t pnpm exec jest __tests__/integration/knowledge-pg.test.js
 *
 * Borra y recrea las tablas knowledge_*: usar SÓLO una base desechable.
 */
const fs = require('fs');
const path = require('path');

process.env.KNOWLEDGE_TENANT_INGEST = 'true';
const URL = process.env.KNOWLEDGE_TEST_PG_URL;
const d = URL ? describe : describe.skip;

const A = { userId: 'a', tenantId: 'org:a', roles: ['USER'], plan: 'business' };
const B = { userId: 'b', tenantId: 'org:b', roles: ['USER'], plan: 'business' };
const sql = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8');

d('Knowledge Plane sobre Postgres', () => {
    let pool; let db; let store; let knowledge; let KnowledgeService; let seedPublicKnowledge;

    beforeAll(async () => {
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: URL });
        db = { query: (...a) => pool.query(...a), getClient: () => pool.connect() };
        await pool.query('DROP TABLE IF EXISTS knowledge_chunks, knowledge_documents, ai_conversations CASCADE');
        await pool.query(sql('062_ai_workspace.sql'));
        await pool.query(sql('065_knowledge_fts.sql'));
        await pool.query(sql('065_knowledge_fts.sql')); // idempotente
        ({ PgStore: store } = require('../../services/knowledge/store'));
        store = new store(db);
        ({ KnowledgeService } = require('../../services/knowledge/knowledge.service'));
        ({ seedPublicKnowledge } = require('../../services/knowledge/seed'));
        knowledge = new KnowledgeService({ store });
        await seedPublicKnowledge(knowledge);
        await knowledge.ingest(A, { id: 'doc-a', title: 'Contrato Zafiro', content: 'El contrato Zafiro con Acme vence en marzo y su penalización es del 7 por ciento.', classification: 'INTERNAL' });
    });
    afterAll(async () => { delete process.env.KNOWLEDGE_RETRIEVAL; await pool.end(); });
    afterEach(() => { delete process.env.KNOWLEDGE_RETRIEVAL; });

    const ids = (r) => r.map((c) => c.document_id);

    it.each([['completo', undefined], ['fts', 'fts']])('aislamiento de tenant (%s)', async (_, modo) => {
        if (modo) process.env.KNOWLEDGE_RETRIEVAL = modo;
        expect(ids(await knowledge.search(A, 'contrato Zafiro penalización'))).toContain('doc-a');
        expect(await knowledge.search(B, 'contrato Zafiro penalización')).toEqual([]);
        expect((await knowledge.buildContext(B, 'contrato Zafiro penalización')).context).not.toMatch(/Zafiro/);
    });

    it('B no puede pisar ni borrar el documento de A (barrera SQL incluida)', async () => {
        await expect(knowledge.ingest(B, { id: 'doc-a', title: 'x', content: 'texto de B', classification: 'INTERNAL' })).rejects.toMatchObject({ status: 403 });
        await expect(knowledge.deleteDocument(B, 'doc-a')).rejects.toMatchObject({ status: 403 });
        // Segunda barrera: aunque el servicio fallase, el UPSERT no pisa un id de otro tenant.
        await expect(store.putDocument({ id: 'doc-a', tenant_id: 'org:b', title: 't', source: 's', category: 'c', classification: 'INTERNAL', allowed_roles: [], allowed_plans: [], valid_from: null, valid_to: null, version: 9, checksum: 'x', status: 'published', created_by: 'b' }, []))
            .rejects.toMatchObject({ status: 403 });
        expect(ids(await knowledge.search(A, 'contrato Zafiro'))).toContain('doc-a');
    });

    it('el modo fts devuelve los mismos documentos que el modo completo para el corpus de evaluación', async () => {
        const { preguntas } = require('../fixtures/rag-eval/questions.json');
        const P = { userId: 'eval', tenantId: 'org:eval', roles: ['USER'], plan: 'business' };
        for (const p of preguntas) {
            delete process.env.KNOWLEDGE_RETRIEVAL;
            const completo = ids(await knowledge.search(P, p.q));
            process.env.KNOWLEDGE_RETRIEVAL = 'fts';
            const fts = ids(await knowledge.search(P, p.q));
            expect({ q: p.q, fts }).toEqual({ q: p.q, fts: completo });
        }
    });

    it('filas anteriores a la migración (tokens NULL) siguen encontrándose y reindexar las rellena', async () => {
        await pool.query("UPDATE knowledge_chunks SET tokens = NULL WHERE document_id = 'doc-a'");
        process.env.KNOWLEDGE_RETRIEVAL = 'fts';
        expect(ids(await knowledge.search(A, 'contrato Zafiro penalización'))).toContain('doc-a');
        expect(await store.reindexar()).toBeGreaterThan(0);
        const { rows } = await pool.query("SELECT count(*)::int n FROM knowledge_chunks WHERE tokens IS NULL");
        expect(rows[0].n).toBe(0);
        expect(ids(await knowledge.search(A, 'contrato Zafiro penalización'))).toContain('doc-a');
    });

    it('el prefiltro SQL usa el índice GIN y no carga el corpus entero', async () => {
        const { rows } = await pool.query(
            `EXPLAIN SELECT id FROM knowledge_chunks WHERE tsv @@ to_tsquery('simple', 'zafir | acme')`);
        // Con tablas diminutas Postgres puede preferir seq scan; se comprueba con el planificador forzado.
        await pool.query('SET enable_seqscan = off');
        const forzado = (await pool.query(`EXPLAIN SELECT id FROM knowledge_chunks WHERE tsv @@ to_tsquery('simple', 'zafir | acme')`)).rows.map((r) => r['QUERY PLAN']).join('\n');
        await pool.query('RESET enable_seqscan');
        expect(forzado).toMatch(/idx_knowledge_chunks_tsv/);
        expect(rows.length).toBeGreaterThan(0);
    });

    it('borrado efectivo: no queda ni en chunks', async () => {
        await knowledge.deleteDocument(A, 'doc-a');
        process.env.KNOWLEDGE_RETRIEVAL = 'fts';
        expect(await knowledge.search(A, 'contrato Zafiro penalización')).toEqual([]);
        const { rows } = await pool.query("SELECT count(*)::int n FROM knowledge_chunks WHERE document_id = 'doc-a'");
        expect(rows[0].n).toBe(0);
    });
});
