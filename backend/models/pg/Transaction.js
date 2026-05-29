const pool = require('../../db/pool');

class TransactionPG {
    static async create(data) {
        const query = `
            INSERT INTO transactions (
                user_id, tx_hash, type, amount, currency, status, error_message, metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8::jsonb
            ) RETURNING *;
        `;
        const values = [
            data.user || data.userId,
            data.txHash,
            data.type,
            data.amount,
            data.currency || 'BEZ',
            data.status || 'pending',
            data.errorMessage,
            JSON.stringify(data.metadata || {})
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async updateStatus(id, newStatus, errorMessage = null) {
        let query;
        let values;
        if (errorMessage) {
            query = `
                UPDATE transactions 
                SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3 RETURNING *;
            `;
            values = [newStatus, errorMessage, id];
        } else {
            query = `
                UPDATE transactions 
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 RETURNING *;
            `;
            values = [newStatus, id];
        }
        const result = await pool.query(query, values);
        return result.rows[0];
    }
}

module.exports = TransactionPG;
