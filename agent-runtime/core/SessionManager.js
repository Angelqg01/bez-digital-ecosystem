/**
 * SessionManager.js — Redis-backed conversational session state.
 * Stores per-user session data: command history, tool results, preferences.
 * Falls back to in-memory Map when Redis is unavailable.
 */

const SESSION_PREFIX = 'bezhas:runtime:session:';
const DEFAULT_TTL = 3600; // 1 hour

class SessionManager {
    /** @type {Map<string, object>} In-memory fallback */
    #memStore = new Map();
    /** @type {import('redis').RedisClientType|null} */
    #redis = null;
    #ttl;

    /**
     * @param {{ redis?: import('redis').RedisClientType, ttl?: number }} opts
     */
    constructor(opts = {}) {
        this.#redis = opts.redis || null;
        this.#ttl = opts.ttl || DEFAULT_TTL;
    }

    /**
     * Attach a Redis client (can be done post-construction).
     * @param {import('redis').RedisClientType} redisClient
     */
    setRedis(redisClient) {
        this.#redis = redisClient;
    }

    /**
     * Get or create a session for a user.
     * @param {string} sessionId — Typically `${userAddress}:${conversationId}`
     * @returns {Promise<object>}
     */
    async get(sessionId) {
        const key = SESSION_PREFIX + sessionId;

        if (this.#redis) {
            try {
                const raw = await this.#redis.get(key);
                if (raw) return JSON.parse(raw);
            } catch { /* fall through to memory */ }
        }

        if (this.#memStore.has(sessionId)) {
            return this.#memStore.get(sessionId);
        }

        // Create new session
        const session = {
            id: sessionId,
            createdAt: new Date().toISOString(),
            history: [],
            context: {},
            lastTool: null,
        };

        await this.set(sessionId, session);
        return session;
    }

    /**
     * Save a session.
     * @param {string} sessionId
     * @param {object} session
     */
    async set(sessionId, session) {
        const key = SESSION_PREFIX + sessionId;

        if (this.#redis) {
            try {
                await this.#redis.set(key, JSON.stringify(session), { EX: this.#ttl });
                return;
            } catch { /* fall through */ }
        }

        this.#memStore.set(sessionId, session);
    }

    /**
     * Append an entry to the session history.
     * @param {string} sessionId
     * @param {{ type: string, name: string, input?: object, output?: object, timestamp?: string }} entry
     */
    async appendHistory(sessionId, entry) {
        const session = await this.get(sessionId);
        entry.timestamp = entry.timestamp || new Date().toISOString();
        session.history.push(entry);

        // Keep only last 50 entries
        if (session.history.length > 50) {
            session.history = session.history.slice(-50);
        }

        session.lastTool = entry.name || null;
        await this.set(sessionId, session);
        return session;
    }

    /**
     * Update session context (merge).
     * @param {string} sessionId
     * @param {object} contextUpdate
     */
    async updateContext(sessionId, contextUpdate) {
        const session = await this.get(sessionId);
        Object.assign(session.context, contextUpdate);
        await this.set(sessionId, session);
        return session;
    }

    /**
     * Delete a session.
     * @param {string} sessionId
     */
    async destroy(sessionId) {
        const key = SESSION_PREFIX + sessionId;

        if (this.#redis) {
            try {
                await this.#redis.del(key);
            } catch { /* ignore */ }
        }

        this.#memStore.delete(sessionId);
    }

    /**
     * Get session count (in-memory only, for monitoring).
     * @returns {number}
     */
    get size() {
        return this.#memStore.size;
    }
}

module.exports = SessionManager;
