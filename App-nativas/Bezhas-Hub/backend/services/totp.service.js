/**
 * TOTP (Time-based One-Time Password) Service
 * 
 * Provides 2FA functionality using TOTP algorithm (RFC 6238)
 * Compatible with Google Authenticator, Authy, and similar apps
 * 
 * IMPORTANT: This feature requires HTTPS in production.
 * Set ENABLE_2FA=true in .env to activate.
 */

// Use preset-default for CommonJS compatibility
const { authenticator } = require('@otplib/preset-default');
const qrcode = require('qrcode');
const crypto = require('crypto');

// Configuration
const APP_NAME = process.env.APP_NAME || 'Bezhas Network';
const TOTP_WINDOW = 1; // Allow 1 step before/after for clock drift

// Configure authenticator options
authenticator.options = {
    window: TOTP_WINDOW,
    step: 30, // 30-second intervals
};

/**
 * Generate a new TOTP secret for a user
 * @param {string} userEmail - User's email for QR code label
 * @returns {Promise<{secret: string, qrCodeUrl: string, backupCodes: string[]}>}
 */
const generate2FASecret = async (userEmail) => {
    try {
        // Generate a cryptographically secure secret
        const secret = authenticator.generateSecret();

        // Create the otpauth URI for QR code
        const otpauthUrl = authenticator.keyuri(userEmail, APP_NAME, secret);

        // Generate QR code as data URL
        const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

        // Generate backup codes (one-time use codes for recovery)
        const backupCodes = generateBackupCodes();

        console.log(`🔐 TOTP secret generated for: ${userEmail}`);

        return {
            secret,
            qrCodeUrl,
            otpauthUrl,
            backupCodes,
        };
    } catch (error) {
        console.error('Error generating TOTP secret:', error);
        throw new Error('Failed to generate 2FA secret');
    }
};

/**
 * Verify a TOTP token
 * @param {string} token - 6-digit token from authenticator app
 * @param {string} secret - User's TOTP secret
 * @returns {boolean} - True if token is valid
 */
const verify2FAToken = (token, secret) => {
    try {
        if (!token || !secret) {
            return false;
        }

        // Normalize token (remove spaces, ensure 6 digits)
        const normalizedToken = token.replace(/\s/g, '');

        if (!/^\d{6}$/.test(normalizedToken)) {
            return false;
        }

        return authenticator.check(normalizedToken, secret);
    } catch (error) {
        console.error('Error verifying TOTP token:', error);
        return false;
    }
};

/**
 * Generate backup codes for account recovery
 * @param {number} count - Number of backup codes to generate
 * @returns {string[]} - Array of backup codes
 */
const generateBackupCodes = (count = 10) => {
    const codes = [];
    for (let i = 0; i < count; i++) {
        // Generate 8-character alphanumeric codes
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
    }
    return codes;
};

/**
 * Verify a backup code and mark it as used
 * @param {string} inputCode - Code provided by user
 * @param {string[]} storedCodes - Array of valid backup codes
 * @returns {{valid: boolean, remainingCodes: string[]}}
 */
const verifyBackupCode = (inputCode, storedCodes) => {
    const normalizedInput = inputCode.replace(/\s/g, '').toUpperCase();
    const codeIndex = storedCodes.findIndex(code => code === normalizedInput);

    if (codeIndex === -1) {
        return { valid: false, remainingCodes: storedCodes };
    }

    // Remove the used code
    const remainingCodes = storedCodes.filter((_, index) => index !== codeIndex);

    return { valid: true, remainingCodes };
};

/**
 * Check if 2FA is enabled globally
 * @returns {boolean}
 */
const is2FAEnabled = () => {
    return process.env.ENABLE_2FA === 'true';
};

/**
 * Encrypt a TOTP secret for secure storage
 * @param {string} secret - Plain TOTP secret
 * @returns {string} - Encrypted secret
 */
const encryptSecret = (secret) => {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt a stored TOTP secret
 * @param {string} encryptedSecret - Encrypted secret string
 * @returns {string} - Plain TOTP secret
 */
const decryptSecret = (encryptedSecret) => {
    try {
        const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');

        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-key', 'salt', 32);
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Error decrypting TOTP secret:', error);
        throw new Error('Failed to decrypt 2FA secret');
    }
};

module.exports = {
    generate2FASecret,
    verify2FAToken,
    generateBackupCodes,
    verifyBackupCode,
    is2FAEnabled,
    encryptSecret,
    decryptSecret,
};
