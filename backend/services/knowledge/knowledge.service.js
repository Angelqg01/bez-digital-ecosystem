/**
 * BeZhas Knowledge Plane — RAG con aislamiento por tenant.
 *
 * Flujo de recuperación (ver BEZHAS-AI-RAG-CHAT-AGENT-PLATFORM-PLAN §6.4):
 *   principal → filtro ACL (ANTES de rankear) → BM25 [+ vector con RRF]
 *   → segunda comprobación ACL → neutralización → contexto con citas.
 */
const crypto = require('crypto');
const { CLASSIFICATIONS, canAccess, isAdmin } = require('./acl');
const { chunkText } = require('./chunker');
const { scan, neutralize } = require('./injectionGuard');
const { bm25Rank } = require('./bm25');
const { MemoryStore } = require('./store');

const MAX_DOC_CHARS = 200_000;
const MAX_TOP_K = 8;
const MIN_RELATIVE_SCORE = 0.5;

const sha256 = (s) => `sha256:${crypto.createHash('sha256').update(s).digest('hex')}`;
const cosine = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

class KnowledgeService {
    /** @param {{store?: MemoryStore, embedder?: {embed(text:string):Promise<number[]>}}} opts */
    constructor({ store = new MemoryStore(), embedder = null } = {}) {
        this.store = store;
        this.embedder = embedder;
    }

    /**
     * Ingesta un documento. `tenantId` lo fija el servidor desde el principal;
     * tenantId === null solo es válido para conocimiento global PUBLIC (admin).
     */
    async ingest(principal, input) {
        const { title, content, classification = CLASSIFICATIONS.INTERNAL, source = 'upload', category = 'general' } = input || {};
        const global = input && input.global === true;

        if (!principal) throw httpError(401, 'No autenticado');
        if (!title || typeof content !== 'string' || !content.trim()) throw httpError(400, 'title y content son obligatorios');
        if (content.length > MAX_DOC_CHARS) throw httpError(413, 'Documento demasiado grande');
        if (!Object.values(CLASSIFICATIONS).includes(classification)) throw httpError(400, 'classification inválida');
        if (classification === CLASSIFICATIONS.SECRET) throw httpError(422, 'Los documentos SECRET no se indexan en RAG');

        if (global) {
            if (!isAdmin(principal)) throw httpError(403, 'Solo un admin puede publicar conocimiento global');
            if (classification !== CLASSIFICATIONS.PUBLIC) throw httpError(422, 'El conocimiento global debe ser PUBLIC');
        }

        const tenantId = global ? null : principal.tenantId;
        const scanResult = scan(`${title}\n${content}`);
        const id = input.id && /^[\w.-]{1,80}$/.test(input.id) ? input.id : `doc_${crypto.randomUUID()}`;

        const existing = this.store.getDoc(id);
        if (existing && existing.tenant_id !== tenantId) throw httpError(403, 'El documento pertenece a otro tenant');

        const doc = {
            id,
            tenant_id: tenantId,
            title: String(title).slice(0, 200),
            source,
            category,
            classification,
            allowed_roles: input.allowed_roles || [],
            allowed_plans: input.allowed_plans || [],
            valid_from: input.valid_from || null,
            valid_to: input.valid_to || null,
            version: existing ? existing.version + 1 : 1,
            checksum: sha256(content),
            // Documentos con instrucciones sospechosas quedan en cuarentena (no recuperables).
            status: scanResult.suspicious ? 'quarantined' : 'published',
            quarantine_reason: scanResult.suspicious ? scanResult.hits : undefined,
            created_by: principal.userId,
            updated_at: new Date().toISOString(),
        };

        const chunks = [];
        for (const [i, part] of chunkText(content).entries()) {
            const chunk = {
                id: `${id}#${doc.version}#${i}`,
                document_id: id,
                chunk_index: i,
                content: part.content,
                section: part.section,
                title: doc.title,
                tenant_id: doc.tenant_id,
                classification,
                allowed_roles: doc.allowed_roles,
                allowed_plans: doc.allowed_plans,
                valid_from: doc.valid_from,
                valid_to: doc.valid_to,
                version: doc.version,
                status: doc.status,
                checksum: sha256(part.content),
            };
            if (this.embedder && doc.status === 'published') chunk.embedding = await this.embedder.embed(part.content);
            chunks.push(chunk);
        }

        this.store.putDocument(doc, chunks);
        return { id, version: doc.version, status: doc.status, chunks: chunks.length, quarantine_reason: doc.quarantine_reason };
    }

    /** Busca solo en lo que el principal puede ver. */
    async search(principal, query, { topK = 4 } = {}) {
        if (!principal || !query) return [];
        const k = Math.min(Math.max(1, topK), MAX_TOP_K);

        // 1) ACL ANTES de rankear.
        const allowed = this.store.allChunks().filter((c) => canAccess(principal, c));
        if (!allowed.length) return [];

        // 2) BM25 (+ vector con Reciprocal Rank Fusion si hay embedder).
        // Se descartan resultados claramente menos relevantes que el mejor (evita que una palabra
        // común, p. ej. "BEZ", arrastre documentos que no tienen que ver con la pregunta).
        const scored = bm25Rank(query, allowed);
        const floor = scored.length ? scored[0].score * MIN_RELATIVE_SCORE : 0;
        let ranked = scored.filter((r) => r.score >= floor).map((r) => r.chunk);
        if (this.embedder) {
            const qv = await this.embedder.embed(query);
            const vec = allowed
                .filter((c) => Array.isArray(c.embedding))
                .map((c) => ({ c, s: cosine(qv, c.embedding) }))
                .sort((a, b) => b.s - a.s)
                .map((x) => x.c);
            const rrf = new Map();
            [ranked, vec].forEach((list) => list.forEach((c, i) => rrf.set(c.id, (rrf.get(c.id) || 0) + 1 / (60 + i))));
            const byId = new Map(allowed.map((c) => [c.id, c]));
            ranked = [...rrf.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id));
        }

        // 3) Segunda comprobación contra el documento vigente (versión/estado/ACL).
        const out = [];
        for (const c of ranked) {
            const doc = this.store.getDoc(c.document_id);
            if (!doc || doc.version !== c.version || !canAccess(principal, doc) || !canAccess(principal, c)) continue;
            out.push(c);
            if (out.length >= k) break;
        }
        return out;
    }

    /**
     * Construye el bloque de contexto para el LLM (datos NO confiables) y las citas.
     */
    async buildContext(principal, query, opts) {
        const chunks = await this.search(principal, query, opts);
        const sources = chunks.map((c, i) => ({
            ref: i + 1,
            document_id: c.document_id,
            title: c.title,
            section: c.section || null,
            version: c.version,
            classification: c.classification,
        }));
        const context = chunks
            .map((c, i) => `<untrusted_document ref="${i + 1}" title="${escapeAttr(c.title)}" version="${c.version}">\n${neutralize(c.content)}\n</untrusted_document>`)
            .join('\n');
        return { context, sources };
    }

    listDocuments(principal) {
        return this.store.listDocs()
            .filter((d) => d.status === 'published' ? canAccess(principal, d) : d.tenant_id === principal.tenantId)
            .map(({ id, title, classification, version, status, updated_at, tenant_id }) => ({
                id, title, classification, version, status, updated_at, scope: tenant_id ? 'tenant' : 'global',
            }));
    }

    deleteDocument(principal, id) {
        const doc = this.store.getDoc(id);
        if (!doc) throw httpError(404, 'Documento no encontrado');
        const owns = doc.tenant_id ? doc.tenant_id === principal.tenantId : isAdmin(principal);
        if (!owns) throw httpError(403, 'Sin permiso');
        return this.store.removeDocument(id);
    }
}

function escapeAttr(s) { return String(s).replace(/[<>"&]/g, ''); }
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

module.exports = { KnowledgeService, httpError };
