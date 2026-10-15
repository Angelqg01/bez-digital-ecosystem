/**
 * Puerta de regresión del retrieval: la evaluación sobre el corpus etiquetado no puede bajar del baseline
 * (docs/audit/RAG-TEST-BASELINE.md). Si se añaden documentos al seed o se cambia el ranking y esto falla, hay que
 * mirar qué preguntas se rompieron (`node scripts/rag-eval.js`) antes de bajar el umbral.
 */
const { evaluar } = require('../../scripts/rag-eval');

describe('evaluación del retrieval (BM25)', () => {
    let r;
    beforeAll(async () => { r = await evaluar(); });

    it('recall@4 no baja del baseline', () => expect(r.recall_at_k).toBeGreaterThanOrEqual(0.95));
    it('preguntas en español (directas, paráfrasis, exactas): recall 100 %', () => {
        for (const t of ['directa', 'parafrasis', 'exacta']) expect(r.por_tipo[t].recall).toBe(1);
    });
    it('sin respuesta: o se abstiene o la coincidencia es débil (el chat lo avisa)', () => expect(r.abstencion_o_debil).toBe(1));
    it('la latencia del retrieval es de milisegundos', () => expect(r.latencia_ms.p95).toBeLessThan(100));
});
