jest.mock('chromadb', () => ({ ChromaClient: class {} }));

describe('RAG: caché de consultas', () => {
    test('la misma consulta paga una sola búsqueda y indexar la invalida', async () => {
        const rag = require('../services/rag.service');
        let queries = 0;
        const collection = {
            query: async () => { queries++; return { documents: [['doc']], distances: [[0.1]], metadatas: [[{}]] }; },
            upsert: async () => {},
        };
        rag.initialized = true;
        rag.collections = { bezhas_platform: collection };

        await Promise.all([rag.retrieveContext('hola'), rag.retrieveContext('hola')]);
        await rag.retrieveContext('hola');
        expect(queries).toBe(1);

        await rag.indexPlatformKnowledge({ id: 'd1', title: 't', content: 'c' });
        await rag.retrieveContext('hola');
        expect(queries).toBe(2);
    });

    test('sin inicializar no cachea el error', async () => {
        jest.resetModules();
        const rag = require('../services/rag.service');
        const r = await rag.retrieveContext('x');
        expect(r.error).toBe('RAG not initialized');
        expect(rag.queryCache.size).toBe(0);
    });
});
