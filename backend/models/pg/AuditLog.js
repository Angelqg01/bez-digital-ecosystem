const pool = require('../../db/pool');

class AuditLogPG {
    static async log(params) {
        try {
            const query = `
                INSERT INTO audit_logs (
                    user_id, performed_by, action, resource, resource_id,
                    section, previous_state, new_state, metadata
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb
                ) RETURNING *;
            `;
            const values = [
                params.user || null,
                params.performedBy,
                params.action,
                params.resource,
                params.resourceId || null,
                params.section || null,
                params.previousState ? JSON.stringify(params.previousState) : null,
                params.newState ? JSON.stringify(params.newState) : null,
                params.metadata ? JSON.stringify(params.metadata) : null
            ];

            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Failed to create AuditLog (PG):', error.message);
            return null; // Do not throw, keep audit transparent
        }
    }

    static async getRecentLogs(limit = 50) {
        const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
        return result.rows;
    }

    static async getLogsByResource(resource, limit = 100) {
        const query = `
            SELECT a.*, u.username, u.email 
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.resource = $1
            ORDER BY a.created_at DESC
            LIMIT $2;
        `;
        const result = await pool.query(query, [resource, limit]);
        return result.rows;
    }
}

module.exports = AuditLogPG;
