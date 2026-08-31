const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { body, param, validationResult } = require('express-validator');
const pino = require('pino');
const QualityReputationSystem = require('../services/qualityReputationSystem');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// This will be injected by server.js
let notificationService = null;

// Initialize reputation system
const reputationSystem = new QualityReputationSystem();

// Set notification service instance
function setNotificationService(service) {
    notificationService = service;
}

/**
 * POST /api/quality-escrow/create
 * Create a new quality service
 */
router.post('/create',
    [
        body('provider').isEthereumAddress().withMessage('Invalid provider address'),
        body('collateral').isNumeric().withMessage('Collateral must be numeric'),
        body('initialQuality').isInt({ min: 0, max: 100 }).withMessage('Quality must be 0-100'),
        body('description').optional().isString().trim().escape()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { provider, collateral, initialQuality, description } = req.body;
            const client = req.user?.address || req.body.client; // From auth middleware

            logger.info({ provider, collateral, initialQuality }, 'Creating quality service');

            // In real implementation, this would interact with the smart contract
            // For now, return mock data
            const serviceId = Math.floor(Math.random() * 10000);

            const serviceData = {
                serviceId,
                client,
                provider,
                collateral: parseFloat(collateral),
                initialQuality: parseInt(initialQuality),
                description: description || '',
                status: 'active',
                createdAt: new Date().toISOString()
            };

            // Send notifications
            if (notificationService) {
                notificationService.notifyServiceCreated(serviceData);
            }

            res.json({
                success: true,
                service: serviceData
            });

        } catch (error) {
            logger.error({ error: error.message }, 'Error creating service');
            res.status(500).json({ error: 'Failed to create service' });
        }
    });

/**
 * GET /api/quality-escrow/:id
 * Get service details
 */
router.get('/:id',
    [
        param('id').isNumeric().withMessage('Service ID must be numeric')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { id } = req.params;

            logger.info({ serviceId: id }, 'Fetching service details');

            // Mock data - in production, fetch from blockchain
            const service = {
                serviceId: id,
                client: '0x1234567890123456789012345678901234567890',
                provider: '0x0987654321098765432109876543210987654321',
                collateral: 100,
                initialQuality: 85,
                currentQuality: 88,
                status: 'active',
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                description: 'Quality assurance service'
            };

            res.json({ success: true, service });

        } catch (error) {
            logger.error({ error: error.message }, 'Error fetching service');
            res.status(500).json({ error: 'Failed to fetch service' });
        }
    });

/**
 * POST /api/quality-escrow/finalize
 * Finalize a service
 */
router.post('/finalize',
    [
        body('serviceId').isNumeric().withMessage('Service ID must be numeric'),
        body('finalQuality').isInt({ min: 0, max: 100 }).withMessage('Quality must be 0-100')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { serviceId, finalQuality } = req.body;

            logger.info({ serviceId, finalQuality }, 'Finalizing service');

            // Mock calculation
            const collateral = 100;
            const qualityThreshold = 85;
            const penaltyRate = 0.1; // 10% penalty per point below threshold

            let collateralReturned = collateral;
            let penaltyApplied = 0;

            if (finalQuality < qualityThreshold) {
                const deficit = qualityThreshold - finalQuality;
                penaltyApplied = Math.floor(collateral * deficit * penaltyRate);
                collateralReturned = collateral - penaltyApplied;
            }

            const result = {
                serviceId,
                finalQuality,
                collateralReturned,
                penaltyApplied,
                provider: '0x0987654321098765432109876543210987654321'
            };

            // Update reputation
            const updatedReputation = reputationSystem.updateAfterService(
                result.provider,
                {
                    serviceId,
                    finalQuality,
                    collateralReturned,
                    penaltyApplied,
                    isDisputed: false
                }
            );

            // Send notifications
            if (notificationService) {
                notificationService.notifyServiceFinalized(result);

                if (collateralReturned > 0) {
                    notificationService.notifyCollateralReleased({
                        serviceId,
                        provider: result.provider,
                        amount: collateralReturned,
                        finalQuality
                    });
                }
            }

            res.json({
                success: true,
                result,
                reputation: reputationSystem.getSummary(result.provider)
            });

        } catch (error) {
            logger.error({ error: error.message }, 'Error finalizing service');
            res.status(500).json({ error: 'Failed to finalize service' });
        }
    });

/**
 * POST /api/quality-escrow/dispute
 * Open a dispute
 */
router.post('/dispute',
    [
        body('serviceId').isNumeric().withMessage('Service ID must be numeric'),
        body('reason').isString().trim().notEmpty().withMessage('Reason is required')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { serviceId, reason } = req.body;
            const client = req.user?.address || req.body.client;

            logger.warn({ serviceId, reason }, 'Opening dispute');

            const disputeData = {
                serviceId,
                client,
                provider: '0x0987654321098765432109876543210987654321',
                reason,
                status: 'pending',
                createdAt: new Date().toISOString()
            };

            // Send notifications
            if (notificationService) {
                notificationService.notifyDisputeOpened(disputeData);
            }

            res.json({ success: true, dispute: disputeData });

        } catch (error) {
            logger.error({ error: error.message }, 'Error opening dispute');
            res.status(500).json({ error: 'Failed to open dispute' });
        }
    });

/**
 * GET /api/quality-escrow/stats
 * Get overall statistics
 */
router.get('/stats', async (req, res) => {
    try {
        logger.info('Fetching quality escrow stats');

        // Mock stats - in production, aggregate from blockchain
        const stats = {
            totalServices: 156,
            activeServices: 23,
            completedServices: 128,
            disputedServices: 5,
            averageQuality: 87.5,
            totalCollateralLocked: 2300,
            totalPenaltiesApplied: 145,
            successRate: 95.8
        };

        res.json({ success: true, stats });

    } catch (error) {
        logger.error({ error: error.message }, 'Error fetching stats');
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * GET /api/quality-escrow/analytics
 * Get comprehensive analytics data
 */
router.get('/analytics', async (req, res) => {
    try {
        const { timeRange = '7d' } = req.query;
        logger.info({ timeRange }, 'Fetching analytics');

        // Mock analytics - in production, aggregate from blockchain and database
        const analytics = {
            overview: {
                totalServices: 156,
                activeServices: 23,
                completedServices: 128,
                disputedServices: 5,
                averageQuality: 87.5,
                totalCollateral: 15600,
                totalPenalties: 890,
                successRate: 95.8
            },
            timeline: generateTimelineData(timeRange),
            qualityDistribution: [
                { range: '95-100%', count: 45, percentage: 35 },
                { range: '85-94%', count: 58, percentage: 45 },
                { range: '70-84%', count: 20, percentage: 16 },
                { range: '<70%', count: 5, percentage: 4 }
            ],
            statusDistribution: [
                { name: 'Completed', value: 128 },
                { name: 'Active', value: 23 },
                { name: 'Disputed', value: 5 }
            ],
            topProviders: [
                { address: '0x1234...5678', services: 45, avgQuality: 92, totalEarned: 4500, penalties: 120 },
                { address: '0x2345...6789', services: 38, avgQuality: 89, totalEarned: 3800, penalties: 180 },
                { address: '0x3456...7890', services: 32, avgQuality: 91, totalEarned: 3200, penalties: 95 },
                { address: '0x4567...8901', services: 28, avgQuality: 87, totalEarned: 2800, penalties: 210 },
                { address: '0x5678...9012', services: 25, avgQuality: 90, totalEarned: 2500, penalties: 150 }
            ],
            collateralFlow: generateCollateralFlowData(timeRange),
            hourlyActivity: generateHourlyActivityData()
        };

        res.json({ success: true, analytics });

    } catch (error) {
        logger.error({ error: error.message }, 'Error fetching analytics');
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Helper functions for generating mock data
function generateTimelineData(timeRange) {
    const days = timeRange === '24h' ? 1 : parseInt(timeRange);
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().split('T')[0],
            services: Math.floor(Math.random() * 15) + 10,
            quality: Math.floor(Math.random() * 10) + 85,
            penalties: Math.floor(Math.random() * 50) + 20
        });
    }

    return data;
}

function generateCollateralFlowData(timeRange) {
    const days = timeRange === '24h' ? 1 : parseInt(timeRange);
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const locked = Math.floor(Math.random() * 1000) + 2000;
        const released = locked - Math.floor(Math.random() * 500);
        data.push({
            date: date.toISOString().split('T')[0],
            locked,
            released,
            penalties: Math.floor(Math.random() * 80) + 20
        });
    }

    return data;
}

function generateHourlyActivityData() {
    const data = [];
    for (let i = 0; i < 24; i++) {
        data.push({
            hour: `${i}:00`,
            services: Math.floor(Math.random() * 10) + 1
        });
    }
    return data;
}

/**
 * GET /api/quality-escrow/reputation/:address
 * Get reputation for specific provider
 */
router.get('/reputation/:address',
    [
        param('address').isEthereumAddress().withMessage('Invalid Ethereum address')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { address } = req.params;
            const summary = reputationSystem.getSummary(address);

            res.json({ success: true, reputation: summary });

        } catch (error) {
            logger.error({ error: error.message }, 'Error fetching reputation');
            res.status(500).json({ error: 'Failed to fetch reputation' });
        }
    });

/**
 * GET /api/quality-escrow/leaderboard
 * Get reputation leaderboard
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const leaderboard = reputationSystem.getLeaderboard(parseInt(limit));

        res.json({ success: true, leaderboard });

    } catch (error) {
        logger.error({ error: error.message }, 'Error fetching leaderboard');
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

module.exports = { router, setNotificationService, reputationSystem };
