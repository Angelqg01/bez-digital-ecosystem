const pool = require('../../db/pool');

class BridgeSyncedItemPG {
    static async create(data) {
        const query = `
            INSERT INTO bridge_synced_items (
                bezhas_id, external_id, platform, title, description, price, stock, status, metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb
            ) RETURNING *;
        `;
        const values = [
            data.beZhasId,
            data.externalId,
            data.platform,
            data.title,
            data.description,
            JSON.stringify(data.price || {}),
            data.stock || 0,
            data.status || 'active',
            JSON.stringify(data.metadata || {})
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByBezhasId(bezhasId) {
        const result = await pool.query('SELECT * FROM bridge_synced_items WHERE bezhas_id = $1', [bezhasId]);
        return result.rows[0];
    }

    static async updateByBezhasId(bezhasId, updates) {
        const setClauses = [];
        const values = [];
        let paramIdx = 1;

        for (const [key, value] of Object.entries(updates)) {
            let dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (typeof value === 'object') {
                setClauses.push(`${dbKey} = $${paramIdx}::jsonb`);
                values.push(JSON.stringify(value));
            } else {
                setClauses.push(`${dbKey} = $${paramIdx}`);
                values.push(value);
            }
            paramIdx++;
        }

        if (setClauses.length === 0) return null;
        
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        setClauses.push(`last_synced_at = CURRENT_TIMESTAMP`);

        const query = `
            UPDATE bridge_synced_items 
            SET ${setClauses.join(', ')} 
            WHERE bezhas_id = $${paramIdx} RETURNING *;
        `;
        values.push(bezhasId);
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }
}

module.exports = BridgeSyncedItemPG;
