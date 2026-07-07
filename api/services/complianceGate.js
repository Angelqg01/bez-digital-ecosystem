/**
 * complianceGate.js — tiered KYC volume gates for buy orders (MiCA-style).
 *
 * A wallet's KYC level caps its cumulative 12-month buy volume:
 *   level 0 (anonymous)  → KYC_TIER0_LIMIT_USD  (default 150)
 *   level 1 (identity)   → KYC_TIER1_LIMIT_USD  (default 15000)
 *   level 2 (enhanced)   → unlimited
 *
 * The gate counts pending+processing+completed orders (an attacker can't
 * split volume across in-flight orders) and answers BEFORE the order is
 * created, so an over-limit buy fails with KYC_REQUIRED instead of parking
 * money in an order that can never settle.
 */
const { query } = require('../db/pool');

const TIER_LIMITS_USD = [
    parseFloat(process.env.KYC_TIER0_LIMIT_USD || '150'),
    parseFloat(process.env.KYC_TIER1_LIMIT_USD || '15000'),
    Infinity,
];

/** Current KYC level of a wallet (0 if never verified). */
async function getKycLevel(walletAddress) {
    const { rows } = await query(
        'SELECT level, provider, verified_at FROM kyc_status WHERE wallet_address = $1',
        [walletAddress.toLowerCase()]
    );
    return rows.length > 0
        ? { level: rows[0].level, provider: rows[0].provider, verifiedAt: rows[0].verified_at }
        : { level: 0, provider: null, verifiedAt: null };
}

/** Cumulative 12-month buy volume (USD) that counts against the cap. */
async function getRollingVolumeUSD(walletAddress) {
    const { rows } = await query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payment_transactions
         WHERE LOWER(wallet_address) = $1 AND type = 'buy'
           AND status IN ('pending', 'processing', 'completed')
           AND created_at > NOW() - INTERVAL '365 days'`,
        [walletAddress.toLowerCase()]
    );
    return parseFloat(rows[0]?.total || '0');
}

/**
 * Decide whether a new buy of `amountUSD` is allowed for this wallet.
 * @returns {{ allowed: boolean, level: number, limitUSD: number|null,
 *             usedUSD: number, requiredLevel?: number }}
 */
async function checkBuyAllowed(walletAddress, amountUSD) {
    const { level } = await getKycLevel(walletAddress);
    const limitUSD = TIER_LIMITS_USD[level];
    if (limitUSD === Infinity) {
        return { allowed: true, level, limitUSD: null, usedUSD: 0 };
    }
    const usedUSD = await getRollingVolumeUSD(walletAddress);
    if (usedUSD + amountUSD <= limitUSD) {
        return { allowed: true, level, limitUSD, usedUSD };
    }
    // The smallest level whose cap would fit the requested total.
    let requiredLevel = level + 1;
    while (requiredLevel < 2 && usedUSD + amountUSD > TIER_LIMITS_USD[requiredLevel]) requiredLevel += 1;
    return { allowed: false, level, limitUSD, usedUSD, requiredLevel };
}

/** Upsert a wallet's KYC level (internal: provider callback / backoffice). */
async function setKycLevel({ walletAddress, level, provider = null, reference = null }) {
    const { rows } = await query(
        `INSERT INTO kyc_status (wallet_address, level, provider, reference, verified_at, updated_at)
         VALUES ($1, $2, $3, $4, CASE WHEN $2 > 0 THEN NOW() ELSE NULL END, NOW())
         ON CONFLICT (wallet_address) DO UPDATE
         SET level = $2, provider = $3, reference = $4,
             verified_at = CASE WHEN $2 > 0 THEN NOW() ELSE NULL END, updated_at = NOW()
         RETURNING wallet_address, level, provider, verified_at`,
        [walletAddress.toLowerCase(), level, provider, reference]
    );
    return rows[0];
}

module.exports = { checkBuyAllowed, getKycLevel, getRollingVolumeUSD, setKycLevel, TIER_LIMITS_USD };
