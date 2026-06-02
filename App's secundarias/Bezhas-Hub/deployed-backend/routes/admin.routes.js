const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/admin.middleware');
const User = require('../models/user.model');
const { UserRole } = require('../models/mockModels');
const { ensureSuperAdminRole } = require('../middleware/auth.middleware');

// Get admin dashboard stats
router.get('/stats', verifyAdminToken, async (req, res) => {
    try {
        const db = require('../database/inMemoryDB');
        const totalUsers = db.users.size;
        const totalPosts = db.posts.size;
        const totalGroups = db.groups ? db.groups.size : 0;

        res.json({
            totalUsers,
            totalPosts,
            totalGroups,
            activeUsers: Math.floor(totalUsers * 0.3) // Mock data
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Get dashboard stats for AdminJS panel
router.get('/dashboard-stats', verifyAdminToken, async (req, res) => {
    try {
        const db = require('../database/inMemoryDB');
        const totalUsers = db.users.size;
        const totalPosts = db.posts.size;
        const totalGroups = db.groups ? db.groups.size : 0;

        // Calculate new users this week
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const newUsersThisWeek = Array.from(db.users.values()).filter(
            user => new Date(user.createdAt) > oneWeekAgo
        ).length;

        // Calculate total staked tokens
        const totalStaked = Array.from(db.users.values()).reduce(
            (sum, user) => sum + (user.stakedBalance || 0), 0
        );

        // Get recent activity
        const recentActivity = [];
        const recentUsers = Array.from(db.users.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3);

        recentUsers.forEach(user => {
            recentActivity.push({
                type: 'Nuevo Usuario',
                description: `${user.username || 'Usuario'} se registró en la plataforma`,
                timestamp: new Date(user.createdAt).toLocaleString('es-ES')
            });
        });

        res.json({
            totalUsers,
            newUsersThisWeek,
            activeUsers: Math.floor(totalUsers * 0.3),
            totalGroups,
            totalPosts,
            totalStaked,
            transactionsVolume: Math.floor(totalStaked * 0.1), // Mock
            recentActivity
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
});

// Get system components status
router.get('/system/components', verifyAdminToken, async (req, res) => {
    try {
        const db = require('../database/inMemoryDB');
        res.json({
            success: true,
            components: [
                { name: 'Backend API', status: 'operational', version: '1.0.0' },
                { name: 'Database', status: 'operational', version: 'PostgreSQL 14' },
                { name: 'Cache', status: 'operational', version: 'Redis 6' },
                { name: 'Blockchain Listener', status: 'degraded', message: 'Syncing' },
                { name: 'AI Engine', status: 'operational', version: 'v2' }
            ]
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get system components' });
    }
});

// List all users
router.get('/users', verifyAdminToken, async (req, res) => {
    try {
        // In-memory: get all users
        const users = Array.from(require('../database/inMemoryDB').users.values());
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// Edit user
router.put('/users/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const db = require('../database/inMemoryDB');
        const updatedUser = db.updateUser(id, updateData);
        if (!updatedUser) return res.status(404).json({ error: 'User not found' });
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/users/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../database/inMemoryDB');
        if (!db.users.has(id)) return res.status(404).json({ error: 'User not found' });
        db.users.delete(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Delete post (content moderation)
router.delete('/posts/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../database/inMemoryDB');
        if (!db.posts.has(id)) return res.status(404).json({ error: 'Post not found' });
        db.posts.delete(id);
        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// Update post status (hide/show)
router.patch('/posts/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { hidden } = req.body;
        const db = require('../database/inMemoryDB');

        const post = db.posts.get(id);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        post.hidden = hidden;
        post.modifiedAt = new Date().toISOString();
        db.posts.set(id, post);

        res.json({ success: true, post });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// ==================== ACCIONES DE USUARIOS ====================

/**
 * POST /api/admin/users/:id/activate
 * Activar un usuario
 */
router.post('/users/:id/activate', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../database/inMemoryDB');

        const user = db.users.get(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.status = 'active';
        user.updatedAt = new Date().toISOString();
        db.users.set(id, user);

        console.log(`✅ Usuario ${id} activado por admin`);

        res.json({
            success: true,
            message: 'Usuario activado correctamente',
            user
        });
    } catch (error) {
        console.error('Error activating user:', error);
        res.status(500).json({ error: 'Error al activar usuario' });
    }
});

/**
 * POST /api/admin/users/:id/deactivate
 * Desactivar un usuario
 */
router.post('/users/:id/deactivate', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../database/inMemoryDB');

        const user = db.users.get(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.status = 'inactive';
        user.updatedAt = new Date().toISOString();
        db.users.set(id, user);

        console.log(`⚠️ Usuario ${id} desactivado por admin`);

        res.json({
            success: true,
            message: 'Usuario desactivado correctamente',
            user
        });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({ error: 'Error al desactivar usuario' });
    }
});

/**
 * POST /api/admin/users/:id/view
 * Ver detalles completos de un usuario
 */
router.post('/users/:id/view', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../database/inMemoryDB');

        const user = db.users.get(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Obtener estadísticas adicionales del usuario
        const userPosts = Array.from(db.posts.values()).filter(post => post.userId === id);

        const userDetails = {
            ...user,
            stats: {
                totalPosts: userPosts.length,
                followers: user.followers?.length || 0,
                following: user.following?.length || 0,
                reputation: user.reputation || 0
            }
        };

        res.json(userDetails);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Error al obtener detalles del usuario' });
    }
});

/**
 * POST /api/admin/users/create
 * Create a new user manually (Admin only)
 */
router.post('/users/create', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];
        const { username, email, walletAddress: newUserWallet, role, subscription, isVendor } = req.body;

        if (!walletAddress) {
            return res.status(401).json({
                success: false,
                error: 'Wallet address not provided'
            });
        }

        // Verify admin privileges
        let adminUser = await User.findOne({
            walletAddress: walletAddress.toLowerCase()
        });

        if (!adminUser) {
            return res.status(404).json({
                success: false,
                error: 'Admin user not found'
            });
        }

        adminUser = await ensureSuperAdminRole(adminUser);

        // Only ADMIN can create users
        if (adminUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Only Super Admins can create users.'
            });
        }

        // Validate required fields
        if (!newUserWallet) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address is required'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            walletAddress: newUserWallet.toLowerCase()
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this wallet address already exists'
            });
        }

        // Validate role if provided
        if (role) {
            const validRoles = Object.values(UserRole);
            if (!validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid role. Valid roles: ${validRoles.join(', ')}`
                });
            }
        }

        // Create new user
        const newUser = new User({
            walletAddress: newUserWallet.toLowerCase(),
            username: username || `User_${newUserWallet.slice(2, 8)}`,
            email: email || null,
            role: role || 'USER',
            subscription: subscription || 'FREE',
            isVerified: false,
            isBanned: false,
            createdAt: new Date().toISOString()
        });

        // If vendor, add vendor-specific fields
        if (isVendor) {
            newUser.isVendor = true;
            newUser.vendorProfile = {
                storeName: username || `Store_${newUserWallet.slice(2, 8)}`,
                verified: false,
                rating: 0,
                totalSales: 0,
                joinedAt: new Date().toISOString()
            };
        }

        await newUser.save();

        console.log(`✅ New user created: ${newUser.username} (${newUser.walletAddress}) - Role: ${newUser.role}${isVendor ? ' [VENDOR]' : ''}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: newUser._id,
                username: newUser.username,
                walletAddress: newUser.walletAddress,
                email: newUser.email,
                role: newUser.role,
                subscription: newUser.subscription,
                isVendor: newUser.isVendor || false,
                createdAt: newUser.createdAt
            }
        });

    } catch (error) {
        console.error('❌ Error creating user:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            details: error.message
        });
    }
});

// ==================== GESTIÓN DE ROLES Y PERMISOS ====================

/**
 * GET /api/admin/users/all
 * Obtener todos los usuarios con sus roles (Admin only)
 */
router.get('/users/all', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];

        if (!walletAddress) {
            return res.status(401).json({
                success: false,
                error: 'Wallet address not provided'
            });
        }

        // Verify admin privileges
        let user = await User.findOne({
            walletAddress: walletAddress.toLowerCase()
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        user = await ensureSuperAdminRole(user);

        // Check if user has admin privileges
        const adminRoles = ['ADMIN', 'MODERATOR', 'DEVELOPER'];
        if (!adminRoles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin privileges required.'
            });
        }

        // Get all users
        const allUsers = await User.find({});

        // Format user data
        const users = allUsers.map(u => ({
            id: u._id,
            username: u.username,
            walletAddress: u.walletAddress,
            email: u.email || null,
            role: u.role,
            subscription: u.subscription,
            isVerified: u.isVerified,
            isBanned: u.isBanned,
            createdAt: u.createdAt,
            lastLogin: u.lastLogin || null
        }));

        res.json({
            success: true,
            users,
            total: users.length
        });

    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            details: error.message
        });
    }
});

/**
 * PUT /api/admin/users/:userId/role
 * Update user role (Admin only)
 */
router.put('/users/:userId/role', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];
        const { userId } = req.params;
        const { role } = req.body;

        if (!walletAddress) {
            return res.status(401).json({
                success: false,
                error: 'Wallet address not provided'
            });
        }

        // Verify admin privileges
        let adminUser = await User.findOne({
            walletAddress: walletAddress.toLowerCase()
        });

        if (!adminUser) {
            return res.status(404).json({
                success: false,
                error: 'Admin user not found'
            });
        }

        adminUser = await ensureSuperAdminRole(adminUser);

        // Only ADMIN can change roles
        if (adminUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Only Super Admins can change user roles.'
            });
        }

        // Validate role
        const validRoles = Object.values(UserRole);
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: `Invalid role. Valid roles: ${validRoles.join(', ')}`
            });
        }

        // Find target user
        const targetUser = await User.findById(userId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: 'Target user not found'
            });
        }

        // Prevent demoting yourself
        if (targetUser._id === adminUser._id && role !== 'ADMIN') {
            return res.status(400).json({
                success: false,
                error: 'You cannot demote yourself'
            });
        }

        // Update role
        targetUser.role = role;
        targetUser.updatedAt = new Date().toISOString();
        await targetUser.save();

        console.log(`✅ Role updated: ${targetUser.username} (${targetUser.walletAddress}) -> ${role}`);

        res.json({
            success: true,
            message: `User role updated to ${role}`,
            user: {
                id: targetUser._id,
                username: targetUser.username,
                walletAddress: targetUser.walletAddress,
                role: targetUser.role,
                updatedAt: targetUser.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Error updating user role:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            details: error.message
        });
    }
});

/**
 * PUT /api/admin/users/:userId/ban
 * Ban/Unban user (Admin only)
 */
router.put('/users/:userId/ban', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];
        const { userId } = req.params;
        const { banned } = req.body;

        if (!walletAddress) {
            return res.status(401).json({
                success: false,
                error: 'Wallet address not provided'
            });
        }

        // Verify admin privileges
        let adminUser = await User.findOne({
            walletAddress: walletAddress.toLowerCase()
        });

        if (!adminUser) {
            return res.status(404).json({
                success: false,
                error: 'Admin user not found'
            });
        }

        adminUser = await ensureSuperAdminRole(adminUser);

        const adminRoles = ['ADMIN', 'MODERATOR'];
        if (!adminRoles.includes(adminUser.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin or Moderator privileges required.'
            });
        }

        // Find target user
        const targetUser = await User.findById(userId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: 'Target user not found'
            });
        }

        // Prevent banning yourself
        if (targetUser._id === adminUser._id) {
            return res.status(400).json({
                success: false,
                error: 'You cannot ban yourself'
            });
        }

        // Prevent banning other admins (unless you're an ADMIN)
        if (targetUser.role === 'ADMIN' && adminUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'You cannot ban other administrators'
            });
        }

        // Update ban status
        targetUser.isBanned = banned;
        targetUser.updatedAt = new Date().toISOString();
        await targetUser.save();

        console.log(`✅ Ban status updated: ${targetUser.username} -> ${banned ? 'BANNED' : 'UNBANNED'}`);

        res.json({
            success: true,
            message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
            user: {
                id: targetUser._id,
                username: targetUser.username,
                walletAddress: targetUser.walletAddress,
                isBanned: targetUser.isBanned,
                updatedAt: targetUser.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Error updating ban status:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            details: error.message
        });
    }
});

/**
 * PUT /api/admin/users/:userId/subscription
 * Update user subscription tier (Admin only)
 */
router.put('/users/:userId/subscription', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];
        const { userId } = req.params;
        const { subscription } = req.body;

        if (!walletAddress) {
            return res.status(401).json({
                success: false,
                error: 'Wallet address not provided'
            });
        }

        // Verify admin privileges
        let adminUser = await User.findOne({
            walletAddress: walletAddress.toLowerCase()
        });

        if (!adminUser) {
            return res.status(404).json({
                success: false,
                error: 'Admin user not found'
            });
        }

        adminUser = await ensureSuperAdminRole(adminUser);

        if (adminUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin privileges required.'
            });
        }

        // Validate subscription tier
        const validSubscriptions = ['FREE', 'PREMIUM', 'VIP'];
        if (!validSubscriptions.includes(subscription)) {
            return res.status(400).json({
                success: false,
                error: `Invalid subscription tier. Must be one of: ${validSubscriptions.join(', ')}`
            });
        }

        // Find target user
        const targetUser = await User.findById(userId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: 'Target user not found'
            });
        }

        // Update subscription
        targetUser.subscription = subscription;
        targetUser.updatedAt = new Date().toISOString();
        await targetUser.save();

        console.log(`✅ Subscription updated: ${targetUser.username} -> ${subscription}`);

        res.json({
            success: true,
            message: `Subscription updated to ${subscription} successfully`,
            user: {
                id: targetUser._id,
                username: targetUser.username,
                walletAddress: targetUser.walletAddress,
                subscription: targetUser.subscription,
                updatedAt: targetUser.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Error updating subscription:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            details: error.message
        });
    }
});

// ==================== GESTIÓN DE CONTENIDO ====================

/**
 * GET /api/admin/content
 * Obtener lista de contenido con filtros
 */
router.get('/content', verifyAdminToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, type = 'all', status = 'all' } = req.query;
        const db = require('../database/inMemoryDB');

        let allContent = Array.from(db.posts.values());

        // Filtrar por tipo si es necesario
        if (type !== 'all') {
            allContent = allContent.filter(post => post.type === type);
        }

        // Filtrar por estado
        if (status !== 'all') {
            allContent = allContent.filter(post => {
                if (status === 'pending') return !post.approved && !post.rejected;
                if (status === 'approved') return post.approved;
                if (status === 'rejected') return post.rejected;
                return true;
            });
        }

        // Ordenar por fecha de creación (más recientes primero)
        allContent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Paginación
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + Number(limit);
        const paginatedContent = allContent.slice(startIndex, endIndex);

        res.json({
            content: paginatedContent,
            total: allContent.length,
            page: Number(page),
            totalPages: Math.ceil(allContent.length / limit)
        });
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: 'Error al obtener contenido' });
    }
});

/**
 * POST /api/admin/content/:id/approve
 * Aprobar contenido
 */
router.post('/content/:id/approve', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../database/inMemoryDB');

        const post = db.posts.get(id);
        if (!post) return res.status(404).json({ error: 'Content not found' });

        post.approved = true;
        post.rejected = false;
        post.modifiedAt = new Date().toISOString();
        db.posts.set(id, post);

        console.log(`✅ Contenido ${id} aprobado por admin`);

        res.json({
            success: true,
            message: 'Contenido aprobado correctamente',
            content: post
        });
    } catch (error) {
        console.error('Error approving content:', error);
        res.status(500).json({ error: 'Error al aprobar contenido' });
    }
});

/**
 * POST /api/admin/content/:id/reject
 * Rechazar contenido
 */
router.post('/content/:id/reject', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const db = require('../database/inMemoryDB');

        const post = db.posts.get(id);
        if (!post) return res.status(404).json({ error: 'Content not found' });

        post.approved = false;
        post.rejected = true;
        post.rejectionReason = reason;
        post.modifiedAt = new Date().toISOString();
        db.posts.set(id, post);

        console.log(`❌ Contenido ${id} rechazado por admin. Razón: ${reason}`);

        res.json({
            success: true,
            message: 'Contenido rechazado correctamente',
            content: post
        });
    } catch (error) {
        console.error('Error rejecting content:', error);
        res.status(500).json({ error: 'Error al rechazar contenido' });
    }
});

// ==================== SISTEMA DE REPORTES ====================

/**
 * GET /api/admin/reports
 * Obtener lista de reportes
 */
router.get('/reports', verifyAdminToken, async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const db = require('../database/inMemoryDB');

        // Mock data de reportes (puedes adaptarlo a tu modelo de datos)
        const mockReports = [
            {
                id: 1,
                type: 'spam',
                targetType: 'post',
                targetId: '123',
                reportedBy: 'user456',
                reason: 'Este post contiene spam',
                status: 'pending',
                createdAt: new Date().toISOString()
            }
        ];

        res.json({
            reports: mockReports,
            total: mockReports.length
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Error al obtener reportes' });
    }
});

/**
 * POST /api/admin/reports/:id/resolve
 * Resolver un reporte
 */
router.post('/reports/:id/resolve', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body;

        console.log(`✅ Reporte ${id} resuelto por admin. Acción: ${action}`);

        res.json({
            success: true,
            message: 'Reporte resuelto correctamente',
            reportId: id
        });
    } catch (error) {
        console.error('Error resolving report:', error);
        res.status(500).json({ error: 'Error al resolver reporte' });
    }
});

// ==================== LOGS DE ACTIVIDAD ====================

/**
 * GET /api/admin/activity-logs
 * Obtener logs de actividad de administradores
 */
router.get('/activity-logs', verifyAdminToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        // Mock data de logs (puedes adaptarlo a tu modelo de datos)
        const mockLogs = [
            {
                id: 1,
                admin: 'admin_user',
                action: 'Usuario activado',
                timestamp: new Date().toISOString()
            },
            {
                id: 2,
                admin: 'admin_user',
                action: 'Contenido aprobado',
                timestamp: new Date(Date.now() - 3600000).toISOString()
            }
        ];

        res.json({
            logs: mockLogs.slice(Number(offset), Number(offset) + Number(limit)),
            total: mockLogs.length
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ error: 'Error al obtener logs' });
    }
});

/**
 * POST /api/admin/activity-logs
 * Crear un nuevo log de actividad
 */
router.post('/activity-logs', verifyAdminToken, async (req, res) => {
    try {
        const { action, details } = req.body;

        const log = {
            id: Date.now(),
            admin: req.user?.username || 'system',
            action,
            details,
            timestamp: new Date().toISOString()
        };

        console.log('📝 Nuevo log de actividad:', log);

        res.json({
            success: true,
            log
        });
    } catch (error) {
        console.error('Error creating activity log:', error);
        res.status(500).json({ error: 'Error al crear log' });
    }
});

module.exports = router;
