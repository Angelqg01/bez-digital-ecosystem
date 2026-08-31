const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bezhas_hub'
});

class NotificationPG {
    static async create(data) {
        const { userId, type, title, message, actionUrl, metadata } = data;
        const query = `
            INSERT INTO platform_notifications (user_id, type, title, message, action_url, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const values = [userId, type, title, message, actionUrl || null, metadata || {}];
        const res = await pool.query(query, values);
        return res.rows[0];
    }

    static async getByUserId(userId, limit = 50, offset = 0) {
        const query = `
            SELECT * FROM platform_notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3;
        `;
        const res = await pool.query(query, [userId, limit, offset]);
        return res.rows.map(row => this._formatRow(row));
    }

    static async getUnreadCount(userId) {
        const query = `SELECT COUNT(*) FROM platform_notifications WHERE user_id = $1 AND read = false;`;
        const res = await pool.query(query, [userId]);
        return parseInt(res.rows[0].count);
    }

    static async markAsRead(id, userId) {
        const query = `
            UPDATE platform_notifications 
            SET read = true 
            WHERE id = $1 AND user_id = $2 
            RETURNING *;
        `;
        const res = await pool.query(query, [id, userId]);
        return res.rows[0] ? this._formatRow(res.rows[0]) : null;
    }

    static async markAllAsRead(userId) {
        const query = `UPDATE platform_notifications SET read = true WHERE user_id = $1;`;
        await pool.query(query, [userId]);
        return true;
    }

    static async delete(id, userId) {
        const query = `DELETE FROM platform_notifications WHERE id = $1 AND user_id = $2;`;
        await pool.query(query, [id, userId]);
        return true;
    }

    static _formatRow(row) {
        return {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            title: row.title,
            message: row.message,
            read: row.read,
            actionUrl: row.action_url,
            metadata: row.metadata,
            createdAt: row.created_at
        };
    }
}

module.exports = NotificationPG;
