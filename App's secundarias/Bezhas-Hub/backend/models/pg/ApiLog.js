const pool = require('../../db/pool');

class ApiLogPG {
    static async create(data) {
        const query = `
            INSERT INTO api_logs (
                api_key_id, user_id, request, response, client, metadata, timestamp
            ) VALUES (
                $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7
            ) RETURNING *;
        `;
        const values = [
            data.apiKeyId,
            data.userId,
            JSON.stringify(data.request),
            JSON.stringify(data.response),
            JSON.stringify(data.client || {}),
            JSON.stringify(data.metadata || {}),
            data.timestamp || new Date().toISOString()
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
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
