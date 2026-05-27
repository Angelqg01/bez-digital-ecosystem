/**
 * Multi-Level Cache Service
 * L1: In-memory (NodeCache) - Fastest, limited capacity
 * L2: Redis - Fast, shared across instances
 * 
 * Critical for Web3 UX - reduces blockchain queries and API latency
 * 
 * @module services/cache.service
 */

const pino = require('pino');
const redisService = require('./redis.service');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Import NodeCache lazily to avoid startup issues
let NodeCache;
try {
    NodeCache = require('node-cache');
} catch {
    NodeCache = null;
    logger.warn('node-cache not available, using Map fallback');
}

/**
 * Simple in-memory cache fallback if node-cache not available
 */
class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.ttls = new Map();
    }

    get(key) {
        const ttl = this.ttls.get(key);
        if (ttl && Date.now() > ttl) {
            this.cache.delete(key);
            this.ttls.delete(key);
            return undefined;
        }
        return this.cache.get(key);
    }

    set(key, value, ttlSeconds = 300) {
        this.cache.set(key, value);
        this.ttls.set(key, Date.now() + (ttlSeconds * 1000));
        return true;
    }

    del(key) {
        this.cache.delete(key);
        this.ttls.delete(key);
    }

    keys() {
        return Array.from(this.cache.keys());
    }

    flushAll() {
        this.cache.clear();
        this.ttls.clear();
    }

    getStats() {
        return { keys: this.cache.size };
    }
}

class MultiLevelCache {
    constructor() {
        // L1: In-memory cache (fastest)
        this.l1 = NodeCache
            ? new NodeCache({
                stdTTL: 60, // Default 1 minute
                checkperiod: 30,
                maxKeys: 10000,
                useClones: false // Better performance
            })
            : new SimpleCache();

        // L2: Redis connection (will be initialized lazily)
        this.l2 = null;
        this.l2Prefix = 'bezhas:cache:';
        this.isL2Available = false;

        // Statistics
        this.stats = {
            l1Hits: 0,
            l2Hits: 0,
            misses: 0,
            sets: 0
        };

        // Initialize Redis connection
        this.initializeL2();
    }

    /**
     * Initialize L2 Redis connection
     */
    async initializeL2() {
        try {
            this.l2 = await redisService.getConnection();
            if (this.l2) {
                this.isL2Available = true;
                logger.info('✅ L2 cache (Redis) initialized');
            } else {
                logger.warn('L2 cache (Redis) not available - running with L1 only');
            }
        } catch (error) {
            logger.warn({ error: error.message }, 'L2 cache initialization failed');
        }
    }

    /**
     * Get value from cache (L1 first, then L2)
     */
    async get(key) {
        try {
            // Try L1 first (in-memory)
            let value = this.l1.get(key);
            if (value !== undefined) {
                this.stats.l1Hits++;
                return value;
            }

            // Try L2 (Redis)
            if (this.isL2Available && this.l2) {
                const l2Value = await this.l2.get(this.l2Prefix + key);
                if (l2Value) {
                    this.stats.l2Hits++;
                    value = JSON.parse(l2Value);

                    // Promote to L1 for faster subsequent access
                    this.l1.set(key, value, 60);

                    return value;
                }
            }

            this.stats.misses++;
            return null;
        } catch (error) {
            logger.debug({ error: error.message, key }, 'Cache get error');
            return null;
        }
    }

    /**
     * Set value in cache (both L1 and L2)
     */
    async set(key, value, ttlSeconds = 300) {
        try {
            this.stats.sets++;

            // Set in L1 (with shorter TTL to keep memory low)
            const l1Ttl = Math.min(ttlSeconds, 300); // Max 5 min in L1
            this.l1.set(key, value, l1Ttl);

            // Set in L2 (with full TTL)
            if (this.isL2Available && this.l2) {
                await this.l2.setex(
                    this.l2Prefix + key,
                    ttlSeconds,
                    JSON.stringify(value)
                );
            }

            return true;
        } catch (error) {
            logger.debug({ error: error.message, key }, 'Cache set error');
            return false;
        }
    }

    /**
     * Delete value from both cache levels
     */
    async delete(key) {
        try {
            // Delete from L1
            this.l1.del(key);

            // Delete from L2
            if (this.isL2Available && this.l2) {
                await this.l2.del(this.l2Prefix + key);
            }

            return true;
        } catch (error) {
            logger.debug({ error: error.message, key }, 'Cache delete error');
            return false;
        }
    }

    /**
     * Invalidate by pattern (useful for cache busting)
     */
    async invalidate(pattern) {
        try {
            // Invalidate matching keys in L1
            const l1Keys = this.l1.keys();
            l1Keys.filter(k => k.includes(pattern)).forEach(k => this.l1.del(k));

            // Invalidate matching keys in L2
            if (this.isL2Available && this.l2) {
                const l2Pattern = this.l2Prefix + '*' + pattern + '*';
                const keys = await this.l2.keys(l2Pattern);
                if (keys.length > 0) {
                    await this.l2.del(...keys);
                }
            }

            logger.debug({ pattern, invalidated: true }, 'Cache invalidated');
            return true;
        } catch (error) {
            logger.debug({ error: error.message, pattern }, 'Cache invalidate error');
            return false;
        }
    }

    /**
     * Get or set pattern (cache-aside)
     * Most common usage pattern
     */
    async getOrSet(key, fetcher, ttlSeconds = 300) {
        // Try to get from cache
        let value = await this.get(key);
        if (value !== null) {
            return value;
        }

        // Fetch fresh data
        value = await fetcher();

        // Cache it
        if (value !== null && value !== undefined) {
            await this.set(key, value, ttlSeconds);
        }

        return value;
    }

    /**
     * Cache blockchain data (immutable, long TTL)
     */
    async getBlockchainData(key, fetcher) {
        const cacheKey = `bc:${key}`;
        return this.getOrSet(cacheKey, fetcher, 86400); // 24 hours
    }

    /**
     * Cache user data (mutable, shorter TTL)
     */
    async getUserData(userId, key, fetcher) {
        const cacheKey = `user:${userId}:${key}`;
        return this.getOrSet(cacheKey, fetcher, 300); // 5 minutes
    }

    /**
     * Cache API response
     */
    async cacheApiResponse(endpoint, params, fetcher, ttlSeconds = 60) {
        const paramsHash = this.hashObject(params);
        const cacheKey = `api:${endpoint}:${paramsHash}`;
        return this.getOrSet(cacheKey, fetcher, ttlSeconds);
    }

    /**
     * Simple object hash for cache keys
     */
    hashObject(obj) {
        const str = JSON.stringify(obj);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const l1Stats = this.l1.getStats ? this.l1.getStats() : { keys: this.l1.cache?.size || 0 };

        return {
            l1: {
                keys: l1Stats.keys,
                hits: this.stats.l1Hits,
                type: NodeCache ? 'node-cache' : 'simple-map'
            },
            l2: {
                available: this.isL2Available,
                hits: this.stats.l2Hits,
                type: 'redis'
            },
            totals: {
                hits: this.stats.l1Hits + this.stats.l2Hits,
                misses: this.stats.misses,
                sets: this.stats.sets,
                hitRate: this.calculateHitRate()
            }
        };
    }

    /**
     * Calculate cache hit rate
     */
    calculateHitRate() {
        const totalRequests = this.stats.l1Hits + this.stats.l2Hits + this.stats.misses;
        if (totalRequests === 0) return 0;

        const hits = this.stats.l1Hits + this.stats.l2Hits;
        return Math.round((hits / totalRequests) * 100);
    }

    /**
     * Clear all caches (use with caution)
     */
    async flush() {
        this.l1.flushAll();

        if (this.isL2Available && this.l2) {
            const keys = await this.l2.keys(this.l2Prefix + '*');
            if (keys.length > 0) {
                await this.l2.del(...keys);
            }
        }

        // Reset stats
        this.stats = { l1Hits: 0, l2Hits: 0, misses: 0, sets: 0 };

        logger.info('Cache flushed');
    }

    /**
     * Warm up cache with common data
     */
    async warmUp(dataFetchers) {
        logger.info('Starting cache warm-up...');

        const results = await Promise.allSettled(
            dataFetchers.map(async ({ key, fetcher, ttl }) => {
                const value = await fetcher();
                await this.set(key, value, ttl);
                return key;
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        logger.info({ successful, total: dataFetchers.length }, 'Cache warm-up completed');

        return results;
    }

    // ============ Specialized Cache Methods ============

    /**
     * Cache for contract addresses (immutable per network)
     */
    async getContractAddress(name, chainId, fetcher) {
        const key = `contract:${chainId}:${name}`;
        return this.getOrSet(key, fetcher, 86400 * 30); // 30 days
    }

    /**
     * Cache for gas prices (short TTL)
     */
    async getGasPrice(chainId, fetcher) {
        const key = `gas:${chainId}`;
        return this.getOrSet(key, fetcher, 15); // 15 seconds
    }

    /**
     * Cache for token balances (medium TTL)
     */
    async getTokenBalance(address, tokenAddress, fetcher) {
        const key = `balance:${address}:${tokenAddress}`;
        return this.getOrSet(key, fetcher, 30); // 30 seconds
    }

    /**
     * Cache for NFT metadata (long TTL, immutable)
     */
    async getNFTMetadata(tokenAddress, tokenId, fetcher) {
        const key = `nft:${tokenAddress}:${tokenId}`;
        return this.getOrSet(key, fetcher, 86400 * 7); // 7 days
    }

    /**
     * Cache for user profile data
     */
    async getUserProfile(userId, fetcher) {
        const key = `profile:${userId}`;
        return this.getOrSet(key, fetcher, 300); // 5 minutes
    }

    /**
     * Cache for feed data
     */
    async getFeedData(userId, page, fetcher) {
        const key = `feed:${userId}:${page}`;
        return this.getOrSet(key, fetcher, 60); // 1 minute
    }

    /**
     * Invalidate user-related caches
     */
    async invalidateUser(userId) {
        await this.invalidate(`user:${userId}`);
        await this.invalidate(`profile:${userId}`);
        await this.invalidate(`feed:${userId}`);
        await this.invalidate(`balance:${userId}`);
    }
}

// Singleton instance
const cacheService = new MultiLevelCache();

module.exports = cacheService;
