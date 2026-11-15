const pool = require('../../db/pool');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUSINESS_TYPES = ['nft-project', 'content-creator', 'defi-dapp', 'web3-service', 'store', 'other'];
const GOALS = ['sell-nfts', 'drive-traffic', 'get-followers', 'brand-awareness', 'token-promotion', 'community-growth', 'app-installs', 'video-views'];

const texto = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);

/** Sólo los campos conocidos de los detalles de empresa: el cliente no puede guardar claves arbitrarias. */
function limpiarDetalles(d) {
    const o = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
    return {
        description: texto(o.description, 1000), logoUrl: texto(o.logoUrl, 500),
        industry: texto(o.industry, 100), teamSize: texto(o.teamSize, 50),
    };
}

/** Perfil de anunciante (migración 024). Sustituye a models/advertiserProfile.model.js (Mongoose). */
class AdvertiserProfilePG {
    static isValidId(id) { return typeof id === 'string' && UUID.test(id); }

    static hydrate(r) {
        if (!r) return null;
        return {
            _id: r.id, id: r.id, userId: r.user_id, walletAddress: r.wallet_address, businessType: r.business_type,
            projectName: r.project_name, country: r.country, website: r.website, businessGoals: r.business_goals || [],
            companyDetails: r.company_details || {}, isActive: r.is_active, isSuspended: r.is_suspended,
            suspensionReason: r.suspension_reason, createdAt: r.created_at, updatedAt: r.updated_at,
        };
    }

    static async findByUserId(userId) {
        const { rows } = await pool.query('SELECT * FROM advertiser_profiles WHERE user_id = $1', [userId]);
        return AdvertiserProfilePG.hydrate(rows[0]);
    }

    /** Crea o actualiza el perfil del usuario. `created` indica si se creó (antes el mensaje siempre decía «actualizado»). */
    static async upsert(userId, walletAddress, d) {
        if (!BUSINESS_TYPES.includes(d.businessType)) throw new Error('Tipo de negocio inválido');
        const metas = (Array.isArray(d.businessGoals) ? d.businessGoals : []).filter((g) => GOALS.includes(g));
        const { rows } = await pool.query(
            `INSERT INTO advertiser_profiles (user_id, wallet_address, business_type, project_name, country, website, business_goals, company_details)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
             ON CONFLICT (user_id) DO UPDATE SET
                 wallet_address = EXCLUDED.wallet_address, business_type = EXCLUDED.business_type, project_name = EXCLUDED.project_name,
                 country = EXCLUDED.country, website = EXCLUDED.website, business_goals = EXCLUDED.business_goals,
                 company_details = CASE WHEN $9::boolean THEN EXCLUDED.company_details ELSE advertiser_profiles.company_details END,
                 updated_at = NOW()
             RETURNING *, (xmax = 0) AS created`,
            [userId, walletAddress || null, d.businessType, texto(d.projectName, 255), texto(d.country, 100), texto(d.website, 2000),
                JSON.stringify([...new Set(metas)]), JSON.stringify(limpiarDetalles(d.companyDetails)), d.companyDetails != null]);
        return { profile: AdvertiserProfilePG.hydrate(rows[0]), created: rows[0].created };
    }

    /** Lista de anunciantes para el panel de administración, con los datos públicos del usuario (antes, populate). */
    static async list({ suspended = null, page = 1, limit = 20 } = {}) {
        const where = typeof suspended === 'boolean' ? 'WHERE p.is_suspended = $1' : '';
        const params = typeof suspended === 'boolean' ? [suspended] : [];
        const [lista, total] = await Promise.all([
            pool.query(
                `SELECT p.*, u.username AS u_username, u.email AS u_email, u.wallet_address AS u_wallet
                   FROM advertiser_profiles p JOIN users u ON u.id = p.user_id ${where}
                  ORDER BY p.created_at DESC, p.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]),
            pool.query(`SELECT COUNT(*)::int AS n FROM advertiser_profiles p ${where}`, params),
        ]);
        return {
            advertisers: lista.rows.map((r) => ({ ...AdvertiserProfilePG.hydrate(r), userId: { _id: r.user_id, username: r.u_username, email: r.u_email, walletAddress: r.u_wallet } })),
            total: total.rows[0].n,
        };
    }

    /**
     * Suspende o reactiva al anunciante. Al suspender, sus campañas activas, aprobadas o en pausa pasan a `suspended` en la
     * MISMA transacción: antes sólo se suspendían las activas y una pausada se podía reanudar estando suspendido el anunciante.
     */
    static async setSuspended(id, suspend, reason) {
        if (!AdvertiserProfilePG.isValidId(id)) return null;
        const client = await pool.getClient();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `UPDATE advertiser_profiles SET is_suspended = $2, suspension_reason = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
                [id, suspend, suspend ? (reason || 'Suspendido por administrador') : null]);
            if (!rows[0]) { await client.query('ROLLBACK'); return null; }
            if (suspend) {
                await client.query(
                    `UPDATE ad_campaigns SET status = 'suspended', suspension_reason = 'Anunciante suspendido', updated_at = NOW()
                      WHERE advertiser_id = $1 AND status IN ('active', 'approved', 'paused')`, [rows[0].user_id]);
            }
            await client.query('COMMIT');
            return AdvertiserProfilePG.hydrate(rows[0]);
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }
}

module.exports = AdvertiserProfilePG;
