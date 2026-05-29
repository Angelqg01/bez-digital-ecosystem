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
