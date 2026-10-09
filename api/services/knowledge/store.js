'use strict';

/**
 * Almacén del Knowledge Plane (documentos + chunks).
 *
 *   PgStore     → producción: Cloud SQL (migración 062). Persiste entre
 *                 reinicios y lo comparten todas las instancias de Cloud Run.
 *   MemoryStore → tests y desarrollo sin base de datos.
 *
 * Interfaz asíncrona y mínima. `chunksVisibles(tenantId)` ya recorta por
 * tenant en SQL (global + el propio); la ACL fina se sigue evaluando en el
 * servicio, antes de rankear y otra vez antes de entregar.
 */

const DOC_COLS = ['id', 'tenant_id', 'title', 'source', 'category', 'classification', 'allowed_roles', 'allowed_plans',
    'valid_from', 'valid_to', 'version', 'checksum', 'status', 'quarantine_reason', 'created_by', 'updated_at'];

class MemoryStore {
    constructor() {
        this.docs = new Map();
        this.chunks = new Map();
    }

    async getDoc(id) { return this.docs.get(id) || null; }

    async listDocs(tenantId) {
        return [...this.docs.values()].filter((d) => d.tenant_id === null || d.tenant_id === tenantId);
    }

    async chunksVisibles(tenantId) {
        return [...this.chunks.values()].filter((c) => c.tenant_id === null || c.tenant_id === tenantId);
    }

    async putDocument(doc, chunks) {
        await this.removeDocument(doc.id);
        this.docs.set(doc.id, doc);
        chunks.forEach((c) => this.chunks.set(c.id, c));
    }

    async removeDocument(id) {
        const existed = this.docs.delete(id);
        for (const [cid, c] of this.chunks) if (c.document_id === id) this.chunks.delete(cid);
        return existed;
    }

    async size() { return this.docs.size; }
}

const jsonOrEmpty = (v) => JSON.stringify(Array.isArray(v) ? v : []);

function filaADoc(r) {
    return {
        ...r,
        allowed_roles: r.allowed_roles || [],
        allowed_plans: r.allowed_plans || [],
        valid_from: r.valid_from ? new Date(r.valid_from).toISOString() : null,
        valid_to: r.valid_to ? new Date(r.valid_to).toISOString() : null,
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
        quarantine_reason: r.quarantine_reason || undefined,
    };
}

class PgStore {
    /** @param {{query: Function, getClient: Function}} db  api/db/pool */
    constructor(db) { this.db = db; }

    async getDoc(id) {
        const { rows } = await this.db.query(`SELECT ${DOC_COLS.join(', ')} FROM knowledge_documents WHERE id = $1`, [id]);
        return rows[0] ? filaADoc(rows[0]) : null;
    }

    async listDocs(tenantId) {
        const { rows } = await this.db.query(
            `SELECT ${DOC_COLS.join(', ')} FROM knowledge_documents
              WHERE tenant_id IS NULL OR tenant_id = $1 ORDER BY updated_at DESC LIMIT 500`,
            [tenantId]
        );
        return rows.map(filaADoc);
    }

    async chunksVisibles(tenantId) {
        const { rows } = await this.db.query(
            `SELECT c.id, c.document_id, c.chunk_index, c.content, c.section, c.version, c.checksum,
                    d.title, d.tenant_id, d.classification, d.allowed_roles, d.allowed_plans,
                    d.valid_from, d.valid_to, d.status
               FROM knowledge_chunks c
               JOIN knowledge_documents d ON d.id = c.document_id AND d.version = c.version
              WHERE d.status = 'published' AND (d.tenant_id IS NULL OR d.tenant_id = $1)
              LIMIT 5000`,
            [tenantId]
        );
        return rows.map(filaADoc);
    }

    async putDocument(doc, chunks) {
        const client = await this.db.getClient();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM knowledge_chunks WHERE document_id = $1', [doc.id]);
            const up = await client.query(
                `INSERT INTO knowledge_documents
                   (id, tenant_id, title, source, category, classification, allowed_roles, allowed_plans,
                    valid_from, valid_to, version, checksum, status, quarantine_reason, created_by, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb,$15,NOW())
                 ON CONFLICT (id) DO UPDATE SET
                   title = EXCLUDED.title, source = EXCLUDED.source, category = EXCLUDED.category,
                   classification = EXCLUDED.classification, allowed_roles = EXCLUDED.allowed_roles,
                   allowed_plans = EXCLUDED.allowed_plans, valid_from = EXCLUDED.valid_from,
                   valid_to = EXCLUDED.valid_to, version = EXCLUDED.version, checksum = EXCLUDED.checksum,
                   status = EXCLUDED.status, quarantine_reason = EXCLUDED.quarantine_reason, updated_at = NOW()
                 WHERE knowledge_documents.tenant_id IS NOT DISTINCT FROM EXCLUDED.tenant_id`,
                [doc.id, doc.tenant_id, doc.title, doc.source, doc.category, doc.classification,
                    jsonOrEmpty(doc.allowed_roles), jsonOrEmpty(doc.allowed_plans), doc.valid_from, doc.valid_to,
                    doc.version, doc.checksum, doc.status,
                    doc.quarantine_reason ? JSON.stringify(doc.quarantine_reason) : null, doc.created_by]
            );
            // El id ya existe en otro tenant: no se pisa (el servicio ya lo impide; esto es la segunda barrera).
            if (up.rowCount === 0) throw Object.assign(new Error('El documento pertenece a otro tenant'), { status: 403 });
            for (const c of chunks) {
                await client.query(
                    `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, section, version, checksum)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [c.id, c.document_id, c.chunk_index, c.content, c.section || null, c.version, c.checksum]
                );
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    async removeDocument(id) {
        const r = await this.db.query('DELETE FROM knowledge_documents WHERE id = $1', [id]);
        return r.rowCount > 0;
    }

    async size() {
        const { rows } = await this.db.query('SELECT COUNT(*)::int AS n FROM knowledge_documents');
        return rows[0].n;
    }
}

module.exports = { MemoryStore, PgStore };
