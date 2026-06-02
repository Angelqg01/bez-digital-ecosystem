const pool = require('../../db/pool');

class PaymentPG {
    static async create(data) {
        const query = `
            INSERT INTO payments (
                payment_intent_id, session_id, stripe_customer_id, user_id,
                wallet_address, email, type, status, fiat_amount,
                fiat_currency, bez_amount, exchange_rate, metadata, distribution
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            ) RETURNING *;
        `;
        
        const values = [
            data.paymentIntentId,
            data.sessionId || null,
            data.stripeCustomerId || null,
            data.userId || null,
            data.walletAddress,
            data.email || null,
            data.type,
            data.status || 'pending',
            data.fiatAmount,
            data.fiatCurrency || 'usd',
            data.bezAmount || null,
            data.exchangeRate || null,
            data.metadata ? JSON.stringify(data.metadata) : null,
            data.distribution ? JSON.stringify(data.distribution) : null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByPaymentIntent(paymentIntentId) {
        const result = await pool.query('SELECT * FROM payments WHERE payment_intent_id = $1', [paymentIntentId]);
        return result.rows[0];
    }

    static async markCompleted(id, txHash, blockNumber, gasUsed) {
        const query = `
            UPDATE payments
            SET status = 'completed',
                tx_hash = $2,
                block_number = $3,
                gas_used = $4,
                distributed_at = CURRENT_TIMESTAMP,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [id, txHash, blockNumber, gasUsed]);
        return result.rows[0];
    }

    static async markFailed(id, errorMessage) {
        const query = `
            UPDATE payments
            SET status = 'failed',
                error_message = $2,
                last_retry_at = CURRENT_TIMESTAMP,
                retry_count = retry_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [id, errorMessage]);
        return result.rows[0];
    }

    static async updateByPaymentIntent(paymentIntentId, updateFields) {
        const setClauses = [];
        const values = [paymentIntentId];
        let paramIdx = 2;

        const mapField = (key) => {
            if (key === 'status') return 'status';
            if (key === 'txHash') return 'tx_hash';
            if (key === 'errorMessage') return 'error_message';
            if (key === 'completedAt') return 'completed_at';
            if (key === 'updatedAt') return 'updated_at';
            return key; // We ignore unmapped extra fields or map to metadata in production
        };

        for (const [key, val] of Object.entries(updateFields)) {
            const dbField = mapField(key);
            if (dbField === key && key !== 'status') continue; // Skip unsupported fields directly
            
            if (val === null) {
                setClauses.push(`${dbField} = NULL`);
            } else {
                setClauses.push(`${dbField} = $${paramIdx}`);
                values.push(val);
                paramIdx++;
            }
        }

        if (setClauses.length === 0) return null;
        const query = `UPDATE payments SET ${setClauses.join(', ')} WHERE payment_intent_id = $1 RETURNING *;`;
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async getStats(startDate, endDate) {
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate || new Date();

        const query = `
            SELECT 
                status as _id,
                COUNT(*) as count,
                SUM(fiat_amount) as total_fiat,
                SUM(bez_amount) as total_bez
            FROM payments
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY status;
        `;
        const result = await pool.query(query, [start, end]);
        return result.rows.map(row => ({
            _id: row._id,
            count: Number(row.count),
            totalFiat: Number(row.total_fiat),
            totalBez: Number(row.total_bez)
        }));
    }
}

module.exports = PaymentPG;
