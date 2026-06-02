/**
 * Two-Factor Authentication (2FA) Routes
 * 
 * Provides endpoints for:
 * - TOTP (Google Authenticator, Authy, etc.)
 * - WebAuthn / Passkeys (biometric, hardware keys)
 * 
 * IMPORTANT: These features require HTTPS in production.
 * Set ENABLE_2FA=true and ENABLE_WEBAUTHN=true in .env to activate.
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/user.model');

// Import 2FA services
const totpService = require('../services/totp.service');
const webauthnService = require('../services/webauthn.service');

// Auth middleware (reuse from existing)
const authenticateToken = require('../middleware/auth.middleware').authenticateToken ||
    ((req, res, next) => {
        // Fallback simple auth check
        if (!req.user && !req.headers.authorization) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        next();
    });

// ============================================
// Status & Configuration
// ============================================

/**
 * @route   GET /api/2fa/status
 * @desc    Get 2FA status for current user
 * @access  Private
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const twoFactorAuth = user.twoFactorAuth || {};

        res.json({
            success: true,
            enabled: !!(twoFactorAuth.totp?.enabled || twoFactorAuth.webauthn?.enabled),
            methods: {
                totp: {
                    enabled: twoFactorAuth.totp?.enabled || false,
                    enabledAt: twoFactorAuth.totp?.enabledAt || null,
                    backupCodesRemaining: twoFactorAuth.totp?.backupCodes?.length || 0,
                },
                webauthn: {
                    enabled: twoFactorAuth.webauthn?.enabled || false,
                    enabledAt: twoFactorAuth.webauthn?.enabledAt || null,
                    credentialsCount: twoFactorAuth.webauthn?.credentials?.length || 0,
                    credentials: (twoFactorAuth.webauthn?.credentials || []).map(c => ({
                        id: c.credentialID,
                        deviceName: c.deviceName,
                        createdAt: c.createdAt,
                        lastUsedAt: c.lastUsedAt,
                    })),
                },
            },
            preferredMethod: twoFactorAuth.preferredMethod || null,
            globalSettings: {
                totpEnabled: totpService.is2FAEnabled(),
                webauthnEnabled: webauthnService.isWebAuthnEnabled(),
                webauthnOrigin: webauthnService.getWebAuthnOrigin(),
            },
        });
    } catch (error) {
        console.error('Error getting 2FA status:', error);
        res.status(500).json({ error: 'Failed to get 2FA status' });
    }
});

/**
 * @route   GET /api/2fa/config
 * @desc    Get 2FA configuration (public - for UI)
 * @access  Public
 */
router.get('/config', (req, res) => {
    const webauthnValidation = webauthnService.validateConfiguration();

    res.json({
        success: true,
        config: {
            totp: {
                enabled: totpService.is2FAEnabled(),
                available: true, // TOTP is always available when enabled
            },
            webauthn: {
                enabled: webauthnService.isWebAuthnEnabled(),
                available: webauthnValidation.valid,
                errors: webauthnValidation.errors,
                rpName: webauthnValidation.config?.rpName,
                rpID: webauthnValidation.config?.rpID,
            },
        },
    });
});

// ============================================
// TOTP Routes
// ============================================

/**
 * @route   POST /api/2fa/totp/setup
 * @desc    Start TOTP setup - generates secret and QR code
 * @access  Private
 */
router.post('/totp/setup', authenticateToken, async (req, res) => {
    try {
        if (!totpService.is2FAEnabled()) {
            return res.status(503).json({
                error: '2FA is not enabled on this server',
                hint: 'Set ENABLE_2FA=true in environment variables'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if TOTP is already enabled
        if (user.twoFactorAuth?.totp?.enabled) {
            return res.status(400).json({
                error: 'TOTP is already enabled',
                hint: 'Disable it first before setting up again'
            });
        }

        // Generate new TOTP secret
        const email = user.email || user.walletAddress || `user-${user._id}`;
        const { secret, qrCodeUrl, backupCodes } = await totpService.generate2FASecret(email);

        // Store encrypted secret temporarily (not enabled yet)
        const encryptedSecret = totpService.encryptSecret(secret);

        // Update user with pending setup
        user.twoFactorAuth = user.twoFactorAuth || {};
        user.twoFactorAuth.totp = {
            enabled: false,
            secret: encryptedSecret,
            backupCodes: backupCodes,
            pendingSetup: true,
        };
        await user.save();

        res.json({
            success: true,
            message: 'TOTP setup initiated. Scan the QR code and verify with a token.',
            qrCodeUrl,
            backupCodes,
            instructions: [
                '1. Open your authenticator app (Google Authenticator, Authy, etc.)',
                '2. Scan the QR code or enter the secret manually',
                '3. Enter the 6-digit code shown in the app to verify',
                '4. Save the backup codes in a secure location',
            ],
        });
    } catch (error) {
        console.error('Error setting up TOTP:', error);
        res.status(500).json({ error: 'Failed to setup TOTP' });
    }
});

/**
 * @route   POST /api/2fa/totp/verify-setup
 * @desc    Complete TOTP setup by verifying a token
 * @access  Private
 */
router.post('/totp/verify-setup', [
    authenticateToken,
    body('token').isString().isLength({ min: 6, max: 6 }).withMessage('Token must be 6 digits'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.twoFactorAuth?.totp?.pendingSetup) {
            return res.status(400).json({ error: 'No pending TOTP setup. Call /totp/setup first.' });
        }

        // Decrypt and verify
        const secret = totpService.decryptSecret(user.twoFactorAuth.totp.secret);
        const isValid = totpService.verify2FAToken(token, secret);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid token. Please try again.' });
        }

        // Enable TOTP
        user.twoFactorAuth.totp.enabled = true;
        user.twoFactorAuth.totp.enabledAt = new Date().toISOString();
        delete user.twoFactorAuth.totp.pendingSetup;

        // Set as preferred method if none set
        if (!user.twoFactorAuth.preferredMethod) {
            user.twoFactorAuth.preferredMethod = 'totp';
        }

        await user.save();

        res.json({
            success: true,
            message: 'TOTP has been successfully enabled!',
            backupCodesRemaining: user.twoFactorAuth.totp.backupCodes.length,
        });
    } catch (error) {
        console.error('Error verifying TOTP setup:', error);
        res.status(500).json({ error: 'Failed to verify TOTP setup' });
    }
});

/**
 * @route   POST /api/2fa/totp/verify
 * @desc    Verify a TOTP token (for login or sensitive actions)
 * @access  Private
 */
router.post('/totp/verify', [
    authenticateToken,
    body('token').isString().isLength({ min: 6, max: 8 }).withMessage('Invalid token format'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.twoFactorAuth?.totp?.enabled) {
            return res.status(400).json({ error: 'TOTP is not enabled for this account' });
        }

        // Try TOTP token first
        const secret = totpService.decryptSecret(user.twoFactorAuth.totp.secret);
        let isValid = totpService.verify2FAToken(token, secret);

        // If not valid, try backup codes
        if (!isValid && token.length === 8) {
            const result = totpService.verifyBackupCode(token, user.twoFactorAuth.totp.backupCodes);
            if (result.valid) {
                isValid = true;
                user.twoFactorAuth.totp.backupCodes = result.remainingCodes;
                await user.save();
            }
        }

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Update last verified
        user.twoFactorAuth.lastVerifiedAt = new Date().toISOString();
        await user.save();

        res.json({
            success: true,
            message: '2FA verification successful',
            verified: true,
        });
    } catch (error) {
        console.error('Error verifying TOTP:', error);
        res.status(500).json({ error: 'Failed to verify token' });
    }
});

/**
 * @route   POST /api/2fa/totp/disable
 * @desc    Disable TOTP 2FA
 * @access  Private
 */
router.post('/totp/disable', [
    authenticateToken,
    body('token').isString().isLength({ min: 6, max: 6 }).withMessage('Token must be 6 digits'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.twoFactorAuth?.totp?.enabled) {
            return res.status(400).json({ error: 'TOTP is not enabled' });
        }

        // Verify token before disabling
        const secret = totpService.decryptSecret(user.twoFactorAuth.totp.secret);
        const isValid = totpService.verify2FAToken(token, secret);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid token. Cannot disable 2FA.' });
        }

        // Disable TOTP
        user.twoFactorAuth.totp = {
            enabled: false,
            secret: null,
            backupCodes: [],
            enabledAt: null,
        };

        // Update preferred method
        if (user.twoFactorAuth.preferredMethod === 'totp') {
            user.twoFactorAuth.preferredMethod = user.twoFactorAuth.webauthn?.enabled ? 'webauthn' : null;
        }

        await user.save();

        res.json({
            success: true,
            message: 'TOTP has been disabled',
        });
    } catch (error) {
        console.error('Error disabling TOTP:', error);
        res.status(500).json({ error: 'Failed to disable TOTP' });
    }
});

/**
 * @route   POST /api/2fa/totp/regenerate-backup-codes
 * @desc    Generate new backup codes (invalidates old ones)
 * @access  Private
 */
router.post('/totp/regenerate-backup-codes', [
    authenticateToken,
    body('token').isString().isLength({ min: 6, max: 6 }).withMessage('Token must be 6 digits'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token } = req.body;
        const user = await User.findById(req.user.id);

        if (!user?.twoFactorAuth?.totp?.enabled) {
            return res.status(400).json({ error: 'TOTP is not enabled' });
        }

        // Verify current token
        const secret = totpService.decryptSecret(user.twoFactorAuth.totp.secret);
        if (!totpService.verify2FAToken(token, secret)) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Generate new backup codes
        const newBackupCodes = totpService.generateBackupCodes();
        user.twoFactorAuth.totp.backupCodes = newBackupCodes;
        await user.save();

        res.json({
            success: true,
            message: 'New backup codes generated. Old codes are now invalid.',
            backupCodes: newBackupCodes,
        });
    } catch (error) {
        console.error('Error regenerating backup codes:', error);
        res.status(500).json({ error: 'Failed to regenerate backup codes' });
    }
});

// ============================================
// WebAuthn / Passkeys Routes
// ============================================

/**
 * @route   POST /api/2fa/webauthn/register/options
 * @desc    Get registration options for a new passkey
 * @access  Private
 */
router.post('/webauthn/register/options', authenticateToken, async (req, res) => {
    try {
        if (!webauthnService.isWebAuthnEnabled()) {
            return res.status(503).json({
                error: 'WebAuthn is not enabled on this server',
                hint: 'Set ENABLE_WEBAUTHN=true in environment variables'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const existingCredentials = user.twoFactorAuth?.webauthn?.credentials || [];
        const options = await webauthnService.getRegistrationOptions(user, existingCredentials);

        res.json({
            success: true,
            options,
        });
    } catch (error) {
        console.error('Error getting WebAuthn registration options:', error);
        res.status(500).json({ error: 'Failed to get registration options' });
    }
});

/**
 * @route   POST /api/2fa/webauthn/register/verify
 * @desc    Verify and store a new passkey
 * @access  Private
 */
router.post('/webauthn/register/verify', [
    authenticateToken,
    body('response').isObject().withMessage('Response object is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { response, deviceName } = req.body;
        response.deviceName = deviceName || 'My Passkey';

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify the registration
        const credential = await webauthnService.verifyRegistration(req.user.id, response);

        // Store the credential
        user.twoFactorAuth = user.twoFactorAuth || {};
        user.twoFactorAuth.webauthn = user.twoFactorAuth.webauthn || { credentials: [] };
        user.twoFactorAuth.webauthn.credentials.push(credential);
        user.twoFactorAuth.webauthn.enabled = true;
        user.twoFactorAuth.webauthn.enabledAt = user.twoFactorAuth.webauthn.enabledAt || new Date().toISOString();

        // Set as preferred method if none set
        if (!user.twoFactorAuth.preferredMethod) {
            user.twoFactorAuth.preferredMethod = 'webauthn';
        }

        await user.save();

        res.json({
            success: true,
            message: 'Passkey registered successfully!',
            credential: {
                id: credential.credentialID,
                deviceName: credential.deviceName,
                createdAt: credential.createdAt,
            },
        });
    } catch (error) {
        console.error('Error verifying WebAuthn registration:', error);
        res.status(500).json({ error: error.message || 'Failed to register passkey' });
    }
});

/**
 * @route   POST /api/2fa/webauthn/authenticate/options
 * @desc    Get authentication options for passkey login
 * @access  Private (or with partial token)
 */
router.post('/webauthn/authenticate/options', async (req, res) => {
    try {
        if (!webauthnService.isWebAuthnEnabled()) {
            return res.status(503).json({ error: 'WebAuthn is not enabled' });
        }

        const { userId, walletAddress } = req.body;
        let credentials = [];
        let user = null;

        // Find user by ID or wallet address
        if (userId) {
            user = await User.findById(userId);
        } else if (walletAddress) {
            user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
        }

        if (user?.twoFactorAuth?.webauthn?.credentials) {
            credentials = user.twoFactorAuth.webauthn.credentials;
        }

        const { options, challengeKey } = await webauthnService.getAuthenticationOptions(
            user?._id?.toString(),
            credentials
        );

        res.json({
            success: true,
            options,
            challengeKey,
        });
    } catch (error) {
        console.error('Error getting WebAuthn authentication options:', error);
        res.status(500).json({ error: 'Failed to get authentication options' });
    }
});

/**
 * @route   POST /api/2fa/webauthn/authenticate/verify
 * @desc    Verify passkey authentication
 * @access  Private
 */
router.post('/webauthn/authenticate/verify', [
    body('response').isObject().withMessage('Response object is required'),
    body('challengeKey').isString().withMessage('Challenge key is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { response, challengeKey, userId, walletAddress } = req.body;

        // Find user
        let user;
        if (userId) {
            user = await User.findById(userId);
        } else if (walletAddress) {
            user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find the matching credential
        const credentialID = response.id;
        const credential = user.twoFactorAuth?.webauthn?.credentials?.find(
            c => c.credentialID === credentialID
        );

        if (!credential) {
            return res.status(400).json({ error: 'Credential not found' });
        }

        // Verify authentication
        const { verified, newCounter } = await webauthnService.verifyAuthentication(
            challengeKey,
            response,
            credential
        );

        if (!verified) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        // Update counter and last used
        credential.counter = newCounter;
        credential.lastUsedAt = new Date().toISOString();
        user.twoFactorAuth.lastVerifiedAt = new Date().toISOString();
        await user.save();

        res.json({
            success: true,
            message: 'Passkey authentication successful',
            verified: true,
            userId: user._id,
        });
    } catch (error) {
        console.error('Error verifying WebAuthn authentication:', error);
        res.status(500).json({ error: error.message || 'Failed to verify authentication' });
    }
});

/**
 * @route   DELETE /api/2fa/webauthn/credential/:credentialId
 * @desc    Remove a passkey
 * @access  Private
 */
router.delete('/webauthn/credential/:credentialId', authenticateToken, async (req, res) => {
    try {
        const { credentialId } = req.params;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.twoFactorAuth?.webauthn?.credentials) {
            return res.status(400).json({ error: 'No passkeys registered' });
        }

        const initialLength = user.twoFactorAuth.webauthn.credentials.length;
        user.twoFactorAuth.webauthn.credentials = user.twoFactorAuth.webauthn.credentials.filter(
            c => c.credentialID !== credentialId
        );

        if (user.twoFactorAuth.webauthn.credentials.length === initialLength) {
            return res.status(404).json({ error: 'Passkey not found' });
        }

        // Disable WebAuthn if no credentials left
        if (user.twoFactorAuth.webauthn.credentials.length === 0) {
            user.twoFactorAuth.webauthn.enabled = false;
            if (user.twoFactorAuth.preferredMethod === 'webauthn') {
                user.twoFactorAuth.preferredMethod = user.twoFactorAuth.totp?.enabled ? 'totp' : null;
            }
        }

        await user.save();

        res.json({
            success: true,
            message: 'Passkey removed successfully',
            remainingCredentials: user.twoFactorAuth.webauthn.credentials.length,
        });
    } catch (error) {
        console.error('Error removing passkey:', error);
        res.status(500).json({ error: 'Failed to remove passkey' });
    }
});

/**
 * @route   PUT /api/2fa/webauthn/credential/:credentialId
 * @desc    Update passkey name
 * @access  Private
 */
router.put('/webauthn/credential/:credentialId', [
    authenticateToken,
    body('deviceName').isString().isLength({ min: 1, max: 50 }).withMessage('Device name is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { credentialId } = req.params;
        const { deviceName } = req.body;
        const user = await User.findById(req.user.id);

        if (!user?.twoFactorAuth?.webauthn?.credentials) {
            return res.status(400).json({ error: 'No passkeys registered' });
        }

        const credential = user.twoFactorAuth.webauthn.credentials.find(
            c => c.credentialID === credentialId
        );

        if (!credential) {
            return res.status(404).json({ error: 'Passkey not found' });
        }

        credential.deviceName = deviceName;
        await user.save();

        res.json({
            success: true,
            message: 'Passkey updated successfully',
            credential: {
                id: credential.credentialID,
                deviceName: credential.deviceName,
            },
        });
    } catch (error) {
        console.error('Error updating passkey:', error);
        res.status(500).json({ error: 'Failed to update passkey' });
    }
});

// ============================================
// General 2FA Settings
// ============================================

/**
 * @route   PUT /api/2fa/preferred-method
 * @desc    Set preferred 2FA method
 * @access  Private
 */
router.put('/preferred-method', [
    authenticateToken,
    body('method').isIn(['totp', 'webauthn', null]).withMessage('Invalid method'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { method } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate method is enabled
        if (method === 'totp' && !user.twoFactorAuth?.totp?.enabled) {
            return res.status(400).json({ error: 'TOTP is not enabled' });
        }
        if (method === 'webauthn' && !user.twoFactorAuth?.webauthn?.enabled) {
            return res.status(400).json({ error: 'WebAuthn is not enabled' });
        }

        user.twoFactorAuth = user.twoFactorAuth || {};
        user.twoFactorAuth.preferredMethod = method;
        await user.save();

        res.json({
            success: true,
            message: `Preferred 2FA method set to ${method || 'none'}`,
            preferredMethod: method,
        });
    } catch (error) {
        console.error('Error setting preferred method:', error);
        res.status(500).json({ error: 'Failed to set preferred method' });
    }
});

module.exports = router;
