'use strict';

/**
 * KnowledgeBase — base de conocimiento por tenant para RAG de Soporte.
 *
 * Cada empresa cliente sube sus artículos (FAQ, manuales) y los agentes
 * recuperan los más relevantes para fundamentar la respuesta.
 *
 * Recuperación HÍBRIDA:
 *   - Con `embedder` (Ollama/pgvector): similitud semántica por coseno.
 *   - Sin embedder: solapamiento de términos (determinista, sin infraestructura).
 * El contrato (ingest/search) es idéntico en ambos casos, así que activar embeddings
 * reales es solo inyectar el embedder; nada más cambia.
 */
class KnowledgeBase {
  /**
   * @param {object} opts
   * @param {string} opts.tenantId
   * @param {object} opts.store    - backend de persistencia (opcional)
   * @param {function} opts.embedder - async (text) => number[] (opcional, p.ej. OllamaProvider.embed)
   */
  constructor({ tenantId, store = null, embedder = null } = {}) {
    this.tenantId = tenantId;
    this.backend = store;     // para persistir en producción (hoy, en memoria)
    this.embedder = embedder; // si existe → recuperación semántica
    this._articles = [];
    // Índice invertido `token -> Set<idx>` para la ruta por términos.
    // Se construye perezosamente en la primera búsqueda por encima del umbral
    // y se invalida al ingerir. Por debajo del umbral, el escaneo lineal es
    // más barato que mantener el índice — medido: cruce en ~5k artículos
    // (`bench/kb-search.bench.js`).
    this._invIndex = null;
  }

  get size() { return this._articles.length; }
  get semantic() { return !!this.embedder; }

  /**
   * Carga los artículos persistidos del tenant (fact `kb:articles`).
   * Llamar tras aprovisionar el tenant; sin backend no hace nada.
   */
  async hydrate() {
    if (!this.backend?.getFact) return 0;
    const saved = await this.backend.getFact({ tenantId: this.tenantId, key: 'kb:articles' });
    if (Array.isArray(saved)) {
      // Los tokens (Set) no sobreviven al JSON: se reconstruyen al cargar.
      this._articles = saved.map((a) => ({
        ...a,
        tokens: KnowledgeBase._tokens(`${a.title} ${a.body} ${(a.tags || []).join(' ')}`),
      }));
    }
    // Backfill: artículos ingeridos cuando no había embedder (o cuyo embed
    // falló) reciben su vector ahora. Best-effort y persistido.
    if (this.embedder && this._articles.some((a) => !a.embedding)) {
      let filled = 0;
      for (const a of this._articles) {
        if (a.embedding) continue;
        a.embedding = await this._embed(`${a.title} ${a.body} ${(a.tags || []).join(' ')}`);
        if (a.embedding) filled++;
      }
      if (filled) await this._persist();
    }
    return this._articles.length;
  }

  /** Embedding con un reintento y aviso (nunca rompe el flujo). */
  async _embed(text) {
    if (!this.embedder) return null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { return await this.embedder(text); } catch (err) {
        if (attempt === 2) console.warn(`[kb:${this.tenantId}] embedding falló (${err.message}); uso términos`);
      }
    }
    return null;
  }

  /** Persiste el estado completo de la KB como fact del tenant (best-effort). */
  async _persist() {
    if (!this.backend?.setFact) return;
    try {
      const raw = this._articles.map(({ tokens, ...rest }) => rest);
      await this.backend.setFact({ tenantId: this.tenantId, key: 'kb:articles', value: raw });
    } catch (err) {
      console.warn(`[kb:${this.tenantId}] no se pudo persistir: ${err.message}`);
    }
  }

  /** Indexa un artículo. Devuelve su id. */
  async ingest({ id, title = '', body = '', tags = [] } = {}) {
    const text = `${title} ${body} ${tags.join(' ')}`;
    const article = {
      id: id || `kb_${this._articles.length + 1}`,
      title,
      body,
      tags,
      tokens: KnowledgeBase._tokens(text),
      embedding: null,
    };
    article.embedding = await this._embed(text); // null si no hay embedder o falla
    this._articles.push(article);
    this._invIndex = null;   // invalidar índice: se reconstruirá si toca
    await this._persist();
    return article.id;
  }

  /** Umbral a partir del cual el índice invertido gana al escaneo lineal. */
  static INVERTED_INDEX_MIN = 2000;

  /** Construye `token -> Set<idx>` para búsqueda O(|q| + hits). */
  _buildInvertedIndex() {
    const idx = new Map();
    for (let i = 0; i < this._articles.length; i++) {
      for (const t of this._articles[i].tokens) {
        let set = idx.get(t);
        if (!set) { set = new Set(); idx.set(t, set); }
        set.add(i);
      }
    }
    this._invIndex = idx;
  }

  /**
   * Devuelve los k artículos más relevantes para la consulta.
   * @returns {Array<{id,title,snippet,score}>}
   */
  async search(query, { k = 3 } = {}) {
    // Vía semántica: si hay embedder y al menos un artículo con vector.
    if (this.embedder && this._articles.some((a) => a.embedding)) {
      const qv = await this._embed(query); // con reintento; null → cae a términos
      if (qv) {
        return this._articles
          .filter((a) => a.embedding)
          .map((a) => ({ id: a.id, title: a.title, snippet: a.body.slice(0, 140), score: KnowledgeBase._cosine(qv, a.embedding) }))
          .filter((s) => s.score > 0.15)   // umbral mínimo de relevancia
          .sort((x, y) => y.score - x.score)
          .slice(0, k);
      }
    }

    // Fallback: solapamiento de términos.
    const q = KnowledgeBase._tokens(query);
    if (!q.size) return [];

    // A partir del umbral (medido en bench/kb-search.bench.js), el escaneo
    // lineal cruza los 5 ms p95; el índice invertido reduce el trabajo a
    // "artículos que contienen al menos un término de la consulta".
    if (this._articles.length >= KnowledgeBase.INVERTED_INDEX_MIN) {
      if (!this._invIndex) this._buildInvertedIndex();
      const scores = new Map();   // idx -> score
      for (const t of q) {
        const postings = this._invIndex.get(t);
        if (!postings) continue;
        for (const idx of postings) scores.set(idx, (scores.get(idx) || 0) + 1);
      }
      if (!scores.size) return [];
      const arr = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map(([idx, score]) => {
          const a = this._articles[idx];
          return { id: a.id, title: a.title, snippet: a.body.slice(0, 140), score };
        });
      return arr;
    }

    return this._articles
      .map((a) => {
        let score = 0;
        for (const t of q) if (a.tokens.has(t)) score++;
        return { id: a.id, title: a.title, snippet: a.body.slice(0, 140), score };
      })
      .filter((s) => s.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, k);
  }

  /** Tokeniza a un conjunto de términos (minúsculas, sin palabras muy cortas). */
  static _tokens(s) {
    return new Set((String(s).toLowerCase().match(/[a-záéíóúñü0-9]+/g) || []).filter((w) => w.length > 2));
  }

  /** Similitud de coseno entre dos vectores. */
  static _cosine(a, b) {
    const n = Math.min(a.length, b.length);
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
}

module.exports = KnowledgeBase;
