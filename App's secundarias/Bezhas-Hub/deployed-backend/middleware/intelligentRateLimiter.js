/**
 * Intelligent Rate Limiter
 * Different limits for different operation types
 * Integrates with Redis for distributed rate limiting
 * 
 * @module middleware/intelligentRateLimiter
 */

const pino = require('pino');
const redisService = require('../services/redis.service');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Rate limit configurations by operation type
 */
const RATE_LIMIT_CONFIGS = {
    // Read operations - most permissive
    read: {
        points: 100,          // requests
        duration: 60,         // per minute
        blockDuration: 60,    // block for 1 minute if exceeded
        keyPrefix: 'rl:read'
    },

    // Write operations - more restrictive
    write: {
        points: 30,
        duration: 60,
        blockDuration: 120,
        keyPrefix: 'rl:write'
    },

    // Blockchain operations - very restrictive
    blockchain: {
        points: 10,
        duration: 60,
        blockDuration: 300,   // block for 5 minutes
        keyPrefix: 'rl:bc'
    },

    // AI/ML operations - expensive resources
    ai: {
        points: 20,
        duration: 60,
        blockDuration: 180,
        keyPrefix: 'rl:ai'
    },

    // Authentication - prevent brute force
    auth: {
        points: 5,
        duration: 900,        // 15 minutes
        blockDuration: 3600,  // block for 1 hour
        keyPrefix: 'rl:auth'
    },

    // File uploads
    upload: {
        points: 10,
        duration: 300,        // 5 minutes
        blockDuration: 600,
        keyPrefix: 'rl:upload'
    },

    // API keys - higher limits for verified apps
    apiKey: {
        points: 1000,
        duration: 60,
        blockDuration: 60,
        keyPrefix: 'rl:api'
    },

    // VIP users - higher limits
    vip: {
        points: 500,
        duration: 60,
        blockDuration: 30,
        keyPrefix: 'rl:vip'
    },

    // WebSocket connections
    websocket: {
        points: 50,
        duration: 60,
        blockDuration: 300,
        keyPrefix: 'rl:ws'
    },

    // Search operations
    search: {
        points: 30,
        duration: 60,
        blockDuration: 60,
        keyPrefix: 'rl:search'
    }
};

/**
 * In-memory rate limiter (fallback if Redis unavailable)
 */
class InMemoryLimiter {
    constructor() {
        this.store = new Map();
        this.blocked = new Map();

        // Cleanup interval
        setInterval(() => this.cleanup(), 60000);
    }

    async consume(key, config) {
        const now = Date.now();
        const windowKey = `${key}:${Math.floor(now / (config.duration * 1000))}`;

        // Check if blocked
        const blockExpires = this.blocked.get(key);
        if (blockExpires && now < blockExpires) {
            return {
                success: false,
                msBeforeNext: blockExpires - now,
                remainingPoints: 0
            };
        }

        // Get current count
        let data = this.store.get(windowKey);
        if (!data) {
            data = { count: 0, firstRequest: now };
            this.store.set(windowKey, data);
        }

        data.count++;

        if (data.count > config.points) {
            // Block the key
            this.blocked.set(key, now + (config.blockDuration * 1000));

            return {
                success: false,
                msBeforeNext: config.blockDuration * 1000,
                remainingPoints: 0
            };
        }

        return {
            success: true,
            remainingPoints: config.points - data.count,
            msBeforeNext: 0
        };
    }

    cleanup() {
        const now = Date.now();

        // Clean old windows
        for (const [key, data] of this.store) {
            if (now - data.firstRequest > 120000) { // 2 minutes old
                this.store.delete(key);
            }
        }

        // Clean expired blocks
        for (const [key, expires] of this.blocked) {
            if (now > expires) {
                this.blocked.delete(key);
            }
        }
    }
}

/**
 * Redis-based rate limiter
 */
class RedisLimiter {
    constructor(redis) {
        this.redis = redis;
    }

    async consume(key, config) {
        const now = Date.now();
        const fullKey = `${config.keyPrefix}:${key}`;
        const blockKey = `${fullKey}:blocked`;

        try {
            // Check if blocked
            const blockTTL = await this.redis.ttl(blockKey);
            if (blockTTL > 0) {
                return {
                    success: false,
                    msBeforeNext: blockTTL * 1000,
                    remainingPoints: 0
                };
            }

            // Use sliding window algorithm
            const windowStart = now - (config.duration * 1000);

            // Remove old entries and count current
            await this.redis.zremrangebyscore(fullKey, 0, windowStart);
            const currentCount = await this.redis.zcard(fullKey);

            if (currentCount >= config.points) {
                // Block the key
                await this.redis.setex(blockKey, config.blockDuration, '1');

                return {
                    success: false,
                    msBeforeNext: config.blockDuration * 1000,
                    remainingPoints: 0
                };
            }

            // Add new request
            await this.redis.zadd(fullKey, now, `${now}:${Math.random()}`);
            await this.redis.expire(fullKey, config.duration * 2);

            return {
                success: true,
                remainingPoints: config.points - currentCount - 1,
                msBeforeNext: 0
            };
        } catch (error) {
            logger.error({ error: error.message, key }, 'Redis rate limiter error');
            // On error, allow the request (fail open)
            return { success: true, remainingPoints: config.points, msBeforeNext: 0 };
        }
    }
}

/**
 * Intelligent Rate Limiter class
 */
class IntelligentRateLimiter {
    constructor() {
        this.limiter = null;
        this.isRedis = false;
        this.initialized = false;
    }

    async initialize() {
        try {
            const redis = await redisService.getConnection();

            if (redis) {
                this.limiter = new RedisLimiter(redis);
                this.isRedis = true;
                logger.info('Rate limiter using Redis');
            } else {
                this.limiter = new InMemoryLimiter();
                logger.info('Rate limiter using in-memory store');
            }

            this.initialized = true;
        } catch (error) {
            this.limiter = new InMemoryLimiter();
            this.initialized = true;
            logger.warn({ error: error.message }, 'Rate limiter fallback to in-memory');
        }
    }

    /**
     * Get identifier from request
     */
    getIdentifier(req) {
        // Priority: API Key > User ID > IP
        if (req.apiKey) {
            return `api:${req.apiKey}`;
        }
        if (req.userId) {
            return `user:${req.userId}`;
        }
        return `ip:${req.ip || req.connection?.remoteAddress || 'unknown'}`;
    }

    /**
     * Check if user has VIP status
     */
    isVIPUser(req) {
        return req.user?.isVIP || req.user?.subscription === 'vip' || req.user?.role === 'admin';
    }

    /**
     * Get effective limit type based on user and operation
     */
    getEffectiveLimitType(req, operationType) {
        // Admins get API-level limits
        if (req.user?.role === 'admin') {
            return 'apiKey';
        }

        // VIP users get enhanced limits
        if (this.isVIPUser(req)) {
            return 'vip';
        }

        // API key users
        if (req.apiKey) {
            return 'apiKey';
        }

        return operationType;
    }

    /**
     * Create middleware for specific operation type
     */
    middleware(operationType = 'read') {
        return async (req, res, next) => {
            if (!this.initialized) {
                await this.initialize();
            }

            const identifier = this.getIdentifier(req);
            const effectiveType = this.getEffectiveLimitType(req, operationType);
            const config = RATE_LIMIT_CONFIGS[effectiveType] || RATE_LIMIT_CONFIGS.read;

            try {
                const result = await this.limiter.consume(identifier, config);

                // Add rate limit headers
                res.set('X-RateLimit-Limit', config.points);
                res.set('X-RateLimit-Remaining', result.remainingPoints);
                res.set('X-RateLimit-Type', effectiveType);

                if (!result.success) {
                    res.set('Retry-After', Math.ceil(result.msBeforeNext / 1000));
                    res.set('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + result.msBeforeNext / 1000));

                    logger.warn({
                        identifier,
                        operationType,
                        effectiveType,
                        msBeforeNext: result.msBeforeNext
                    }, 'Rate limit exceeded');

                    return res.status(429).json({
                        error: 'Too Many Requests',
                        message: `Rate limit exceeded for ${operationType} operations`,
                        retryAfter: Math.ceil(result.msBeforeNext / 1000),
                        limit: config.points,
                        window: config.duration
                    });
                }

                next();
            } catch (error) {
                logger.error({ error: error.message }, 'Rate limiter error');
                // Fail open - allow request on error
                next();
            }
        };
    }

    /**
     * Create custom middleware with dynamic configuration
     */
    custom(getConfig) {
        return async (req, res, next) => {
            if (!this.initialized) {
                await this.initialize();
            }

            const identifier = this.getIdentifier(req);
            const config = getConfig(req);

            try {
                const result = await this.limiter.consume(identifier, config);

                res.set('X-RateLimit-Limit', config.points);
                res.set('X-RateLimit-Remaining', result.remainingPoints);

                if (!result.success) {
                    res.set('Retry-After', Math.ceil(result.msBeforeNext / 1000));

                    return res.status(429).json({
                        error: 'Too Many Requests',
                        retryAfter: Math.ceil(result.msBeforeNext / 1000)
                    });
                }

                next();
            } catch (error) {
                next();
            }
        };
    }

    /**
     * Check rate limit without blocking
     */
    async checkLimit(identifier, operationType) {
        if (!this.initialized) {
            await this.initialize();
        }

        const config = RATE_LIMIT_CONFIGS[operationType] || RATE_LIMIT_CONFIGS.read;
        return this.limiter.consume(identifier, config);
    }

    /**
     * Get rate limit status for identifier
     */
    async getStatus(identifier, operationType = 'read') {
        if (!this.initialized) {
            await this.initialize();
        }

        const config = RATE_LIMIT_CONFIGS[operationType];

        // For Redis, we can get exact count
        if (this.isRedis) {
            const fullKey = `${config.keyPrefix}:${identifier}`;
            const now = Date.now();
            const windowStart = now - (config.duration * 1000);

            await this.limiter.redis.zremrangebyscore(fullKey, 0, windowStart);
            const currentCount = await this.limiter.redis.zcard(fullKey);
            const blockTTL = await this.limiter.redis.ttl(`${fullKey}:blocked`);

            return {
                operationType,
                limit: config.points,
                used: currentCount,
                remaining: Math.max(0, config.points - currentCount),
                isBlocked: blockTTL > 0,
                blockExpiresIn: blockTTL > 0 ? blockTTL : null,
                windowSeconds: config.duration
            };
        }

        // For in-memory, return basic info
        return {
            operationType,
            limit: config.points,
            windowSeconds: config.duration,
            backend: 'in-memory'
        };
    }
}

// Create convenience middlewares
const rateLimiter = new IntelligentRateLimiter();

// Export pre-configured middlewares
module.exports = rateLimiter;
module.exports.read = () => rateLimiter.middleware('read');
module.exports.write = () => rateLimiter.middleware('write');
module.exports.blockchain = () => rateLimiter.middleware('blockchain');
module.exports.ai = () => rateLimiter.middleware('ai');
module.exports.auth = () => rateLimiter.middleware('auth');
module.exports.upload = () => rateLimiter.middleware('upload');
module.exports.search = () => rateLimiter.middleware('search');
module.exports.websocket = () => rateLimiter.middleware('websocket');
module.exports.custom = (getConfig) => rateLimiter.custom(getConfig);
module.exports.CONFIGS = RATE_LIMIT_CONFIGS;
