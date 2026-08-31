const pool = require('../../db/pool');

class ApiLogPG {
    static async create(data) {
        const query = `
            INSERT INTO api_logs (
                api_key_id, user_id, request, response, client, metadata, timestamp, org_id, site_id
            ) VALUES (
                $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8::uuid, $9::uuid
            ) RETURNING *;
        `;
        const values = [
            data.apiKeyId,
            data.userId,
            JSON.stringify(data.request),
            JSON.stringify(data.response),
            JSON.stringify(data.client || {}),
            JSON.stringify(data.metadata || {}),
            data.timestamp || new Date().toISOString(),
            data.orgId || null,
            data.siteId || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Uso agregado por sede para facturación B2B. Devuelve nº de llamadas por
     * site_id (y total) en una ventana temporal.
     */
    static async getUsageByOrg(orgId, { since = "30 days" } = {}) {
        const query = `
            SELECT site_id,
                   COUNT(*)::int AS requests,
                   AVG((response->>'responseTime')::numeric) AS avg_response_time,
                   AVG(CASE WHEN (response->>'statusCode')::numeric >= 400 THEN 1 ELSE 0 END) AS error_rate
              FROM api_logs
             WHERE org_id = $1::uuid AND timestamp >= NOW() - ($2)::interval
             GROUP BY site_id
             ORDER BY requests DESC;
        `;
        const { rows } = await pool.query(query, [orgId, since]);
        const bySite = rows.map((r) => ({
            siteId: r.site_id,
            requests: Number(r.requests),
            avgResponseTime: r.avg_response_time != null ? Number(r.avg_response_time).toFixed(2) : null,
            errorRate: r.error_rate != null ? (Number(r.error_rate) * 100).toFixed(2) : null,
        }));
        const totalRequests = bySite.reduce((s, r) => s + r.requests, 0);
        return { orgId, since, totalRequests, bySite };
    }

    static async getTopEndpoints(apiKeyId, limit = 10) {
        // Find most used endpoints in last 7 days
        const query = `
            SELECT 
                request->>'endpoint' as endpoint,
                COUNT(*) as count,
                AVG((response->>'responseTime')::numeric) as avg_response_time,
                AVG(CASE WHEN (response->>'statusCode')::numeric >= 400 THEN 1 ELSE 0 END) as error_rate
            FROM api_logs
            WHERE api_key_id = $1 AND timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY request->>'endpoint'
            ORDER BY count DESC
            LIMIT $2;
        `;
        const result = await pool.query(query, [apiKeyId, limit]);
        return result.rows.map(r => ({
            endpoint: r.endpoint,
            count: Number(r.count),
            avgResponseTime: Number(r.avg_response_time).toFixed(2),
            errorRate: (Number(r.error_rate) * 100).toFixed(4)
        }));
    }

    static async getDailyActivity(apiKeyId, days = 30) {
        const query = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as requests,
                SUM(CASE WHEN (response->>'statusCode')::numeric >= 400 THEN 1 ELSE 0 END) as errors
            FROM api_logs
            WHERE api_key_id = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(timestamp)
            ORDER BY date ASC;
        `;
        const result = await pool.query(query, [apiKeyId]);
        return result.rows.map(r => ({
            date: r.date,
            requests: Number(r.requests),
            errors: Number(r.errors)
        }));
    }
}

module.exports = ApiLogPG;
