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

/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  CIFRADO DEL SECRETO TOTP (v2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * v1 derivaba la clave con scrypt(JWT_SECRET || 'default-key', 'salt'). Quien
 * tuviera el secreto de los JWT —o, sin él, cualquiera: el literal está en el
 * repositorio— descifraba el segundo factor de todos los usuarios, y el segundo
 * factor dejaba de ser un segundo factor.
 *
 * v2 usa una clave propia (TOTP_ENCRYPTION_KEY, ≥ 32 caracteres, distinta de
 * JWT_SECRET) derivada con HKDF. En producción, sin ella no se cifra nada nuevo.
 * Los registros v1 se siguen leyendo para no dejar a nadie fuera; se reescriben
 * en v2 la próxima vez que el usuario configure su 2FA.
 */
const PREFIJO_V2 = 'v2';

function claveV2() {
    const raw = process.env.TOTP_ENCRYPTION_KEY;
    const produccion = process.env.NODE_ENV === 'production';
    if (!raw) {
        if (produccion) throw new Error('TOTP_ENCRYPTION_KEY es obligatoria en producción para cifrar secretos 2FA.');
        return crypto.hkdfSync('sha256', Buffer.from('dev-only-totp-key'), Buffer.from('bezhas/totp'), Buffer.from('v2'), 32);
    }
    if (produccion && (raw.length < 32 || raw === process.env.JWT_SECRET)) {
        throw new Error('TOTP_ENCRYPTION_KEY debe tener al menos 32 caracteres y no puede ser JWT_SECRET.');
    }
    return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(raw, 'utf8'), Buffer.from('bezhas/totp'), Buffer.from('v2'), 32));
}

/** Clave de los registros v1, sólo para leerlos. */
const claveV1 = () => crypto.scryptSync(process.env.JWT_SECRET || 'default-key', 'salt', 32);

/**
 * Encrypt a TOTP secret for secure storage
 * @param {string} secret - Plain TOTP secret
 * @returns {string} - `v2:iv:authTag:ciphertext`
 */
const encryptSecret = (secret) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', claveV2(), iv);
    const cifrado = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [PREFIJO_V2, iv.toString('hex'), cipher.getAuthTag().toString('hex'), cifrado.toString('hex')].join(':');
};

/**
 * Decrypt a stored TOTP secret (v2, o v1 heredado)
 * @param {string} encryptedSecret - Encrypted secret string
 * @returns {string} - Plain TOTP secret
 */
const decryptSecret = (encryptedSecret) => {
    try {
        const partes = String(encryptedSecret || '').split(':');
        const v2 = partes[0] === PREFIJO_V2;
        const [ivHex, authTagHex, cifradoHex] = v2 ? partes.slice(1) : partes;
        const decipher = crypto.createDecipheriv('aes-256-gcm', v2 ? claveV2() : claveV1(), Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(cifradoHex, 'hex')), decipher.final()]).toString('utf8');
    } catch (error) {
        // Nunca se registra el valor cifrado ni el error con datos: sólo que falló.
        console.error('Error decrypting TOTP secret');
        throw new Error('Failed to decrypt 2FA secret');
    }
};

/** ¿Está en el formato antiguo? Para reescribirlo en v2 cuando se pueda. */
const isLegacySecret = (encryptedSecret) => !String(encryptedSecret || '').startsWith(`${PREFIJO_V2}:`);

module.exports = {
    isLegacySecret,
    generate2FASecret,
    verify2FAToken,
    generateBackupCodes,
    verifyBackupCode,
    is2FAEnabled,
    encryptSecret,
    decryptSecret,
};
