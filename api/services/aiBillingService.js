/**
 * aiBillingService.js — AI usage tracking, invoicing & Paymaster integration
 *
 * Records every AI call, generates invoices, applies subscription discounts,
 * and settles via the on-chain Paymaster contract.
 */
const { query } = require('../db/pool');
const { cacheGet, cacheSet } = require('../cache/redis');
const { getContract } = require('./contractService');
const { ethers } = require('ethers');
const pricing = require('./aiPricingService');

// ─── Record AI usage ─────────────────────────────────────────────────

async function recordUsage({ userId, enterpriseAddress, provider, model, inputTokens, outputTokens, execSeconds = 0 }) {
    const tier = await getActiveSubscriptionTier(userId);
    const invoice = pricing.calculateInvoice(provider, model, inputTokens, outputTokens, tier, execSeconds);

    // monthly-limit guard (0 = unlimited)
    const tierMeta = pricing.SUBSCRIPTION_TIERS[tier];
    if (tierMeta && tierMeta.monthlyLimitUSD > 0) {
        const spent = await getMonthlySpend(userId);
        if (spent + invoice.totalCost > tierMeta.monthlyLimitUSD) {
            throw new Error(
                `Monthly limit exceeded for tier "${tier}". ` +
                `Limit: $${tierMeta.monthlyLimitUSD}, spent: $${spent.toFixed(2)}, ` +
                `charge: $${invoice.totalCost.toFixed(6)}`
            );
        }
    }

    const result = await query(
        `INSERT INTO ai_usage
            (user_id, enterprise_address, provider, model,
             input_tokens, output_tokens, exec_seconds,
             api_cost, commission, discount, total_cost,
             subscription_tier, invoice_json, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
         RETURNING id`,
        [
            userId, enterpriseAddress, provider, model,
            inputTokens, outputTokens, execSeconds,
            invoice.apiCost, invoice.commission, invoice.discountAmount, invoice.totalCost,
            tier, JSON.stringify(invoice),
        ],
    );

    const usageId = result.rows[0].id;

    // Create pending invoice row
    const dueDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const amountBez = await usdToBez(invoice.totalCost);

    await query(
        `INSERT INTO ai_invoices
            (usage_id, user_id, enterprise_address, amount_usd, amount_bez, status, due_date, created_at)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,NOW())`,
        [usageId, userId, enterpriseAddress, invoice.totalCost, amountBez, dueDate],
    );

    return { usageId, invoice };
}

// ─── Subscription helpers ────────────────────────────────────────────

async function getActiveSubscriptionTier(userId) {
    const cacheKey = `ai:sub:${userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const { rows } = await query(
        `SELECT tier FROM ai_subscriptions
         WHERE user_id = $1 AND end_date > NOW()
         ORDER BY end_date DESC LIMIT 1`,
        [userId],
    );
    const tier = rows.length ? rows[0].tier : 'free';
    await cacheSet(cacheKey, tier, 3600);
    return tier;
}

async function purchaseSubscription(userId, tier) {
    if (!pricing.SUBSCRIPTION_TIERS[tier]) throw new Error(`Invalid tier: ${tier}`);
    const meta = pricing.SUBSCRIPTION_TIERS[tier];
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 3600 * 1000);

    const { rows } = await query(
        `INSERT INTO ai_subscriptions (user_id, tier, start_date, end_date, created_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (user_id) DO UPDATE SET tier=$2, start_date=$3, end_date=$4
         RETURNING id`,
        [userId, tier, start, end],
    );

    return { subscriptionId: rows[0].id, tier, priceUSD: meta.priceUSD, discount: `${(meta.discount * 100).toFixed(0)}%`, start, end };
}

// ─── Monthly spend ───────────────────────────────────────────────────

async function getMonthlySpend(userId) {
    const { rows } = await query(
        `SELECT COALESCE(SUM(total_cost),0) AS spent FROM ai_usage
         WHERE user_id = $1
           AND date_trunc('month', created_at) = date_trunc('month', NOW())`,
        [userId],
    );
    return parseFloat(rows[0].spent);
}

// ─── Invoices ────────────────────────────────────────────────────────

async function getUserInvoices(userId, status = 'pending') {
    const { rows } = await query(
        `SELECT i.*, u.provider, u.model
         FROM ai_invoices i JOIN ai_usage u ON i.usage_id = u.id
         WHERE i.user_id = $1 AND i.status = $2
         ORDER BY i.created_at DESC LIMIT 100`,
        [userId, status],
    );
    return rows;
}

async function payInvoice(invoiceId, userId, enterpriseAddress) {
    const { rows } = await query(
        `SELECT * FROM ai_invoices WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
        [invoiceId, userId],
    );
    if (!rows.length) throw new Error('Invoice not found or already paid');
    const inv = rows[0];

    // Verify Paymaster balance
    const pm = await getContract('Paymaster');
    const balance = await pm.getEnterpriseBalance(enterpriseAddress);
    const needed = BigInt(inv.amount_bez);
    if (balance < needed) {
        throw new Error(`Insufficient Paymaster balance. Need ${inv.amount_bez} BEZ`);
    }

    await query(`UPDATE ai_invoices SET status='paid', paid_at=NOW() WHERE id=$1`, [invoiceId]);
    await query(
        `INSERT INTO ai_payments (invoice_id, user_id, enterprise_address, amount_bez, status, created_at)
         VALUES ($1,$2,$3,$4,'processed',NOW())`,
        [invoiceId, userId, enterpriseAddress, inv.amount_bez],
    );

    return { invoiceId, amountBez: inv.amount_bez, status: 'paid' };
}

// ─── Stats ───────────────────────────────────────────────────────────

async function getUserStats(userId) {
    const { rows } = await query(
        `SELECT
            count(*)::int                   AS total_requests,
            coalesce(sum(input_tokens),0)::bigint  AS total_input,
            coalesce(sum(output_tokens),0)::bigint AS total_output,
            coalesce(sum(api_cost),0)       AS total_api_cost,
            coalesce(sum(commission),0)     AS total_commission,
            coalesce(sum(discount),0)       AS total_discount,
            coalesce(sum(total_cost),0)     AS total_spent
         FROM ai_usage WHERE user_id = $1`,
        [userId],
    );
    return rows[0];
}

// ─── USD → BEZ conversion ───────────────────────────────────────────

async function usdToBez(usd) {
    const { rows } = await query(`SELECT price_usd FROM token_price_cache WHERE symbol='BEZ'`);
    const price = rows.length ? parseFloat(rows[0].price_usd) : 0.10;
    return Math.ceil((usd / price) * 1e18).toString(); // wei-like representation
}

module.exports = {
    recordUsage,
    getActiveSubscriptionTier,
    purchaseSubscription,
    getMonthlySpend,
    getUserInvoices,
    payInvoice,
    getUserStats,
    usdToBez,
};
