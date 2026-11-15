const pool = require('../../db/pool');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLATFORMS = ['twitter', 'facebook', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'email', 'discord', 'copy', 'native'];
// Alcance estimado por plataforma (el mismo cálculo que hacía el middleware pre-save de Mongoose).
const REACH = { twitter: 100, facebook: 150, linkedin: 75, whatsapp: 50, telegram: 40, reddit: 200, email: 10, discord: 30, copy: 5, native: 25 };
const MAX_POR_DIA = 20;
const RECOMPENSA_BEZ = 5;
const RETENCION_DIAS = 365;

const DIA_UTC = `(date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`;

let ultimaPurga = 0;

/**
 * Compartidos de posts (tabla `post_shares`, migración 025). Sustituye a models/Share.js (Mongoose).
 * La respuesta pública NO incluye IP ni user-agent: se guardan para antiabuso, no para mostrarlos a quien lea el post.
 */
class SharePG {
    static isValidId(id) { return typeof id === 'string' && UUID.test(id); }

    static hydrate(r) {
        if (!r) return null;
        return {
            _id: r.id, id: r.id, postId: r.post_id, userId: r.user_id, platform: r.platform, url: r.url, comment: r.comment,
            timestamp: r.created_at, metadata: r.metadata || {}, clicks: r.clicks, reach: r.reach, engagement: r.engagement,
            createdAt: r.created_at, updatedAt: r.updated_at,
        };
    }

    /**
     * Registra el compartido, sube el contador del post y, si procede, anota la recompensa en el libro de BEZ, todo en UNA
     * transacción serializada por usuario (advisory lock) para que el límite diario no se pueda saltar con peticiones simultáneas.
     *
     * Recompensa (5 BEZ): sólo la PRIMERA vez que el usuario comparte ese post y mientras no pase de 20 compartidos al día, y sólo si
     * tiene wallet. Antes se pagaba en cada compartido: se podía cobrar compartiendo el mismo post 20 veces al día.
     */
    static async record({ postId, userId, platform, url, comment, ipAddress, userAgent, walletAddress }) {
        if (!PLATFORMS.includes(platform)) throw Object.assign(new Error('Plataforma inválida'), { code: 'BAD_PLATFORM' });
        if (!SharePG.isValidId(postId)) return { error: 'POST_NOT_FOUND' };
        const client = await pool.getClient();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`share:${userId}`]);

            const post = await client.query('UPDATE posts SET shares = shares + 1 WHERE id = $1 RETURNING shares', [postId]);
            if (!post.rows[0]) { await client.query('ROLLBACK'); return { error: 'POST_NOT_FOUND' }; }
            const primera = (await client.query('SELECT 1 FROM post_shares WHERE post_id = $1 AND user_id = $2 LIMIT 1', [postId, userId])).rowCount === 0;

            const ins = await client.query(
                `INSERT INTO post_shares (post_id, user_id, platform, url, comment, ip_address, user_agent, reach)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                [postId, userId, platform, url ? String(url).slice(0, 2000) : null, String(comment || '').slice(0, 500),
                    ipAddress ? String(ipAddress).slice(0, 64) : null, userAgent ? String(userAgent).slice(0, 500) : null, REACH[platform] || 10]);
            const hoy = (await client.query(`SELECT COUNT(*)::int AS n FROM post_shares WHERE user_id = $1 AND created_at >= ${DIA_UTC}`, [userId])).rows[0].n;

            let reward = null;
            if (primera && hoy <= MAX_POR_DIA && walletAddress) {
                await client.query(
                    `INSERT INTO bezcoin_transactions (user_id, wallet_address, type, amount, currency, status, metadata)
                     VALUES ($1,$2,'EARN',$3,'BEZ','completed',$4::jsonb)`,
                    [String(userId), walletAddress, RECOMPENSA_BEZ, JSON.stringify({ reason: 'share_reward', shareId: ins.rows[0].id, postId })]);
                reward = { tokens: RECOMPENSA_BEZ, reason: 'Compartir contenido' };
            }
            await client.query('COMMIT');
            SharePG.purgeExpiredSometimes();
            return { share: SharePG.hydrate(ins.rows[0]), reward, totalShares: post.rows[0].shares, todayShares: hoy, limitReached: hoy >= MAX_POR_DIA };
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    /** Compartidos de un post (los 50 más recientes, con datos públicos del usuario), total y reparto por plataforma. */
    static async forPost(postId) {
        if (!SharePG.isValidId(postId)) return { shares: [], total: 0, byPlatform: {} };
        const [lista, plat] = await Promise.all([
            pool.query(
                `SELECT s.*, u.username AS u_username, u.profile_image AS u_avatar FROM post_shares s JOIN users u ON u.id = s.user_id
                  WHERE s.post_id = $1 ORDER BY s.created_at DESC, s.id LIMIT 50`, [postId]),
            pool.query('SELECT platform, COUNT(*)::int AS n FROM post_shares WHERE post_id = $1 GROUP BY platform ORDER BY n DESC', [postId]),
        ]);
        return {
            shares: lista.rows.map((r) => ({ ...SharePG.hydrate(r), userId: { _id: r.user_id, username: r.u_username, avatar: r.u_avatar } })),
            total: plat.rows.reduce((s, r) => s + r.n, 0),
            byPlatform: Object.fromEntries(plat.rows.map((r) => [r.platform, r.n])),
        };
    }

    static async forUser(userId, { limit = 20, skip = 0 } = {}) {
        const [lista, total] = await Promise.all([
            pool.query(
                `SELECT s.*, p.content AS p_content, p.image AS p_image FROM post_shares s JOIN posts p ON p.id = s.post_id
                  WHERE s.user_id = $1 ORDER BY s.created_at DESC, s.id LIMIT $2 OFFSET $3`, [userId, limit, skip]),
            pool.query('SELECT COUNT(*)::int AS n FROM post_shares WHERE user_id = $1', [userId]),
        ]);
        return {
            shares: lista.rows.map((r) => ({ ...SharePG.hydrate(r), postId: { _id: r.post_id, content: r.p_content, images: r.p_image ? [r.p_image] : [] } })),
            total: total.rows[0].n,
        };
    }

    /** Borra el compartido SÓLO si es del usuario y resta el contador del post en la misma transacción. */
    static async removeOwned(id, userId) {
        if (!SharePG.isValidId(id)) return { found: false };
        const client = await pool.getClient();
        try {
            await client.query('BEGIN');
            const s = await client.query('SELECT user_id, post_id FROM post_shares WHERE id = $1 FOR UPDATE', [id]);
            if (!s.rows[0]) { await client.query('ROLLBACK'); return { found: false }; }
            if (String(s.rows[0].user_id) !== String(userId)) { await client.query('ROLLBACK'); return { found: true, forbidden: true }; }
            await client.query('DELETE FROM post_shares WHERE id = $1', [id]);
            await client.query('UPDATE posts SET shares = GREATEST(shares - 1, 0) WHERE id = $1', [s.rows[0].post_id]);
            await client.query('COMMIT');
            return { found: true, deleted: true };
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    /** Analítica global para el panel de administración. */
    static async analytics() {
        const [tot, plat, top, hora] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int AS last_month FROM post_shares`),
            pool.query('SELECT platform AS _id, COUNT(*)::int AS count FROM post_shares GROUP BY platform ORDER BY count DESC'),
            pool.query('SELECT post_id AS _id, COUNT(*)::int AS "shareCount" FROM post_shares GROUP BY post_id ORDER BY "shareCount" DESC LIMIT 10'),
            pool.query(`SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS _id, COUNT(*)::int AS count FROM post_shares
                         WHERE created_at >= NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 1`),
        ]);
        const total = tot.rows[0].total; const lastMonth = tot.rows[0].last_month;
        return { totalShares: total, lastMonthShares: lastMonth, growthRate: total > 0 ? ((lastMonth / total) * 100).toFixed(2) : '0.00',
            byPlatform: plat.rows, topSharedPosts: top.rows, sharesByHour: hora.rows };
    }

    /** Retención: Mongo borraba los compartidos al año con un índice TTL; aquí se purgan (como mucho una vez por hora, tras un alta). */
    static async purgeExpired() {
        const { rowCount } = await pool.query(`DELETE FROM post_shares WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`, [RETENCION_DIAS]);
        return rowCount;
    }

    static purgeExpiredSometimes() {
        if (Date.now() - ultimaPurga < 3600_000) return;
        ultimaPurga = Date.now();
        SharePG.purgeExpired().catch(() => {});
    }
}

SharePG.PLATFORMS = PLATFORMS;
SharePG.MAX_POR_DIA = MAX_POR_DIA;
module.exports = SharePG;
