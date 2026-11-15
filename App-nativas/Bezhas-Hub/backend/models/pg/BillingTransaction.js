const pool = require('../../db/pool');

class BillingTransactionPG {
    static async create(data) {
        const query = `
            INSERT INTO billing_transactions (
                user_id, wallet_address, type, amount, currency,
                status, payment_method, stripe_payment_intent_id,
                blockchain_tx_hash, campaign_id, description, metadata, error_message
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13
            ) RETURNING *;
        `;
        const values = [
            data.userId || null,
            data.walletAddress,
            data.type,
            data.amount,
            data.currency,
            data.status || 'pending',
            data.paymentMethod || null,
            data.stripePaymentIntentId || null,
            data.blockchainTxHash || null,
            data.campaignId || null,
            data.description,
            JSON.stringify(data.metadata || {}),
            data.errorMessage || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static hydrate(r) {
        if (!r) return null;
        return {
            _id: r.id, id: r.id, userId: r.user_id, walletAddress: r.wallet_address, type: r.type,
            amount: r.amount == null ? null : Number(r.amount), currency: r.currency, status: r.status,
            paymentMethod: r.payment_method, stripePaymentIntentId: r.stripe_payment_intent_id,
            blockchainTxHash: r.blockchain_tx_hash, campaignId: r.campaign_id, description: r.description,
            metadata: r.metadata || {}, errorMessage: r.error_message, processedAt: r.processed_at, createdAt: r.created_at,
        };
    }

    static async findById(id, db = pool) {
        if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
        const { rows } = await db.query('SELECT * FROM billing_transactions WHERE id = $1', [id]);
        return BillingTransactionPG.hydrate(rows[0]);
    }

    static async findByStripeIntent(paymentIntentId, db = pool) {
        const { rows } = await db.query(`SELECT * FROM billing_transactions WHERE stripe_payment_intent_id = $1 AND type = 'deposit_fiat'`, [paymentIntentId]);
        return BillingTransactionPG.hydrate(rows[0]);
    }

    static async attachStripeIntent(id, paymentIntentId) {
        const { rows } = await pool.query('UPDATE billing_transactions SET stripe_payment_intent_id = $2 WHERE id = $1 RETURNING *', [id, paymentIntentId]);
        return BillingTransactionPG.hydrate(rows[0]);
    }

    /**
     * Marca la transacción como completada SÓLO si seguía pendiente o en proceso, y devuelve la fila únicamente a quien lo
     * consigue. Es la barrera contra el doble abono: Stripe reintenta los webhooks y una entrega repetida ya no encuentra la
     * transacción pendiente. Pásale el cliente de la transacción para abonar el saldo en la misma transacción SQL.
     */
    static async completeIfPending(id, db = pool) {
        const { rows } = await db.query(
            `UPDATE billing_transactions SET status = 'completed', processed_at = CURRENT_TIMESTAMP
              WHERE id = $1 AND status IN ('pending', 'processing') RETURNING *`, [id]);
        return BillingTransactionPG.hydrate(rows[0]);
    }

    static async markFailed(id, errorMessage, db = pool) {
        const { rows } = await db.query(
            `UPDATE billing_transactions SET status = 'failed', error_message = $2, processed_at = CURRENT_TIMESTAMP
              WHERE id = $1 AND status IN ('pending', 'processing') RETURNING *`, [id, String(errorMessage).slice(0, 2000)]);
        return BillingTransactionPG.hydrate(rows[0]);
    }

    /** Historial del usuario (por id o por wallet), paginado y filtrable por tipo. */
    static async history({ userId, walletAddress }, { type = null, page = 1, limit = 20 } = {}) {
        const where = ['(user_id = $1 OR LOWER(wallet_address) = LOWER($2))'];
        const params = [userId, walletAddress || ''];
        if (type) { params.push(type); where.push(`type = $${params.length}::billing_type`); }
        const [lista, total] = await Promise.all([
            pool.query(`SELECT * FROM billing_transactions WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, (page - 1) * limit]),
            pool.query(`SELECT COUNT(*)::int AS n FROM billing_transactions WHERE ${where.join(' AND ')}`, params),
        ]);
        return { transactions: lista.rows.map(BillingTransactionPG.hydrate), total: total.rows[0].n };
    }

    static async updateStatus(id, newStatus, extra = {}) {
        const setClauses = [`status = $2`];
        const values = [id, newStatus];
        let paramIdx = 3;

        if (newStatus === 'completed') {
            setClauses.push(`processed_at = CURRENT_TIMESTAMP`);
        }

        if (extra.errorMessage) {
            setClauses.push(`error_message = $${paramIdx}`);
            values.push(extra.errorMessage);
            paramIdx++;
        }
        if (extra.blockchainTxHash) {
            setClauses.push(`blockchain_tx_hash = $${paramIdx}`);
            values.push(extra.blockchainTxHash);
            paramIdx++;
        }

        const query = `
            UPDATE billing_transactions
            SET ${setClauses.join(', ')}
            WHERE id = $1 RETURNING *
        `;
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByUserId(userId, limit = 50) {
        const result = await pool.query(
            'SELECT * FROM billing_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
            [userId, limit]
        );
        return result.rows;
    }
}

module.exports = BillingTransactionPG;
