const pool = require('../../db/pool');

class BridgeShipmentPG {
    static async create(data) {
        const query = `
            INSERT INTO bridge_shipments (
                tracking_number, carrier, status, origin, destination, metadata
            ) VALUES (
                $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb
            ) RETURNING *;
        `;
        const values = [
            data.trackingNumber,
            data.carrier,
            data.status || 'pending',
            JSON.stringify(data.origin || {}),
            JSON.stringify(data.destination || {}),
            JSON.stringify(data.metadata || {})
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByTrackingNumber(trackingNumber) {
        const result = await pool.query('SELECT * FROM bridge_shipments WHERE tracking_number = $1', [trackingNumber]);
        return result.rows[0];
    }

    static async addEvent(trackingNumber, event) {
        const query = `
            UPDATE bridge_shipments 
            SET 
                history = history || $1::jsonb,
                status = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE tracking_number = $3 RETURNING *;
        `;
        const result = await pool.query(query, [
            JSON.stringify([event]),
            event.status,
            trackingNumber
        ]);
        return result.rows[0];
    }
}

module.exports = BridgeShipmentPG;
