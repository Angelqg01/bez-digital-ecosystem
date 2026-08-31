/**
 * Universal Bridge API Routes
 * 
 * RESTful API for managing the bridge from the frontend/admin panel.
 */

const express = require('express');
const router = express.Router();
const bridge = require('../index');
const { verifyAdminToken } = require('../../middleware/admin.middleware');
const logger = require('../../utils/logger');

/**
 * GET /api/bridge/status
 * Get bridge status and statistics
 */
router.get('/status', async (req, res) => {
    try {
        const stats = bridge.getStats();
        const health = await bridge.healthCheck();

        res.json({
            success: true,
            status: 'operational',
            stats,
            health,
            availableAdapters: bridge.getAvailableAdapters(),
            timestamp: new Date(),
        });
    } catch (error) {
        logger.error({ error }, 'Bridge status error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/bridge/adapters
 * List all registered adapters
 */
router.get('/adapters', async (req, res) => {
    try {
        const adapters = bridge.bridgeCore.getAllAdapters();
        const adapterList = [];

        for (const [platformId, adapter] of adapters) {
            adapterList.push({
                platformId,
                platformName: adapter.platformName,
                status: adapter.getStatus(),
                lastSync: adapter.getLastSyncTime(),
                stats: adapter.getStats(),
            });
        }

        res.json({
            success: true,
            adapters: adapterList,
            total: adapterList.length,
        });
    } catch (error) {
        logger.error({ error }, 'List adapters error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/bridge/adapters/:platformId
 * Get specific adapter details
 */
router.get('/adapters/:platformId', async (req, res) => {
    try {
        const { platformId } = req.params;
        const adapter = bridge.bridgeCore.getAdapter(platformId);

        if (!adapter) {
            return res.status(404).json({
                success: false,
                error: `Adapter ${platformId} not found`,
            });
        }

        res.json({
            success: true,
            adapter: {
                platformId,
                platformName: adapter.platformName,
                status: adapter.getStatus(),
                lastSync: adapter.getLastSyncTime(),
                stats: adapter.getStats(),
            },
        });
    } catch (error) {
        logger.error({ error }, 'Get adapter error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/bridge/adapters/:platformId/register
 * Register a new adapter (Admin only)
 */
router.post('/adapters/:platformId/register', verifyAdminToken, async (req, res) => {
    try {
        const { platformId } = req.params;
        const config = req.body;

        const result = await bridge.registerAdapter(platformId, config);

        if (result.success) {
            res.status(201).json({
                success: true,
                message: `Adapter ${platformId} registered successfully`,
                platformId,
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        logger.error({ error }, 'Register adapter error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/bridge/adapters/:platformId
 * Unregister an adapter (Admin only)
 */
router.delete('/adapters/:platformId', verifyAdminToken, async (req, res) => {
    try {
        const { platformId } = req.params;
        bridge.bridgeCore.unregisterAdapter(platformId);

        res.json({
            success: true,
            message: `Adapter ${platformId} unregistered`,
        });
    } catch (error) {
        logger.error({ error }, 'Unregister adapter error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/bridge/sync/:platformId
 * Trigger inventory sync for a platform (Admin only)
 */
router.post('/sync/:platformId', verifyAdminToken, async (req, res) => {
    try {
        const { platformId } = req.params;
        const options = req.body;

        logger.info({ platformId, options }, 'Manual sync triggered');

        const result = await bridge.syncInventory(platformId, options);

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        logger.error({ error }, 'Sync error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/bridge/sync-all
 * Trigger sync for all platforms (Admin only)
 */
router.post('/sync-all', verifyAdminToken, async (req, res) => {
    try {
        const options = req.body;

        logger.info({ options }, 'Sync all triggered');

        const results = await bridge.syncAll(options);

        res.json({
            success: true,
            results,
        });
    } catch (error) {
        logger.error({ error }, 'Sync all error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/bridge/jobs
 * Get sync jobs status
 */
router.get('/jobs', async (req, res) => {
    try {
        const status = bridge.syncJobs.getJobsStatus();

        res.json({
            success: true,
            jobs: status,
        });
    } catch (error) {
        logger.error({ error }, 'Get jobs error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/bridge/track/:trackingNumber
 * Track a shipment across logistics providers
 */
router.post('/track/:trackingNumber', async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const { carrier } = req.body;

        // Try to track using the specified carrier or auto-detect
        const adapterIds = carrier ? [carrier] : ['maersk', 'fedex', 'dhl'];
        let trackingResult = null;

        for (const adapterId of adapterIds) {
            const adapter = bridge.bridgeCore.getAdapter(adapterId);
            if (adapter && typeof adapter.trackShipment === 'function') {
                try {
                    trackingResult = await adapter.trackShipment(trackingNumber);
                    if (trackingResult) {
                        trackingResult.carrier = adapterId;
                        break;
                    }
                } catch (e) {
                    // Try next carrier
                }
            }
        }

        if (trackingResult) {
            res.json({
                success: true,
                tracking: trackingResult,
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Tracking information not found',
            });
        }
    } catch (error) {
        logger.error({ error }, 'Tracking error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/bridge/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const health = await bridge.healthCheck();
        const allHealthy = Object.values(health).every(h => h.healthy);

        res.status(allHealthy ? 200 : 503).json({
            success: allHealthy,
            healthy: allHealthy,
            adapters: health,
            timestamp: new Date(),
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            healthy: false,
            error: error.message,
        });
    }
});

module.exports = router;
