/**
 * ============================================================================
 * TELEGRAM BOT INTEGRATION - Security Notifications
 * ============================================================================
 * 
 * Sistema de notificaciones de seguridad a Telegram para:
 * - Eventos críticos de seguridad
 * - Transacciones importantes
 * - Alertas de sistema
 * - Actividad sospechosa
 */

const axios = require('axios');
const { audit } = require('./auditLogger');

// Configuración del bot
const TELEGRAM_CONFIG = {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    CHAT_ID: process.env.TELEGRAM_SECURITY_CHAT_ID || '', // El usuario debe configurar esto
    ENABLED: process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'false' && process.env.TELEGRAM_BOT_TOKEN,
    MIN_SEVERITY: process.env.TELEGRAM_MIN_SEVERITY || 'high', // low, medium, high, critical
    RATE_LIMIT: 10, // Máximo 10 notificaciones por minuto
    COOLDOWN: 60000 // 1 minuto
};

// Store para rate limiting
const notificationQueue = [];
const lastNotificationTime = new Map();

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
    'RATE_LIMIT_BAN': '🚫',
    'SUSPICIOUS_ACTIVITY': '👁️',

    // Pagos
    'PAYMENT_FAILED': '💳❌',
    'PAYMENT_SUCCESS': '💰✅',
    'PAYMENT_REFUND': '↩️',
    'LARGE_TRANSACTION': '💎',

    // Sistema
    'SERVER_ERROR': '💥',
    'DATABASE_ERROR': '🗄️❌',
    'API_ERROR': '🔌❌',
    'DEPLOYMENT': '🚀',

    // Blockchain
    'TRANSACTION_FAILED': '⛓️❌',
    'TRANSACTION_SUCCESS': '⛓️✅',
    'CONTRACT_DEPLOYED': '📜',
    'GAS_SPIKE': '⛽⬆️',

    // Seguridad
    'INTRUSION_ATTEMPT': '🚨🚨',
    'SQL_INJECTION': '💉',
    'XSS_ATTEMPT': '🔓',
    'DDOS_DETECTED': '🌊',
    'UNAUTHORIZED_ACCESS': '🚪🔒',

    // Default
    'DEFAULT': 'ℹ️'
};

/**
 * Severidad mínima para notificar
 */
const SEVERITY_LEVELS = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
};

/**
 * Verifica si se debe enviar la notificación según rate limiting
 */
function shouldSendNotification(eventType) {
    const now = Date.now();
    const lastTime = lastNotificationTime.get(eventType) || 0;

    // Cooldown específico por tipo de evento
    if (now - lastTime < TELEGRAM_CONFIG.COOLDOWN) {
        return false;
    }

    // Rate limit global
    const recentNotifications = notificationQueue.filter(time => now - time < TELEGRAM_CONFIG.COOLDOWN);
    if (recentNotifications.length >= TELEGRAM_CONFIG.RATE_LIMIT) {
        return false;
    }

    return true;
}

/**
 * Actualiza el registro de notificaciones
 */
function recordNotification(eventType) {
    const now = Date.now();
    lastNotificationTime.set(eventType, now);
    notificationQueue.push(now);

    // Limpiar notificaciones antiguas
    const cutoff = now - TELEGRAM_CONFIG.COOLDOWN * 2;
    const validIndex = notificationQueue.findIndex(time => time > cutoff);
    if (validIndex > 0) {
        notificationQueue.splice(0, validIndex);
    }
}

/**
 * Formatea mensaje para Telegram (Markdown)
 */
function formatMessage(title, description, fields = [], severity = 'medium') {
    const emoji = EVENT_EMOJIS[title] || EVENT_EMOJIS.DEFAULT;

    let message = `${emoji} *${title}*\n\n`;

    if (description) {
        message += `${description}\n\n`;
    }

    if (fields && fields.length > 0) {
        fields.forEach(field => {
            message += `*${field.name}:* ${field.value}\n`;
        });
        message += '\n';
    }

    // Footer con timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    message += `⏰ ${timestamp} UTC`;

    // Agregar severidad si es crítica o alta
    if (severity === 'critical') {
        message = `🚨 *CRÍTICO* 🚨\n\n${message}`;
    } else if (severity === 'high') {
        message = `⚠️ *ALTA PRIORIDAD* ⚠️\n\n${message}`;
    }

    return message;
}

/**
 * Envía notificación a Telegram
 */
async function sendTelegramNotification(title, description, fields = [], severity = 'medium') {
    // Verificar si Telegram está habilitado
    if (!TELEGRAM_CONFIG.ENABLED) {
        console.log('📱 Telegram notifications disabled');
        return { success: false, reason: 'disabled' };
    }

    // Verificar si hay chat_id configurado
    if (!TELEGRAM_CONFIG.CHAT_ID) {
        console.warn('⚠️ TELEGRAM_SECURITY_CHAT_ID not configured');
        return { success: false, reason: 'no_chat_id' };
    }

    // Verificar severidad mínima
    const eventSeverity = SEVERITY_LEVELS[severity] || SEVERITY_LEVELS.medium;
    const minSeverity = SEVERITY_LEVELS[TELEGRAM_CONFIG.MIN_SEVERITY] || SEVERITY_LEVELS.medium;

    if (eventSeverity < minSeverity) {
        return { success: false, reason: 'below_min_severity' };
    }

    // Verificar rate limiting
    if (!shouldSendNotification(title)) {
        console.log(`⏱️ Telegram rate limit: ${title} throttled`);
        return { success: false, reason: 'rate_limited' };
    }

    try {
        const message = formatMessage(title, description, fields, severity);

        const response = await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`,
            {
                chat_id: TELEGRAM_CONFIG.CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            },
            {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.ok) {
            recordNotification(title);

            // Auditar el envío
            audit('TELEGRAM_NOTIFICATION_SENT', 'system', 'telegram', 'notification', 'low', {
                title,
                severity,
                messageId: response.data.result.message_id
            });

            return { success: true, messageId: response.data.result.message_id };
        } else {
            console.error('❌ Telegram API error:', response.data);
            return { success: false, reason: 'api_error', error: response.data };
        }

    } catch (error) {
        console.error('❌ Error sending Telegram notification:', error.message);

        // Auditar el fallo
        audit('TELEGRAM_NOTIFICATION_FAILED', 'system', 'telegram', 'notification', 'low', {
            title,
            error: error.message
        });

        return { success: false, reason: 'network_error', error: error.message };
    }
}

/**
 * Funciones de conveniencia por severidad
 */

async function notifyLow(title, description, fields = []) {
    return sendTelegramNotification(title, description, fields, 'low');
}

async function notifyMedium(title, description, fields = []) {
    return sendTelegramNotification(title, description, fields, 'medium');
}

async function notifyHigh(title, description, fields = []) {
    return sendTelegramNotification(title, description, fields, 'high');
}

async function notifyCritical(title, description, fields = []) {
    return sendTelegramNotification(title, description, fields, 'critical');
}

/**
 * Funciones específicas por tipo de evento
 */

async function notifyPaymentSuccess(amount, currency, walletAddress, txHash) {
    return notifyMedium(
        'PAYMENT_SUCCESS',
        `Pago procesado exitosamente`,
        [
            { name: 'Monto', value: `${amount} ${currency}` },
            { name: 'Wallet', value: walletAddress.substring(0, 10) + '...' },
            { name: 'TX Hash', value: txHash ? txHash.substring(0, 16) + '...' : 'N/A' }
        ]
    );
}

async function notifyPaymentFailed(amount, currency, walletAddress, reason) {
    return notifyHigh(
        'PAYMENT_FAILED',
        `Error procesando pago`,
        [
            { name: 'Monto', value: `${amount} ${currency}` },
            { name: 'Wallet', value: walletAddress.substring(0, 10) + '...' },
            { name: 'Razón', value: reason }
        ]
    );
}

async function notifyLargeTransaction(amount, currency, from, to) {
    return notifyHigh(
        'LARGE_TRANSACTION',
        `Transacción de alto valor detectada`,
        [
            { name: 'Monto', value: `${amount} ${currency}` },
            { name: 'From', value: from.substring(0, 10) + '...' },
            { name: 'To', value: to.substring(0, 10) + '...' }
        ]
    );
}

async function notifySecurityAlert(alertType, description, details = {}) {
    return notifyCritical(
        alertType,
        description,
        Object.entries(details).map(([key, value]) => ({
            name: key,
            value: String(value)
        }))
    );
}

async function notifyServerError(errorType, errorMessage, stackTrace) {
    return notifyHigh(
        'SERVER_ERROR',
        `Error en el servidor: ${errorType}`,
        [
            { name: 'Error', value: errorMessage.substring(0, 100) },
            { name: 'Stack', value: stackTrace ? stackTrace.substring(0, 100) + '...' : 'N/A' }
        ]
    );
}

async function notifyDeployment(contractName, address, network) {
    return notifyMedium(
        'CONTRACT_DEPLOYED',
        `Nuevo contrato desplegado`,
        [
            { name: 'Contrato', value: contractName },
            { name: 'Address', value: address },
            { name: 'Network', value: network }
        ]
    );
}

/**
 * Test de notificación
 */
async function testTelegramNotification() {
    return notifyMedium(
        'TEST',
        '🧪 Test de notificación Telegram',
        [
            { name: 'Status', value: 'Sistema de alertas funcionando' },
            { name: 'Timestamp', value: new Date().toISOString() }
        ]
    );
}

module.exports = {
    // Core
    sendTelegramNotification,

    // Por severidad
    notifyLow,
    notifyMedium,
    notifyHigh,
    notifyCritical,

    // Eventos específicos
    notifyPaymentSuccess,
    notifyPaymentFailed,
    notifyLargeTransaction,
    notifySecurityAlert,
    notifyServerError,
    notifyDeployment,

    // Testing
    testTelegramNotification,

    // Config
    TELEGRAM_CONFIG
};
