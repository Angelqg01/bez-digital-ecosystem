/**
 * ============================================================================
 * REFRESH TOKEN SYSTEM - JWT Token Rotation
 * ============================================================================
 * 
 * Implementa un sistema seguro de refresh tokens para:
 * - Tokens de acceso de corta duración (15 min)
 * - Refresh tokens de larga duración (7 días)
 * - Rotación automática de tokens
 * - Revocación de tokens comprometidos
 * - Detección de reuso de tokens
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { audit } = require('./auditLogger');
const { notifyMaxDevices, notifyTokenReuse } = require('./discordNotifier');

// In-memory store (en producción usar Redis)
const refreshTokenStore = new Map();
const revokedTokens = new Set();

// Configuración
const CONFIG = {
    ACCESS_TOKEN_EXPIRY: '15m',      // 15 minutos
    REFRESH_TOKEN_EXPIRY: '7d',      // 7 días
    REFRESH_TOKEN_FAMILY: true,      // Detectar reuso
    MAX_DEVICES: 5,                  // Máximo dispositivos simultáneos
    ACCESS_SECRET: process.env.JWT_SECRET || 'default-secret-change-me',
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me'
};

/**
 * Generar token ID único
 */
function generateTokenId() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Crear par de tokens (access + refresh)
 */
function createTokenPair(payload, deviceInfo = {}) {
    const tokenId = generateTokenId();
    const familyId = generateTokenId(); // Para detectar reuso

    // Access Token (corta duración)
    const accessToken = jwt.sign(
        {
            ...payload,
            tokenId,
            type: 'access'
        },
        CONFIG.ACCESS_SECRET,
        { expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    // Refresh Token (larga duración)
    const refreshToken = jwt.sign(
        {
            userId: payload.userId,
            tokenId,
            familyId,
            type: 'refresh'
        },
        CONFIG.REFRESH_SECRET,
        { expiresIn: CONFIG.REFRESH_TOKEN_EXPIRY }
    );

    // Guardar refresh token en store
    const userTokens = refreshTokenStore.get(payload.userId) || [];

    userTokens.push({
        tokenId,
        familyId,
        refreshToken,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        deviceInfo: {
            userAgent: deviceInfo.userAgent || 'unknown',
            ip: deviceInfo.ip || 'unknown',
            deviceName: deviceInfo.deviceName || 'unknown'
        }
    });

    // Limitar número de dispositivos
    if (userTokens.length > CONFIG.MAX_DEVICES) {
        // Remover el más antiguo
        userTokens.sort((a, b) => a.lastUsed - b.lastUsed);
        const removed = userTokens.shift();

        audit.security('MAX_DEVICES_EXCEEDED', 'low', {
            userId: payload.userId,
            removedToken: removed.tokenId
        });

        // Notificar a Discord
        notifyMaxDevices(payload.userId, removed.tokenId).catch(err =>
            console.error('Discord notification error:', err.message)
        );
    }

    refreshTokenStore.set(payload.userId, userTokens);

    return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutos en segundos
        tokenType: 'Bearer'
    };
}

/**
 * Verificar access token
 */
function verifyAccessToken(token) {
    try {
        // Verificar si está revocado
        const decoded = jwt.decode(token);
        if (decoded && revokedTokens.has(decoded.tokenId)) {
            return { valid: false, reason: 'revoked' };
        }

        const payload = jwt.verify(token, CONFIG.ACCESS_SECRET);

        if (payload.type !== 'access') {
            return { valid: false, reason: 'invalid_type' };
        }

        return { valid: true, payload };
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { valid: false, reason: 'expired' };
        }
        return { valid: false, reason: 'invalid', error: error.message };
    }
}

/**
 * Refrescar tokens usando refresh token
 */
function refreshTokens(refreshToken, deviceInfo = {}) {
    try {
        // Verificar refresh token
        const payload = jwt.verify(refreshToken, CONFIG.REFRESH_SECRET);

        if (payload.type !== 'refresh') {
            return { success: false, reason: 'invalid_type' };
        }

        const { userId, tokenId, familyId } = payload;

        // Verificar que no esté revocado
        if (revokedTokens.has(tokenId)) {
            audit.security('REVOKED_TOKEN_REUSE', 'high', {
                userId,
                tokenId
            });
            return { success: false, reason: 'revoked' };
        }

        // Buscar token en store
        const userTokens = refreshTokenStore.get(userId);
        if (!userTokens) {
            return { success: false, reason: 'not_found' };
        }

        const tokenIndex = userTokens.findIndex(t => t.tokenId === tokenId);
        if (tokenIndex === -1) {
            // Token no encontrado = posible reuso
            if (CONFIG.REFRESH_TOKEN_FAMILY) {
                // Revocar toda la familia de tokens
                const familyTokens = userTokens.filter(t => t.familyId === familyId);
                familyTokens.forEach(t => revokedTokens.add(t.tokenId));

                audit.security('TOKEN_REUSE_DETECTED', 'critical', {
                    userId,
                    familyId,
                    revokedCount: familyTokens.length
                });

                // Notificar a Discord - CRÍTICO
                notifyTokenReuse(userId, familyId, deviceInfo.ip).catch(err =>
                    console.error('Discord notification error:', err.message)
                );

                // Limpiar tokens de la familia
                const remaining = userTokens.filter(t => t.familyId !== familyId);
                refreshTokenStore.set(userId, remaining);

                return {
                    success: false,
                    reason: 'token_reuse',
                    critical: true
                };
            }
            return { success: false, reason: 'not_found' };
        }

        // Revocar el token viejo
        const oldToken = userTokens[tokenIndex];
        revokedTokens.add(oldToken.tokenId);
        userTokens.splice(tokenIndex, 1);

        // Crear nuevos tokens (mismo familyId)
        const newTokenPair = createTokenPair(
            {
                userId,
                walletAddress: oldToken.deviceInfo.walletAddress,
                role: oldToken.deviceInfo.role
            },
            deviceInfo
        );

        // Actualizar familyId del nuevo token
        const newUserTokens = refreshTokenStore.get(userId);
        const newTokenIndex = newUserTokens.findIndex(
            t => jwt.decode(t.refreshToken).tokenId === jwt.decode(newTokenPair.refreshToken).tokenId
        );

        if (newTokenIndex !== -1) {
            newUserTokens[newTokenIndex].familyId = familyId;
            refreshTokenStore.set(userId, newUserTokens);
        }

        audit.auth('TOKEN_REFRESHED', userId, {
            oldTokenId: tokenId,
            newTokenId: jwt.decode(newTokenPair.accessToken).tokenId,
            ip: deviceInfo.ip
        });

        return {
            success: true,
            tokens: newTokenPair
        };

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { success: false, reason: 'expired' };
        }
        return { success: false, reason: 'invalid', error: error.message };
    }
}

/**
 * Revocar token específico
 */
function revokeToken(tokenId, userId, reason = 'user_logout') {
    // Agregar a lista de revocados
    revokedTokens.add(tokenId);

    // Remover de store
    const userTokens = refreshTokenStore.get(userId);
    if (userTokens) {
        const filtered = userTokens.filter(t => t.tokenId !== tokenId);
        refreshTokenStore.set(userId, filtered);
    }

    audit.auth('TOKEN_REVOKED', userId, {
        tokenId,
        reason
    });

    return { success: true };
}

/**
 * Revocar todos los tokens de un usuario
 */
function revokeAllUserTokens(userId, reason = 'logout_all') {
    const userTokens = refreshTokenStore.get(userId);

    if (userTokens) {
        userTokens.forEach(t => revokedTokens.add(t.tokenId));
        refreshTokenStore.delete(userId);

        audit.auth('ALL_TOKENS_REVOKED', userId, {
            count: userTokens.length,
            reason
        });

        return { success: true, count: userTokens.length };
    }

    return { success: true, count: 0 };
}

/**
 * Listar sesiones activas de un usuario
 */
function getUserSessions(userId) {
    const userTokens = refreshTokenStore.get(userId);

    if (!userTokens) {
        return [];
    }

    return userTokens.map(t => {
        const decoded = jwt.decode(t.refreshToken);
        return {
            tokenId: t.tokenId,
            deviceInfo: t.deviceInfo,
            createdAt: t.createdAt,
            lastUsed: t.lastUsed,
            expiresAt: decoded.exp * 1000,
            isActive: decoded.exp * 1000 > Date.now()
        };
    });
}

/**
 * Limpiar tokens expirados
 */
function cleanupExpiredTokens() {
    let cleaned = 0;
    const now = Date.now();

    for (const [userId, tokens] of refreshTokenStore.entries()) {
        const validTokens = tokens.filter(t => {
            const decoded = jwt.decode(t.refreshToken);
            return decoded.exp * 1000 > now;
        });

        if (validTokens.length !== tokens.length) {
            cleaned += tokens.length - validTokens.length;
        }

        if (validTokens.length === 0) {
            refreshTokenStore.delete(userId);
        } else if (validTokens.length !== tokens.length) {
            refreshTokenStore.set(userId, validTokens);
        }
    }

    return cleaned;
}

/**
 * Middleware Express para verificar access token
 */
function verifyTokenMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'No token provided',
            code: 'NO_TOKEN'
        });
    }

    const token = authHeader.substring(7);
    const result = verifyAccessToken(token);

    if (!result.valid) {
        if (result.reason === 'expired') {
            return res.status(401).json({
                error: 'Token expired',
                code: 'TOKEN_EXPIRED',
                message: 'Please refresh your token'
            });
        }

        return res.status(401).json({
            error: 'Invalid token',
            code: 'INVALID_TOKEN',
            reason: result.reason
        });
    }

    req.user = result.payload;
    next();
}

module.exports = {
    createTokenPair,
    verifyAccessToken,
    refreshTokens,
    revokeToken,
    revokeAllUserTokens,
    getUserSessions,
    cleanupExpiredTokens,
    verifyTokenMiddleware,
    CONFIG
};
