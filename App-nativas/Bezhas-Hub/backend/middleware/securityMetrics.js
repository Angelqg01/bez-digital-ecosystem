/**
 * ============================================================================
 * SECURITY METRICS - Prometheus Integration
 * ============================================================================
 * 
 * Sistema de métricas de seguridad para monitoreo en tiempo real:
 * - Contadores de eventos de seguridad
 * - Histogramas de latencia
 * - Gauges de estado del sistema
 * - Métricas exportables a Prometheus/Grafana
 */

const promClient = require('prom-client');

// Registro de métricas
const register = new promClient.Registry();

// Labels por defecto
register.setDefaultLabels({
    app: 'bezhas-backend',
    environment: process.env.NODE_ENV || 'development'
});

// Habilitar métricas por defecto (CPU, memoria, etc.)
promClient.collectDefaultMetrics({ register });

// ============================================================================
// CONTADORES DE SEGURIDAD
// ============================================================================

/**
 * Contador de intentos de autenticación
 */
const authAttemptsCounter = new promClient.Counter({
    name: 'auth_attempts_total',
    help: 'Total authentication attempts',
    labelNames: ['status', 'method', 'user_type'],
    registers: [register]
});

/**
 * Contador de eventos de seguridad
 */
const securityEventsCounter = new promClient.Counter({
    name: 'security_events_total',
    help: 'Total security events detected',
    labelNames: ['event_type', 'severity', 'outcome'],
    registers: [register]
});

/**
 * Contador de violaciones de rate limit
 */
const rateLimitViolationsCounter = new promClient.Counter({
    name: 'rate_limit_violations_total',
    help: 'Total rate limit violations',
    labelNames: ['endpoint', 'user_id', 'violation_type'],
    registers: [register]
});

/**
 * Contador de tokens revocados
 */
const tokensRevokedCounter = new promClient.Counter({
    name: 'tokens_revoked_total',
    help: 'Total tokens revoked',
    labelNames: ['reason', 'token_type'],
    registers: [register]
});

/**
 * Contador de pagos
 */
const paymentsCounter = new promClient.Counter({
    name: 'payments_total',
    help: 'Total payment attempts',
    labelNames: ['status', 'payment_type', 'currency'],
    registers: [register]
});

/**
 * Contador de cifrado/descifrado
 */
const encryptionCounter = new promClient.Counter({
    name: 'encryption_operations_total',
    help: 'Total encryption/decryption operations',
    labelNames: ['operation', 'field_type', 'status'],
    registers: [register]
});

/**
 * Contador de notificaciones Discord
 */
const discordNotificationsCounter = new promClient.Counter({
    name: 'discord_notifications_total',
    help: 'Total Discord notifications sent',
    labelNames: ['event_type', 'severity', 'status'],
    registers: [register]
});

// ============================================================================
// HISTOGRAMAS (LATENCIA)
// ============================================================================

/**
 * Histograma de latencia de autenticación
 */
const authLatencyHistogram = new promClient.Histogram({
    name: 'auth_duration_seconds',
    help: 'Authentication request duration in seconds',
    labelNames: ['method', 'status'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5],
    registers: [register]
});

/**
 * Histograma de latencia de cifrado
 */
const encryptionLatencyHistogram = new promClient.Histogram({
    name: 'encryption_duration_seconds',
    help: 'Encryption operation duration in seconds',
    labelNames: ['operation', 'field_count'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register]
});

/**
 * Histograma de latencia de pagos
 */
const paymentLatencyHistogram = new promClient.Histogram({
    name: 'payment_duration_seconds',
    help: 'Payment processing duration in seconds',
    labelNames: ['payment_type', 'status'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [register]
});

// ============================================================================
// GAUGES (ESTADO ACTUAL)
// ============================================================================

/**
 * Gauge de sesiones activas
 */
const activeSessionsGauge = new promClient.Gauge({
    name: 'active_sessions_current',
    help: 'Current number of active user sessions',
    labelNames: ['user_type'],
    registers: [register]
});

/**
 * Gauge de usuarios baneados
 */
const bannedUsersGauge = new promClient.Gauge({
    name: 'banned_users_current',
    help: 'Current number of banned users',
    registers: [register]
});

/**
 * Gauge de penalizaciones activas
 */
const activePenaltiesGauge = new promClient.Gauge({
    name: 'active_penalties_current',
    help: 'Current number of active rate limit penalties',
    registers: [register]
});

/**
 * Gauge de claves de cifrado
 */
const encryptionKeysGauge = new promClient.Gauge({
    name: 'encryption_keys_current',
    help: 'Current number of encryption keys',
    labelNames: ['status'],
    registers: [register]
});

/**
 * Gauge de health del sistema
 */
const systemHealthGauge = new promClient.Gauge({
    name: 'system_health_score',
    help: 'Overall system health score (0-100)',
    registers: [register]
});

// ============================================================================
// FUNCIONES DE TRACKING
// ============================================================================

/**
 * Trackear intento de autenticación
 */
function trackAuthAttempt(status, method, userType = 'user') {
    authAttemptsCounter.inc({
        status,      // 'success' | 'failure' | '2fa_required'
        method,      // 'wallet' | 'email' | 'oauth'
        user_type: userType
    });
}

/**
 * Trackear evento de seguridad
 */
function trackSecurityEvent(eventType, severity, outcome = 'detected') {
    securityEventsCounter.inc({
        event_type: eventType,  // 'token_reuse' | 'brute_force' | 'suspicious_activity'
        severity,               // 'low' | 'medium' | 'high' | 'critical'
        outcome                 // 'detected' | 'blocked' | 'resolved'
    });
}

/**
 * Trackear violación de rate limit
 */
function trackRateLimitViolation(endpoint, userId, violationType) {
    rateLimitViolationsCounter.inc({
        endpoint,
        user_id: userId || 'anonymous',
        violation_type: violationType  // 'base' | 'burst' | 'hourly' | 'model'
    });
}

/**
 * Trackear token revocado
 */
function trackTokenRevoked(reason, tokenType = 'refresh') {
    tokensRevokedCounter.inc({
        reason,      // 'reuse' | 'max_devices' | 'manual' | 'expired'
        token_type: tokenType
    });
}

/**
 * Trackear pago
 */
function trackPayment(status, paymentType, currency = 'usd') {
    paymentsCounter.inc({
        status,       // 'success' | 'failed' | 'pending' | 'refunded'
        payment_type: paymentType,  // 'nft' | 'subscription' | 'tokens'
        currency
    });
}

/**
 * Trackear operación de cifrado
 */
function trackEncryption(operation, fieldType, status = 'success') {
    encryptionCounter.inc({
        operation,   // 'encrypt' | 'decrypt' | 'hash' | 'verify'
        field_type: fieldType,  // 'email' | 'phone' | 'address' | 'payment'
        status       // 'success' | 'failure'
    });
}

/**
 * Trackear notificación Discord
 */
function trackDiscordNotification(eventType, severity, status = 'sent') {
    discordNotificationsCounter.inc({
        event_type: eventType,
        severity,
        status  // 'sent' | 'rate_limited' | 'failed'
    });
}

/**
 * Medir latencia de autenticación
 */
function measureAuthLatency(method, status, durationSeconds) {
    authLatencyHistogram.observe({ method, status }, durationSeconds);
}

/**
 * Medir latencia de cifrado
 */
function measureEncryptionLatency(operation, fieldCount, durationSeconds) {
    encryptionLatencyHistogram.observe({
        operation,
        field_count: fieldCount.toString()
    }, durationSeconds);
}

/**
 * Medir latencia de pago
 */
function measurePaymentLatency(paymentType, status, durationSeconds) {
    paymentLatencyHistogram.observe({ payment_type: paymentType, status }, durationSeconds);
}

/**
 * Actualizar sesiones activas
 */
function updateActiveSessions(count, userType = 'user') {
    activeSessionsGauge.set({ user_type: userType }, count);
}

/**
 * Actualizar usuarios baneados
 */
function updateBannedUsers(count) {
    bannedUsersGauge.set(count);
}

/**
 * Actualizar penalizaciones activas
 */
function updateActivePenalties(count) {
    activePenaltiesGauge.set(count);
}

/**
 * Actualizar claves de cifrado
 */
function updateEncryptionKeys(activeCount, deprecatedCount) {
    encryptionKeysGauge.set({ status: 'active' }, activeCount);
    encryptionKeysGauge.set({ status: 'deprecated' }, deprecatedCount);
}

/**
 * Actualizar health score del sistema
 */
function updateSystemHealth(score) {
    systemHealthGauge.set(score);
}

// ============================================================================
// ENDPOINT DE MÉTRICAS
// ============================================================================

/**
 * Middleware para exponer métricas a Prometheus
 */
async function metricsEndpoint(req, res) {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        res.status(500).end(error);
    }
}

/**
 * Obtener snapshot de métricas en formato JSON
 */
async function getMetricsSnapshot() {
    const metrics = await register.getMetricsAsJSON();

    return {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        metrics: metrics.map(metric => ({
            name: metric.name,
            type: metric.type,
            help: metric.help,
            values: metric.values
        }))
    };
}

/**
 * Calcular score de seguridad basado en métricas
 */
async function calculateSecurityScore() {
    const metrics = await register.getMetricsAsJSON();

    // Obtener contadores relevantes
    const authFailures = getMetricValue(metrics, 'auth_attempts_total', { status: 'failure' });
    const authSuccesses = getMetricValue(metrics, 'auth_attempts_total', { status: 'success' });
    const securityEvents = getMetricValue(metrics, 'security_events_total');
    const rateLimitViolations = getMetricValue(metrics, 'rate_limit_violations_total');
    const tokensRevoked = getMetricValue(metrics, 'tokens_revoked_total');

    // Calcular score (100 = perfecto, 0 = crítico)
    let score = 100;

    // Penalizar por fallos de autenticación (max -20 puntos)
    const authFailureRate = authSuccesses > 0 ? authFailures / authSuccesses : 0;
    score -= Math.min(20, authFailureRate * 100);

    // Penalizar por eventos de seguridad críticos (max -30 puntos)
    const criticalEvents = getMetricValue(metrics, 'security_events_total', { severity: 'critical' });
    score -= Math.min(30, criticalEvents * 5);

    // Penalizar por violaciones de rate limit (max -20 puntos)
    score -= Math.min(20, rateLimitViolations * 0.5);

    // Penalizar por tokens revocados por reuso (max -30 puntos)
    const reuseRevocations = getMetricValue(metrics, 'tokens_revoked_total', { reason: 'reuse' });
    score -= Math.min(30, reuseRevocations * 10);

    return Math.max(0, Math.round(score));
}

/**
 * Helper para obtener valor de métrica
 */
function getMetricValue(metrics, metricName, labels = {}) {
    const metric = metrics.find(m => m.name === metricName);
    if (!metric || !metric.values) return 0;

    // Si no hay labels, sumar todos los valores
    if (Object.keys(labels).length === 0) {
        return metric.values.reduce((sum, v) => sum + (v.value || 0), 0);
    }

    // Buscar valor con labels específicos
    const matchingValue = metric.values.find(v => {
        if (!v.labels) return false;
        return Object.keys(labels).every(key => v.labels[key] === labels[key]);
    });

    return matchingValue ? matchingValue.value : 0;
}

/**
 * Resetear todas las métricas (solo para testing)
 */
function resetMetrics() {
    register.resetMetrics();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    register,

    // Tracking functions
    trackAuthAttempt,
    trackSecurityEvent,
    trackRateLimitViolation,
    trackTokenRevoked,
    trackPayment,
    trackEncryption,
    trackDiscordNotification,

    // Measurement functions
    measureAuthLatency,
    measureEncryptionLatency,
    measurePaymentLatency,

    // Gauge updates
    updateActiveSessions,
    updateBannedUsers,
    updateActivePenalties,
    updateEncryptionKeys,
    updateSystemHealth,

    // Endpoints
    metricsEndpoint,
    getMetricsSnapshot,
    calculateSecurityScore,

    // Testing
    resetMetrics
};
