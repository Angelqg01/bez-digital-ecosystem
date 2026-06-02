/**
 * Health Check Routes
 * Centralized health monitoring endpoints
 */

const express = require('express');
const router = express.Router();
const healthService = require('../services/health.service');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * GET /health - Quick health check
 */
router.get('/', async (req, res) => {
    try {
        const quickStatus = healthService.getQuickStatus();

        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            ...quickStatus
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Health check error');
        res.status(503).json({
            status: 'error',
            message: error.message
        });
    }
});

/**
 * GET /health/detailed - Detailed health check of all services
 */
router.get('/detailed', async (req, res) => {
    try {
        const health = await healthService.checkAll();

        const statusCode = health.status === 'healthy' ? 200 : 503;

        res.status(statusCode).json(health);
    } catch (error) {
        logger.error({ error: error.message }, 'Detailed health check error');
        res.status(503).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /health/:service - Check specific service
 */
router.get('/:service', async (req, res) => {
    try {
        const { service } = req.params;
        const result = await healthService.checkService(service);

        if (result.status === 'unknown') {
            return res.status(404).json({
                status: 'error',
                message: `Service '${service}' not found`
            });
        }

        const statusCode = result.status === 'healthy' ? 200 : 503;

        res.status(statusCode).json({
            service,
            ...result
        });
    } catch (error) {
        logger.error({ error: error.message, service: req.params.service }, 'Service health check error');
        res.status(503).json({
            status: 'error',
            message: error.message
        });
    }
});

/**
 * GET /health/system/info - System information
 */
router.get('/system/info', (req, res) => {
    const memoryUsage = process.memoryUsage();

    res.json({
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
        },
        cpu: process.cpuUsage(),
        env: process.env.NODE_ENV || 'development'
    });
});

/**
 * GET /health/live - Kubernetes/Cloud Run liveness probe
 * Returns 200 if the server is running (even if dependencies are down)
 */
router.get('/live', (req, res) => {
    res.status(200).json({
        alive: true,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /health/ready - Kubernetes/Cloud Run readiness probe
 * Returns 200 only if the server can accept traffic
 */
router.get('/ready', async (req, res) => {
    try {
        // Check critical dependencies
        const checks = {
            database: false,
            cache: false
        };

        // Check MongoDB connection
        try {
            const mongoose = require('mongoose');
            checks.database = mongoose.connection.readyState === 1;
        } catch (e) {
            // If mongoose not loaded or not connected, try mock models
            checks.database = true; // Mock models are always "ready"
        }

        // Check Redis connection
        try {
            const redisService = require('../services/redis.service');
            checks.cache = redisService.isConnected?.() || false;
        } catch (e) {
            checks.cache = true; // Cache is optional
        }

        // Determine readiness - at minimum, database should be ready
        const ready = checks.database;

        if (ready) {
            res.status(200).json({
                ready: true,
                checks,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                ready: false,
                checks,
                message: 'Service not ready to accept traffic',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        logger.error({ error: error.message }, 'Readiness check error');
        res.status(503).json({
            ready: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /health/startup - Kubernetes startup probe
 * Returns 200 once the application has fully started
 */
router.get('/startup', async (req, res) => {
    try {
        // Check if essential modules are loaded
        const startupChecks = {
            express: !!require.cache[require.resolve('express')],
            config: !!require.cache[require.resolve('../config')],
            routes: true // If we're here, routes are loaded
        };

        const started = Object.values(startupChecks).every(v => v);

        if (started) {
            res.status(200).json({
                started: true,
                checks: startupChecks,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                started: false,
                checks: startupChecks,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        logger.error({ error: error.message }, 'Startup check error');
        res.status(503).json({
            started: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
