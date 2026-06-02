/**
 * Telemetry API Routes
 * Endpoints for collecting frontend telemetry data
 */

const express = require('express');
const router = express.Router();
const telemetryService = require('../services/telemetry.service');

/**
 * POST /api/v1/telemetry
 * Receive telemetry events from frontend
 */
router.post('/', async (req, res) => {
    try {
        const { sessionId, events } = req.body;

        // Validate request
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId is required'
            });
        }

        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'events must be a non-empty array'
            });
        }

        // Process each event - with safety checks
        let processed = 0;
        let failed = 0;

        for (const event of events) {
            try {
                if (telemetryService && typeof telemetryService.addEvent === 'function') {
                    await telemetryService.addEvent({
                        sessionId,
                        ...event
                    });
                    processed++;
                } else {
                    console.warn('⚠️ Telemetry service not available, skipping event');
                    failed++;
                }
            } catch (error) {
                console.error('Failed to process telemetry event:', error);
                failed++;
            }
        }

        res.json({
            success: true,
            processed,
            failed,
            total: events.length
        });

    } catch (error) {
        console.error('❌ Telemetry endpoint error:', error);
        res.status(200).json({
            success: false,
            error: 'Telemetry service unavailable',
            processed: 0,
            failed: 0
        });
    }
});

/**
 * GET /api/v1/telemetry/stats
 * Get telemetry service statistics
 */
router.get('/stats', (req, res) => {
    try {
        const stats = telemetryService.getStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('❌ Failed to get telemetry stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * POST /api/v1/telemetry/flush
 * Force flush telemetry buffer (admin only)
 */
router.post('/flush', async (req, res) => {
    try {
        // TODO: Add admin authentication middleware
        await telemetryService.flush();

        res.json({
            success: true,
            message: 'Telemetry buffer flushed'
        });
    } catch (error) {
        console.error('❌ Failed to flush telemetry:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
