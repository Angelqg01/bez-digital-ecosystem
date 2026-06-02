const pool = require('../../db/pool');
const crypto = require('crypto');

class ApiKeyPG {
    static async create(data) {
        const query = `
            INSERT INTO api_keys (
                user_id, name, description, key, key_hash, sector,
                permissions, status, rate_limit, usage, achievements,
                environment, ip_whitelist, webhooks, metadata,
                last_rotated, expires_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7::jsonb, $8, $9::jsonb, $10::jsonb, $11::jsonb,
                $12, $13::jsonb, $14::jsonb, $15::jsonb,
                $16, $17
            ) RETURNING *;
        `;
        const values = [
            data.userId,
            data.name,
            data.description || null,
            data.key,
            data.keyHash,
            data.sector,
            JSON.stringify(data.permissions || []),
            data.status || 'active',
            JSON.stringify(data.rateLimit || { requestsPerMinute: 60, requestsPerDay: 10000 }),
            JSON.stringify(data.usage || { totalRequests: 0, requestsToday: 0, requestsThisMonth: 0, smartContractCalls: 0, identityValidations: 0 }),
            JSON.stringify(data.achievements || []),
            data.environment || 'development',
            JSON.stringify(data.ipWhitelist || []),
            JSON.stringify(data.webhooks || []),
            JSON.stringify(data.metadata || {}),
            data.lastRotated || null,
            data.expiresAt || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByKey(key) {
        const result = await pool.query('SELECT * FROM api_keys WHERE key = $1', [key]);
        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }

    static async updateUsage(id, updates) {
        // updates can have requestsToday, totalRequests, etc.
        // Needs a merge, but simpler to read, merge, update.
        // Actually, could use jsonb_set in DB.
        const current = await pool.query('SELECT usage FROM api_keys WHERE id = $1', [id]);
        if (!current.rows[0]) return null;

        const newUsage = { ...current.rows[0].usage, ...updates, lastUsed: new Date().toISOString() };
        
        const query = `UPDATE api_keys SET usage = $1::jsonb WHERE id = $2 RETURNING *`;
        const result = await pool.query(query, [JSON.stringify(newUsage), id]);
        return result.rows[0];
    }

    static generateKey(userId, sector, environment = 'development') {
        const prefix = environment === 'production' ? 'bzh_live' : 'bzh_test';
        const randomPart = crypto.randomBytes(24).toString('hex');
        return `${prefix}_${sector}_${randomPart}`;
    }

    static hashKey(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    static verifyKey(keyHash, key) {
        const hash = crypto.createHash('sha256').update(key).digest('hex');
        return keyHash === hash;
    }
}

module.exports = ApiKeyPG;
