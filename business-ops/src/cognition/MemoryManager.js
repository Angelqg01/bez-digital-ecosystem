'use strict';

/**
 * MemoryManager — los tres niveles de memoria, scoped por tenant.
 *
 *  - corto plazo : conversación activa (en RAM / Redis)
 *  - episódica   : todas las interacciones, buscables por similitud (vector DB)
 *  - semántica   : perfiles/hechos acumulados (Postgres)
 *
 * Esta implementación es un stub funcional en memoria. En producción:
 *  store.vector → pgvector / Pinecone / Qdrant ; store.db → Postgres.
 */
class MemoryManager {
  constructor({ tenantId, store = null, embedder = null } = {}) {
    this.tenantId = tenantId;
    this.backend = store; // data store (Postgres/vector DB)
    this.embedder = embedder; // embedder opcional para RAG
    this._episodic = [];          // [{agentId, summary, embedding, ...}]
    this._semantic = new Map();   // key -> hechos
    this._shortTerm = new Map();  // conversationId -> [messages]
  }

  async connect() { if (this.backend?.connect) await this.backend.connect(); return true; }
  async disconnect() { if (this.backend?.disconnect) await this.backend.disconnect(); return true; }

  // ── Corto plazo ──
  getConversation(id) {
    if (!this._shortTerm.has(id)) this._shortTerm.set(id, []);
    return this._shortTerm.get(id);
  }
  appendMessage(id, role, content) {
    const c = this.getConversation(id);
    c.push({ role, content, at: Date.now() });
    if (c.length > 20) c.splice(0, c.length - 20);
  }

  // ── Episódica (aprendizaje) ──
  async store(interaction) {
    let embedding = interaction.embedding || null;
    if (!embedding && this.embedder && interaction.summary) {
      try {
        embedding = await this.embedder(interaction.summary);
      } catch (err) {
        // ignore embedder errors
      }
    }

    if (this.backend?.saveInteraction) {
      return this.backend.saveInteraction({ tenantId: this.tenantId, ...interaction, embedding });
    }
    this._episodic.push({ tenantId: this.tenantId, at: Date.now(), ...interaction, embedding });
    return true;
  }

  /**
   * Recupera casos pasados relevantes (RAG). Sin backend: filtra por agente y
   * devuelve los más recientes. Con backend: delega (similitud de embeddings).
   */
  async recall(query, { agentId, k = 5 } = {}) {
    let embedding = null;
    if (query && this.embedder) {
      try {
        embedding = await this.embedder(query);
      } catch (err) {
        // ignore embedder errors
      }
    }

    if (this.backend?.recallInteractions) {
      return this.backend.recallInteractions({ tenantId: this.tenantId, agentId, embedding, k });
    }

    const list = this._episodic
      .filter(e => !agentId || e.agentId === agentId);

    if (embedding && list.some(e => e.embedding)) {
      // Siempre se devuelven los k más similares, sin umbral duro: un umbral
      // (p.ej. 0.15) puede dejar menos de k resultados aunque haya casos
      // disponibles — el score ya viaja en cada resultado para que quien
      // consuma esto pueda descartar los de relevancia baja si quiere.
      return list
        .filter(e => e.embedding)
        .map(e => ({
          ...e,
          score: MemoryManager._cosine(embedding, e.embedding)
        }))
        .sort((x, y) => y.score - x.score)
        .slice(0, k);
    }

    return list
      .slice(-k)
      .reverse();
  }

  static _cosine(a, b) {
    const n = Math.min(a.length, b.length);
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // ── Semántica (perfiles) ──
  async setFact(key, value) {
    if (this.backend?.setFact) return this.backend.setFact({ tenantId: this.tenantId, key, value });
    this._semantic.set(key, value);
  }
  async getFact(key) {
    if (this.backend?.getFact) return this.backend.getFact({ tenantId: this.tenantId, key });
    return this._semantic.get(key) || null;
  }
}

module.exports = MemoryManager;
