'use strict';

/**
 * Conversaciones del chat, aisladas por usuario: toda lectura y escritura va
 * filtrada por user_id, así que nadie puede leer ni escribir la de otro aunque
 * adivine su id.
 *
 *   PgConversationStore     → producción (tabla ai_conversations, migración 062).
 *   MemoryConversationStore → tests.
 */

const TTL_DIAS = 30;
const MAX_PER_USER = 50;
const MAX_TURNS = 40; // mensajes (user + assistant) conservados

const nueva = (userId, id) => ({ userId, id, title: '', turns: [], createdAt: Date.now(), updatedAt: Date.now(), nueva: true });

function anadir(conv, userText, assistantText) {
    conv.turns = [...conv.turns, { role: 'user', content: userText }, { role: 'assistant', content: assistantText }].slice(-MAX_TURNS);
    if (!conv.title) conv.title = userText.replace(/\s+/g, ' ').slice(0, 60);
    conv.updatedAt = Date.now();
    return conv;
}

class MemoryConversationStore {
    constructor({ now = () => Date.now() } = {}) { this.now = now; this.items = new Map(); }
    _key(userId, id) { return `${userId}:${id}`; }

    async get(userId, id) {
        const c = this.items.get(this._key(userId, id));
        if (c && c.updatedAt < this.now() - TTL_DIAS * 86400000) { this.items.delete(this._key(userId, id)); return null; }
        return c || null;
    }

    async getOrCreate(userId, id) { return (await this.get(userId, id)) || nueva(userId, id); }

    async append(conv, userText, assistantText) {
        anadir(conv, userText, assistantText);
        delete conv.nueva;
        this.items.set(this._key(conv.userId, conv.id), conv);
        const mias = [...this.items.values()].filter((c) => c.userId === conv.userId).sort((a, b) => a.updatedAt - b.updatedAt);
        while (mias.length > MAX_PER_USER) { const v = mias.shift(); this.items.delete(this._key(v.userId, v.id)); }
        return conv;
    }

    async list(userId) {
        return [...this.items.values()].filter((c) => c.userId === userId)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map(({ id, title, updatedAt, turns }) => ({ id, title, updatedAt, messages: turns.length }));
    }

    async remove(userId, id) { return this.items.delete(this._key(userId, id)); }
}

class PgConversationStore {
    constructor(db) { this.db = db; }

    async get(userId, id) {
        const { rows } = await this.db.query(
            `SELECT id, title, turns, created_at, updated_at FROM ai_conversations
              WHERE user_id = $1 AND id = $2 AND updated_at > NOW() - INTERVAL '${TTL_DIAS} days'`,
            [String(userId), id]
        );
        if (!rows[0]) return null;
        const r = rows[0];
        return { userId: String(userId), id: r.id, title: r.title, turns: r.turns || [], createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at) };
    }

    async getOrCreate(userId, id) { return (await this.get(userId, id)) || nueva(String(userId), id); }

    async append(conv, userText, assistantText) {
        anadir(conv, userText, assistantText);
        // La clave primaria es (user_id, id): un id ajeno crea una conversación propia, nunca toca la otra.
        await this.db.query(
            `INSERT INTO ai_conversations (user_id, id, title, turns, created_at, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
             ON CONFLICT (user_id, id) DO UPDATE SET title = EXCLUDED.title, turns = EXCLUDED.turns, updated_at = NOW()`,
            [String(conv.userId), conv.id, conv.title, JSON.stringify(conv.turns)]
        );
        delete conv.nueva;
        await this.db.query(
            `DELETE FROM ai_conversations WHERE user_id = $1 AND id IN (
               SELECT id FROM ai_conversations WHERE user_id = $1 ORDER BY updated_at DESC OFFSET ${MAX_PER_USER})`,
            [String(conv.userId)]
        );
        return conv;
    }

    async list(userId) {
        const { rows } = await this.db.query(
            `SELECT id, title, updated_at, jsonb_array_length(turns) AS messages FROM ai_conversations
              WHERE user_id = $1 AND updated_at > NOW() - INTERVAL '${TTL_DIAS} days'
              ORDER BY updated_at DESC LIMIT ${MAX_PER_USER}`,
            [String(userId)]
        );
        return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: Date.parse(r.updated_at), messages: r.messages }));
    }

    async remove(userId, id) {
        const r = await this.db.query('DELETE FROM ai_conversations WHERE user_id = $1 AND id = $2', [String(userId), id]);
        return r.rowCount > 0;
    }
}

function crearConversaciones() {
    if (process.env.NODE_ENV === 'test' || process.env.KNOWLEDGE_STORE === 'memory') return new MemoryConversationStore();
    return new PgConversationStore(require('../../db/pool'));
}

module.exports = { MemoryConversationStore, PgConversationStore, crearConversaciones, MAX_TURNS, MAX_PER_USER };
