/**
 * Analytics API Routes
 * 
 * Comprehensive analytics endpoints for revenue stream data
 */

const express = require('express');
const router = express.Router();
const { getDatabaseService } = require('../services/databaseService');

const db = getDatabaseService();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OVERVIEW & SUMMARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get overview stats
router.get('/overview', async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Get daily stats
        const dailyStats = await db.getDailyStats(startDate, new Date());

        // Calculate totals
        const totals = dailyStats.reduce((acc, day) => ({
            totalVolume: acc.totalVolume + parseFloat(day.totalVolume),
            totalFees: acc.totalFees + parseFloat(day.totalFees),
            totalSwaps: acc.totalSwaps + day.totalSwaps,
            uniqueUsers: acc.uniqueUsers + day.uniqueUsers,
            newUsers: acc.newUsers + day.newUsers
        }), {
            totalVolume: 0,
            totalFees: 0,
            totalSwaps: 0,
            uniqueUsers: 0,
            newUsers: 0
        });

        res.json({
            success: true,
            data: {
                period: { days: parseInt(days), startDate, endDate: new Date() },
                totals,
                daily: dailyStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SWAPS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get recent swaps
router.get('/swaps', async (req, res) => {
    try {
        const {
            userAddress,
            serviceId,
            startDate,
            endDate,
            limit = 50,
            offset = 0
        } = req.query;

        const swaps = await db.getSwaps({
            userAddress,
            serviceId,
            startDate,
            endDate,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: swaps,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific swap
router.get('/swaps/:txHash', async (req, res) => {
    try {
        const swap = await db.getSwap(req.params.txHash);

        if (!swap) {
            return res.status(404).json({
                success: false,
                error: 'Swap not found'
            });
        }

        res.json({
            success: true,
            data: swap
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get fee analytics
router.get('/fees', async (req, res) => {
    try {
        const { startDate, endDate, serviceId } = req.query;

        const feesData = await db.getTotalFees({
            startDate,
            endDate,
            serviceId
        });

        res.json({
            success: true,
            data: feesData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WALLET ANALYTICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get wallet analytics
router.get('/wallets/:address', async (req, res) => {
    try {
        const analytics = await db.getWalletAnalytics(req.params.address);

        if (!analytics) {
            return res.status(404).json({
                success: false,
                error: 'Wallet not found'
            });
        }

        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get top wallets
router.get('/wallets/top/:limit?', async (req, res) => {
    try {
        const limit = parseInt(req.params.limit) || 10;
        const topWallets = await db.getTopWallets(limit);

        res.json({
            success: true,
            data: topWallets
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIME SERIES DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get daily time series
router.get('/timeseries/daily', async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const dailyStats = await db.getDailyStats(startDate, new Date());

        // Format for charts
        const formatted = dailyStats.map(day => ({
            date: day.date,
            volume: parseFloat(day.totalVolume),
            fees: parseFloat(day.totalFees),
            swaps: day.totalSwaps,
            users: day.uniqueUsers,
            newUsers: day.newUsers
        }));

        res.json({
            success: true,
            data: formatted
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVICE DELIVERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get pending deliveries
router.get('/deliveries/pending', async (req, res) => {
    try {
        const pending = await db.getPendingDeliveries();

        res.json({
            success: true,
            data: pending,
            count: pending.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALERTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get alerts
router.get('/alerts', async (req, res) => {
    try {
        const { type, severity, startDate, endDate, limit = 50 } = req.query;

        const alerts = await db.getAlerts({
            type,
            severity,
            startDate,
            endDate,
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEALTH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get recent health checks
router.get('/health-history', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const checks = await db.getRecentHealthChecks(parseInt(limit));

        res.json({
            success: true,
            data: checks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Database health check
router.get('/db-health', async (req, res) => {
    try {
        const health = await db.healthCheck();

        const status = health.status === 'healthy' ? 200 : 503;
        res.status(status).json({
            success: health.status === 'healthy',
            data: health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
