const pool = require('../../db/pool');

class BridgeOrderPG {
    static async create(data) {
        const query = `
            INSERT INTO bridge_orders (
                bezhas_order_id, external_order_id, platform, buyer, seller,
                items, shipping_address, total_amount, shipping_cost, currency,
                status, payment_status, escrow_id, escrow_status, tracking_number,
                api_key_id, metadata
            ) VALUES (
                $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17::jsonb
            ) RETURNING *;
        `;
        
        const values = [
            data.beZhasOrderId,
            data.externalOrderId,
            data.platform || 'other',
            JSON.stringify(data.buyer || {}),
            JSON.stringify(data.seller || {}),
            JSON.stringify(data.items || []),
            JSON.stringify(data.shippingAddress || {}),
            data.totalAmount,
            data.shippingCost || 0,
            data.currency || 'EUR',
            data.status || 'pending',
            data.paymentStatus || 'pending',
            data.escrowId || null,
            data.escrowStatus || 'pending',
            data.trackingNumber || null,
            data.apiKey || null, // Ensure casting if necessary
            JSON.stringify(data.metadata || {})
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByOrderId(bezhasOrderId) {
        const result = await pool.query('SELECT * FROM bridge_orders WHERE bezhas_order_id = $1', [bezhasOrderId]);
        return result.rows[0];
    }

    static async updateStatus(id, newStatus) {
        const query = `
            UPDATE bridge_orders 
            SET status = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING *
        `;
        const result = await pool.query(query, [id, newStatus]);
        return result.rows[0];
    }

    static async markPaid(id) {
        const query = `
            UPDATE bridge_orders 
            SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING *
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }
}

module.exports = BridgeOrderPG;
