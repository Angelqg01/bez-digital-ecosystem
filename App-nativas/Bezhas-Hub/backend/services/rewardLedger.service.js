const pool = require('../db/pool');

/**
 * Recompensas en BEZ como asientos del libro (`bezcoin_transactions`, tipo EARN), siempre con clave de idempotencia
 * (índice único de la migración 027): repetir la misma recompensa no la paga dos veces, ni con jobs reintentados ni con instancias
 * en paralelo. Sustituye a `User.update(id, {$inc: {bezBalance}})`, que no existe en el usuario de Postgres.
 *
 * Quien recibe es una identidad pública (wallet o nombre de usuario, como `posts.author`). Sin usuario o sin wallet no hay dónde anotar
 * el asiento y NO se paga: se devuelve el motivo para que el job pueda reintentarlo más tarde.
 */

const MAX_RECOMPENSA = 10_000;

async function resolveUser(identity, db = pool) {
    if (!identity) return null;
    const { rows } = await db.query(
        `SELECT id, wallet_address FROM users WHERE LOWER(wallet_address) = LOWER($1) OR username = $1
          ORDER BY (LOWER(wallet_address) = LOWER($1)) DESC LIMIT 1`, [String(identity)]);
    return rows[0] || null;
}

/** @returns {Promise<{credited: boolean, reason?: string, userId?: string, amount?: number}>} */
async function earn({ identity, amount, reason, idempotencyKey, metadata = {} }, db = pool) {
    if (!idempotencyKey) throw new Error('Una recompensa necesita idempotencyKey');
    const importe = Number(amount);
    if (!Number.isFinite(importe) || importe <= 0 || importe > MAX_RECOMPENSA) throw new Error(`Importe de recompensa inválido: ${amount}`);
    const user = await resolveUser(identity, db);
    if (!user) return { credited: false, reason: 'USER_NOT_FOUND' };
    if (!user.wallet_address) return { credited: false, reason: 'WALLET_REQUIRED', userId: user.id };

    const { rowCount } = await db.query(
        `INSERT INTO bezcoin_transactions (user_id, wallet_address, type, amount, currency, status, metadata)
         VALUES ($1,$2,'EARN',$3,'BEZ','completed',$4::jsonb)
         ON CONFLICT ((metadata ->> 'idempotencyKey')) WHERE metadata ? 'idempotencyKey' DO NOTHING`,
        [String(user.id), user.wallet_address, importe, JSON.stringify({ ...metadata, reason, idempotencyKey })]);
    return rowCount === 0 ? { credited: false, reason: 'ALREADY_REWARDED', userId: user.id } : { credited: true, userId: user.id, amount: importe };
}

/**
 * Recompensa por la calidad de un post: reclama el post de forma atómica (sólo se premia una vez) y anota el asiento en la MISMA
 * transacción; si no se puede pagar (usuario sin wallet) se deshace el reclamo para poder reintentarlo.
 */
async function rewardPost({ postId, author, amount }) {
    const client = await pool.getClient();
    try {
        await client.query('BEGIN');
        const claim = await client.query(
            `UPDATE posts SET reward_amount = $2, reward_distributed = true, reward_distributed_at = NOW(), updated_at = NOW()
              WHERE id = $1 AND reward_distributed = false RETURNING id`, [postId, amount]);
        if (!claim.rows[0]) { await client.query('ROLLBACK'); return { credited: false, reason: 'ALREADY_REWARDED' }; }
        const r = await earn({ identity: author, amount, reason: 'post_quality_reward', idempotencyKey: `post-quality:${postId}`, metadata: { postId } }, client);
        if (!r.credited) { await client.query('ROLLBACK'); return r; }
        await client.query('COMMIT');
        return r;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

/** Bono de actividad diaria: uno por persona y día (UTC). */
function rewardDaily({ identity, amount, day = new Date() }) {
    const dia = day.toISOString().slice(0, 10);
    return earn({ identity, amount, reason: 'daily_activity', idempotencyKey: `daily:${String(identity).toLowerCase()}:${dia}`, metadata: { day: dia } });
}

/**
 * Desbloquea un logro por número de posts: a todos los autores con al menos `posts` posts que aún no lo tengan. El logro (UNIQUE usuario+insignia)
 * y el asiento van en una transacción; sin wallet no se desbloquea (se reintentará). Antes se exigía EXACTAMENTE ese número de posts y quien
 * pasaba de largo no lo conseguía nunca.
 */
async function unlockPostMilestone({ posts, reward, badge }) {
    const { rows } = await pool.query('SELECT author FROM posts GROUP BY author HAVING COUNT(*) >= $1', [posts]);
    const unlocked = [];
    for (const { author } of rows) {
        const user = await resolveUser(author);
        if (!user || !user.wallet_address) continue;
        const client = await pool.getClient();
        try {
            await client.query('BEGIN');
            const ins = await client.query(
                'INSERT INTO user_achievements (user_id, badge, reward) VALUES ($1,$2,$3) ON CONFLICT (user_id, badge) DO NOTHING RETURNING id', [user.id, badge, reward]);
            if (!ins.rows[0]) { await client.query('ROLLBACK'); continue; }
            const r = await earn({ identity: author, amount: reward, reason: 'achievement', idempotencyKey: `achievement:${user.id}:${badge}`, metadata: { badge } }, client);
            if (!r.credited) { await client.query('ROLLBACK'); continue; }
            await client.query('COMMIT');
            unlocked.push({ userId: user.id, author, badge, reward });
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }
    return unlocked;
}

/** Métricas de la plataforma (las que calculaba el motor con aggregates de Mongo). */
async function platformMetrics() {
    const { rows } = await pool.query(
        `SELECT (SELECT COUNT(*)::int FROM users) AS total_users,
                (SELECT COUNT(*)::int FROM posts) AS total_posts,
                (SELECT COUNT(DISTINCT author)::int FROM posts WHERE created_at >= NOW() - INTERVAL '24 hours') AS active_today,
                (SELECT COALESCE(AVG(quality_score), 0)::float FROM posts WHERE quality_score IS NOT NULL) AS avg_quality,
                (SELECT COALESCE(SUM(amount), 0)::float FROM bezcoin_transactions WHERE type = 'EARN' AND currency = 'BEZ') AS total_rewards`);
    const r = rows[0];
    return { totalUsers: r.total_users, totalPosts: r.total_posts, activeUsersToday: r.active_today, avgQualityScore: r.avg_quality, totalRewardsDistributed: r.total_rewards };
}

module.exports = { earn, rewardPost, rewardDaily, unlockPostMilestone, platformMetrics, resolveUser, MAX_RECOMPENSA };
