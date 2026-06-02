const pool = require('../../db/pool');

class PostPG {
    static async create(data) {
        const query = `
            INSERT INTO posts (
                author, content, image, hidden, pinned, validated,
                blockchain_data, metadata, modified_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9
            ) RETURNING *;
        `;
        const values = [
            data.author,
            data.content,
            data.image || '',
            data.hidden || false,
            data.pinned || false,
            data.validated || false,
            JSON.stringify(data.blockchainData || { txHash: null, blockNumber: null, network: "polygon", validationScore: 0 }),
            JSON.stringify(data.metadata || { title: "", category: "general", tags: [], externalLinks: [] }),
            data.modifiedAt || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async addComment(id, author, content) {
        const comment = { author, content, createdAt: new Date() };
        const query = `
            UPDATE posts 
            SET comments = comments || $2::jsonb
            WHERE id = $1 RETURNING *
        `;
        const result = await pool.query(query, [id, JSON.stringify([comment])]);
        return result.rows[0];
    }

    static async getFeed(options = {}) {
        const query = `
            SELECT * FROM posts
            WHERE hidden = false
            ORDER BY pinned DESC, created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [options.limit || 50, options.skip || 0]);
        return result.rows;
    }
}

module.exports = PostPG;
