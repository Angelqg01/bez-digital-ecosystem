const pool = require('../../db/pool');

const TYPES = ['click', 'signup', 'rewardable_action'];

/** Eventos de afiliados (migración 022). Sustituye a models/affiliateEvent.model.js (Mongoose). */
class AffiliateEventPG {
    static hydrate(r) {
        if (!r) return null;
        return {
            _id: r.id,
            id: r.id,
            referrerId: r.referrer_id,
            referredId: r.referred_id,
            eventType: r.event_type,
            ipAddress: r.ip_address,
            userAgent: r.user_agent,
            referralCodeUsed: r.referral_code_used,
            attributionWindowEnds: r.attribution_window_ends,
            rewardStatus: r.reward_status,
            rewardDetails: { transactionId: r.reward_transaction_id, amount: r.reward_amount, currency: r.reward_currency },
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }

    static async record({ referrerId, referredId = null, eventType, ipAddress = null, userAgent = null, referralCodeUsed = null, attributionWindowEnds = null }) {
        if (!TYPES.includes(eventType)) throw new Error(`eventType inválido: ${eventType}`);
        const { rows } = await pool.query(
            `INSERT INTO affiliate_events (referrer_id, referred_id, event_type, ip_address, user_agent, referral_code_used, attribution_window_ends)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [referrerId, referredId, eventType, ipAddress, userAgent, referralCodeUsed, attributionWindowEnds]);
        return AffiliateEventPG.hydrate(rows[0]);
    }

    /** { click, signup, rewardable_action } del afiliado, en una sola consulta. */
    static async countsByType(referrerId) {
        const { rows } = await pool.query('SELECT event_type, COUNT(*)::int AS n FROM affiliate_events WHERE referrer_id = $1 GROUP BY event_type', [referrerId]);
        return Object.fromEntries(TYPES.map((t) => [t, (rows.find((r) => r.event_type === t) || { n: 0 }).n]));
    }

    static async history(referrerId, { limit = 20, skip = 0 } = {}) {
        const [lista, total] = await Promise.all([
            pool.query('SELECT * FROM affiliate_events WHERE referrer_id = $1 ORDER BY created_at DESC, id LIMIT $2 OFFSET $3', [referrerId, limit, skip]),
            pool.query('SELECT COUNT(*)::int AS n FROM affiliate_events WHERE referrer_id = $1', [referrerId]),
        ]);
        return { events: lista.rows.map(AffiliateEventPG.hydrate), total: total.rows[0].n };
    }
}

module.exports = AffiliateEventPG;
