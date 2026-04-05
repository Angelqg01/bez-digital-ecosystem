/**
 * Simple In-Memory Cache Service
 * Replaces the missing cache module to prevent startup crashes.
 */

class CacheService {
    constructor() {
        this.cache = new Map();
        this.stats = { hits: 0, misses: 0 };
    }

    async get(key) {
        const item = this.cache.get(key);
        if (!item) {
            this.stats.misses++;
            return null;
        }
        if (item.expiry && item.expiry < Date.now()) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        this.stats.hits++;
        return item.value;
    }

    async set(key, value, ttlSeconds = 0) {
        const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : 0;
        this.cache.set(key, { value, expiry });
    }

    async delete(key) {
        this.cache.delete(key);
    }

    async invalidate(pattern) {
        // Invalidate keys that include the pattern
        const patternStr = pattern.replace('*', '');
        for (const key of this.cache.keys()) {
            if (key.includes(patternStr)) {
                this.cache.delete(key);
            }
        }
    }

    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total === 0 ? 0 : Math.round((this.stats.hits / total) * 100);
        return {
            totals: { hitRate }
        };
    }
}

module.exports = new CacheService();
