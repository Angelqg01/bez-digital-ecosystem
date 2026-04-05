const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const { UserRole } = require('../models/mockModels');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const totpService = require('../services/totp.service');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'bezhas_super_secret_key';

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
    },
    HUMAN_RESOURCES: {
        name: 'HUMAN_RESOURCES',
        label: 'Recursos Humanos',
        permissions: ['admin.read', 'hr.users', 'hr.reports'],
        color: 'pink'
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

/**
 * Helper to get user by temp token without 2fa_verified claim
 */
const verifyTempToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.tempAdmin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

/**
 * @route   POST /api/admin/auth/oauth/google
 * @desc    Admin login with Google. Requires 2FA follow-up.
 */
router.post('/oauth/google', [
    body('idToken').isString().notEmpty()
], async (req, res) => {
    try {
        const { idToken } = req.body;
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        
        let payload;
        if (googleClientId && !googleClientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
            const { OAuth2Client } = require('google-auth-library');
            const client = new OAuth2Client(googleClientId);
            const ticket = await client.verifyIdToken({ idToken, audience: googleClientId });
            payload = ticket.getPayload();
        } else {
            console.warn('⚠️ Admin Google Auth: SIMULATION MODE');
            payload = {
                email: `admin_${Date.now()}@bezhas.com`,
                name: 'Simulated Admin',
                sub: `google_admin_${Date.now()}`
            };
        }

        const email = payload.email.toLowerCase();
        
        // Find existing user or create one (only if they are an admin by config)
        let user = await User.findOne({ email });
        
        // Check if user is actually an admin
        // Note: For a real platform, you might check if they are in an ALLOWED_ADMIN_EMAILS list,
        // but here we check if their existing user profile has an ADMIN role, OR we just let them log in 
        // to setup if we want to bootstrap. Let's assume user must already have admin roles in DB.
        
        if (!user) {
            // Check if it's the environment wallet... wait, we only have emails from Google.
            // So we must have seeded them. We'll create the user if it's a known admin domain or just let them be USER
            return res.status(403).json({ error: 'Usuario no encontrado o no tiene permisos de administrador.' });
        }

        const isAdmin = user.roles && (
            user.roles.includes('ADMIN') || 
            user.roles.includes('SUPER_ADMIN') || 
            user.roles.includes('DEVELOPER') ||
            user.roles.includes('HUMAN_RESOURCES')
        );

        if (!isAdmin) {
            return res.status(403).json({ error: 'Esta cuenta de Google no tiene privilegios de administrador.' });
        }

        // Generate temporary token for 2FA progression
        const tempToken = jwt.sign({ id: user._id, role: 'admin', isTemp: true }, JWT_SECRET, { expiresIn: '15m' });

        if (user.is2FAEnabled) {
            return res.json({
                message: '2FA Requerido',
                requires2FA: true,
                tempToken
            });
        } else {
            return res.json({
                message: 'Configuración 2FA Requerida',
                requiresSetup2FA: true,
                tempToken
            });
        }
    } catch (error) {
        console.error('Error in Admin Google Auth:', error);
        res.status(500).json({ error: 'Error en autenticación administrativa.' });
    }
});

/**
 * @route   POST /api/admin/auth/2fa/setup
 * @desc    Generate 2FA secret for admin
 */
router.post('/2fa/setup', verifyTempToken, async (req, res) => {
    try {
        const user = await User.findById(req.tempAdmin.id);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        if (user.is2FAEnabled) {
            return res.status(400).json({ error: '2FA ya está habilitado para este administrador.' });
        }

        const setupData = await totpService.generate2FASecret(user.email);
        
        // Save encrypted secret
        user.twoFactorSecret = totpService.encryptSecret(setupData.secret);
        await user.save();

        res.json({
            qrCodeUrl: setupData.qrCodeUrl,
            backupCodes: setupData.backupCodes
        });
    } catch (error) {
        console.error('Error setting up admin 2FA:', error);
        res.status(500).json({ error: 'Error configurando 2FA' });
    }
});

/**
 * @route   POST /api/admin/auth/2fa/verify
 * @desc    Verify 2FA token to finalize login or setup
 */
router.post('/2fa/verify', [
    body('code').isString().notEmpty()
], verifyTempToken, async (req, res) => {
    try {
        const { code, backupCodes } = req.body; // Backup codes provided if it's the setup step
        const user = await User.findById(req.tempAdmin.id).select('+twoFactorSecret +backupCodes');
        
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!user.twoFactorSecret) return res.status(400).json({ error: '2FA setup was not initiated' });

        const secret = totpService.decryptSecret(user.twoFactorSecret);
        
        // For login via backup code
        if (code.length === 8 && user.is2FAEnabled) {
            const backupResult = totpService.verifyBackupCode(code, user.backupCodes);
            if (!backupResult.valid) return res.status(401).json({ error: 'Código de respaldo inválido' });
            
            user.backupCodes = backupResult.remainingCodes;
            await user.save();
        } else {
            // Normal TOTP verification
            const isValid = totpService.verify2FAToken(code, secret);
            if (!isValid) return res.status(401).json({ error: 'Código 2FA inválido' });
        }

        // If it was setup, activate 2FA
        if (!user.is2FAEnabled) {
            user.is2FAEnabled = true;
            if (backupCodes) user.backupCodes = backupCodes;
            await user.save();
        }

        // Issue final Admin JWT with twoFactorVerified: true
        const finalToken = jwt.sign({ 
            id: user._id, 
            role: 'admin', 
            twoFactorVerified: true 
        }, JWT_SECRET, { expiresIn: '12h' });

        res.json({
            message: 'Autenticación exitosa',
            token: finalToken,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                roles: user.roles
            }
        });
    } catch (error) {
        console.error('Error verifying admin 2FA:', error);
        res.status(500).json({ error: 'Error verificando 2FA' });
    }
});

module.exports = router;
