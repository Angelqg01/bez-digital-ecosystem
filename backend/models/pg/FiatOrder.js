const pool = require('../../db/pool');

class FiatOrderPG {
    static async create(data) {
        const query = `
            INSERT INTO fiat_orders (
                user_wallet, user_email, fiat_amount, fiat_currency, bez_amount, status, payment_method, reference_id, metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb
            ) RETURNING *;
        `;
        const values = [
            data.userWallet,
            data.userEmail,
            data.fiatAmount,
            data.fiatCurrency || 'EUR',
            data.bezAmount,
            data.status || 'PENDING',
            data.paymentMethod,
            data.referenceId || `FIAT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            JSON.stringify(data.metadata || {})
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM fiat_orders WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async updateStatus(id, newStatus, adminNotes = null) {
        const query = `
            UPDATE fiat_orders 
            SET 
                status = $1,
                admin_notes = COALESCE($2, admin_notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 RETURNING *;
        `;
        const result = await pool.query(query, [newStatus, adminNotes, id]);
        return result.rows[0];
    }
}

module.exports = FiatOrderPG;
