const pool = require('../../db/pool');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = ['draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'rejected', 'suspended'];
const CTAS = ['learn-more', 'shop-now', 'sign-up', 'download', 'get-started', 'join-now'];
const GENDERS = ['male', 'female', 'other', 'all'];
const DEVICES = ['desktop', 'mobile', 'tablet', 'all'];
const PLATFORMS = ['web', 'mobile-app', 'both'];

const txt = (v, max) => (v == null ? undefined : String(v).trim().slice(0, max));
const lista = (v, max = 30, len = 100) => (Array.isArray(v) ? v.map((x) => String(x).trim().slice(0, len)).filter(Boolean).slice(0, max) : []);
const enumLista = (v, valid) => (Array.isArray(v) ? [...new Set(v.filter((x) => valid.includes(x)))] : []);
const entero = (v, min, max) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : undefined);

/**
 * Sólo los campos conocidos y con su tipo. Mongoose descartaba lo que no estaba en el esquema; en JSONB eso hay que hacerlo a mano o
 * el cliente puede guardar claves arbitrarias (y tamaños ilimitados) en la creatividad o la segmentación.
 */
function limpiarCreatividad(c) {
    const o = c && typeof c === 'object' ? c : {};
    return {
        title: txt(o.title, 100), description: txt(o.description, 300), imageUrl: txt(o.imageUrl, 2000),
        videoUrl: txt(o.videoUrl, 2000), destinationUrl: txt(o.destinationUrl, 2000),
        callToAction: CTAS.includes(o.callToAction) ? o.callToAction : 'learn-more',
    };
}

function limpiarSegmentacion(t) {
    const o = t && typeof t === 'object' ? t : {};
    const demo = o.demographics && typeof o.demographics === 'object' ? o.demographics : {};
    const edad = demo.ageRange && typeof demo.ageRange === 'object' ? demo.ageRange : {};
    return {
        keywords: lista(o.keywords), locations: lista(o.locations), languages: lista(o.languages), contentCategories: lista(o.contentCategories),
        deviceTypes: enumLista(o.deviceTypes, DEVICES), platforms: enumLista(o.platforms, PLATFORMS),
        demographics: {
            ageRange: { min: entero(edad.min, 13, 100), max: entero(edad.max, 13, 100) },
            genders: enumLista(demo.genders, GENDERS), interests: lista(demo.interests),
        },
    };
}

function limpiarHorarios(r) {
    return (Array.isArray(r) ? r : []).slice(0, 50).map((x) => ({
        dayOfWeek: entero(x && x.dayOfWeek, 0, 6), startHour: entero(x && x.startHour, 0, 23), endHour: entero(x && x.endHour, 0, 23),
    }));
}

const COLS_PUBLICAS = '*';

class CampaignPG {
    static isValidId(id) { return typeof id === 'string' && UUID.test(id); }

    static hydrate(r) {
        if (!r) return null;
        const impressions = Number(r.impressions); const clicks = Number(r.clicks); const spent = Number(r.spent); const conversions = Number(r.conversions);
        return {
            _id: r.id, id: r.id, advertiserId: r.advertiser_id, advertiserWallet: r.advertiser_wallet, name: r.name, objective: r.objective,
            creative: r.creative, targeting: r.targeting,
            budget: { dailyBudget: Number(r.daily_budget), totalBudget: Number(r.total_budget), bidAmount: Number(r.bid_amount), bidStrategy: r.bid_strategy, currency: r.currency },
            schedule: { startDate: r.start_date, endDate: r.end_date, timeRanges: r.time_ranges || [], timezone: r.timezone },
            status: r.status, rejectionReason: r.rejection_reason, suspensionReason: r.suspension_reason,
            metrics: { impressions, clicks, spent, conversions, videoViews: Number(r.video_views), engagement: Number(r.engagement) },
            // Rendimiento derivado de las métricas (antes se guardaba y podía quedar desfasado).
            performance: {
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0, cpm: impressions > 0 ? (spent / impressions) * 1000 : 0,
                cpc: clicks > 0 ? spent / clicks : 0, conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
            },
            approvedAt: r.approved_at, approvedBy: r.approved_by, lastActiveAt: r.last_active_at, createdAt: r.created_at, updatedAt: r.updated_at,
        };
    }

    /** Campos de entrada → columnas, ya limpios y con los topes del esquema. */
    static normalizar({ name, objective, creative, targeting, budget = {}, schedule = {} }) {
        return {
            name: txt(name, 255), objective, creative: limpiarCreatividad(creative), targeting: limpiarSegmentacion(targeting),
            daily_budget: Number(budget.dailyBudget), total_budget: Number(budget.totalBudget), bid_amount: Number(budget.bidAmount),
            bid_strategy: ['manual', 'automatic', 'target-cpa'].includes(budget.bidStrategy) ? budget.bidStrategy : 'manual',
            currency: ['EUR', 'BEZ'].includes(budget.currency) ? budget.currency : 'EUR',
            start_date: schedule.startDate, end_date: schedule.endDate || null,
            time_ranges: limpiarHorarios(schedule.timeRanges), timezone: txt(schedule.timezone, 64) || 'UTC',
        };
    }

    static async create(advertiserId, advertiserWallet, entrada, status = 'pending_approval') {
        const c = CampaignPG.normalizar(entrada);
        const { rows } = await pool.query(
            `INSERT INTO ad_campaigns (advertiser_id, advertiser_wallet, name, objective, creative, targeting, daily_budget, total_budget, bid_amount,
                                       bid_strategy, currency, start_date, end_date, time_ranges, timezone, status)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16) RETURNING *`,
            [advertiserId, advertiserWallet || null, c.name, c.objective, JSON.stringify(c.creative), JSON.stringify(c.targeting), c.daily_budget,
                c.total_budget, c.bid_amount, c.bid_strategy, c.currency, c.start_date, c.end_date, JSON.stringify(c.time_ranges), c.timezone, status]);
        return CampaignPG.hydrate(rows[0]);
    }

    /** Una campaña del anunciante (null si no existe o no es suya: el 404 no distingue). */
    static async findOwned(id, userId) {
        if (!CampaignPG.isValidId(id)) return null;
        const { rows } = await pool.query('SELECT * FROM ad_campaigns WHERE id = $1 AND advertiser_id = $2', [id, userId]);
        return CampaignPG.hydrate(rows[0]);
    }

    static async findById(id) {
        if (!CampaignPG.isValidId(id)) return null;
        const { rows } = await pool.query('SELECT * FROM ad_campaigns WHERE id = $1', [id]);
        return CampaignPG.hydrate(rows[0]);
    }

    static async listByAdvertiser(userId, { status = null, page = 1, limit = 10 } = {}) {
        const params = [userId]; let where = 'advertiser_id = $1';
        if (status) { params.push(status); where += ` AND status = $${params.length}`; }
        const [l, t] = await Promise.all([
            pool.query(`SELECT * FROM ad_campaigns WHERE ${where} ORDER BY created_at DESC, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]),
            pool.query(`SELECT COUNT(*)::int AS n FROM ad_campaigns WHERE ${where}`, params),
        ]);
        return { campaigns: l.rows.map(CampaignPG.hydrate), total: t.rows[0].n };
    }

    /** Cola de administración: todas o sólo las de un estado, con los datos públicos del anunciante (antes, populate). */
    static async listForAdmin({ status = null, page = 1, limit = 20, fifo = false, conWallet = false } = {}) {
        const params = []; let where = '';
        if (status) { params.push(status); where = `WHERE c.status = $1`; }
        const [l, t] = await Promise.all([
            pool.query(
                `SELECT c.*, u.username AS u_username, u.email AS u_email, u.wallet_address AS u_wallet
                   FROM ad_campaigns c JOIN users u ON u.id = c.advertiser_id ${where}
                  ORDER BY c.created_at ${fifo ? 'ASC' : 'DESC'}, c.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]),
            pool.query(`SELECT COUNT(*)::int AS n FROM ad_campaigns c ${where}`, params),
        ]);
        return {
            campaigns: l.rows.map((r) => ({ ...CampaignPG.hydrate(r), advertiserId: { _id: r.advertiser_id, username: r.u_username, email: r.u_email, ...(conWallet ? { walletAddress: r.u_wallet } : {}) } })),
            total: t.rows[0].n,
        };
    }

    /**
     * Edición de campos permitida SÓLO en borrador o pendiente de aprobación (la condición va en el UPDATE: si entre tanto el
     * administrador la aprobó, no se pisa). Devuelve null si no existe, no es suya o ya no es editable.
     */
    static async updateEditable(id, userId, cambios) {
        const actual = await CampaignPG.findOwned(id, userId);
        if (!actual) return null;
        const merged = {
            name: cambios.name !== undefined ? cambios.name : actual.name, objective: actual.objective,
            creative: { ...actual.creative, ...(cambios.creative || {}) },
            targeting: { ...actual.targeting, ...(cambios.targeting || {}) },
            budget: { ...actual.budget, ...(cambios.budget || {}) },
            schedule: { ...actual.schedule, ...(cambios.schedule || {}) },
        };
        const c = CampaignPG.normalizar(merged);
        const { rows } = await pool.query(
            `UPDATE ad_campaigns SET name=$3, creative=$4::jsonb, targeting=$5::jsonb, daily_budget=$6, total_budget=$7, bid_amount=$8,
                    bid_strategy=$9, currency=$10, start_date=$11, end_date=$12, time_ranges=$13::jsonb, timezone=$14, updated_at=NOW()
              WHERE id=$1 AND advertiser_id=$2 AND status IN ('draft','pending_approval') RETURNING *`,
            [id, userId, c.name, JSON.stringify(c.creative), JSON.stringify(c.targeting), c.daily_budget, c.total_budget, c.bid_amount, c.bid_strategy,
                c.currency, c.start_date, c.end_date, JSON.stringify(c.time_ranges), c.timezone]);
        return CampaignPG.hydrate(rows[0]);
    }

    /**
     * Cambio de estado ATÓMICO: sólo ocurre si la campaña está en alguno de los estados `desde`. Evita dos aprobaciones o un
     * pause/resume cruzados con otra petición. `extra` admite lastActiveAt y los motivos. Devuelve null si no se pudo.
     */
    static async transition(id, { desde, hacia, userId = null, rejectionReason, suspensionReason, clearSuspension = false, touchActive = false }) {
        if (!CampaignPG.isValidId(id)) return null;
        const params = [id, desde, hacia]; const sets = ['status = $3', 'updated_at = NOW()'];
        if (rejectionReason !== undefined) { params.push(rejectionReason); sets.push(`rejection_reason = $${params.length}`); }
        if (suspensionReason !== undefined) { params.push(suspensionReason); sets.push(`suspension_reason = $${params.length}`); }
        if (clearSuspension) sets.push('suspension_reason = NULL');
        if (touchActive) sets.push('last_active_at = NOW()');
        let where = 'id = $1 AND status = ANY($2::text[])';
        if (userId) { params.push(userId); where += ` AND advertiser_id = $${params.length}`; }
        const { rows } = await pool.query(`UPDATE ad_campaigns SET ${sets.join(', ')} WHERE ${where} RETURNING *`, params);
        return CampaignPG.hydrate(rows[0]);
    }

    /** Aprobación: pasa de pending_approval a active si ya debe empezar, o a approved si empieza más tarde. Atómica. */
    static async approve(id, adminId) {
        if (!CampaignPG.isValidId(id)) return null;
        const { rows } = await pool.query(
            `UPDATE ad_campaigns SET
                 status = CASE WHEN start_date <= NOW() THEN 'active' ELSE 'approved' END,
                 last_active_at = CASE WHEN start_date <= NOW() THEN NOW() ELSE last_active_at END,
                 approved_at = NOW(), approved_by = $2, updated_at = NOW()
              WHERE id = $1 AND status = 'pending_approval' RETURNING *`, [id, adminId || null]);
        return CampaignPG.hydrate(rows[0]);
    }

    /** Borra sólo borradores del propio anunciante. */
    static async deleteDraft(id, userId) {
        if (!CampaignPG.isValidId(id)) return false;
        const { rowCount } = await pool.query(`DELETE FROM ad_campaigns WHERE id = $1 AND advertiser_id = $2 AND status = 'draft'`, [id, userId]);
        return rowCount > 0;
    }

    /** Resumen del anunciante en una sola consulta agregada. */
    static async summary(userId) {
        const { rows } = await pool.query(
            `SELECT status, COUNT(*)::int AS n, COALESCE(SUM(spent),0) AS spent, COALESCE(SUM(impressions),0) AS impressions,
                    COALESCE(SUM(clicks),0) AS clicks, COALESCE(SUM(conversions),0) AS conversions
               FROM ad_campaigns WHERE advertiser_id = $1 GROUP BY status`, [userId]);
        const out = { total: 0, byStatus: { active: 0, paused: 0, pending: 0, completed: 0, rejected: 0 }, totalSpent: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0, averageCTR: 0, averageCPC: 0 };
        for (const r of rows) {
            const clave = r.status === 'pending_approval' ? 'pending' : r.status;
            out.byStatus[clave] = (out.byStatus[clave] || 0) + r.n;
            out.total += r.n; out.totalSpent += Number(r.spent); out.totalImpressions += Number(r.impressions);
            out.totalClicks += Number(r.clicks); out.totalConversions += Number(r.conversions);
        }
        if (out.totalImpressions > 0) out.averageCTR = (out.totalClicks / out.totalImpressions * 100).toFixed(2);
        if (out.totalClicks > 0) out.averageCPC = (out.totalSpent / out.totalClicks).toFixed(2);
        return out;
    }
}

CampaignPG.STATUSES = STATUSES;
module.exports = CampaignPG;
