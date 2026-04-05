/**
 * Redis Connection Service - Singleton Pattern
 * Centraliza todas las conexiones Redis para evitar múltiples instancias
 */

const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class RedisService {
    constructor() {
        console.log('🔧 RedisService constructor called');
        this.client = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
    }

    /**
     * Get or create Redis connection (Singleton)
     */
    async getConnection() {
        // Return existing connection if available
        if (this.client && this.isConnected) {
            return this.client;
        }

        // Wait if connection is in progress
        if (this.isConnecting) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.isConnected && this.client) {
                        clearInterval(checkInterval);
                        resolve(this.client);
                    } else if (!this.isConnecting) {
                        clearInterval(checkInterval);
                        resolve(null);
                    }
                }, 100);
            });
        }

        return await this.connect();
    }

    /**
     * Connect to Redis
     */
    async connect() {
        // Check if Redis is configured
        const hasRedisConfig = !!(
            process.env.REDIS_URL ||
            process.env.REDIS_HOST ||
            process.env.REDIS_PORT
        );

        if (!hasRedisConfig) {
            logger.warn('Redis configuration not found. Running without Redis.');
            return null;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max Redis reconnection attempts reached. Giving up.');
            return null;
        }

        this.isConnecting = true;

        try {
            const IORedis = require('ioredis');

            const redisOptions = {
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => {
                    if (times > 5) {
                        logger.warn('Max Redis retry attempts reached, running without Redis');
                        return null; // Stop retrying
                    }
                    return Math.min(times * 500, 3000); // Increased delays for cloud
                },
                enableReadyCheck: true,
                connectTimeout: 30000, // Increased to 30s for Upstash/cloud environments
                commandTimeout: 10000, // Command timeout
                lazyConnect: true,
                family: 0, // Allow both IPv4 and IPv6
                enableOfflineQueue: false, // Don't queue commands when offline
            };

            // Create connection based on available config
            if (process.env.REDIS_URL) {
                const redisUrl = process.env.REDIS_URL;

                // Check if TLS is required (rediss:// protocol - Upstash, etc.)
                if (redisUrl.startsWith('rediss://')) {
                    redisOptions.tls = {
                        rejectUnauthorized: false, // Required for some cloud Redis providers
                    };
                    logger.info('Redis TLS mode enabled for rediss:// connection');
                }

                this.client = new IORedis(redisUrl, redisOptions);
            } else {
                this.client = new IORedis({
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    password: process.env.REDIS_PASSWORD || undefined,
                    ...redisOptions
                });
            }

            // Event handlers
            this.client.on('connect', () => {
                logger.info('Redis connecting...');
            });

            this.client.on('ready', () => {
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                logger.info('✅ Redis connected and ready');
            });

            this.client.on('error', (err) => {
                this.isConnected = false;
                if (!this.isConnecting) {
                    logger.error({ err: err.message }, 'Redis connection error');
                }
            });

            // Attempt connection
            await this.client.connect().catch(err => {
                logger.warn(`⚠️ Could not connect to Redis: ${err.message}. Running in memory-only mode.`);
                this.isConnecting = false;
                this.client = null;
            });

            // Wait for connection validation
            try {
                await this.client.ping();
            } catch (pingError) {
                logger.warn(`⚠️ Redis ping failed: ${pingError.message}. Running in memory-only mode.`);
                this.disconnect();
                return null;
            }

            return this.client;

        } catch (error) {
            this.isConnecting = false;
            this.isConnected = false;
            logger.error({ error: error.message }, 'Failed to connect to Redis');
            return null;
        }
    }

    /**
     * Check if Redis is available
     */
    isAvailable() {
        return this.isConnected && this.client !== null;
    }

    /**
     * Close Redis connection
     */
    async disconnect() {
        if (this.client) {
            try {
                await this.client.quit();
                this.client = null;
                this.isConnected = false;
                logger.info('Redis disconnected gracefully');
            } catch (error) {
                logger.error({ error: error.message }, 'Error disconnecting Redis');
            }
        }
    }

    /**
     * Get connection for BullMQ (returns connection object).
     * Returns null if DISABLE_BULLMQ=true or Redis is unavailable.
     */
    getBullMQConnection() {
        // Respect global BullMQ kill-switch
        const forceDisabled = ['true', '1'].includes((process.env.DISABLE_BULLMQ || '').toLowerCase());
        if (forceDisabled || !this.isAvailable()) {
            return null;
        }

        const IORedis = require('ioredis');

        const sharedOptions = {
            maxRetriesPerRequest: null,  // Required for BullMQ
            enableReadyCheck: false,
            enableOfflineQueue: false,   // Prevent command piling during reconnects
            connectTimeout: 10000,
            family: 0,
            retryStrategy: (times) => {
                if (times > 3) return null; // Give up after 3 retries
                return Math.min(times * 1000, 3000);
            },
        };

        if (process.env.REDIS_URL) {
            const redisUrl = process.env.REDIS_URL;
            if (redisUrl.startsWith('rediss://')) {
                sharedOptions.tls = { rejectUnauthorized: false };
                logger.info('BullMQ Redis TLS enabled for rediss:// connection');
            }
            return new IORedis(redisUrl, sharedOptions);
        }

        return new IORedis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            ...sharedOptions,
        });
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            if (!this.client) {
                return { status: 'disconnected', message: 'No Redis client' };
            }

            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;

            return {
                status: 'healthy',
                connected: this.isConnected,
                latency: `${latency}ms`
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message
            };
        }
    }
}

// Export singleton instance
module.exports = new RedisService();
