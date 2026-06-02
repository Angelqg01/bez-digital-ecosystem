const express = require('express');
const os = require('os');
const router = express.Router();
const db = require('../database/inMemoryDB');
const verifyAdminJWT = require('../middleware/verifyAdminJWT');

// Helper: parse boolean-ish query values
function parseBool(val) {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'boolean') return val;
    const s = String(val).toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
    return undefined;
}

// In-memory system logs and activity stream clients
const systemLogs = [];
const MAX_LOGS = 200;
const activityClients = new Set(); // Set of { id, res }

function addLog(level, message) {
    const entry = { id: Date.now() + Math.random().toString(36).slice(2), level, message, timestamp: new Date().toISOString() };
    systemLogs.push(entry);
    while (systemLogs.length > MAX_LOGS) systemLogs.shift();
    return entry;
}

function pushActivity(activity) {
    const payload = `data: ${JSON.stringify(activity)}\n\n`;
    for (const client of activityClients) {
        try { client.res.write(payload); } catch (_) { }
    }
}

// GET /api/admin/v1/stats
router.get('/stats', verifyAdminJWT, async (req, res) => {
    try {
        const totalUsers = db.users.size;
        const totalPosts = db.posts.size;
        const totalGroups = db.groups.size;

        // Very rough active user estimate for demo (30% of users)
        const activeUsers24h = Math.floor(totalUsers * 0.3);

        res.json({ totalUsers, totalPosts, totalGroups, activeUsers24h });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// GET /api/admin/v1/users/recent
router.get('/users/recent', verifyAdminJWT, async (req, res) => {
    try {
        const recent = Array.from(db.users.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10)
            .map(u => ({
                id: u._id,
                username: u.username || 'Usuario',
                email: u.email || '',
                role: u.role || 'user',
                verified: !!u.verified,
                suspended: !!u.suspended,
                joinedAt: u.createdAt,
                address: u.walletAddress || null,
                avatar: u.avatar || null,
            }));
        res.json(recent);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get recent users' });
    }
});

// GET /api/admin/v1/activity/recent
router.get('/activity/recent', verifyAdminJWT, async (req, res) => {
    try {
        const activities = [];

        // recent posts
        const recentPosts = Array.from(db.posts.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);
        for (const p of recentPosts) {
            activities.push({
                type: 'post_created',
                data: { author: p.author || p.userId || 'usuario', title: p.title || 'Nueva publicación' },
                timestamp: p.createdAt
            });
        }

        // recent users
        const recentUsers = Array.from(db.users.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);
        for (const u of recentUsers) {
            activities.push({
                type: 'user_registered',
                data: { username: u.username || 'Usuario' },
                timestamp: u.createdAt
            });
        }

        // recent groups
        const recentGroups = Array.from(db.groups.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3);
        for (const g of recentGroups) {
            activities.push({
                type: 'group_created',
                data: { groupName: g.name },
                timestamp: g.createdAt
            });
        }

        // sort by timestamp desc and cap to 10
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(activities.slice(0, 10));
    } catch (err) {
        res.status(500).json({ error: 'Failed to get recent activity' });
    }
});

// GET /api/admin/v1/analytics/overview
router.get('/analytics/overview', verifyAdminJWT, async (req, res) => {
    try {
        const totalUsers = db.users.size;
        const totalPosts = db.posts.size;
        const totalGroups = db.groups.size;
        const totalTokens = 120; // demo metric
        const tokenDistribution = [
            { name: 'Treasury', value: 40 },
            { name: 'Staked', value: 25 },
            { name: 'Users', value: 20 },
            { name: 'Rewards', value: 10 },
            { name: 'Team', value: 5 },
        ];

        res.json({ totalUsers, totalPosts, totalGroups, totalTokens, tokenDistribution });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get analytics overview' });
    }
});

// GET /api/admin/v1/analytics/timeline
router.get('/analytics/timeline', verifyAdminJWT, async (req, res) => {
    try {
        // last 7 days timeline
        const days = 7;
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - (days - 1));

        // build maps of counts per date
        const fmt = (d) => d.toISOString().slice(0, 10);
        const userCounts = {};
        const postCounts = {};

        for (const u of db.users.values()) {
            const d = new Date(u.createdAt);
            const key = fmt(d);
            userCounts[key] = (userCounts[key] || 0) + 1;
        }
        for (const p of db.posts.values()) {
            const d = new Date(p.createdAt);
            const key = fmt(d);
            postCounts[key] = (postCounts[key] || 0) + 1;
        }

        const data = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = fmt(d);
            data.push({ date: key, users: userCounts[key] || 0, posts: postCounts[key] || 0 });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get analytics timeline' });
    }
});

// GET /api/admin/v1/system/health
router.get('/system/health', verifyAdminJWT, async (req, res) => {
    try {
        const uptime = process.uptime();
        const version = require('../package.json')?.version || '1.0.0';
        const mem = process.memoryUsage();
        const totalMem = os.totalmem();
        const cpus = os.cpus() || [];

        const health = {
            status: 'healthy',
            uptime: `${Math.floor(uptime)}s`,
            version,
            memory: { used: `${Math.round(mem.rss / (1024 * 1024))} MB`, total: `${Math.round(totalMem / (1024 * 1024))} MB` },
            cpu: { usage: 0, cores: cpus.length }
        };
        res.json(health);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get system health' });
    }
});

// GET /api/admin/v1/system/logs
router.get('/system/logs', verifyAdminJWT, async (req, res) => {
    try {
        if (systemLogs.length === 0) {
            addLog('info', 'Sistema iniciado');
        }
        res.json({ logs: systemLogs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// SSE: /api/admin/v1/stream/health
router.get('/stream/health', verifyAdminJWT, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    const send = () => {
        const uptime = process.uptime();
        const version = require('../package.json')?.version || '1.0.0';
        const mem = process.memoryUsage();
        const totalMem = os.totalmem();
        const cpus = os.cpus() || [];
        const health = {
            status: 'healthy',
            uptime: `${Math.floor(uptime)}s`,
            version,
            memory: { used: `${Math.round(mem.rss / (1024 * 1024))} MB`, total: `${Math.round(totalMem / (1024 * 1024))} MB` },
            cpu: { usage: 0, cores: cpus.length }
        };
        res.write(`data: ${JSON.stringify(health)}\n\n`);
    };

    const interval = setInterval(send, 5000);
    send();

    req.on('close', () => {
        clearInterval(interval);
    });
});

// SSE: /api/admin/v1/stream/activity
router.get('/stream/activity', verifyAdminJWT, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    const client = { id: Date.now(), res };
    activityClients.add(client);

    // Send a hello event
    res.write(`event: hello\n`);
    res.write(`data: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);

    req.on('close', () => {
        activityClients.delete(client);
    });
});

// GET /api/admin/v1/users
router.get('/users', verifyAdminJWT, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', role = '', verified = '', suspended = '' } = req.query;
        const p = Math.max(1, parseInt(page));
        const l = Math.max(1, Math.min(100, parseInt(limit)));
        const v = parseBool(verified);
        const s = parseBool(suspended);

        let users = Array.from(db.users.values()).map(u => ({
            id: u._id,
            username: u.username || 'Usuario',
            email: u.email || '',
            role: u.role || 'user',
            verified: !!u.verified,
            suspended: !!u.suspended,
            avatar: u.avatar || null,
            createdAt: u.createdAt,
        }));

        if (search) {
            const sLower = String(search).toLowerCase();
            users = users.filter(u =>
                (u.username && u.username.toLowerCase().includes(sLower)) ||
                (u.email && u.email.toLowerCase().includes(sLower))
            );
        }
        if (role) users = users.filter(u => u.role === role);
        if (v !== undefined) users = users.filter(u => u.verified === v);
        if (s !== undefined) users = users.filter(u => u.suspended === s);

        const total = users.length;
        const start = (p - 1) * l;
        const paged = users.slice(start, start + l);

        res.json({ users: paged, total, page: p, limit: l });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// PUT /api/admin/v1/users/:id
router.put('/users/:id', verifyAdminJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body || {};
        const updated = db.updateUser(id, updateData);
        if (!updated) return res.status(404).json({ error: 'User not found' });
        res.json({
            id: updated._id,
            username: updated.username,
            email: updated.email,
            role: updated.role || 'user',
            verified: !!updated.verified,
            suspended: !!updated.suspended,
            avatar: updated.avatar || null,
            createdAt: updated.createdAt,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /api/admin/v1/users/:id
router.delete('/users/:id', verifyAdminJWT, async (req, res) => {
    try {
        const { id } = req.params;
        if (!db.users.has(id)) return res.status(404).json({ error: 'User not found' });
        db.users.delete(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// POST /api/admin/v1/users/:id/verify
router.post('/users/:id/verify', verifyAdminJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const user = db.updateUser(id, { verified: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        addLog('info', `Usuario verificado: ${id}`);
        pushActivity({ type: 'user_verified', data: { userId: id }, timestamp: new Date().toISOString() });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to verify user' });
    }
});

// POST /api/admin/v1/users/:id/suspend
router.post('/users/:id/suspend', verifyAdminJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const user = db.updateUser(id, { suspended: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        addLog('warn', `Usuario suspendido: ${id}`);
        pushActivity({ type: 'user_suspended', data: { userId: id }, timestamp: new Date().toISOString() });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

// POST /api/admin/v1/users/bulk
router.post('/users/bulk', verifyAdminJWT, async (req, res) => {
    try {
        const { userIds = [], action } = req.body || {};
        if (!Array.isArray(userIds) || !action) return res.status(400).json({ error: 'Invalid payload' });
        let updated = 0;
        for (const id of userIds) {
            if (!db.users.has(id)) continue;
            if (action === 'verify') {
                db.updateUser(id, { verified: true });
                updated++;
            } else if (action === 'suspend') {
                db.updateUser(id, { suspended: true });
                updated++;
            }
        }
        addLog('info', `Acción masiva '${action}' aplicada a ${updated} usuarios`);
        res.json({ success: true, updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process bulk action' });
    }
});

// ====================================
// SDK & VIP MANAGEMENT ENDPOINTS
// ====================================

// Mock data for SDK clients (in production this would be in a DB)
const mockSDKClients = [
    {
        id: 'client_001',
        company: 'Alpha Innovations',
        tier: 'Bronze',
        apiCalls: 45000,
        transactions: 150,
        revenue: 200,
        createdAt: new Date('2025-11-15').toISOString(),
        contactEmail: 'dev@alpha-innovations.com',
        bezBalance: 50
    },
    {
        id: 'client_002',
        company: 'Tech Growth Ltd',
        tier: 'Silver',
        apiCalls: 380000,
        transactions: 920,
        revenue: 1000,
        createdAt: new Date('2025-10-20').toISOString(),
        contactEmail: 'api@techgrowth.io',
        bezBalance: 500
    },
    {
        id: 'client_003',
        company: 'MegaCorp Solutions',
        tier: 'Platinum',
        apiCalls: 2350000,
        transactions: 15200,
        revenue: 1500,
        createdAt: new Date('2025-09-05').toISOString(),
        contactEmail: 'integrations@megacorp.com',
        bezBalance: 15000
    },
    {
        id: 'client_004',
        company: 'StartupX',
        tier: 'Bronze',
        apiCalls: 28000,
        transactions: 80,
        revenue: 200,
        createdAt: new Date('2026-01-10').toISOString(),
        contactEmail: 'dev@startupx.app',
        bezBalance: 25
    },
    {
        id: 'client_005',
        company: 'Enterprise Labs',
        tier: 'Gold',
        apiCalls: 1200000,
        transactions: 5800,
        revenue: 800,
        createdAt: new Date('2025-08-15').toISOString(),
        contactEmail: 'platform@enterpriselabs.com',
        bezBalance: 4500
    }
];

// Tier pricing configuration (matching the PDF structure)
const tierConfig = {
    'Bronze': { maxCalls: 50000, price: 200, costPercentage: 0.80 },
    'Silver': { maxCalls: 500000, price: 1000, costPercentage: 0.80 },
    'Gold': { maxCalls: 2000000, price: 800, costPercentage: 0.80 },
    'Platinum': { maxCalls: Infinity, price: 1500, costPercentage: 0.70 } // 70% COGS for Platinum
};

// Helper function to calculate financials
function calculateFinancials(client) {
    const config = tierConfig[client.tier] || tierConfig['Bronze'];
    const costPercentage = client.apiCalls > 2000000 ? 0.70 : 0.80;
    const cost = client.revenue * costPercentage;
    const profit = client.revenue - cost;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;

    return {
        cost: Math.round(cost),
        profit: Math.round(profit),
        roi: Math.round(roi * 10) / 10,
        costPercentage: Math.round(costPercentage * 100)
    };
}

// Helper function to determine tier based on usage
function determineTier(apiCalls) {
    if (apiCalls > 2000000) return 'Platinum';
    if (apiCalls > 500000) return 'Gold';
    if (apiCalls > 50000) return 'Silver';
    return 'Bronze';
}

// GET /api/admin/v1/sdk/clients - Get all SDK clients with metrics
router.get('/sdk/clients', verifyAdminJWT, async (req, res) => {
    try {
        // Calculate financials for each client
        const clientsWithMetrics = mockSDKClients.map(client => {
            const financials = calculateFinancials(client);
            return {
                ...client,
                ...financials,
                suggestedTier: determineTier(client.apiCalls)
            };
        });

        // Calculate totals
        const totals = clientsWithMetrics.reduce((acc, client) => {
            acc.totalRevenue += client.revenue;
            acc.totalCost += client.cost;
            acc.totalProfit += client.profit;
            acc.totalApiCalls += client.apiCalls;
            acc.totalTransactions += client.transactions;
            return acc;
        }, {
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            totalApiCalls: 0,
            totalTransactions: 0
        });

        totals.avgROI = totals.totalCost > 0
            ? Math.round((totals.totalProfit / totals.totalCost) * 1000) / 10
            : 0;

        res.json({
            clients: clientsWithMetrics,
            totals,
            timestamp: new Date().toISOString()
        });

        addLog('info', `Admin consultó métricas de SDK (${clientsWithMetrics.length} clientes)`);
    } catch (err) {
        console.error('Error fetching SDK clients:', err);
        res.status(500).json({ error: 'Failed to fetch SDK clients' });
    }
});

// POST /api/admin/v1/sdk/clients/:clientId/upgrade-tier - Upgrade client tier
router.post('/sdk/clients/:clientId/upgrade-tier', verifyAdminJWT, async (req, res) => {
    try {
        const { clientId } = req.params;
        const { newTier } = req.body;

        // Validate tier
        const validTiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
        if (!validTiers.includes(newTier)) {
            return res.status(400).json({ error: 'Invalid tier' });
        }

        // Find client
        const clientIndex = mockSDKClients.findIndex(c => c.id === clientId);
        if (clientIndex === -1) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const oldTier = mockSDKClients[clientIndex].tier;
        mockSDKClients[clientIndex].tier = newTier;

        addLog('info', `Cliente ${mockSDKClients[clientIndex].company} actualizado: ${oldTier} → ${newTier}`);
        pushActivity({
            type: 'sdk_tier_upgraded',
            data: {
                clientId,
                company: mockSDKClients[clientIndex].company,
                oldTier,
                newTier
            },
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            client: mockSDKClients[clientIndex]
        });
    } catch (err) {
        console.error('Error upgrading tier:', err);
        res.status(500).json({ error: 'Failed to upgrade tier' });
    }
});

// POST /api/admin/v1/sdk/clients/:clientId/send-message - Send push notification to client
router.post('/sdk/clients/:clientId/send-message', verifyAdminJWT, async (req, res) => {
    try {
        const { clientId } = req.params;
        const { message, subject } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Find client
        const client = mockSDKClients.find(c => c.id === clientId);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // In production, this would send an email or push notification
        console.log(`📧 Sending message to ${client.company} (${client.contactEmail})`);
        console.log(`Subject: ${subject || 'Notificación de BeZhas'}`);
        console.log(`Message: ${message}`);

        addLog('info', `Mensaje enviado a cliente: ${client.company}`);
        pushActivity({
            type: 'sdk_message_sent',
            data: {
                clientId,
                company: client.company,
                subject: subject || 'Notificación'
            },
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Message sent successfully',
            sentTo: client.contactEmail
        });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// GET /api/admin/v1/sdk/metrics - Get aggregated SDK metrics
router.get('/sdk/metrics', verifyAdminJWT, async (req, res) => {
    try {
        // Calculate tier distribution
        const tierDistribution = mockSDKClients.reduce((acc, client) => {
            acc[client.tier] = (acc[client.tier] || 0) + 1;
            return acc;
        }, {});

        // Calculate monthly growth (mock data)
        const monthlyGrowth = [
            { month: 'Sep', revenue: 2800, clients: 3 },
            { month: 'Oct', revenue: 3200, clients: 4 },
            { month: 'Nov', revenue: 3500, clients: 5 },
            { month: 'Dec', revenue: 3700, clients: 5 },
            { month: 'Jan', revenue: 3700, clients: 5 }
        ];

        // Calculate top clients
        const topClients = [...mockSDKClients]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3)
            .map(c => ({
                company: c.company,
                revenue: c.revenue,
                tier: c.tier
            }));

        res.json({
            tierDistribution,
            monthlyGrowth,
            topClients,
            totalClients: mockSDKClients.length
        });

        addLog('info', 'Admin consultó métricas agregadas de SDK');
    } catch (err) {
        console.error('Error fetching SDK metrics:', err);
        res.status(500).json({ error: 'Failed to fetch SDK metrics' });
    }
});

module.exports = router;
