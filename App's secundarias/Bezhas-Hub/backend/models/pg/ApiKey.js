const pool = require('../../db/pool');
const crypto = require('crypto');

class ApiKeyPG {
    static async create(data) {
        const query = `
            INSERT INTO api_keys (
                user_id, name, description, key, key_hash, sector,
                permissions, status, rate_limit, usage, achievements,
                environment, ip_whitelist, webhooks, metadata,
                last_rotated, expires_at, org_id, site_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7::jsonb, $8, $9::jsonb, $10::jsonb, $11::jsonb,
                $12, $13::jsonb, $14::jsonb, $15::jsonb,
                $16, $17, $18::uuid, $19::uuid
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
            data.expiresAt || null,
            data.orgId || null,
            data.siteId || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByKey(key) {
        const result = await pool.query('SELECT * FROM api_keys WHERE key = $1', [key]);
        return result.rows[0];
    }

    /** Clave activa por su hash SHA-256 (auth máquina-a-máquina). */
    static async findActiveByHash(keyHash) {
        const result = await pool.query(
            `SELECT * FROM api_keys WHERE key_hash = $1 AND status = 'active' LIMIT 1`,
            [keyHash],
        );
        return result.rows[0] || null;
    }

    static async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }

    /** Claves de una organización (panel B2B + facturación por sede). */
    static async findByOrg(orgId) {
        const result = await pool.query(
            'SELECT * FROM api_keys WHERE org_id = $1::uuid ORDER BY created_at DESC',
            [orgId],
        );
        return result.rows;
    }

    /** Revoca una clave dentro de su organización (defensa anti cross-tenant). */
    static async revoke(id, orgId) {
        const result = await pool.query(
            `UPDATE api_keys SET status = 'revoked' WHERE id = $1::uuid AND org_id = $2::uuid RETURNING id, status`,
            [id, orgId],
        );
        return result.rows[0] || null;
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

    /**
     * Activa/desactiva el scope de una SubApp sobre la clave (columna
     * `permissions` jsonb = lista de scopes). Idempotente. Lo usa el Plugin
     * WordPress al togglear una SubApp desde la consola embebida.
     */
    static async setSubappScope(id, scope, enabled) {
        if (!scope) return null;
        const current = await pool.query('SELECT permissions FROM api_keys WHERE id = $1::uuid', [id]);
        if (!current.rows[0]) return null;
        const perms = Array.isArray(current.rows[0].permissions) ? current.rows[0].permissions : [];
        const set = new Set(perms);
        if (enabled) set.add(scope); else set.delete(scope);
        const next = Array.from(set);
        const result = await pool.query(
            'UPDATE api_keys SET permissions = $1::jsonb WHERE id = $2::uuid RETURNING id, permissions',
            [JSON.stringify(next), id],
        );
        return result.rows[0] || null;
    }

    /** Persiste el plan contratado en la metadata de la clave. */
    static async setPlan(id, planId) {
        const current = await pool.query('SELECT metadata FROM api_keys WHERE id = $1::uuid', [id]);
        if (!current.rows[0]) return null;
        const meta = { ...(current.rows[0].metadata || {}), plan: planId, planUpdatedAt: new Date().toISOString() };
        const result = await pool.query(
            'UPDATE api_keys SET metadata = $1::jsonb WHERE id = $2::uuid RETURNING id, metadata',
            [JSON.stringify(meta), id],
        );
        return result.rows[0] || null;
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
