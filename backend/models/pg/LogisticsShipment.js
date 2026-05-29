const pool = require('../../db/pool');

class LogisticsShipmentPG {
    static async create(data) {
        const query = `
            INSERT INTO logistics_shipments (
                shipment_type, status, carrier, tracking_number, origin, destination, container_info, parcel_info, metadata
            ) VALUES (
                $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb
            ) RETURNING *;
        `;
        const values = [
            data.shipmentType,
            data.status || 'CREATED',
            data.carrier,
            data.trackingNumber,
            JSON.stringify(data.origin || {}),
            JSON.stringify(data.destination || {}),
            JSON.stringify(data.containerInfo || {}),
            JSON.stringify(data.parcelInfo || {}),
            JSON.stringify(data.metadata || {})
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM logistics_shipments WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByTrackingNumber(trackingNumber) {
        const result = await pool.query('SELECT * FROM logistics_shipments WHERE tracking_number = $1', [trackingNumber]);
        return result.rows[0];
    }

    static async updateStatus(id, newStatus, metadata = {}) {
        const query = `
            UPDATE logistics_shipments 
            SET 
                status = $1,
                metadata = metadata || $2::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 RETURNING *;
        `;
        const result = await pool.query(query, [newStatus, JSON.stringify(metadata), id]);
        return result.rows[0];
    }
}

module.exports = LogisticsShipmentPG;
