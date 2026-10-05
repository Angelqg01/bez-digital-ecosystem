/**
 * Créditos del chat de IA.
 *
 * Cada mensaje consume 1: primero de la cuota del plan (diaria y mensual) y, agotada esa, de los
 * créditos comprados. Sin cuota ni créditos, el chat responde 402 con lo que la persona puede hacer
 * (suscribirse, mejorar de plan o comprar más). Todo se decide en el servidor.
 */
const { SUBSCRIPTION_TIERS } = require('../../config/tier.config');
const { publicPacks } = require('../../config/credit-packs');

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'];
const day = (d = new Date()) => `d:${d.toISOString().slice(0, 10)}`;
const month = (d = new Date()) => `m:${d.toISOString().slice(0, 7)}`;
const finite = (n) => (Number.isFinite(n) ? n : Infinity);

/** Cuota del plan. `free`/desconocido = el plan más bajo. */
function allowanceFor(plan) {
    const tiers = Object.values(SUBSCRIPTION_TIERS);
    const tier = tiers.find((t) => String(t.id).toLowerCase() === String(plan || '').toLowerCase()) || tiers[0];
    let daily = finite(tier.ai && tier.ai.dailyQueries);
    let monthly = finite(tier.ai && tier.ai.monthlyQueries);
    const override = Number(process.env.AI_CREDITS_LIMIT_OVERRIDE);
    if (Number.isFinite(override) && override >= 0) {
        if (daily !== Infinity) daily = override;
        if (monthly !== Infinity) monthly = override;
    }
    return { tierId: String(tier.id).toLowerCase(), daily, monthly };
}

/** Qué ofrecer cuando se agota: sin plan de pago → suscribirse; con plan → mejorar o comprar créditos. */
function exhaustedKind(plan) {
    const { tierId } = allowanceFor(plan);
    const paid = Object.values(SUBSCRIPTION_TIERS).some((t) => String(t.id).toLowerCase() === tierId && Number(t.price.monthly) > 0);
    return paid ? 'upgrade' : 'subscribe';
}

class MemoryCreditStore {
    constructor() { this.usage = new Map(); this.balance = new Map(); this.grants = new Set(); }
    _u(u, p) { return this.usage.get(`${u}|${p}`) || 0; }
    async tryConsumeQuota(userId, { dayKey, monthKey, daily, monthly }) {
        if (this._u(userId, dayKey) >= daily || this._u(userId, monthKey) >= monthly) return false;
        this.usage.set(`${userId}|${dayKey}`, this._u(userId, dayKey) + 1);
        this.usage.set(`${userId}|${monthKey}`, this._u(userId, monthKey) + 1);
        return true;
    }
    async refundQuota(userId, { dayKey, monthKey }) {
        for (const k of [dayKey, monthKey]) this.usage.set(`${userId}|${k}`, Math.max(0, this._u(userId, k) - 1));
    }
    async takeCredit(userId) {
        const b = this.balance.get(userId) || 0;
        if (b <= 0) return false;
        this.balance.set(userId, b - 1);
        return true;
    }
    async addCredits(userId, n) { this.balance.set(userId, (this.balance.get(userId) || 0) + n); }
    async grant(userId, sessionId, packId, credits) {
        if (this.grants.has(sessionId)) return false;
        this.grants.add(sessionId);
        await this.addCredits(userId, credits);
        return true;
    }
    async snapshot(userId, { dayKey, monthKey }) {
        return { dailyUsed: this._u(userId, dayKey), monthlyUsed: this._u(userId, monthKey), credits: this.balance.get(userId) || 0 };
    }
}

class PgCreditStore {
    constructor(pool) { this.pool = pool; }
    async tryConsumeQuota(userId, { dayKey, monthKey, daily, monthly }) {
        const client = await this.pool.getClient();
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO ai_usage (user_id, period, count) VALUES ($1,$2,0),($1,$3,0) ON CONFLICT DO NOTHING`, [userId, dayKey, monthKey]);
            const { rows } = await client.query(
                `SELECT period, count FROM ai_usage WHERE user_id = $1 AND period = ANY($2) FOR UPDATE`, [userId, [dayKey, monthKey]]);
            const get = (p) => (rows.find((r) => r.period === p) || { count: 0 }).count;
            if (get(dayKey) >= daily || get(monthKey) >= monthly) { await client.query('ROLLBACK'); return false; }
            await client.query(`UPDATE ai_usage SET count = count + 1 WHERE user_id = $1 AND period = ANY($2)`, [userId, [dayKey, monthKey]]);
            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            throw e;
        } finally { client.release(); }
    }
    async refundQuota(userId, { dayKey, monthKey }) {
        await this.pool.query(`UPDATE ai_usage SET count = GREATEST(count - 1, 0) WHERE user_id = $1 AND period = ANY($2)`, [userId, [dayKey, monthKey]]);
    }
    async takeCredit(userId) {
        const { rowCount } = await this.pool.query(
            `UPDATE users SET ai_credit_balance = ai_credit_balance - 1 WHERE id = $1 AND ai_credit_balance > 0`, [userId]);
        return rowCount === 1;
    }
    async addCredits(userId, n) {
        await this.pool.query(`UPDATE users SET ai_credit_balance = ai_credit_balance + $2 WHERE id = $1`, [userId, n]);
    }
    async grant(userId, sessionId, packId, credits) {
        const client = await this.pool.getClient();
        try {
            await client.query('BEGIN');
            const ins = await client.query(
                `INSERT INTO ai_credit_grants (session_id, user_id, pack_id, credits) VALUES ($1,$2,$3,$4) ON CONFLICT (session_id) DO NOTHING`,
                [sessionId, userId, packId, credits]);
            if (ins.rowCount !== 1) { await client.query('ROLLBACK'); return false; }
            await client.query(`UPDATE users SET ai_credit_balance = ai_credit_balance + $2 WHERE id = $1`, [userId, credits]);
            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            throw e;
        } finally { client.release(); }
    }
    async snapshot(userId, { dayKey, monthKey }) {
        const u = await this.pool.query(`SELECT period, count FROM ai_usage WHERE user_id = $1 AND period = ANY($2)`, [userId, [dayKey, monthKey]]);
        const b = await this.pool.query(`SELECT ai_credit_balance FROM users WHERE id = $1`, [userId]);
        const get = (p) => (u.rows.find((r) => r.period === p) || { count: 0 }).count;
        return { dailyUsed: get(dayKey), monthlyUsed: get(monthKey), credits: b.rows[0] ? b.rows[0].ai_credit_balance : 0 };
    }
}

function defaultStore() {
    const choice = process.env.AI_CREDITS_STORE || (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL ? 'pg' : 'memory');
    if (process.env.NODE_ENV === 'test' && !process.env.AI_CREDITS_STORE) return new MemoryCreditStore();
    return choice === 'pg' ? new PgCreditStore(require('../../db/pool')) : new MemoryCreditStore();
}

/** En pruebas no se mide salvo que se active expresamente: así las suites de chat no dependen de la cuota. */
const enforced = () => (process.env.NODE_ENV === 'test' ? process.env.AI_CREDITS_ENFORCE === 'true' : process.env.AI_CREDITS_ENFORCE !== 'false');

class CreditService {
    constructor(store = defaultStore()) { this.store = store; }

    _isAdmin(p) { return (p.roles || []).some((r) => ADMIN_ROLES.includes(String(r).toUpperCase())); }

    /** Descuenta 1 crédito o lanza 402 con las opciones. Devuelve el recibo para poder devolverlo si el modelo falla. */
    async consume(principal, now = new Date()) {
        if (!enforced() || this._isAdmin(principal)) return { source: 'none' };
        const a = allowanceFor(principal.plan);
        const keys = { dayKey: day(now), monthKey: month(now) };
        if (await this.store.tryConsumeQuota(principal.userId, { ...keys, daily: a.daily, monthly: a.monthly })) {
            return { source: 'plan', userId: principal.userId, ...keys };
        }
        if (await this.store.takeCredit(principal.userId)) return { source: 'credit', userId: principal.userId };
        const status = await this.status(principal, now);
        throw Object.assign(new Error('Has agotado tus créditos de chat'), {
            status: 402,
            payload: {
                code: 'CREDITS_EXHAUSTED',
                kind: exhaustedKind(principal.plan),
                plan: a.tierId,
                usage: status,
                packs: publicPacks(),
                upgradeActionId: 'subscribe_plans',
            },
        });
    }

    async refund(receipt) {
        if (!receipt) return;
        try {
            if (receipt.source === 'plan') await this.store.refundQuota(receipt.userId, receipt);
            else if (receipt.source === 'credit') await this.store.addCredits(receipt.userId, 1);
        } catch (e) { console.warn('⚠️ No se pudo devolver el crédito:', e.message); }
    }

    async status(principal, now = new Date()) {
        const a = allowanceFor(principal.plan);
        const s = await this.store.snapshot(principal.userId, { dayKey: day(now), monthKey: month(now) });
        const n = (v) => (v === Infinity ? null : v); // null = ilimitado
        return {
            plan: a.tierId, dailyLimit: n(a.daily), dailyUsed: s.dailyUsed, monthlyLimit: n(a.monthly), monthlyUsed: s.monthlyUsed,
            credits: s.credits,
        };
    }

    /** Aplica un pack pagado. Idempotente por sesión de Stripe. */
    grantPack(userId, sessionId, pack) { return this.store.grant(userId, sessionId, pack.id, pack.credits); }
}

let shared = null;
/** Una sola instancia para chat y webhook (con el almacén en memoria de desarrollo, dos instancias no verían el mismo saldo). */
const getCreditService = () => (shared ||= new CreditService());

module.exports = { getCreditService, CreditService, MemoryCreditStore, PgCreditStore, allowanceFor, exhaustedKind, enforced };
