/**
 * ============================================================================
 * TWO-FACTOR AUTHENTICATION (2FA) - TOTP Implementation
 * ============================================================================
 * 
 * Sistema de autenticación de dos factores usando TOTP (Time-based OTP)
 * Compatible con Google Authenticator, Authy, etc.
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { audit } = require('./auditLogger');
const { notifyMedium, notifyHigh } = require('./discordNotifier');

// Store de secrets 2FA (en producción usar base de datos)
const twoFactorSecrets = new Map();

// Backup codes store
const backupCodes = new Map();

/**
 * Generar secret 2FA para un usuario
 */
async function generateTwoFactorSecret(userId, userEmail) {
    const secret = speakeasy.generateSecret({
        name: `BeZhas (${userEmail})`,
        issuer: 'BeZhas Web3 Platform',
        length: 32
    });

    // Guardar temporalmente (no confirmado)
    twoFactorSecrets.set(`temp_${userId}`, {
        secret: secret.base32,
        confirmed: false,
        createdAt: Date.now()
    });

    // Generar QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    audit.auth('2FA_SECRET_GENERATED', userId, {
        email: userEmail
    });

    return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntry: secret.base32
    };
}

/**
 * Verificar código 2FA y confirmar activación
 */
function verifyAndEnable2FA(userId, token) {
    const tempSecret = twoFactorSecrets.get(`temp_${userId}`);

    if (!tempSecret) {
        return {
            success: false,
            error: 'No 2FA setup in progress'
        };
    }

    // Verificar token
    const verified = speakeasy.totp.verify({
        secret: tempSecret.secret,
        encoding: 'base32',
        token: token,
        window: 2 // Permitir 2 períodos de tiempo (60 segundos antes/después)
    });

    if (!verified) {
        return {
            success: false,
            error: 'Invalid verification code'
        };
    }

    // Mover de temp a permanente
    twoFactorSecrets.set(userId, {
        secret: tempSecret.secret,
        confirmed: true,
        enabledAt: Date.now()
    });
    twoFactorSecrets.delete(`temp_${userId}`);

    // Generar backup codes
    const codes = generateBackupCodes(userId);

    audit.auth('2FA_ENABLED', userId, {
        method: 'TOTP'
    });

    return {
        success: true,
        backupCodes: codes
    };
}

/**
 * Generar códigos de backup
 */
function generateBackupCodes(userId, count = 10) {
    const crypto = require('crypto');
    const codes = [];

    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
    }

    // Hashear y guardar
    const hashedCodes = codes.map(code =>
        crypto.createHash('sha256').update(code).digest('hex')
    );

    backupCodes.set(userId, {
        codes: hashedCodes,
        used: new Set(),
        generatedAt: Date.now()
    });

    return codes;
}

/**
 * Verificar código 2FA durante login
 */
function verify2FACode(userId, token, isBackupCode = false) {
    const userSecret = twoFactorSecrets.get(userId);

    if (!userSecret || !userSecret.confirmed) {
        return {
            success: false,
            error: '2FA not enabled for this user'
        };
    }

    // Verificar código de backup
    if (isBackupCode) {
        return verifyBackupCode(userId, token);
    }

    // Verificar TOTP
    const verified = speakeasy.totp.verify({
        secret: userSecret.secret,
        encoding: 'base32',
        token: token,
        window: 2
    });

    if (verified) {
        audit.auth('2FA_VERIFIED', userId, {
            method: 'TOTP'
        });

        return { success: true };
    }

    audit.security('2FA_VERIFICATION_FAILED', 'medium', {
        userId,
        method: 'TOTP'
    });

    // Notificar fallos 2FA a Discord (puede indicar intento de acceso no autorizado)
    notifyMedium('2FA_VERIFICATION_FAILED', {
        userId,
        method: 'TOTP',
        details: 'Invalid 2FA code entered - possible unauthorized access attempt'
    }).catch(err => console.error('Discord notification error:', err.message));

    return {
        success: false,
        error: 'Invalid verification code'
    };
}

/**
 * Verificar código de backup
 */
function verifyBackupCode(userId, code) {
    const crypto = require('crypto');
    const userBackupCodes = backupCodes.get(userId);

    if (!userBackupCodes) {
        return {
            success: false,
            error: 'No backup codes found'
        };
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const codeIndex = userBackupCodes.codes.indexOf(hashedCode);

    if (codeIndex === -1) {
        audit.security('2FA_BACKUP_CODE_INVALID', 'medium', {
            userId
        });
        return {
            success: false,
            error: 'Invalid backup code'
        };
    }

    // Verificar si ya fue usado
    if (userBackupCodes.used.has(hashedCode)) {
        audit.security('2FA_BACKUP_CODE_REUSED', 'high', {
            userId
        });

        // Notificar reuso de backup code (alta prioridad - posible ataque)
        notifyHigh('2FA_BACKUP_CODE_REUSED', {
            userId,
            details: 'Backup code was already used - possible replay attack or stolen code'
        }).catch(err => console.error('Discord notification error:', err.message));

        return {
            success: false,
            error: 'Backup code already used'
        };
    }

    // Marcar como usado
    userBackupCodes.used.add(hashedCode);
    backupCodes.set(userId, userBackupCodes);

    const remainingCodes = userBackupCodes.codes.length - userBackupCodes.used.size;

    audit.auth('2FA_BACKUP_CODE_USED', userId, {
        remainingCodes
    });

    // Notificar si quedan pocos códigos de backup
    if (remainingCodes <= 2) {
        notifyMedium('2FA_BACKUP_CODES_LOW', {
            userId,
            remainingCodes,
            details: `User has only ${remainingCodes} backup codes remaining`
        }).catch(err => console.error('Discord notification error:', err.message));
    }

    return {
        success: true,
        remainingCodes
    };
}

/**
 * Desactivar 2FA
 */
function disable2FA(userId, password, twoFactorCode) {
    const userSecret = twoFactorSecrets.get(userId);

    if (!userSecret) {
        return {
            success: false,
            error: '2FA not enabled'
        };
    }

    // Verificar código 2FA antes de desactivar
    const verified = verify2FACode(userId, twoFactorCode);

    if (!verified.success) {
        return verified;
    }

    // Remover secret y backup codes
    twoFactorSecrets.delete(userId);
    backupCodes.delete(userId);

    audit.auth('2FA_DISABLED', userId, {
        method: 'TOTP'
    });

    return { success: true };
}

/**
 * Verificar si 2FA está habilitado para un usuario
 */
function is2FAEnabled(userId) {
    const userSecret = twoFactorSecrets.get(userId);
    return userSecret && userSecret.confirmed;
}

/**
 * Regenerar códigos de backup
 */
function regenerateBackupCodes(userId, twoFactorCode) {
    // Verificar código 2FA primero
    const verified = verify2FACode(userId, twoFactorCode);

    if (!verified.success) {
        return verified;
    }

    const codes = generateBackupCodes(userId);

    audit.auth('2FA_BACKUP_CODES_REGENERATED', userId, {});

    return {
        success: true,
        backupCodes: codes
    };
}

/**
 * Obtener estadísticas de 2FA de un usuario
 */
function get2FAStats(userId) {
    const userSecret = twoFactorSecrets.get(userId);
    const userBackupCodes = backupCodes.get(userId);

    if (!userSecret || !userSecret.confirmed) {
        return {
            enabled: false
        };
    }

    const remainingBackupCodes = userBackupCodes
        ? userBackupCodes.codes.length - userBackupCodes.used.size
        : 0;

    return {
        enabled: true,
        enabledAt: userSecret.enabledAt,
        method: 'TOTP',
        backupCodes: {
            total: userBackupCodes?.codes.length || 0,
            used: userBackupCodes?.used.size || 0,
            remaining: remainingBackupCodes
        }
    };
}

/**
 * Middleware para requerir 2FA
 */
function require2FA(req, res, next) {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }

    // Verificar si tiene 2FA habilitado
    if (!is2FAEnabled(userId)) {
        return next(); // No tiene 2FA, continuar
    }

    // Verificar si ya pasó 2FA en esta sesión
    if (req.session?.twoFactorVerified) {
        return next();
    }

    return res.status(403).json({
        error: '2FA verification required',
        code: '2FA_REQUIRED'
    });
}

module.exports = {
    generateTwoFactorSecret,
    verifyAndEnable2FA,
    verify2FACode,
    disable2FA,
    is2FAEnabled,
    generateBackupCodes,
    regenerateBackupCodes,
    get2FAStats,
    require2FA
};
