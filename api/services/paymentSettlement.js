/**
 * paymentSettlement.js — single settlement path for BEZ buy orders.
 *
 * Extracted from POST /payments/settle so the route, the on-chain watcher
 * (bezSettlementWatcher) and any future PSP webhook all settle through the
 * SAME logic: price snapshot, BEZ conversion, tokenomics breakdown, note
 * audit trail, and the outbound `payment.settled` webhook event.
 */
const { query } = require('../db/pool');
const { calculateFeeBreakdown } = require('../config/tokenomics');
const paymentWebhooks = require('./paymentWebhooks');
const logger = require('pino')({ level: 'info', name: 'payment-settlement' });

class SettlementError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code; // NOT_FOUND | ALREADY_COMPLETED
    }
}

/**
 * Settle a buy order (mark completed/failed, compute BEZ amounts, emit webhook).
 * @param {object} p
 * @param {number} p.paymentId
 * @param {'completed'|'failed'} [p.status]
 * @param {string|null} [p.providerReference]  e.g. Stripe ref or 'onchain-watcher'
 * @param {string|null} [p.txHash]
 * @returns {{ payment: object, nextAction: string }}
 * @throws {SettlementError}
 */
async function settlePayment({ paymentId, status = 'completed', providerReference = null, txHash = null }) {
    const { rows } = await query(
        `SELECT id, wallet_address, amount_usd, platform_fee_usd, payment_method, type, status, note, app_id
         FROM payment_transactions
         WHERE id = $1 AND type = 'buy'
         LIMIT 1`,
        [paymentId]
    );
    if (rows.length === 0) {
        throw new SettlementError('NOT_FOUND', 'Payment buy order not found');
    }

    const payment = rows[0];
    if (payment.status === 'completed') {
        throw new SettlementError('ALREADY_COMPLETED', 'Payment already completed');
    }

    const price = await query(
        "SELECT price_usd FROM token_price_cache WHERE symbol = 'BEZ' LIMIT 1"
    ).catch(() => ({ rows: [] }));
    const priceUSD = parseFloat(price.rows[0]?.price_usd || '0.10');
    const amountUSD = parseFloat(payment.amount_usd || '0');
    const platformFeeUSD = parseFloat(payment.platform_fee_usd || '0');
    const netAmountUSD = Math.max(amountUSD - platformFeeUSD, 0);
    const amountBEZ = status === 'completed' && priceUSD > 0
        ? (netAmountUSD / priceUSD).toFixed(18)
        : null;
    const platformFeeBEZ = status === 'completed' && priceUSD > 0
        ? (platformFeeUSD / priceUSD).toFixed(18)
        : null;
    const feeBreakdown = calculateFeeBreakdown(netAmountUSD, priceUSD);

    let note = {};
    try { note = payment.note ? JSON.parse(payment.note) : {}; } catch { note = {}; }
    note.settlement = {
        status,
        providerReference,
        txHash,
        priceUSD,
        amountBEZ,
        platformFeeUSD,
        platformFeeBEZ,
        tokenomics: feeBreakdown.allocations,
        settledAt: new Date().toISOString(),
    };

    const update = await query(
        `UPDATE payment_transactions
         SET status = $1,
             amount_bez = COALESCE($2, amount_bez),
             tx_hash = COALESCE($3, tx_hash),
             platform_fee_bez = COALESCE($4, platform_fee_bez),
             note = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, wallet_address, amount_usd, amount_bez, payment_method, status, tx_hash, updated_at`,
        [status, amountBEZ, txHash, platformFeeBEZ, JSON.stringify(note), paymentId]
    );

    logger.info({ paymentId, status, amountBEZ, txHash, providerReference }, 'Payment settled');

    // Outbound event to the app that created the order (fire-and-forget: a
    // webhook failure must never roll back a settlement).
    if (payment.app_id) {
        paymentWebhooks.emit(payment.app_id, status === 'completed' ? 'payment.settled' : 'payment.failed', {
            paymentId: update.rows[0].id,
            status: update.rows[0].status,
            walletAddress: update.rows[0].wallet_address,
            amountUSD: parseFloat(update.rows[0].amount_usd || '0'),
            amountBEZ: update.rows[0].amount_bez,
            paymentMethod: update.rows[0].payment_method,
            txHash: update.rows[0].tx_hash,
            providerReference,
            settledAt: note.settlement.settledAt,
        }).catch((err) => logger.warn({ err: err.message, paymentId }, 'Webhook enqueue failed'));
    }

    return {
        payment: update.rows[0],
        nextAction: status === 'completed' && !txHash
            ? 'submit_or_attach_bez_transfer_tx'
            : 'settlement_recorded',
    };
}

module.exports = { settlePayment, SettlementError };
