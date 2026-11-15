const pool = require('../../db/pool');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_CONTENT = 10000;
const MAX_COMMENT = 2000;

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const lista = (v, max = 20, len = 200) => (Array.isArray(v) ? v.map((x) => texto(x, len)).filter(Boolean).slice(0, max) : []);

/** Los metadatos del post: sólo título, categoría, etiquetas y enlaces (antes, lo que dijera el cliente). */
function limpiarMetadatos(m) {
    const o = m && typeof m === 'object' && !Array.isArray(m) ? m : {};
    return { title: texto(o.title, 200), category: texto(o.category, 50) || 'general', tags: lista(o.tags), externalLinks: lista(o.externalLinks, 10, 500) };
}

/**
 * Posts del feed social (tabla `posts`, migraciones 005 y 025). Sustituye a models/post.model.js (Mongoose).
 * Likes y comentarios se modifican con una sola sentencia (jsonb): nunca leer-modificar-guardar, que perdía los que llegaban a la vez.
 */
class PostPG {
    static isValidId(id) { return typeof id === 'string' && UUID.test(id); }

    static hydrate(r) {
        if (!r) return null;
        return {
            _id: r.id, id: r.id, author: r.author, content: r.content, likes: r.likes || [], comments: r.comments || [],
            image: r.image || '', hidden: r.hidden, pinned: r.pinned, validated: r.validated,
            blockchainData: r.blockchain_data || {}, metadata: r.metadata || {}, shares: r.shares || 0,
            qualityScore: r.quality_score == null ? undefined : Number(r.quality_score), aiAnalyzedAt: r.ai_analyzed_at,
            aiAnalysisData: r.ai_analysis_data, blockchainValidated: r.blockchain_validated, validationTxHash: r.validation_tx_hash,
            rewardAmount: r.reward_amount == null ? undefined : Number(r.reward_amount), rewardDistributed: r.reward_distributed,
            rewardDistributedAt: r.reward_distributed_at, modifiedAt: r.modified_at, createdAt: r.created_at, updatedAt: r.updated_at,
        };
    }

    static async create({ author, content, image, metadata, hidden = false, pinned = false, validated = false, blockchainData }) {
        const { rows } = await pool.query(
            `INSERT INTO posts (author, content, image, hidden, pinned, validated, blockchain_data, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::jsonb, '{"txHash": null, "blockNumber": null, "network": "polygon", "validationScore": 0}'::jsonb),$8::jsonb) RETURNING *`,
            [texto(author, 100), texto(content, MAX_CONTENT), texto(image, 2000), hidden, pinned, validated,
                blockchainData ? JSON.stringify(blockchainData) : null, JSON.stringify(limpiarMetadatos(metadata))]);
        return PostPG.hydrate(rows[0]);
    }

    static async findById(id) {
        if (!PostPG.isValidId(id)) return null;
        const { rows } = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
        return PostPG.hydrate(rows[0]);
    }

    /** Feed: los fijados primero y luego los más recientes. `includeHidden` sólo para administradores. */
    static async feed({ includeHidden = false, limit = 100 } = {}) {
        const { rows } = await pool.query(
            `SELECT * FROM posts ${includeHidden ? '' : 'WHERE hidden = false'} ORDER BY pinned DESC, created_at DESC, id LIMIT $1`, [limit]);
        return rows.map(PostPG.hydrate);
    }

    static async byAuthor(author, { limit = 50, includeHidden = false } = {}) {
        const { rows } = await pool.query(
            `SELECT * FROM posts WHERE author = $1 ${includeHidden ? '' : 'AND hidden = false'} ORDER BY created_at DESC, id LIMIT $2`, [author, limit]);
        return rows.map(PostPG.hydrate);
    }

    /** Añade el «me gusta» si no estaba (un único UPDATE: dos likes simultáneos de la misma persona no se duplican). */
    static async like(id, who) {
        if (!PostPG.isValidId(id)) return null;
        const { rows } = await pool.query(
            `UPDATE posts SET likes = CASE WHEN likes ? $2 THEN likes ELSE likes || to_jsonb($2::text) END, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, texto(who, 100)]);
        return PostPG.hydrate(rows[0]);
    }

    static async unlike(id, who) {
        if (!PostPG.isValidId(id)) return null;
        const { rows } = await pool.query(
            `UPDATE posts SET likes = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(likes) e WHERE e <> to_jsonb($2::text)), '[]'::jsonb), updated_at = NOW()
              WHERE id = $1 RETURNING *`, [id, texto(who, 100)]);
        return PostPG.hydrate(rows[0]);
    }

    static async addComment(id, author, content) {
        if (!PostPG.isValidId(id)) return null;
        const comentario = { author: texto(author, 100), content: texto(content, MAX_COMMENT), createdAt: new Date().toISOString() };
        const { rows } = await pool.query(
            `UPDATE posts SET comments = comments || $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, JSON.stringify([comentario])]);
        return PostPG.hydrate(rows[0]);
    }

    /** Moderación: sólo ocultar, fijar y validar. */
    static async moderate(id, { hidden, pinned, validated }) {
        if (!PostPG.isValidId(id)) return null;
        const { rows } = await pool.query(
            `UPDATE posts SET hidden = COALESCE($2, hidden), pinned = COALESCE($3, pinned), validated = COALESCE($4, validated),
                    modified_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, hidden === undefined ? null : !!hidden, pinned === undefined ? null : !!pinned, validated === undefined ? null : !!validated]);
        return PostPG.hydrate(rows[0]);
    }

    static async remove(id) {
        if (!PostPG.isValidId(id)) return false;
        const { rowCount } = await pool.query('DELETE FROM posts WHERE id = $1', [id]);
        return rowCount > 0;
    }

    static async stats() {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE validated)::int AS validated, COUNT(*) FILTER (WHERE pinned)::int AS pinned FROM posts`);
        return { totalPosts: rows[0].total, validatedPosts: rows[0].validated, pinnedPosts: rows[0].pinned };
    }

    static async count() {
        const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM posts');
        return rows[0].n;
    }

    static async countSince(date) {
        const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM posts WHERE created_at >= $1', [date]);
        return rows[0].n;
    }

    /** Siembra de arranque: inserta los posts de ejemplo sólo si la tabla está vacía (atómico por la comprobación en la misma sentencia). */
    static async seedIfEmpty(posts) {
        let creados = 0;
        const client = await pool.getClient();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['posts:seed']);
            const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM posts');
            if (rows[0].n === 0) {
                for (const p of posts) {
                    await client.query(
                        `INSERT INTO posts (author, content, image, hidden, pinned, validated, blockchain_data, metadata)
                         VALUES ($1,$2,$3,false,$4,$5,$6::jsonb,$7::jsonb)`,
                        [texto(p.author, 100), texto(p.content, MAX_CONTENT), texto(p.image, 2000), !!p.pinned, !!p.validated,
                            JSON.stringify(p.blockchainData || {}), JSON.stringify(limpiarMetadatos(p.metadata))]);
                    creados += 1;
                }
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
        return creados;
    }

    // ── Oráculo de calidad y recompensas (services/oracle.service.js) ─────────────────────────────────────────────

    /**
     * Actualiza sólo campos conocidos del oráculo (lista blanca). `Post.update(id, {...})` lo usaba el oráculo contra un método que
     * Mongoose ya no tiene, así que su resultado nunca se guardaba.
     */
    static async update(id, campos) {
        if (!PostPG.isValidId(id)) return null;
        const c = campos && campos.$set ? { ...campos, ...campos.$set } : (campos || {});
        const mapa = {
            qualityScore: ['quality_score', (v) => Math.min(100, Math.max(0, Number(v)))], aiAnalyzedAt: ['ai_analyzed_at', (v) => v],
            aiAnalysisData: ['ai_analysis_data', (v) => JSON.stringify(v)], blockchainValidated: ['blockchain_validated', (v) => !!v],
            validationTxHash: ['validation_tx_hash', (v) => String(v).slice(0, 66)], rewardAmount: ['reward_amount', (v) => Number(v)],
            rewardDistributed: ['reward_distributed', (v) => !!v], rewardDistributedAt: ['reward_distributed_at', (v) => v],
        };
        const sets = []; const params = [id];
        for (const [k, [col, fn]] of Object.entries(mapa)) {
            if (c[k] === undefined) continue;
            params.push(fn(c[k]));
            sets.push(`${col} = $${params.length}${col === 'ai_analysis_data' ? '::jsonb' : ''}`);
        }
        if (!sets.length) return PostPG.findById(id);
        const { rows } = await pool.query(`UPDATE posts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, params);
        return PostPG.hydrate(rows[0]);
    }

    /** Posts recientes aún sin analizar por la IA. */
    static async findUnanalyzed({ sinceHours = 24, limit = 20 } = {}) {
        const { rows } = await pool.query(
            `SELECT * FROM posts WHERE quality_score IS NULL AND content <> '' AND created_at >= NOW() - ($1::int * INTERVAL '1 hour')
              ORDER BY created_at DESC, id LIMIT $2`, [sinceHours, limit]);
        return rows.map(PostPG.hydrate);
    }

    /** Oculta los posts con calidad por debajo del umbral (los no analizados no se tocan). Devuelve cuántos ocultó. */
    static async hideLowQuality({ threshold = 30 } = {}) {
        const { rowCount } = await pool.query(
            `UPDATE posts SET hidden = true, hidden_reason = 'Low quality score', hidden_at = NOW(), updated_at = NOW()
              WHERE quality_score < $1 AND hidden = false`, [threshold]);
        return rowCount;
    }

    /** Autores activos del periodo con su calidad media (para los bonos diarios): sustituye al aggregate de Mongo. */
    static async activeAuthors({ sinceHours = 24, minQuality = 50 } = {}) {
        const { rows } = await pool.query(
            `SELECT author AS _id, COUNT(*)::int AS "postCount", AVG(quality_score)::float AS "avgQuality"
               FROM posts WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour') AND quality_score >= $2 GROUP BY author`, [sinceHours, minQuality]);
        return rows;
    }
}

PostPG.limpiarMetadatos = limpiarMetadatos;
module.exports = PostPG;
