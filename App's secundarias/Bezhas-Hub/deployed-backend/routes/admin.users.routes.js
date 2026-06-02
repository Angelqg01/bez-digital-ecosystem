const express = require('express');
const router = express.Router();
const { User, UserRole, SubscriptionTier } = require('../models/mockModels');
const { requireAuth, requireAdmin, isSuperAdmin } = require('../middleware/auth.middleware');
const { adminUserUpdateSchema, userFilterSchema } = require('../lib/validations/user.validation');

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filters
 * @access  Admin only
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { role, subscription, isVerified, isBanned, search } = req.query;

        // Validate filters
        const filterValidation = userFilterSchema.safeParse({
            role,
            subscription,
            isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
            isBanned: isBanned === 'true' ? true : isBanned === 'false' ? false : undefined,
            search
        });

        if (!filterValidation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid filter parameters',
                details: filterValidation.error.errors
            });
        }

        // Get all users
        let users = await User.find({});

        // Apply filters
        if (role) {
            users = users.filter(u => u.role === role);
        }
        if (subscription) {
            users = users.filter(u => u.subscription === subscription);
        }
        if (isVerified !== undefined) {
            const verified = isVerified === 'true';
            users = users.filter(u => u.isVerified === verified);
        }
        if (isBanned !== undefined) {
            const banned = isBanned === 'true';
            users = users.filter(u => u.isBanned === banned);
        }
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(u =>
                (u.username && u.username.toLowerCase().includes(searchLower)) ||
                (u.email && u.email.toLowerCase().includes(searchLower)) ||
                (u.walletAddress && u.walletAddress.toLowerCase().includes(searchLower)) ||
                (u.firstName && u.firstName.toLowerCase().includes(searchLower)) ||
                (u.lastName && u.lastName.toLowerCase().includes(searchLower))
            );
        }

        // Remove sensitive data
        const sanitizedUsers = users.map(user => ({
            _id: user._id,
            walletAddress: user.walletAddress,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role,
            subscription: user.subscription,
            isVerified: user.isVerified,
            isBanned: user.isBanned,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }));

        res.json({
            success: true,
            users: sanitizedUsers,
            total: sanitizedUsers.length
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching users',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get single user details
 * @access  Admin only
 */
router.get('/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Remove sensitive data but include more details for admin
        const sanitizedUser = {
            _id: user._id,
            walletAddress: user.walletAddress,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            bio: user.bio,
            email: user.email,
            avatarUrl: user.avatarUrl,
            coverUrl: user.coverUrl,
            interests: user.interests,
            role: user.role,
            subscription: user.subscription,
            isVerified: user.isVerified,
            isBanned: user.isBanned,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        res.json({
            success: true,
            user: sanitizedUser
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching user',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/admin/users/:userId
 * @desc    Update user role, subscription, or status
 * @access  Admin only
 */
router.put('/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        // Validate input
        const validation = adminUserUpdateSchema.safeParse({ userId, ...updates });

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid update data',
                details: validation.error.errors
            });
        }

        // Find user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // 🔒 PROTECTION: Prevent modifying Super Admin accounts
        if (isSuperAdmin(user.walletAddress)) {
            return res.status(403).json({
                success: false,
                error: 'Cannot modify Super Admin accounts. This wallet is protected by the platform owner.'
            });
        }

        // Prevent demoting yourself as admin
        if (req.user._id.toString() === userId && updates.role && updates.role !== UserRole.ADMIN) {
            return res.status(400).json({
                success: false,
                error: 'Cannot demote yourself from admin role'
            });
        }

        // Apply updates
        const allowedUpdates = ['role', 'subscription', 'isVerified', 'isBanned'];
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                user[field] = updates[field];
            }
        });

        user.updatedAt = new Date().toISOString();
        await user.save();

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                _id: user._id,
                walletAddress: user.walletAddress,
                username: user.username,
                role: user.role,
                subscription: user.subscription,
                isVerified: user.isVerified,
                isBanned: user.isBanned
            }
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating user',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/admin/users/:userId/ban
 * @desc    Ban/unban user
 * @access  Admin only
 */
router.post('/:userId/ban', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { ban = true } = req.body; // Default to ban

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // 🔒 PROTECTION: Prevent banning Super Admins
        if (isSuperAdmin(user.walletAddress)) {
            return res.status(403).json({
                success: false,
                error: 'Cannot ban Super Admin accounts'
            });
        }

        // Prevent banning yourself
        if (req.user._id.toString() === userId) {
            return res.status(400).json({
                success: false,
                error: 'Cannot ban yourself'
            });
        }

        user.isBanned = ban;
        user.updatedAt = new Date().toISOString();
        await user.save();

        res.json({
            success: true,
            message: ban ? 'User banned successfully' : 'User unbanned successfully',
            user: {
                _id: user._id,
                walletAddress: user.walletAddress,
                username: user.username,
                isBanned: user.isBanned
            }
        });
    } catch (error) {
        console.error('Error banning/unbanning user:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating ban status',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/admin/users/:userId/verify
 * @desc    Verify/unverify user
 * @access  Admin only
 */
router.post('/:userId/verify', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { verify = true } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        user.isVerified = verify;
        user.updatedAt = new Date().toISOString();
        await user.save();

        res.json({
            success: true,
            message: verify ? 'User verified successfully' : 'User unverified',
            user: {
                _id: user._id,
                walletAddress: user.walletAddress,
                username: user.username,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('Error verifying user:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating verification status',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/admin/users/stats/overview
 * @desc    Get user statistics overview
 * @access  Admin only
 */
router.get('/stats/overview', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await User.find({});

        const stats = {
            total: users.length,
            byRole: {},
            bySubscription: {},
            verified: users.filter(u => u.isVerified).length,
            banned: users.filter(u => u.isBanned).length,
            active: users.filter(u => !u.isBanned).length
        };

        // Count by role
        Object.values(UserRole).forEach(role => {
            stats.byRole[role] = users.filter(u => u.role === role).length;
        });

        // Count by subscription
        Object.values(SubscriptionTier).forEach(tier => {
            stats.bySubscription[tier] = users.filter(u => u.subscription === tier).length;
        });

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching statistics',
            message: error.message
        });
    }
});

module.exports = router;
