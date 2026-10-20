/**
 * Puerta de regresión del retrieval: la evaluación sobre el corpus etiquetado no puede bajar del baseline
 * (docs/audit/RAG-TEST-BASELINE.md). Si se añaden documentos al seed o se cambia el ranking y esto falla, hay que
 * mirar qué preguntas se rompieron (`node scripts/rag-eval.js`) antes de bajar el umbral.
 */
const { evaluar } = require('../../scripts/rag-eval');

describe('evaluación del retrieval (BM25)', () => {
    let r;
    beforeAll(async () => { r = await evaluar(); });

    it('recall@4 no baja del baseline', () => expect(r.recall_at_k).toBeGreaterThanOrEqual(0.97));
    it('preguntas en español (directas, paráfrasis, exactas): recall 100 %', () => {
        for (const t of ['directa', 'parafrasis', 'exacta']) expect(r.por_tipo[t].recall).toBe(1);
    });
    it('sin respuesta: o se abstiene o la coincidencia es débil (el chat lo avisa)', () => expect(r.abstencion_o_debil).toBe(1));
    it('preguntas de precio (cuesta, coste, tarifa, vale): recall 100 %', () => expect(r.por_tipo.precio.recall).toBe(1));
    it('top-1 no baja del baseline (0,84 tras arreglar la raíz de los plurales en «-es»)', () => expect(r.top1).toBeGreaterThanOrEqual(0.84));
    it('preguntas en inglés (glosario inglés → español del BM25): recall 100 %', () => expect(r.por_tipo.english.recall).toBe(1));
    it('preguntas sobre las SubApps (notas públicas del vault): recall 100 %', () => expect(r.por_tipo.subapps.recall).toBe(1));
    it('las 11 preguntas del CTO energético (informe docs/audit/informe-energia): recall 100 %', () => expect(r.por_tipo.cto_energia.recall).toBe(1));
    it('«¿Cuánto cuestan los planes?» ya no sale como coincidencia débil (el chat decía «no estoy seguro»)', async () => {
        const { KnowledgeService, MemoryStore } = require('../../services/knowledge');
        const { seedPublicKnowledge } = require('../../services/knowledge/seed');
        const k = new KnowledgeService({ store: new MemoryStore() });
        await seedPublicKnowledge(k);
        const P = { userId: 'a', tenantId: 'public', roles: ['ANON'], plan: 'none' };
        const q1 = await k.search(P, '¿Cuánto cuestan los planes de BeZhas?');
        expect({ doc: q1[0].document_id, debil: q1[0].cobertura < 0.5 }).toEqual({ doc: 'bz_planes', debil: false });
        // Con «plan Business» otro documento corto que también habla de planes puede salir primero: lo que se exige es que
        // el de planes y precios esté en el contexto y que la coincidencia no se marque como débil.
        const q2 = await k.search(P, '¿Cuánto cuesta el plan Business?');
        expect(q2.map((c) => c.document_id)).toContain('bz_planes');
        expect(Math.max(...q2.map((c) => c.cobertura))).toBeGreaterThanOrEqual(0.5);
    });
    it('la latencia del retrieval es de milisegundos', () => expect(r.latencia_ms.p95).toBeLessThan(100));
});
