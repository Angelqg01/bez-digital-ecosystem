'use strict';
const BaseConnector = require('./BaseConnector');

/**
 * VectorDB — conector para búsquedas semánticas y almacenamiento vectorial.
 * Aísla la información por tenant (namespace/filtro de tenant).
 */
class VectorDB extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'vectordb';
    this.embedder = config.embedder || null;
    this.store = config.store || null;
    this._initialized = false;

    if (!globalThis._vectorDbStorage) {
      globalThis._vectorDbStorage = new Map(); // tenantId -> articles[]
    }
    this.storage = globalThis._vectorDbStorage;
    if (!this.storage.has(this.tenantId)) {
      this.storage.set(this.tenantId, []);
    }
  }

  async execute(method, args = {}) {
    await this._init();
    switch (method) {
      case 'upsert': return this.upsert(args);
      case 'search': return this.search(args);
      default: throw new Error(`vectordb: método desconocido ${method}`);
    }
  }

  async _init() {
    if (this._initialized) return;
    this._initialized = true;
    if (this.store?.getFact) {
      try {
        const saved = await this.store.getFact({ tenantId: this.tenantId, key: 'vectordb:articles' });
        if (Array.isArray(saved)) {
          this.storage.set(this.tenantId, saved.map(a => ({
            ...a,
            tokens: new Set((String(`${a.title} ${a.body} ${(a.tags || []).join(' ')}`).toLowerCase().match(/[a-záéíóúñü0-9]+/g) || []).filter((w) => w.length > 2))
          })));
        }
      } catch (err) {
        console.warn(`[vectordb:${this.tenantId}] error cargando artículos: ${err.message}`);
      }
    }
  }

  async upsert({ id, title = '', body = '', tags = [] } = {}) {
    const text = `${title} ${body} ${tags.join(' ')}`;
    const articles = this.storage.get(this.tenantId);
    
    let embedding = null;
    if (this.embedder) {
      try { embedding = await this.embedder(text); } catch (e) { /* ignore */ }
    }

    const doc = {
      id: id || `doc_${articles.length + 1}`,
      title,
      body,
      tags,
      embedding,
      tokens: new Set((String(text).toLowerCase().match(/[a-záéíóúñü0-9]+/g) || []).filter((w) => w.length > 2))
    };

    articles.push(doc);

    if (this.store?.setFact) {
      try {
        const raw = articles.map(({ tokens, ...rest }) => rest);
        await this.store.setFact({ tenantId: this.tenantId, key: 'vectordb:articles', value: raw });
      } catch (err) {
        console.warn(`[vectordb:${this.tenantId}] error guardando artículos: ${err.message}`);
      }
    }
    return doc.id;
  }

  async search({ query, k = 3 } = {}) {
    const articles = this.storage.get(this.tenantId);
    if (!articles || articles.length === 0) return [];

    let qv = null;
    if (this.embedder) {
      try { qv = await this.embedder(query); } catch (e) { /* ignore */ }
    }

    if (qv && articles.some(a => a.embedding)) {
      return articles
        .filter(a => a.embedding)
        .map(a => ({
          id: a.id,
          title: a.title,
          snippet: a.body.slice(0, 140),
          score: VectorDB._cosine(qv, a.embedding)
        }))
        .filter(s => s.score > 0.15)
        .sort((x, y) => y.score - x.score)
        .slice(0, k);
    }

    // Fallback por términos
    const qTokens = new Set((String(query).toLowerCase().match(/[a-záéíóúñü0-9]+/g) || []).filter((w) => w.length > 2));
    if (!qTokens.size) return [];

    return articles
      .map(a => {
        let score = 0;
        for (const t of qTokens) {
          if (a.tokens.has(t)) score++;
        }
        return {
          id: a.id,
          title: a.title,
          snippet: a.body.slice(0, 140),
          score
        };
      })
      .filter(s => s.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, k);
  }

  static _cosine(a, b) {
    const n = Math.min(a.length, b.length);
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
}

module.exports = VectorDB;
