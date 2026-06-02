const pool = require('../../db/pool');

class WorkflowPG {
    static async create(data) {
        const query = `
            INSERT INTO workflows (
                name, description, steps, trigger, created_by, status, 
                tags, run_history, blockchain
            ) VALUES (
                $1, $2, $3::jsonb, $4::jsonb, $5, $6, 
                $7::jsonb, $8::jsonb, $9::jsonb
            ) RETURNING *;
        `;
        const values = [
            data.name,
            data.description || '',
            JSON.stringify(data.steps || []),
            JSON.stringify(data.trigger || { type: 'manual' }),
            data.createdBy,
            data.status || 'draft',
            JSON.stringify(data.tags || []),
            JSON.stringify(data.runHistory || []),
            JSON.stringify(data.blockchain || {})
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM workflows WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByCreator(walletAddress) {
        const result = await pool.query('SELECT * FROM workflows WHERE created_by = $1 ORDER BY created_at DESC', [walletAddress]);
        return result.rows;
    }

    static async addRunLog(id, runLog) {
        const query = `
            UPDATE workflows 
            SET 
                run_history = run_history || $1::jsonb,
                last_run = $2,
                total_runs = total_runs + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 RETURNING *;
        `;
        const values = [JSON.stringify([runLog]), runLog.startedAt || new Date().toISOString(), id];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async updateBlockchainStatus(id, blockchainData) {
        const query = `
            UPDATE workflows 
            SET 
                blockchain = blockchain || $1::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 RETURNING *;
        `;
        const result = await pool.query(query, [JSON.stringify(blockchainData), id]);
        return result.rows[0];
    }
}

module.exports = WorkflowPG;
