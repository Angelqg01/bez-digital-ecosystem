/**
 * ============================================================================
 * AUDIT LOGGER - Sistema de logging con Winston
 * ============================================================================
 * 
 * Proporciona logging estructurado para auditoría y debugging
 */

const winston = require('winston');
const path = require('path');

// Configuración de transports
const transports = [];

// Console transport (desarrollo)
if (process.env.NODE_ENV !== 'production') {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    let msg = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(meta).length > 0) {
                        msg += ` ${JSON.stringify(meta)}`;
                    }
                    return msg;
                })
            )
        })
    );
}

// File transport removed for App Engine (Read-only FS)
// Use Console transport with JSON format for Google Cloud Logging
if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    );
}

// Crear logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'bezhas-backend',
        environment: process.env.NODE_ENV || 'development'
    },
    transports
});

/**
 * Métodos de auditoría para acciones críticas
 */
const audit = {
    /**
     * Log de autenticación
     */
    auth(action, userId, metadata = {}) {
        logger.info('AUTH', {
            action,
            userId,
            timestamp: new Date().toISOString(),
            category: 'authentication',
            ...metadata
        });
    },

    /**
     * Log de acciones admin
     */
    admin(action, adminId, targetId, metadata = {}) {
        logger.info('ADMIN', {
            action,
            adminId,
            targetId,
            timestamp: new Date().toISOString(),
            category: 'admin',
            severity: 'high',
            ...metadata
        });
    },

    /**
     * Log de transacciones blockchain
     */
    transaction(type, userId, amount, txHash, metadata = {}) {
        logger.info('TRANSACTION', {
            type,
            userId,
            amount,
            txHash,
            timestamp: new Date().toISOString(),
            category: 'blockchain',
            ...metadata
        });
    },

    /**
     * Log de acciones DAO
     */
    dao(action, userId, proposalId, metadata = {}) {
        logger.info('DAO', {
            action,
            userId,
            proposalId,
            timestamp: new Date().toISOString(),
            category: 'governance',
            ...metadata
        });
    },

    /**
     * Log de chat (créditos)
     */
    chat(action, userId, creditsUsed, metadata = {}) {
        logger.info('CHAT', {
            action,
            userId,
            creditsUsed,
            timestamp: new Date().toISOString(),
            category: 'chat',
            ...metadata
        });
    },

    /**
     * Log de errores de seguridad
     */
    security(event, severity, metadata = {}) {
        logger.warn('SECURITY', {
            event,
            severity,
            timestamp: new Date().toISOString(),
            category: 'security',
            ...metadata
        });
    },

    /**
     * Log de acceso denegado
     */
    accessDenied(resource, userId, reason, metadata = {}) {
        logger.warn('ACCESS_DENIED', {
            resource,
            userId,
            reason,
            timestamp: new Date().toISOString(),
            category: 'security',
            severity: 'medium',
            ...metadata
        });
    },

    /**
     * Log de cambios de configuración
     */
    configChange(setting, oldValue, newValue, adminId, metadata = {}) {
        logger.info('CONFIG_CHANGE', {
            setting,
            oldValue,
            newValue,
            adminId,
            timestamp: new Date().toISOString(),
            category: 'configuration',
            severity: 'high',
            ...metadata
        });
    }
};

/**
 * Middleware Express para logging de requests
 */
function requestLogger(req, res, next) {
    const startTime = Date.now();

    // Log cuando termine la request
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        logger.info('HTTP_REQUEST', {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            userId: req.user?.id || 'anonymous'
        });
    });

    next();
}

/**
 * Middleware para logging de errores
 */
function errorLogger(err, req, res, next) {
    logger.error('HTTP_ERROR', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id || 'anonymous'
    });

    next(err);
}

module.exports = {
    logger,
    audit,
    requestLogger,
    errorLogger
};
