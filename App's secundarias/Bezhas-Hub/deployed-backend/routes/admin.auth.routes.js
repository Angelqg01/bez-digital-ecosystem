const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const { UserRole } = require('../models/mockModels');

// Load Super Admin Wallets from environment
const SUPER_ADMIN_WALLETS = (process.env.SUPER_ADMIN_WALLETS || '')
    .split(',')
    .map(addr => addr.trim().toLowerCase())
    .filter(Boolean);

// Load Admin Wallets from environment
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map(addr => addr.trim().toLowerCase())
    .filter(Boolean);

// Load Treasury Wallet from environment
const TREASURY_WALLET = (process.env.TREASURY_WALLET || '').trim().toLowerCase();

// Load Community Wallet from environment
const COMMUNITY_WALLET = (process.env.COMMUNITY_WALLET || '').trim().toLowerCase();

/**
 * Admin Role Definitions with specific permissions
 */
const ADMIN_ROLES = {
    SUPER_ADMIN: {
        name: 'SUPER_ADMIN',
        label: 'Super Administrador',
        permissions: ['*'], // All permissions
        color: 'gold'
    },
    ADMIN: {
        name: 'ADMIN',
        label: 'Administrador',
        permissions: ['admin.read', 'admin.write', 'admin.users', 'admin.system', 'admin.config'],
        color: 'blue'
    },
    DEVELOPER: {
        name: 'DEVELOPER',
        label: 'Desarrollador',
        permissions: ['admin.read', 'developer.tools', 'developer.debug', 'developer.api', 'developer.logs'],
        color: 'purple'
    },
    TREASURY: {
        name: 'TREASURY',
        label: 'Tesorería',
        permissions: ['admin.read', 'treasury.read', 'treasury.write', 'treasury.transfers', 'dao.treasury'],
        color: 'green'
    },
    DAO: {
        name: 'DAO',
        label: 'DAO Manager',
        permissions: ['admin.read', 'dao.proposals', 'dao.voting', 'dao.governance', 'dao.treasury'],
        color: 'cyan'
    },
    COMMUNITY: {
        name: 'COMMUNITY',
        label: 'Comunidad/Recompensas',
        permissions: ['admin.read', 'community.rewards', 'community.staking', 'community.events'],
        color: 'orange'
    }
};

/**
 * Get role for a wallet address
 */
function getWalletRole(walletAddress) {
    const normalized = walletAddress.toLowerCase();

    // Check Super Admin first
    if (SUPER_ADMIN_WALLETS.includes(normalized)) {
        return ADMIN_ROLES.SUPER_ADMIN;
    }

    // Check Treasury wallet
    if (TREASURY_WALLET && normalized === TREASURY_WALLET) {
        return ADMIN_ROLES.TREASURY;
    }

    // Check Community wallet
    if (COMMUNITY_WALLET && normalized === COMMUNITY_WALLET) {
        return ADMIN_ROLES.COMMUNITY;
    }

    // Check Admin wallets
    if (ADMIN_WALLETS.includes(normalized)) {
        return ADMIN_ROLES.ADMIN;
    }

    return null;
}

/**
 * Verify admin permissions
 * GET /api/admin/verify-permissions
 */
router.get('/verify-permissions', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];

        if (!walletAddress) {
            return res.status(401).json({
                authorized: false,
                message: 'Wallet address required'
            });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Check wallet-based roles first (env-configured wallets)
        const walletRole = getWalletRole(normalizedAddress);
        if (walletRole) {
            return res.json({
                authorized: true,
                role: walletRole.name,
                roleLabel: walletRole.label,
                permissions: walletRole.permissions,
                roleColor: walletRole.color
            });
        }

        // Check in database for user-based roles
        const user = await User.findOne({
            walletAddress: normalizedAddress
        });

        if (!user) {
            return res.status(403).json({
                authorized: false,
                message: 'User not found'
            });
        }

        // Check if user has Admin or Developer role
        const allowedRoles = [UserRole.ADMIN, UserRole.DEVELOPER];
        if (allowedRoles.includes(user.role)) {
            const roleConfig = user.role === UserRole.ADMIN
                ? ADMIN_ROLES.ADMIN
                : ADMIN_ROLES.DEVELOPER;

            return res.json({
                authorized: true,
                role: roleConfig.name,
                roleLabel: roleConfig.label,
                permissions: roleConfig.permissions,
                roleColor: roleConfig.color
            });
        }

        // Not authorized
        return res.status(403).json({
            authorized: false,
            message: `Insufficient permissions. Current role: ${user.role}`,
            requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'TREASURY', 'DAO', 'COMMUNITY']
        });

    } catch (error) {
        console.error('Error verifying admin permissions:', error);
        res.status(500).json({
            authorized: false,
            message: 'Internal server error'
        });
    }
});

/**
 * Check if user is Super Admin
 * GET /api/admin/check-super-admin
 */
router.get('/check-super-admin', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];

        if (!walletAddress) {
            return res.json({ isSuperAdmin: false });
        }

        const normalizedAddress = walletAddress.toLowerCase();
        const isSuperAdmin = SUPER_ADMIN_WALLETS.includes(normalizedAddress);

        res.json({ isSuperAdmin });

    } catch (error) {
        console.error('Error checking super admin:', error);
        res.json({ isSuperAdmin: false });
    }
});

/**
 * Get current user's admin info
 * GET /api/admin/me
 */
router.get('/me', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];

        if (!walletAddress) {
            return res.status(401).json({
                error: 'Unauthorized'
            });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Check wallet-based roles first (env-configured wallets)
        const walletRole = getWalletRole(normalizedAddress);
        if (walletRole) {
            return res.json({
                walletAddress: normalizedAddress,
                role: walletRole.name,
                roleLabel: walletRole.label,
                isSuperAdmin: walletRole.name === 'SUPER_ADMIN',
                permissions: walletRole.permissions,
                roleColor: walletRole.color
            });
        }

        // Check in database
        const user = await User.findOne({
            walletAddress: normalizedAddress
        });

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const allowedRoles = [UserRole.ADMIN, UserRole.DEVELOPER];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        const roleConfig = user.role === UserRole.ADMIN
            ? ADMIN_ROLES.ADMIN
            : ADMIN_ROLES.DEVELOPER;

        res.json({
            walletAddress: normalizedAddress,
            role: roleConfig.name,
            roleLabel: roleConfig.label,
            isSuperAdmin: false,
            username: user.username,
            email: user.email,
            permissions: roleConfig.permissions,
            roleColor: roleConfig.color
        });

    } catch (error) {
        console.error('Error getting admin info:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

/**
 * Get all admin roles configuration
 * GET /api/admin/roles
 */
router.get('/roles', async (req, res) => {
    try {
        res.json({
            success: true,
            roles: ADMIN_ROLES,
            configuredWallets: {
                superAdminCount: SUPER_ADMIN_WALLETS.length,
                adminCount: ADMIN_WALLETS.length,
                hasTreasury: !!TREASURY_WALLET,
                hasCommunity: !!COMMUNITY_WALLET
            }
        });
    } catch (error) {
        console.error('Error getting roles:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
