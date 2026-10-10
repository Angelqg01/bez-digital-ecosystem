/**
 * Conversaciones del AI Workspace, aisladas por usuario.
 * Memoria con persistencia JSON opcional (AI_CONVERSATIONS_PATH) para desarrollo local.
 * La clave incluye el userId: un usuario nunca puede leer ni escribir la conversación de otro.
 */
const fs = require('fs');
const path = require('path');

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PER_USER = 50;
const MAX_TURNS = 40; // mensajes (user + assistant) conservados

class ConversationStore {
    constructor({ filePath = process.env.AI_CONVERSATIONS_PATH || null, now = () => Date.now() } = {}) {
        this.filePath = filePath;
        this.now = now;
        this.items = new Map(); // `${userId}:${id}` -> { userId, id, title, turns, createdAt, updatedAt }
        this._load();
    }

    _key(userId, id) { return `${userId}:${id}`; }

    _load() {
        if (!this.filePath || !fs.existsSync(this.filePath)) return;
        try {
            const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            (raw.items || []).forEach((c) => this.items.set(this._key(c.userId, c.id), c));
        } catch (e) {
            console.warn('⚠️ Conversaciones ilegibles, se inicia vacío:', e.message);
        }
    }

    _persist() {
        if (!this.filePath) return;
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        const tmp = `${this.filePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ items: [...this.items.values()] }));
        fs.renameSync(tmp, this.filePath);
    }

    _sweep() {
        const limit = this.now() - TTL_MS;
        for (const [k, c] of this.items) if (c.updatedAt < limit) this.items.delete(k);
    }

    get(userId, id) {
        this._sweep();
        return this.items.get(this._key(userId, id)) || null;
    }

    /** Devuelve la conversación existente o crea una vacía (no se persiste hasta append). */
    getOrCreate(userId, id) {
        const existing = this.get(userId, id);
        if (existing) return existing;
        const t = this.now();
        return { userId, id, title: '', turns: [], createdAt: t, updatedAt: t };
    }

    append(conv, userText, assistantText) {
        conv.turns.push({ role: 'user', content: userText }, { role: 'assistant', content: assistantText });
        conv.turns = conv.turns.slice(-MAX_TURNS);
        if (!conv.title) conv.title = userText.replace(/\s+/g, ' ').slice(0, 60);
        conv.updatedAt = this.now();
        this.items.set(this._key(conv.userId, conv.id), conv);
        this._enforceLimit(conv.userId);
        this._persist();
        return conv;
    }

    list(userId) {
        this._sweep();
        return [...this.items.values()]
            .filter((c) => c.userId === userId)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map(({ id, title, updatedAt, turns }) => ({ id, title, updatedAt, messages: turns.length }));
    }

    remove(userId, id) {
        const ok = this.items.delete(this._key(userId, id));
        if (ok) this._persist();
        return ok;
    }

    _enforceLimit(userId) {
        const mine = [...this.items.values()].filter((c) => c.userId === userId).sort((a, b) => a.updatedAt - b.updatedAt);
        while (mine.length > MAX_PER_USER) {
            const old = mine.shift();
            this.items.delete(this._key(old.userId, old.id));
        }
    }
}

module.exports = { ConversationStore, MAX_TURNS };
