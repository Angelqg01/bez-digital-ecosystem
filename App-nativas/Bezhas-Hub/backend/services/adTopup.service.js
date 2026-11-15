const pool = require('../db/pool');
const AdBalance = require('../models/pg/AdBalance');
const BillingTransaction = require('../models/pg/BillingTransaction');

/**
 * Abono de saldo publicitario. Las dos vías (Stripe y BEZ en cadena) comparten el mismo patrón: UNA transacción SQL que marca la
 * recarga como completada y suma el saldo; si la recarga ya estaba completada no se vuelve a abonar (idempotente).
 */

/** Webhook payment_intent.succeeded de Stripe. Devuelve { credited, reason }. */
async function completeStripeTopup(paymentIntent) {
    const tx = await BillingTransaction.findByStripeIntent(paymentIntent.id);
    if (!tx) return { credited: false, reason: 'NO_TRANSACTION' };

    // Lo que Stripe cobró es la verdad; la recarga se creó con el mismo importe. Si no coinciden, no se abona nada.
    const recibido = Number(paymentIntent.amount_received != null ? paymentIntent.amount_received : paymentIntent.amount) / 100;
    if (String(paymentIntent.currency || '').toLowerCase() !== 'eur' || Math.abs(recibido - tx.amount) > 0.005) {
        await BillingTransaction.markFailed(tx.id, `Importe o moneda no coinciden con el cobro de Stripe (${recibido} ${paymentIntent.currency})`);
        return { credited: false, reason: 'AMOUNT_MISMATCH' };
    }

    const client = await pool.getClient();
    try {
        await client.query('BEGIN');
        const done = await BillingTransaction.completeIfPending(tx.id, client);
        if (!done) { await client.query('ROLLBACK'); return { credited: false, reason: 'ALREADY_PROCESSED' }; }
        await AdBalance.credit(tx.userId, tx.walletAddress, { fiat: tx.amount, depositedEur: tx.amount }, client);
        await client.query('COMMIT');
        return { credited: true, amountEur: tx.amount, userId: tx.userId };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Abona un depósito BEZ ya verificado en cadena. El índice único sobre el hash impide acreditar dos veces la misma transacción
 * (incluso con peticiones simultáneas): la segunda falla con 23505 y se devuelve { credited: false, reason: 'DUPLICATE_TX' }.
 */
async function creditBezDeposit({ userId, walletAddress, txHash, amountBez, bezEurPrice }) {
    const eurEquivalent = amountBez * bezEurPrice;
    const client = await pool.getClient();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `INSERT INTO billing_transactions (user_id, wallet_address, type, amount, currency, status, payment_method, blockchain_tx_hash, description, metadata, processed_at)
             VALUES ($1,$2,'deposit_bez',$3,'BEZ','completed','bez-coin',$4,$5,$6::jsonb,CURRENT_TIMESTAMP) RETURNING *`,
            [userId, walletAddress, amountBez, txHash.toLowerCase(), `Recarga con BEZ-Coin - ${amountBez} BEZ (≈€${eurEquivalent.toFixed(2)})`, JSON.stringify({ eurEquivalent, bezEurPrice, verifiedOnChain: true })]);
        const balance = await AdBalance.credit(userId, walletAddress, { bez: amountBez, depositedEur: eurEquivalent }, client);
        await client.query('COMMIT');
        return { credited: true, transaction: BillingTransaction.hydrate(rows[0]), balance, eurEquivalent };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') return { credited: false, reason: 'DUPLICATE_TX' };
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { completeStripeTopup, creditBezDeposit };
