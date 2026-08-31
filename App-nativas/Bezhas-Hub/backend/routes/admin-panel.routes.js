const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/admin.middleware');
const { db } = require('../database/inMemoryDB');

/**
 * Advanced Admin API Routes
 * Panel de administración completo con gestión de recursos
 */

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

// Get comprehensive dashboard statistics
router.get('/analytics/overview', verifyAdminToken, async (req, res) => {
    try {
        const totalUsers = db.users.size;
        const totalPosts = db.posts.size;
        const totalGroups = db.groups ? db.groups.size : 0;

        // Time-based analytics
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const users = Array.from(db.users.values());
        const posts = Array.from(db.posts.values());

        const newUsersToday = users.filter(u => new Date(u.createdAt) > oneDayAgo).length;
        const newUsersWeek = users.filter(u => new Date(u.createdAt) > oneWeekAgo).length;
        const newUsersMonth = users.filter(u => new Date(u.createdAt) > oneMonthAgo).length;

        const postsToday = posts.filter(p => new Date(p.createdAt) > oneDayAgo).length;
        const postsWeek = posts.filter(p => new Date(p.createdAt) > oneWeekAgo).length;

        // Token economics
        const totalTokensDistributed = users.reduce((sum, u) => sum + (u.tokenBalance || 0), 0);
        const totalStaked = users.reduce((sum, u) => sum + (u.stakedBalance || 0), 0);

        res.json({
            users: {
                total: totalUsers,
                newToday: newUsersToday,
                newThisWeek: newUsersWeek,
                newThisMonth: newUsersMonth,
                active: Math.floor(totalUsers * 0.3) // Mock active users
            },
            content: {
                totalPosts,
                postsToday,
                postsThisWeek: postsWeek,
                totalGroups,
                averagePostsPerUser: totalUsers > 0 ? (totalPosts / totalUsers).toFixed(2) : 0
            },
            economy: {
                totalTokens: totalTokensDistributed,
                totalStaked,
                circulatingSupply: totalTokensDistributed - totalStaked,
                stakingRatio: totalTokensDistributed > 0 ? ((totalStaked / totalTokensDistributed) * 100).toFixed(2) : 0
            },
            growth: {
                userGrowthRate: newUsersWeek > 0 ? '+' + ((newUsersWeek / totalUsers) * 100).toFixed(1) + '%' : '0%',
                contentGrowthRate: postsWeek > 0 ? '+' + ((postsWeek / totalPosts) * 100).toFixed(1) + '%' : '0%'
            }
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// Get activity timeline
router.get('/analytics/timeline', verifyAdminToken, async (req, res) => {
    try {
        const { period = '7d' } = req.query; // 7d, 30d, 90d
        const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;

        const timeline = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
            const endOfDay = new Date(date.setHours(23, 59, 59, 999));

            const usersCount = Array.from(db.users.values()).filter(u => {
                const created = new Date(u.createdAt);
                return created >= startOfDay && created <= endOfDay;
            }).length;

            const postsCount = Array.from(db.posts.values()).filter(p => {
                const created = new Date(p.createdAt);
                return created >= startOfDay && created <= endOfDay;
            }).length;

            timeline.push({
                date: startOfDay.toISOString().split('T')[0],
                users: usersCount,
                posts: postsCount
            });
        }

        res.json(timeline);
    } catch (error) {
        console.error('Error getting timeline:', error);
        res.status(500).json({ error: 'Failed to get timeline' });
    }
});

// ============================================
// USER MANAGEMENT
// ============================================

// Get all users with pagination and filters
router.get('/users/list', verifyAdminToken, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            role = '',
            verified = ''
        } = req.query;

        let users = Array.from(db.users.values());

        // Apply filters
        if (search) {
            users = users.filter(u =>
                (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
                (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
                (u.walletAddress && u.walletAddress.toLowerCase().includes(search.toLowerCase()))
            );
        }

        if (role) {
            users = users.filter(u => u.role === role);
        }

        if (verified !== '') {
            const isVerified = verified === 'true';
            users = users.filter(u => u.isVerified === isVerified);
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedUsers = users.slice(startIndex, endIndex);

        res.json({
            users: paginatedUsers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: users.length,
                pages: Math.ceil(users.length / limit)
            }
        });
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// Get single user details
router.get('/users/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user = db.findUserByWallet(id) || db.findUserById(id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's posts
        const userPosts = Array.from(db.posts.values())
            .filter(p => p.author === user.walletAddress)
            .length;

        // Get user's groups
        const userGroups = Array.from(db.groups ? db.groups.values() : [])
            .filter(g => g.members && g.members.includes(user.walletAddress))
            .length;

        res.json({
            ...user,
            stats: {
                postsCount: userPosts,
                groupsCount: userGroups,
                followers: user.followers || 0,
                following: user.following || 0
            }
        });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Bulk user actions
router.post('/users/bulk-action', verifyAdminToken, async (req, res) => {
    try {
        const { action, userIds } = req.body;

        if (!action || !Array.isArray(userIds)) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const results = [];

        for (const userId of userIds) {
            const user = db.findUserByWallet(userId) || db.findUserById(userId);
            if (!user) continue;

            switch (action) {
                case 'verify':
                    user.isVerified = true;
                    db.updateUser(user.walletAddress, user);
                    results.push({ userId, success: true });
                    break;
                case 'unverify':
                    user.isVerified = false;
                    db.updateUser(user.walletAddress, user);
                    results.push({ userId, success: true });
                    break;
                case 'suspend':
                    user.suspended = true;
                    db.updateUser(user.walletAddress, user);
                    results.push({ userId, success: true });
                    break;
                case 'unsuspend':
                    user.suspended = false;
                    db.updateUser(user.walletAddress, user);
                    results.push({ userId, success: true });
                    break;
                default:
                    results.push({ userId, success: false, error: 'Unknown action' });
            }
        }

        res.json({
            success: true,
            processed: results.length,
            results
        });
    } catch (error) {
        console.error('Error in bulk action:', error);
        res.status(500).json({ error: 'Failed to execute bulk action' });
    }
});

// ============================================
// CONTENT MANAGEMENT
// ============================================

// Get all posts with filters
router.get('/content/posts', verifyAdminToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all', search = '' } = req.query;

        let posts = Array.from(db.posts.values());

        // Apply filters
        if (status === 'hidden') {
            posts = posts.filter(p => p.hidden === true);
        } else if (status === 'visible') {
            posts = posts.filter(p => !p.hidden);
        }

        if (search) {
            posts = posts.filter(p =>
                (p.content && p.content.toLowerCase().includes(search.toLowerCase())) ||
                (p.author && p.author.toLowerCase().includes(search.toLowerCase()))
            );
        }

        // Sort by date
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedPosts = posts.slice(startIndex, endIndex);

        res.json({
            posts: paginatedPosts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: posts.length,
                pages: Math.ceil(posts.length / limit)
            }
        });
    } catch (error) {
        console.error('Error getting posts:', error);
        res.status(500).json({ error: 'Failed to get posts' });
    }
});

// Get all groups
router.get('/content/groups', verifyAdminToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const groups = Array.from(db.groups ? db.groups.values() : []);

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedGroups = groups.slice(startIndex, endIndex);

        res.json({
            groups: paginatedGroups,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: groups.length,
                pages: Math.ceil(groups.length / limit)
            }
        });
    } catch (error) {
        console.error('Error getting groups:', error);
        res.status(500).json({ error: 'Failed to get groups' });
    }
});

// ============================================
// SYSTEM TOOLS
// ============================================

// Get system health
router.get('/system/health', verifyAdminToken, async (req, res) => {
    try {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        res.json({
            status: 'healthy',
            uptime: {
                seconds: uptime,
                formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
            },
            memory: {
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
            },
            database: {
                users: db.users.size,
                posts: db.posts.size,
                groups: db.groups ? db.groups.size : 0,
                type: 'in-memory'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting system health:', error);
        res.status(500).json({ error: 'Failed to get system health' });
    }
});

// Clear cache/reset data (dangerous!)
router.post('/system/reset-cache', verifyAdminToken, async (req, res) => {
    try {
        const { confirmSecret } = req.body;

        // Require confirmation secret to prevent accidents
        if (confirmSecret !== 'RESET_BEZHAS_CACHE_CONFIRMED') {
            return res.status(403).json({
                error: 'Invalid confirmation secret. This action is dangerous!'
            });
        }

        // Here you would implement cache clearing logic
        // For now, just return success

        res.json({
            success: true,
            message: 'Cache cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error resetting cache:', error);
        res.status(500).json({ error: 'Failed to reset cache' });
    }
});

// Get application logs (last N entries)
router.get('/system/logs', verifyAdminToken, async (req, res) => {
    try {
        const { limit = 100 } = req.query;

        // Mock logs - in production, read from actual log files
        const mockLogs = [
            {
                level: 'info',
                message: 'Server started successfully',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                service: 'server'
            },
            {
                level: 'warn',
                message: 'High memory usage detected',
                timestamp: new Date(Date.now() - 1800000).toISOString(),
                service: 'monitor'
            },
            {
                level: 'error',
                message: 'Failed to connect to Redis',
                timestamp: new Date(Date.now() - 900000).toISOString(),
                service: 'redis'
            }
        ];

        res.json({
            logs: mockLogs.slice(0, parseInt(limit)),
            total: mockLogs.length
        });
    } catch (error) {
        console.error('Error getting logs:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// === TELEMETRY SUMMARY ===
router.get('/telemetry/summary', verifyAdminToken, async (req, res) => {
    try {
        // Simulación: contar eventos por tipo (en producción, consultar DB)
        const events = db.telemetryEvents ? Array.from(db.telemetryEvents.values()) : [];
        const summary = {};
        for (const ev of events) {
            summary[ev.eventType] = (summary[ev.eventType] || 0) + 1;
        }
        const result = Object.entries(summary).map(([eventType, count]) => ({ eventType, count }));
        res.json({ events: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get telemetry summary' });
    }
});

// === ML ANALYSIS & CONCLUSIONS ===
router.get('/ml/analysis', verifyAdminToken, async (req, res) => {
    try {
        // Simulación: conclusiones y timeline
        const conclusions = [
            'El sistema detectó un aumento de errores JS en la última hora.',
            'La latencia media de navegación bajó un 10% tras el último deploy.',
            'No se detectaron anomalías críticas en los eventos de usuario.'
        ];
        const stats = [
            { label: 'Errores JS', value: 12 },
            { label: 'Anomalías UX', value: 2 },
            { label: 'Auto-healings', value: 1 }
        ];
        const timeline = [
            { date: '2025-10-20', value: 2 },
            { date: '2025-10-21', value: 4 },
            { date: '2025-10-22', value: 1 }
        ];
        res.json({ conclusions, stats, timeline });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get ML analysis' });
    }
});

module.exports = router;
