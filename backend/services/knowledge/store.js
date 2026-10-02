/**
 * Almacén local del Knowledge Plane (documentos + chunks).
 * Memoria con persistencia JSON opcional (KNOWLEDGE_STORE_PATH) para desarrollo local.
 * La interfaz es mínima para poder sustituirla por pgvector sin tocar el servicio.
 */
const fs = require('fs');
const path = require('path');

class MemoryStore {
    constructor({ filePath = process.env.KNOWLEDGE_STORE_PATH || null } = {}) {
        this.filePath = filePath;
        this.docs = new Map();   // docId -> doc meta
        this.chunks = new Map(); // chunkId -> { ...meta, content, embedding? }
        this._load();
    }

    _load() {
        if (!this.filePath || !fs.existsSync(this.filePath)) return;
        try {
            const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            (raw.docs || []).forEach((d) => this.docs.set(d.id, d));
            (raw.chunks || []).forEach((c) => this.chunks.set(c.id, c));
        } catch (e) {
            console.warn('⚠️ Knowledge store ilegible, se inicia vacío:', e.message);
        }
    }

    _persist() {
        if (!this.filePath) return;
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        const tmp = `${this.filePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ docs: [...this.docs.values()], chunks: [...this.chunks.values()] }));
        fs.renameSync(tmp, this.filePath);
    }

    getDoc(id) { return this.docs.get(id) || null; }
    listDocs() { return [...this.docs.values()]; }
    allChunks() { return [...this.chunks.values()]; }
    size() { return this.docs.size; }

    /** Reemplaza atómicamente un documento y sus chunks. */
    putDocument(doc, chunks) {
        this.removeDocument(doc.id, { persist: false });
        this.docs.set(doc.id, doc);
        chunks.forEach((c) => this.chunks.set(c.id, c));
        this._persist();
    }

    removeDocument(id, { persist = true } = {}) {
        const existed = this.docs.delete(id);
        for (const [cid, c] of this.chunks) if (c.document_id === id) this.chunks.delete(cid);
        if (persist) this._persist();
        return existed;
    }
}

module.exports = { MemoryStore };
