/**
 * Health Check Endpoint for Revenue Monitor
 * 
 * Endpoint: GET /api/monitoring/health
 * 
 * Returns system health status including:
 * - Event listener status
 * - RPC connection
 * - Contract connectivity
 * - Notification channels
 * - Recent activity
 */

const express = require('express');
const router = express.Router();
const { getEventListener } = require('../services/revenueEventListener');
const { notificationService } = require('../services/notificationService');
const { ethers } = require('ethers');

// Health check endpoint
router.get('/health', async (req, res) => {
    const startTime = Date.now();
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        components: {},
        metrics: {}
    };

    try {
        // Check Event Listener
        try {
            const listener = getEventListener();
            health.components.eventListener = {
                status: 'healthy',
                running: listener.isRunning || false
            };
        } catch (error) {
            health.components.eventListener = {
                status: 'unhealthy',
                error: error.message
            };
            health.status = 'degraded';
        }

        // Check RPC Connection
        try {
            const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
            const blockNumber = await provider.getBlockNumber();
            health.components.rpcConnection = {
                status: 'healthy',
                latestBlock: blockNumber
            };
        } catch (error) {
            health.components.rpcConnection = {
                status: 'unhealthy',
                error: error.message
            };
            health.status = 'unhealthy';
        }

        // Check Contract
        try {
            const listener = getEventListener();
            await listener.initialize();
            const stats = await listener.getStats();
            health.components.contract = {
                status: 'healthy',
                address: process.env.BEZ_LIQUIDITY_RAMP_ADDRESS
            };
            health.metrics = {
                totalVolume: stats.totalVolume.toString(),
                totalFees: stats.totalFees.toString(),
                totalSwaps: stats.totalSwaps.toString()
            };
        } catch (error) {
            health.components.contract = {
                status: 'unhealthy',
                error: error.message
            };
            health.status = 'degraded';
        }

        // Check Notification Channels
        health.components.notifications = {
            discord: !!process.env.DISCORD_WEBHOOK_URL,
            slack: !!process.env.SLACK_WEBHOOK_URL,
            email: !!(process.env.SMTP_HOST && process.env.SMTP_USER)
        };

        // Response time
        health.responseTime = Date.now() - startTime;

        // Set HTTP status based on health
        const httpStatus = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
        res.status(httpStatus).json(health);

    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Stats endpoint
router.get('/stats', async (req, res) => {
    try {
        const listener = getEventListener();
        await listener.initialize();
        const stats = await listener.getStats();

        res.json({
            success: true,
            data: {
                totalVolume: stats.totalVolume.toString(),
                totalFees: stats.totalFees.toString(),
                totalSwaps: stats.totalSwaps.toString(),
                contractAddress: process.env.BEZ_LIQUIDITY_RAMP_ADDRESS,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Recent events endpoint
router.get('/events/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const listener = getEventListener();
        await listener.initialize();

        const events = await listener.queryHistoricalEvents(
            'PlatformFeeCollected',
            -10000,
            'latest'
        );

        const recentEvents = events.slice(-limit).map(event => ({
            user: event.args.user,
            amount: event.args.feeAmount.toString(),
            serviceId: event.args.serviceId,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: event.args.timestamp?.toString()
        }));

        res.json({
            success: true,
            data: recentEvents,
            total: events.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test notifications endpoint (admin only)
router.post('/test-notifications', async (req, res) => {
    try {
        const results = [];

        // Test Discord
        if (process.env.DISCORD_WEBHOOK_URL) {
            try {
                await notificationService.sendDiscord({
                    title: '🧪 Test Notification',
                    description: 'This is a test from the monitoring API',
                    color: 0x3b82f6
                });
                results.push({ channel: 'discord', status: 'success' });
            } catch (error) {
                results.push({ channel: 'discord', status: 'failed', error: error.message });
            }
        }

        // Test Slack
        if (process.env.SLACK_WEBHOOK_URL) {
            try {
                await notificationService.sendSlack({
                    text: '🧪 Test Notification from monitoring API'
                });
                results.push({ channel: 'slack', status: 'success' });
            } catch (error) {
                results.push({ channel: 'slack', status: 'failed', error: error.message });
            }
        }

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Metrics endpoint (Prometheus format)
router.get('/metrics', async (req, res) => {
    try {
        const listener = getEventListener();
        await listener.initialize();
        const stats = await listener.getStats();

        const metrics = `
# HELP bezhas_total_volume_usd Total volume processed in USD
# TYPE bezhas_total_volume_usd gauge
bezhas_total_volume_usd ${ethers.formatUnits(stats.totalVolume, 6)}

# HELP bezhas_total_fees_usd Total fees collected in USD
# TYPE bezhas_total_fees_usd gauge
bezhas_total_fees_usd ${ethers.formatUnits(stats.totalFees, 6)}

# HELP bezhas_total_swaps Total number of swaps
# TYPE bezhas_total_swaps counter
bezhas_total_swaps ${stats.totalSwaps.toString()}

# HELP bezhas_monitor_uptime_seconds Monitor uptime in seconds
# TYPE bezhas_monitor_uptime_seconds gauge
bezhas_monitor_uptime_seconds ${process.uptime()}
    `.trim();

        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        res.status(500).send(`# Error: ${error.message}`);
    }
});

module.exports = router;
