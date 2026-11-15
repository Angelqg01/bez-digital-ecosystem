'use strict';

/**
 * Embedder del Knowledge Plane. Convierte texto en un vector para la búsqueda semántica que se fusiona con BM25
 * (Reciprocal Rank Fusion en knowledge.service.js). Apagado por defecto: sin KNOWLEDGE_EMBEDDER el RAG es BM25 puro.
 *
 *   KNOWLEDGE_EMBEDDER=ollama
 *   OLLAMA_URL=http://127.0.0.1:11434          (el mismo Ollama que el chat)
 *   KNOWLEDGE_EMBED_MODEL=nomic-embed-text     (hay que tenerlo descargado: `ollama pull nomic-embed-text`)
 *
 * Contrato: `id` identifica modelo+prefijos (un vector sólo se compara con otro del mismo id), `embedDocument(texto)` y
 * `embedQuery(pregunta)` devuelven un vector unitario. Un fallo del servidor de embeddings NUNCA debe tumbar la
 * búsqueda: el servicio lo trata como «sin vector» y responde sólo con BM25.
 */

// Modelos que esperan un prefijo distinto para documentos y preguntas.
const PREFIJOS = {
    'nomic-embed-text': { query: 'search_query: ', document: 'search_document: ' },
};

function unitario(v) {
    let n = 0;
    for (const x of v) n += x * x;
    n = Math.sqrt(n);
    return n ? v.map((x) => x / n) : v;
}

class OllamaEmbedder {
    constructor({ url = 'http://127.0.0.1:11434', model, timeoutMs = 15000, cache = 200, prefijos, fetchImpl = globalThis.fetch } = {}) {
        if (!model) throw new Error('OllamaEmbedder: falta el modelo (KNOWLEDGE_EMBED_MODEL)');
        this.url = String(url).replace(/\/+$/, '');
        this.model = model;
        this.timeoutMs = timeoutMs;
        this.fetch = fetchImpl;
        const base = model.split(':')[0];
        this.prefijos = prefijos || PREFIJOS[base] || { query: '', document: '' };
        this.id = `ollama:${model}:${this.prefijos.query || this.prefijos.document ? 'pref' : 'raw'}`;
        this._cache = new Map();
        this._cacheMax = cache;
    }

    async _embed(entradas) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
        try {
            const r = await this.fetch(`${this.url}/api/embed`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ model: this.model, input: entradas }),
                signal: ctrl.signal,
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !Array.isArray(j.embeddings) || j.embeddings.length !== entradas.length) {
                throw new Error(`Ollama embed: ${j.error || `HTTP ${r.status}`}`);
            }
            return j.embeddings.map(unitario);
        } finally {
            clearTimeout(t);
        }
    }

    async embedDocument(texto) { return (await this._embed([this.prefijos.document + texto]))[0]; }

    /** Varios documentos en una sola llamada (ingesta y reindexado). */
    async embedDocuments(textos) { return this._embed(textos.map((x) => this.prefijos.document + x)); }

    /** Las preguntas se repiten mucho (chat, MCP): caché LRU pequeña para no pagar el modelo dos veces. */
    async embedQuery(pregunta) {
        const k = String(pregunta);
        if (this._cache.has(k)) { const v = this._cache.get(k); this._cache.delete(k); this._cache.set(k, v); return v; }
        const v = (await this._embed([this.prefijos.query + k]))[0];
        this._cache.set(k, v);
        if (this._cache.size > this._cacheMax) this._cache.delete(this._cache.keys().next().value);
        return v;
    }
}

/** @returns {OllamaEmbedder|null} null = búsqueda sólo léxica. */
function crearEmbedder(env = process.env) {
    const tipo = String(env.KNOWLEDGE_EMBEDDER || '').toLowerCase();
    if (!tipo || tipo === 'off' || tipo === 'none') return null;
    if (tipo === 'ollama') {
        return new OllamaEmbedder({
            url: env.OLLAMA_URL || undefined,
            model: env.KNOWLEDGE_EMBED_MODEL || 'nomic-embed-text',
            timeoutMs: Number(env.KNOWLEDGE_EMBED_TIMEOUT_MS) || undefined,
        });
    }
    throw new Error(`KNOWLEDGE_EMBEDDER desconocido: ${tipo} (valores: ollama, off)`);
}

module.exports = { OllamaEmbedder, crearEmbedder, unitario };
