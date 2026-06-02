/**
 * Centralized Health Check Service
 * Monitors all backend services and connections
 */

const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class HealthCheckService {
    constructor() {
        console.log('🔧 HealthCheckService constructor called');
        this.services = new Map();
        this.lastCheck = null;
        this.checkInterval = null;
    }

    /**
     * Register a service for health monitoring
     * @param {string} name - Service name
     * @param {Function} checkFunction - Async function that returns health status
     */
    registerService(name, checkFunction) {
        this.services.set(name, {
            name,
            check: checkFunction,
            lastStatus: null,
            lastChecked: null
        });
        logger.info({ service: name }, 'Service registered for health monitoring');
    }

    /**
     * Check health of a specific service
     */
    async checkService(name) {
        const service = this.services.get(name);
        if (!service) {
            return {
                status: 'unknown',
                error: 'Service not registered'
            };
        }

        try {
            const startTime = Date.now();
            const result = await Promise.race([
                service.check(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Health check timeout')), 5000)
                )
            ]);
            const responseTime = Date.now() - startTime;

            service.lastStatus = {
                ...result,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            };
            service.lastChecked = Date.now();

            return service.lastStatus;

        } catch (error) {
            const errorStatus = {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };

            service.lastStatus = errorStatus;
            service.lastChecked = Date.now();

            return errorStatus;
        }
    }

    /**
     * Check all registered services
     */
    async checkAll() {
        const results = {};
        const serviceNames = Array.from(this.services.keys());

        await Promise.all(
            serviceNames.map(async (name) => {
                results[name] = await this.checkService(name);
            })
        );

        this.lastCheck = Date.now();

        return {
            status: this.getOverallStatus(results),
            timestamp: new Date().toISOString(),
            services: results,
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
            }
        };
    }

    /**
     * Get overall health status
     */
    getOverallStatus(results) {
        const statuses = Object.values(results).map(r => r.status);

        if (statuses.every(s => s === 'healthy')) {
            return 'healthy';
        } else if (statuses.some(s => s === 'unhealthy')) {
            return 'degraded';
        } else {
            return 'unknown';
        }
    }

    /**
     * Start periodic health checks
     */
    startPeriodicChecks(intervalMs = 60000) {
        if (this.checkInterval) {
            logger.warn('Periodic health checks already running');
            return;
        }

        this.checkInterval = setInterval(async () => {
            try {
                const health = await this.checkAll();

                if (health.status !== 'healthy') {
                    logger.warn({ health }, 'System health degraded');
                }
            } catch (error) {
                logger.error({ error: error.message }, 'Error in periodic health check');
            }
        }, intervalMs);

        logger.info({ interval: intervalMs }, 'Periodic health checks started');
    }

    /**
     * Stop periodic health checks
     */
    stopPeriodicChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('Periodic health checks stopped');
        }
    }

    /**
     * Get quick status summary
     */
    getQuickStatus() {
        const services = {};

        this.services.forEach((service, name) => {
            services[name] = {
                status: service.lastStatus?.status || 'unknown',
                lastChecked: service.lastChecked
                    ? new Date(service.lastChecked).toISOString()
                    : 'never'
            };
        });

        return {
            lastFullCheck: this.lastCheck
                ? new Date(this.lastCheck).toISOString()
                : 'never',
            services
        };
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        this.stopPeriodicChecks();
        this.services.clear();
        logger.info('Health check service shutdown complete');
    }
}

// Export singleton instance
module.exports = new HealthCheckService();
