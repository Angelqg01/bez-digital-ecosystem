/**
 * ============================================================================
 * ADVANCED RATE LIMITER - Redis-based Distributed Rate Limiting
 * ============================================================================
 * 
 * Implementa rate limiting avanzado con Redis para:
 * - Per-user rate limiting
 * - Per-endpoint rate limiting
 * - Distributed rate limiting (múltiples instancias)
 * - Admin bypass
 * - Custom limits por rol de usuario
 */

const Redis = require('ioredis');
const { audit } = require('./auditLogger');

class AdvancedRateLimiter {
    constructor(options = {}) {
        console.log('🔧 AdvancedRateLimiter constructor called');
        this.useMemory = false;
        this.memoryStore = new Map();

        try {
            // Use REDIS_URL if available (Upstash, cloud Redis)
            if (options.redis) {
                this.redis = options.redis;
            } else if (process.env.REDIS_URL) {
                const redisUrl = process.env.REDIS_URL;
                const connectionOptions = {
                    lazyConnect: true,
                    connectTimeout: 5000,
                    maxRetriesPerRequest: 1,
                    family: 0,
                    retryStrategy: (times) => {
                        if (times > 3) {
                            console.warn('⚠️ Redis connection failed too many times. Switching to memory mode.');
                            this.useMemory = true;
                            return null;
                        }
                        return Math.min(times * 50, 2000);
                    }
                };

                // Enable TLS for rediss:// protocol
                if (redisUrl.startsWith('rediss://')) {
                    connectionOptions.tls = { rejectUnauthorized: false };
                }

                this.redis = new Redis(redisUrl, connectionOptions);
            } else {
                this.redis = new Redis({
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379,
                    password: process.env.REDIS_PASSWORD || undefined,
                    db: process.env.REDIS_DB || 0,
                    lazyConnect: true,
                    connectTimeout: 3000,
                    maxRetriesPerRequest: 1,
                    retryStrategy: (times) => {
                        if (times > 3) {
                            console.warn('⚠️ Redis connection failed too many times. Switching to memory mode.');
                            this.useMemory = true;
                            return null;
                        }
                        const delay = Math.min(times * 50, 2000);
                        return delay;
                    }
                });
            }

            this.redis.on('error', (err) => {
                if (!this.useMemory) {
                    console.warn('⚠️ Redis error in RateLimiter (switching to memory):', err.message);
                    this.useMemory = true;
                }
            });

            // Attempt to connect non-blocking
            if (!options.redis) {
                this.redis.connect().catch(err => {
                    console.warn('⚠️ Could not connect to Redis for RateLimiter. Using memory mode.');
                    this.useMemory = true;
                });
            }
        } catch (error) {
            console.warn('⚠️ Failed to initialize Redis for RateLimiter. Using memory mode.');
            this.useMemory = true;
        }

        // Configuración por defecto
        this.config = {
            // Límites por endpoint
            endpoints: {
                '/api/chat/send': {
                    windowMs: 1000,      // 1 segundo
                    maxRequests: 5,       // 5 mensajes por segundo
                    message: 'Demasiados mensajes. Espera un momento.'
                },
                '/api/ai/generate': {
                    windowMs: 60000,     // 1 minuto
                    maxRequests: 20,      // 20 generaciones por minuto
                    message: 'Límite de generaciones alcanzado.'
                },
                '/api/staking/stake': {
                    windowMs: 60000,     // 1 minuto
                    maxRequests: 10,      // 10 stakes por minuto
                    message: 'Demasiadas transacciones de staking.'
                },
                '/api/dao/vote': {
                    windowMs: 60000,     // 1 minuto
                    maxRequests: 30,      // 30 votos por minuto
                    message: 'Límite de votos alcanzado.'
                },
                '/api/admin': {
                    windowMs: 60000,     // 1 minuto
                    maxRequests: 100,     // 100 acciones admin por minuto
                    message: 'Límite de acciones administrativas.'
                }
            },

            // Límites por rol de usuario
            roles: {
                anonymous: {
                    windowMs: 60000,     // 1 minuto
                    maxRequests: 300      // Increased from 10 to 300 for dev/initial load
                },
                user: {
                    windowMs: 60000,     // 1 minuto
                    maxRequests: 100      // 100 requests
                },
                premium: {
                    windowMs: 60000,     // 1 minuto
                    maxRequests: 500      // 500 requests
                },
                admin: {
                    bypass: true          // Sin límite
                }
            },

            // Configuración global
            enabled: options.enabled !== false,
            keyPrefix: options.keyPrefix || 'ratelimit:',

            ...options
        };

        this.redis.on('error', (err) => {
            console.error('Redis Rate Limiter Error:', err);
        });

        this.redis.on('connect', () => {
            console.log('✅ Redis Rate Limiter connected');
        });
    }

    /**
     * Middleware Express para rate limiting
     */
    middleware() {
        return async (req, res, next) => {
            if (!this.config.enabled) {
                return next();
            }

            try {
                // Extraer información del usuario
                const userId = req.user?.id || req.user?._id?.toString() || req.ip;
                const userRole = req.user?.role || 'anonymous';
                const endpoint = this.normalizeEndpoint(req.path);

                // Bypass para admins
                if (userRole === 'admin' && this.config.roles.admin.bypass) {
                    return next();
                }

                // Verificar límite por endpoint
                const endpointLimited = await this.checkEndpointLimit(
                    userId,
                    endpoint,
                    req
                );

                if (endpointLimited) {
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: endpointLimited.message,
                        retryAfter: endpointLimited.retryAfter
                    });
                }

                // Verificar límite por rol
                const roleLimited = await this.checkRoleLimit(
                    userId,
                    userRole,
                    req
                );

                if (roleLimited) {
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: 'Has excedido tu límite de requests.',
                        retryAfter: roleLimited.retryAfter
                    });
                }

                // Agregar headers informativos
                res.setHeader('X-RateLimit-Limit',
                    this.config.roles[userRole]?.maxRequests || 100
                );

                next();
            } catch (error) {
                console.error('Rate limiter error:', error);
                // En caso de error, permitir la request
                next();
            }
        };
    }

    /**
     * Verificar límite por endpoint específico
     */
    async checkEndpointLimit(userId, endpoint, req) {
        const endpointConfig = this.getEndpointConfig(endpoint);

        if (!endpointConfig) {
            return null; // No hay configuración para este endpoint
        }

        const key = `${this.config.keyPrefix}endpoint:${endpoint}:${userId}`;
        const now = Date.now();
        const windowStart = now - endpointConfig.windowMs;

        try {
            let count;
            let retryAfter;

            if (this.useMemory) {
                // Implementación en memoria
                if (!this.memoryStore.has(key)) {
                    this.memoryStore.set(key, []);
                }
                const requests = this.memoryStore.get(key);
                // Filtrar requests viejos
                const validRequests = requests.filter(time => time > windowStart);
                validRequests.push(now);
                this.memoryStore.set(key, validRequests);

                count = validRequests.length;

                // Limpieza periódica simple
                if (this.memoryStore.size > 10000) {
                    this.memoryStore.clear(); // Reset de emergencia si crece mucho
                }

                if (count > endpointConfig.maxRequests) {
                    const oldestRequest = validRequests[0];
                    retryAfter = Math.ceil((oldestRequest + endpointConfig.windowMs - now) / 1000);
                }
            } else {
                // Implementación Redis
                await this.redis.zadd(key, now, `${now}-${Math.random()}`);
                await this.redis.zremrangebyscore(key, 0, windowStart);
                await this.redis.expire(key, Math.ceil(endpointConfig.windowMs / 1000));

                const countRedis = await this.redis.zcard(key);
                count = countRedis;

                if (count > endpointConfig.maxRequests) {
                    const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
                    retryAfter = oldestRequest[1]
                        ? Math.ceil((parseInt(oldestRequest[1]) + endpointConfig.windowMs - now) / 1000)
                        : Math.ceil(endpointConfig.windowMs / 1000);
                }
            }

            if (count > endpointConfig.maxRequests) {
                // Log del evento de rate limit
                audit.security('RATE_LIMIT_EXCEEDED', 'medium', {
                    userId,
                    endpoint,
                    count,
                    limit: endpointConfig.maxRequests,
                    ip: req.ip
                });

                return {
                    message: endpointConfig.message,
                    retryAfter
                };
            }

            return null;
        } catch (error) {
            console.error('Error checking endpoint limit:', error);
            return null;
        }
    }

    /**
     * Verificar límite por rol de usuario
     */
    async checkRoleLimit(userId, userRole, req) {
        const roleConfig = this.config.roles[userRole];

        if (!roleConfig || roleConfig.bypass) {
            return null;
        }

        const key = `${this.config.keyPrefix}role:${userRole}:${userId}`;
        const now = Date.now();
        const windowStart = now - roleConfig.windowMs;

        try {
            let count;
            let retryAfter;

            if (this.useMemory) {
                // Implementación en memoria
                if (!this.memoryStore.has(key)) {
                    this.memoryStore.set(key, []);
                }
                const requests = this.memoryStore.get(key);
                const validRequests = requests.filter(time => time > windowStart);
                validRequests.push(now);
                this.memoryStore.set(key, validRequests);

                count = validRequests.length;

                if (count > roleConfig.maxRequests) {
                    const oldestRequest = validRequests[0];
                    retryAfter = Math.ceil((oldestRequest + roleConfig.windowMs - now) / 1000);
                }
            } else {
                // Implementación Redis
                await this.redis.zadd(key, now, `${now}-${Math.random()}`);
                await this.redis.zremrangebyscore(key, 0, windowStart);
                await this.redis.expire(key, Math.ceil(roleConfig.windowMs / 1000));

                const countRedis = await this.redis.zcard(key);
                count = countRedis;

                if (count > roleConfig.maxRequests) {
                    const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
                    retryAfter = oldestRequest[1]
                        ? Math.ceil((parseInt(oldestRequest[1]) + roleConfig.windowMs - now) / 1000)
                        : Math.ceil(roleConfig.windowMs / 1000);
                }
            }

            if (count > roleConfig.maxRequests) {
                audit.security('ROLE_RATE_LIMIT_EXCEEDED', 'medium', {
                    userId,
                    role: userRole,
                    count,
                    limit: roleConfig.maxRequests,
                    ip: req.ip
                });

                return { retryAfter };
            }

            return null;
        } catch (error) {
            console.error('Error checking role limit:', error);
            return null;
        }
    }

    /**
     * Normalizar endpoint para matching
     */
    normalizeEndpoint(path) {
        // Buscar match exacto primero
        if (this.config.endpoints[path]) {
            return path;
        }

        // Buscar match por prefijo
        for (const endpoint of Object.keys(this.config.endpoints)) {
            if (path.startsWith(endpoint)) {
                return endpoint;
            }
        }

        return null;
    }

    /**
     * Obtener configuración de endpoint
     */
    getEndpointConfig(endpoint) {
        if (!endpoint) return null;
        return this.config.endpoints[endpoint];
    }

    /**
     * Agregar o actualizar configuración de endpoint
     */
    setEndpointConfig(endpoint, config) {
        this.config.endpoints[endpoint] = {
            ...this.config.endpoints[endpoint],
            ...config
        };
    }

    /**
     * Verificar manualmente si un usuario está rate limited
     */
    async isRateLimited(userId, endpoint) {
        const key = `${this.config.keyPrefix}endpoint:${endpoint}:${userId}`;
        const endpointConfig = this.getEndpointConfig(endpoint);

        if (!endpointConfig) return false;

        const now = Date.now();
        const windowStart = now - endpointConfig.windowMs;

        try {
            await this.redis.zremrangebyscore(key, 0, windowStart);
            const count = await this.redis.zcard(key);
            return count >= endpointConfig.maxRequests;
        } catch (error) {
            console.error('Error checking rate limit:', error);
            return false;
        }
    }

    /**
     * Resetear rate limit de un usuario
     */
    async resetUserLimit(userId) {
        try {
            const pattern = `${this.config.keyPrefix}*:${userId}`;
            const keys = await this.redis.keys(pattern);

            if (keys.length > 0) {
                await this.redis.del(...keys);
                return keys.length;
            }
            return 0;
        } catch (error) {
            console.error('Error resetting user limit:', error);
            return 0;
        }
    }

    /**
     * Obtener estadísticas de uso de un usuario
     */
    async getUserStats(userId) {
        try {
            const stats = {
                endpoints: {},
                total: 0
            };

            const pattern = `${this.config.keyPrefix}endpoint:*:${userId}`;
            const keys = await this.redis.keys(pattern);

            for (const key of keys) {
                const endpoint = key.split(':')[2];
                const count = await this.redis.zcard(key);
                stats.endpoints[endpoint] = count;
                stats.total += count;
            }

            return stats;
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }

    /**
     * Limpiar datos expirados (mantenimiento)
     */
    async cleanup() {
        try {
            const pattern = `${this.config.keyPrefix}*`;
            const keys = await this.redis.keys(pattern);
            let cleaned = 0;

            for (const key of keys) {
                const ttl = await this.redis.ttl(key);
                if (ttl === -1) {
                    // Key sin TTL, eliminar
                    await this.redis.del(key);
                    cleaned++;
                }
            }

            return cleaned;
        } catch (error) {
            console.error('Error during cleanup:', error);
            return 0;
        }
    }

    /**
     * Cerrar conexión Redis
     */
    async disconnect() {
        await this.redis.quit();
    }
}

module.exports = AdvancedRateLimiter;
