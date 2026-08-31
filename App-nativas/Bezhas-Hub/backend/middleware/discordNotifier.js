/**
 * ============================================================================
 * DISCORD WEBHOOK INTEGRATION - Security Notifications
 * ============================================================================
 * 
 * Sistema de notificaciones de seguridad a Discord para:
 * - Eventos críticos de seguridad
 * - Intentos de intrusión
 * - Fallos de autenticación
 * - Actividad sospechosa
 * - Alertas de rate limiting
 */

const axios = require('axios');
const { audit } = require('./auditLogger');

// Configuración del webhook
const DISCORD_CONFIG = {
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1448627231625838745/afE6XbHBr4e9oZFhbn7WOHuQ5MWvuJHuDdrwPS_s0673s2j3DlRvmd73IbcO-wcShgnf',
    ENABLED: process.env.DISCORD_NOTIFICATIONS_ENABLED !== 'false',
    MIN_SEVERITY: process.env.DISCORD_MIN_SEVERITY || 'medium', // low, medium, high, critical
    RATE_LIMIT: 5, // Máximo 5 notificaciones por minuto
    COOLDOWN: 60000 // 1 minuto
};

// Store para rate limiting
const notificationQueue = [];
const lastNotificationTime = new Map();

/**
 * Colores por severidad
 */
const SEVERITY_COLORS = {
    low: 3447003,      // Azul
    medium: 16776960,  // Amarillo
    high: 16744192,    // Naranja
    critical: 16711680 // Rojo
};

/**
 * Emojis por tipo de evento
 */
const EVENT_EMOJIS = {
    // Autenticación
    'LOGIN_FAILED': '🔒',
    'LOGIN_SUCCESS': '✅',
    'TOKEN_REUSE_DETECTED': '🚨',
    'TOKEN_REVOKED': '⚠️',
    '2FA_ENABLED': '🔐',
    '2FA_FAILED': '❌',

    // Rate Limiting
    'RATE_LIMIT_EXCEEDED': '⏱️',
    'PENALTY_APPLIED': '🔨',
    'MAX_DEVICES_EXCEEDED': '📱',

    // Seguridad
    'INVALID_SIGNATURE': '⛔',
    'ADMIN_ACCESS_DENIED': '🚫',
    'SUSPICIOUS_ACTIVITY': '👁️',
    'BRUTE_FORCE_DETECTED': '💥',

    // Pagos
    'STRIPE_PAYMENT_FAILED': '💳',
    'STRIPE_REFUND_CREATED': '💸',
    'STRIPE_WEBHOOK_ERROR': '🔴',

    // Sistema
    'DATABASE_ERROR': '🗄️',
    'API_ERROR': '🔧',
    'SECURITY_BREACH': '🚨',

    // Default
    'DEFAULT': '📢'
};

/**
 * Verificar si se debe enviar notificación
 */
function shouldNotify(severity, eventType) {
    if (!DISCORD_CONFIG.ENABLED) {
        return false;
    }

    // Verificar severidad mínima
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const minLevel = severityLevels[DISCORD_CONFIG.MIN_SEVERITY] || 2;
    const eventLevel = severityLevels[severity] || 1;

    if (eventLevel < minLevel) {
        return false;
    }

    // Verificar rate limit
    const now = Date.now();
    const recentNotifications = notificationQueue.filter(
        time => now - time < DISCORD_CONFIG.COOLDOWN
    );

    if (recentNotifications.length >= DISCORD_CONFIG.RATE_LIMIT) {
        console.log('⚠️ Discord notification rate limit reached');
        return false;
    }

    // Verificar cooldown por tipo de evento
    const lastTime = lastNotificationTime.get(eventType);
    if (lastTime && (now - lastTime) < 30000) { // 30 segundos cooldown por tipo
        return false;
    }

    return true;
}

/**
 * Enviar notificación a Discord
 */
async function sendDiscordNotification(eventType, severity, data) {
    try {
        if (!shouldNotify(severity, eventType)) {
            return { success: true, skipped: true };
        }

        const emoji = EVENT_EMOJIS[eventType] || EVENT_EMOJIS['DEFAULT'];
        const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS['medium'];

        // Construir embed
        const embed = {
            title: `${emoji} Security Alert: ${eventType.replace(/_/g, ' ')}`,
            color: color,
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: '🔍 Severity',
                    value: severity.toUpperCase(),
                    inline: true
                },
                {
                    name: '⏰ Time',
                    value: new Date().toLocaleString('es-ES', { timeZone: 'America/Mexico_City' }),
                    inline: true
                }
            ]
        };

        // Agregar campos específicos según el tipo de evento
        if (data.userId) {
            embed.fields.push({
                name: '👤 User ID',
                value: `\`${data.userId}\``,
                inline: true
            });
        }

        if (data.walletAddress) {
            embed.fields.push({
                name: '💼 Wallet',
                value: `\`${data.walletAddress.substring(0, 10)}...${data.walletAddress.substring(38)}\``,
                inline: true
            });
        }

        if (data.ip) {
            embed.fields.push({
                name: '🌐 IP Address',
                value: `\`${data.ip}\``,
                inline: true
            });
        }

        if (data.reason) {
            embed.fields.push({
                name: '📝 Reason',
                value: data.reason,
                inline: false
            });
        }

        if (data.details) {
            embed.fields.push({
                name: '📋 Details',
                value: typeof data.details === 'string'
                    ? data.details
                    : JSON.stringify(data.details, null, 2).substring(0, 1000),
                inline: false
            });
        }

        // Agregar contador si hay múltiples intentos
        if (data.attempts) {
            embed.fields.push({
                name: '🔢 Attempts',
                value: `${data.attempts}`,
                inline: true
            });
        }

        // Footer
        embed.footer = {
            text: `BeZhas Security System | ${process.env.NODE_ENV || 'development'}`,
            icon_url: 'https://bez.digital/favicon.ico'
        };

        // Agregar descripción según severidad
        if (severity === 'critical') {
            embed.description = '⚠️ **CRITICAL SECURITY EVENT** - Immediate action required!';
        } else if (severity === 'high') {
            embed.description = '⚠️ High priority security event detected';
        }

        // Enviar a Discord
        const response = await axios.post(DISCORD_CONFIG.WEBHOOK_URL, {
            username: 'BeZhas Security Bot',
            avatar_url: 'https://bez.digital/assets/security-bot-avatar.png',
            embeds: [embed]
        }, {
            timeout: 5000
        });

        // Actualizar rate limiting
        const now = Date.now();
        notificationQueue.push(now);
        lastNotificationTime.set(eventType, now);

        // Limpiar queue antiguo
        while (notificationQueue.length > 0 && (now - notificationQueue[0]) > DISCORD_CONFIG.COOLDOWN) {
            notificationQueue.shift();
        }

        audit.admin('DISCORD_NOTIFICATION_SENT', 'info', {
            eventType,
            severity,
            status: response.status
        });

        return { success: true, status: response.status };

    } catch (error) {
        console.error('Error sending Discord notification:', error.message);

        audit.admin('DISCORD_NOTIFICATION_FAILED', 'medium', {
            eventType,
            error: error.message
        });

        return { success: false, error: error.message };
    }
}

/**
 * Notificar evento de seguridad crítico
 */
function notifyCritical(eventType, data) {
    return sendDiscordNotification(eventType, 'critical', data);
}

/**
 * Notificar evento de alta prioridad
 */
function notifyHigh(eventType, data) {
    return sendDiscordNotification(eventType, 'high', data);
}

/**
 * Notificar evento de prioridad media
 */
function notifyMedium(eventType, data) {
    return sendDiscordNotification(eventType, 'medium', data);
}

/**
 * Notificar evento de baja prioridad
 */
function notifyLow(eventType, data) {
    return sendDiscordNotification(eventType, 'low', data);
}

/**
 * Notificar intento de intrusión
 */
async function notifySecurityBreach(details) {
    return notifyCritical('SECURITY_BREACH', {
        details: details,
        timestamp: Date.now()
    });
}

/**
 * Notificar múltiples fallos de login (brute force)
 */
async function notifyBruteForce(userId, attempts, ip) {
    return notifyHigh('BRUTE_FORCE_DETECTED', {
        userId,
        attempts,
        ip,
        details: `${attempts} failed login attempts detected`
    });
}

/**
 * Notificar reuso de token (posible compromiso)
 */
async function notifyTokenReuse(userId, familyId, ip) {
    return notifyCritical('TOKEN_REUSE_DETECTED', {
        userId,
        familyId,
        ip,
        details: 'Token reuse detected - possible account compromise. All sessions terminated.'
    });
}

/**
 * Notificar exceso de dispositivos
 */
async function notifyMaxDevices(userId, removedToken) {
    return notifyMedium('MAX_DEVICES_EXCEEDED', {
        userId,
        removedToken,
        details: 'Maximum device limit exceeded (5). Oldest session removed.'
    });
}

/**
 * Notificar fallo de pago en Stripe
 */
async function notifyPaymentFailed(paymentIntentId, amount, reason) {
    return notifyHigh('STRIPE_PAYMENT_FAILED', {
        paymentIntentId,
        details: `Payment of $${amount} failed: ${reason}`
    });
}

/**
 * Notificar error en webhook de Stripe
 */
async function notifyStripeWebhookError(eventType, error) {
    return notifyHigh('STRIPE_WEBHOOK_ERROR', {
        eventType,
        details: error,
        reason: 'Webhook processing failed'
    });
}

/**
 * Notificar penalización aplicada
 */
async function notifyPenalty(userId, violationType, duration) {
    return notifyMedium('PENALTY_APPLIED', {
        userId,
        details: `User penalized for ${violationType}`,
        reason: `Penalty duration: ${duration}ms`
    });
}

/**
 * Notificar actividad sospechosa
 */
async function notifySuspiciousActivity(userId, activityType, details) {
    return notifyHigh('SUSPICIOUS_ACTIVITY', {
        userId,
        details: `${activityType}: ${details}`
    });
}

/**
 * Enviar resumen diario de seguridad
 */
async function sendDailySummary(stats) {
    const embed = {
        title: '📊 Daily Security Summary',
        color: 3447003, // Azul
        timestamp: new Date().toISOString(),
        fields: [
            {
                name: '✅ Successful Logins',
                value: `${stats.successfulLogins || 0}`,
                inline: true
            },
            {
                name: '❌ Failed Logins',
                value: `${stats.failedLogins || 0}`,
                inline: true
            },
            {
                name: '🚨 Security Alerts',
                value: `${stats.securityAlerts || 0}`,
                inline: true
            },
            {
                name: '🔒 2FA Enabled',
                value: `${stats.twoFactorEnabled || 0}`,
                inline: true
            },
            {
                name: '⏱️ Rate Limit Hits',
                value: `${stats.rateLimitHits || 0}`,
                inline: true
            },
            {
                name: '💳 Payments Processed',
                value: `${stats.paymentsProcessed || 0}`,
                inline: true
            }
        ],
        footer: {
            text: `BeZhas Security Daily Report | ${new Date().toLocaleDateString()}`,
            icon_url: 'https://bez.digital/favicon.ico'
        }
    };

    try {
        await axios.post(DISCORD_CONFIG.WEBHOOK_URL, {
            username: 'BeZhas Security Bot',
            embeds: [embed]
        });
    } catch (error) {
        console.error('Error sending daily summary:', error.message);
    }
}

/**
 * Test de notificación
 */
async function testNotification() {
    return sendDiscordNotification('TEST_NOTIFICATION', 'low', {
        details: 'This is a test notification from BeZhas Security System',
        timestamp: Date.now()
    });
}

module.exports = {
    sendDiscordNotification,
    notifyCritical,
    notifyHigh,
    notifyMedium,
    notifyLow,
    notifySecurityBreach,
    notifyBruteForce,
    notifyTokenReuse,
    notifyMaxDevices,
    notifyPaymentFailed,
    notifyStripeWebhookError,
    notifyPenalty,
    notifySuspiciousActivity,
    sendDailySummary,
    testNotification,
    DISCORD_CONFIG
};
