process.env.KNOWLEDGE_STORE = 'memory';
process.env.KNOWLEDGE_TENANT_INGEST = 'true';
const { KnowledgeService, MemoryStore } = require('../../services/knowledge');
const { OllamaEmbedder, crearEmbedder } = require('../../services/knowledge/embedder');

const P = { userId: 'u', tenantId: 'org:t', roles: ['USER'], plan: 'business' };

/** Embedder de prueba: cada «concepto» es una dimensión; las palabras de un concepto activan esa dimensión. */
const CONCEPTOS = [
    ['precio', 'cuesta', 'coste', 'cost', 'price', 'tarifa', 'gratuito', 'free', 'tier'],
    ['staking', 'stake', 'recompensas', 'rewards', 'bloquear'],
    ['ruido', 'mongolia', 'capital'],
];
function vectorDe(texto) {
    const t = texto.toLowerCase();
    const v = CONCEPTOS.map((ws) => ws.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0));
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
}
const falso = (extra = {}) => ({
    id: 'fake:v1',
    embedDocument: async (x) => vectorDe(x),
    embedQuery: async (x) => vectorDe(x),
    ...extra,
});

async function conDocs(embedder) {
    const k = new KnowledgeService({ store: new MemoryStore(), embedder, vecMin: 0.55 });
    await k.ingest(P, { id: 'precios', title: 'Tarifas de la plataforma', content: 'El plan Starter tiene un precio de cero euros y se paga por uso.', classification: 'INTERNAL' });
    await k.ingest(P, { id: 'staking', title: 'Staking de BEZ', content: 'Puedes bloquear BEZ para obtener recompensas semanales.', classification: 'INTERNAL' });
    return k;
}
const ids = (r) => r.map((c) => c.document_id);

describe('búsqueda híbrida BM25 + vectores', () => {
    it('sin embedder se comporta como siempre: una paráfrasis sin términos en común no encuentra nada', async () => {
        const k = await conDocs(null);
        expect(await k.search(P, 'how much does the free tier cost')).toEqual([]);
    });

    it('con embedder encuentra la paráfrasis (otro idioma) que BM25 no ve', async () => {
        const k = await conDocs(falso());
        const r = await k.search(P, 'how much does the free tier cost');
        expect(ids(r)[0]).toBe('precios');
        expect(r[0].cobertura).toBeGreaterThanOrEqual(0.55);
    });

    it('se sigue abstiendo: una pregunta sin relación no devuelve «el vecino más cercano»', async () => {
        const k = await conDocs(falso());
        expect(await k.search(P, 'capital de Mongolia')).toEqual([]);
    });

    it('los aciertos léxicos siguen funcionando y no se duplican con los semánticos', async () => {
        const k = await conDocs(falso());
        const r = await k.search(P, 'recompensas del staking');
        expect(ids(r)[0]).toBe('staking');
        expect(new Set(ids(r)).size).toBe(ids(r).length);
    });

    it('si el embedder falla, la búsqueda responde con BM25 y no lanza', async () => {
        const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const k = await conDocs(falso({ embedQuery: async () => { throw new Error('servidor caído'); } }));
        expect(ids(await k.search(P, 'recompensas del staking'))[0]).toBe('staking');
        expect(aviso).toHaveBeenCalledTimes(1);
        aviso.mockRestore();
    });

    it('si el embedder falla al ingerir, el documento se indexa igualmente sin vector', async () => {
        const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const k = new KnowledgeService({ store: new MemoryStore(), embedder: falso({ embedDocument: async () => { throw new Error('caído'); } }) });
        await k.ingest(P, { id: 'd', title: 'Tarifas', content: 'El precio del plan Starter es cero.', classification: 'INTERNAL' });
        expect(ids(await k.search(P, 'precio Starter'))).toEqual(['d']);
        aviso.mockRestore();
    });

    it('ignora los vectores de otro modelo o de otra dimensión', async () => {
        const k = await conDocs(falso());
        for (const c of k.store.chunks.values()) c.embedding_model = 'otro:modelo';
        expect(await k.search(P, 'how much does the free tier cost')).toEqual([]);
        for (const c of k.store.chunks.values()) { c.embedding_model = 'fake:v1'; c.embedding = [1, 0]; }
        expect(await k.search(P, 'how much does the free tier cost')).toEqual([]);
    });

    it('respeta la ACL: el vector de un tenant ajeno no entra', async () => {
        const k = await conDocs(falso());
        const otro = { userId: 'x', tenantId: 'org:otro', roles: ['USER'], plan: 'business' };
        expect(await k.search(otro, 'how much does the free tier cost')).toEqual([]);
    });
});

describe('OllamaEmbedder', () => {
    const respuesta = (embeddings, ok = true) => async () => ({ ok, status: ok ? 200 : 500, json: async () => (ok ? { embeddings } : { error: 'sin modelo' }) });

    it('devuelve vectores unitarios y envía el modelo y la entrada', async () => {
        const fetchImpl = jest.fn(respuesta([[3, 4]]));
        const e = new OllamaEmbedder({ model: 'bge-m3', fetchImpl });
        const v = await e.embedDocument('hola');
        expect(v).toEqual([0.6, 0.8]);
        expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ model: 'bge-m3', input: ['hola'] });
        expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/embed');
    });

    it('nomic-embed-text lleva prefijos distintos para preguntas y documentos', async () => {
        const fetchImpl = jest.fn(respuesta([[1, 0]]));
        const e = new OllamaEmbedder({ model: 'nomic-embed-text', fetchImpl });
        await e.embedQuery('¿precio?');
        await e.embedDocument('El precio');
        expect(JSON.parse(fetchImpl.mock.calls[0][1].body).input[0]).toBe('search_query: ¿precio?');
        expect(JSON.parse(fetchImpl.mock.calls[1][1].body).input[0]).toBe('search_document: El precio');
        expect(e.id).toContain('nomic-embed-text');
    });

    it('cachea las preguntas repetidas', async () => {
        const fetchImpl = jest.fn(respuesta([[1, 0]]));
        const e = new OllamaEmbedder({ model: 'm', fetchImpl });
        await e.embedQuery('misma'); await e.embedQuery('misma');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('un error del servidor lanza (el servicio lo degrada a BM25)', async () => {
        const e = new OllamaEmbedder({ model: 'm', fetchImpl: respuesta(null, false) });
        await expect(e.embedQuery('x')).rejects.toThrow(/sin modelo/);
    });

    it('un número de vectores distinto al de entradas se rechaza', async () => {
        const e = new OllamaEmbedder({ model: 'm', fetchImpl: respuesta([[1, 0]]) });
        await expect(e.embedDocuments(['a', 'b'])).rejects.toThrow();
    });
});

describe('crearEmbedder', () => {
    it('está apagado por defecto', () => {
        expect(crearEmbedder({})).toBeNull();
        expect(crearEmbedder({ KNOWLEDGE_EMBEDDER: 'off' })).toBeNull();
    });
    it('ollama usa nomic-embed-text si no se indica modelo', () => {
        expect(crearEmbedder({ KNOWLEDGE_EMBEDDER: 'ollama' }).model).toBe('nomic-embed-text');
    });
    it('un valor desconocido falla en el arranque en vez de ignorarse', () => {
        expect(() => crearEmbedder({ KNOWLEDGE_EMBEDDER: 'openia' })).toThrow(/desconocido/);
    });
});
