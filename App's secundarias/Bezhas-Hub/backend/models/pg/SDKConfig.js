const pool = require('../../db/pool');

class SDKConfigPG {
    static async getConfig() {
        const result = await pool.query("SELECT * FROM sdk_configs WHERE id = 'global_sdk_config'");
        if (result.rows.length === 0) {
            const def = this.getDefaultConfig();
            const query = `
                INSERT INTO sdk_configs (
                    id, sdk_version, is_globally_enabled, modules, ai_models, 
                    access_tiers, webhooks, global_rate_limit, logging, security, mcp_server
                ) VALUES (
                    'global_sdk_config', $1, $2, $3::jsonb, $4::jsonb, 
                    $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb
                ) RETURNING *;
            `;
            const values = [
                def.sdkVersion, def.isGloballyEnabled,
                JSON.stringify(def.modules), JSON.stringify(def.aiModels),
                JSON.stringify(def.accessTiers), JSON.stringify(def.webhooks),
                JSON.stringify(def.globalRateLimit), JSON.stringify(def.logging),
                JSON.stringify(def.security), JSON.stringify(def.mcpServer)
            ];
            const created = await pool.query(query, values);
            return created.rows[0];
        }
        return result.rows[0];
    }

    static async updateConfig(updates, adminId) {
        const current = await this.getConfig();
        const setClauses = [];
        const values = [];
        let paramIdx = 1;

        const allowedFields = ['sdk_version', 'is_globally_enabled', 'maintenance_mode', 'maintenance_message', 'modules', 'ai_models', 'access_tiers', 'webhooks', 'global_rate_limit', 'logging', 'security', 'mcp_server', 'notes'];

        for (const [key, value] of Object.entries(updates)) {
            // map json field to snake_case db
            let dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (dbKey === 'ai_models' || dbKey === 'access_tiers' || dbKey === 'global_rate_limit' || dbKey === 'mcp_server') {
                // already correctly mapped by the regex
            }
            if (allowedFields.includes(dbKey)) {
                if (typeof value === 'object') {
                    setClauses.push(`${dbKey} = $${paramIdx}::jsonb`);
                    values.push(JSON.stringify(value));
                } else {
                    setClauses.push(`${dbKey} = $${paramIdx}`);
                    values.push(value);
                }
                paramIdx++;
            }
        }

        if (setClauses.length === 0) return current;

        setClauses.push(`updated_by = $${paramIdx}`);
        values.push(adminId || 'admin');
        paramIdx++;

        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

        const query = `
            UPDATE sdk_configs 
            SET ${setClauses.join(', ')} 
            WHERE id = 'global_sdk_config' RETURNING *;
        `;
        const updated = await pool.query(query, values);
        return updated.rows[0];
    }

    static getDefaultConfig() {
        return {
            sdkVersion: '1.0.0',
            isGloballyEnabled: true,
            modules: [],
            aiModels: [],
            accessTiers: [],
            webhooks: [],
            globalRateLimit: { requestsPerMinute: 1000, requestsPerDay: 100000, burstLimit: 50 },
            logging: { level: 'info', retentionDays: 30, enableRequestLogs: true, enableAILogs: true },
            security: { requireApiKey: true, allowedOrigins: ['https://bez.digital', 'http://localhost:5173'], ipWhitelist: [], maxApiKeysPerUser: 5 },
            mcpServer: { url: 'http://bezhas-intelligence:8080', isConnected: false }
        };
    }
}

module.exports = SDKConfigPG;
