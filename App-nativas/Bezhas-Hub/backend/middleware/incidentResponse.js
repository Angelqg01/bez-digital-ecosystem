/**
 * ============================================================================
 * INCIDENT RESPONSE AUTOMATION
 * ============================================================================
 * 
 * Sistema automatizado de respuesta a incidentes de seguridad:
 * - Detección automática de amenazas
 * - Bloqueo de IPs sospechosas
 * - Lockdown de cuentas comprometidas
 * - Escalación automática
 * - Forensic logging
 */

const { audit } = require('./auditLogger');
const { notifyCritical, notifyHigh } = require('./discordNotifier');

// Store de incidentes activos
const activeIncidents = new Map();
const blockedIPs = new Set();
const lockedAccounts = new Map();
const threatScores = new Map();

// Configuración
const INCIDENT_CONFIG = {
    // Umbrales de detección
    BRUTE_FORCE_THRESHOLD: 5,        // 5 intentos fallidos
    BRUTE_FORCE_WINDOW: 300000,      // 5 minutos

    RATE_LIMIT_THRESHOLD: 10,        // 10 violaciones
    RATE_LIMIT_WINDOW: 600000,       // 10 minutos

    SUSPICIOUS_ACTIVITY_THRESHOLD: 3, // 3 eventos sospechosos
    SUSPICIOUS_WINDOW: 900000,       // 15 minutos

    // Duraciones de bloqueo
    IP_BLOCK_DURATION: 3600000,      // 1 hora
    ACCOUNT_LOCK_DURATION: 1800000,  // 30 minutos
    PERMANENT_BAN_THRESHOLD: 3,      // 3 incidentes = ban permanente

    // Forensics
    ENABLE_FORENSICS: true,
    FORENSIC_RETENTION_DAYS: 90
};

/**
 * Tipos de incidentes
 */
const INCIDENT_TYPES = {
    BRUTE_FORCE: 'brute_force_attack',
    TOKEN_REUSE: 'token_reuse_detected',
    RATE_LIMIT_ABUSE: 'rate_limit_abuse',
    SUSPICIOUS_LOCATION: 'suspicious_location',
    CREDENTIAL_STUFFING: 'credential_stuffing',
    SQL_INJECTION: 'sql_injection_attempt',
    XSS_ATTEMPT: 'xss_attempt',
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    DATA_EXFILTRATION: 'data_exfiltration_attempt',
    ACCOUNT_TAKEOVER: 'account_takeover'
};

/**
 * Niveles de severidad de incidentes
 */
const SEVERITY_LEVELS = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4
};

// ============================================================================
// DETECCIÓN DE AMENAZAS
// ============================================================================

/**
 * Detectar ataque de fuerza bruta
 */
function detectBruteForce(userId, ip) {
    const key = `brute_force:${userId || ip}`;
    const attempts = threatScores.get(key) || [];
    const now = Date.now();

    // Limpiar intentos antiguos
    const recentAttempts = attempts.filter(
        timestamp => now - timestamp < INCIDENT_CONFIG.BRUTE_FORCE_WINDOW
    );

    // Agregar nuevo intento
    recentAttempts.push(now);
    threatScores.set(key, recentAttempts);

    // Verificar umbral
    if (recentAttempts.length >= INCIDENT_CONFIG.BRUTE_FORCE_THRESHOLD) {
        return createIncident(
            INCIDENT_TYPES.BRUTE_FORCE,
            SEVERITY_LEVELS.HIGH,
            {
                userId,
                ip,
                attempts: recentAttempts.length,
                window: INCIDENT_CONFIG.BRUTE_FORCE_WINDOW / 1000
            }
        );
    }

    return null;
}

/**
 * Detectar abuso de rate limiting
 */
function detectRateLimitAbuse(userId, endpoint) {
    const key = `rate_abuse:${userId}:${endpoint}`;
    const violations = threatScores.get(key) || [];
    const now = Date.now();

    // Limpiar violaciones antiguas
    const recentViolations = violations.filter(
        timestamp => now - timestamp < INCIDENT_CONFIG.RATE_LIMIT_WINDOW
    );

    // Agregar nueva violación
    recentViolations.push(now);
    threatScores.set(key, recentViolations);

    // Verificar umbral
    if (recentViolations.length >= INCIDENT_CONFIG.RATE_LIMIT_THRESHOLD) {
        return createIncident(
            INCIDENT_TYPES.RATE_LIMIT_ABUSE,
            SEVERITY_LEVELS.MEDIUM,
            {
                userId,
                endpoint,
                violations: recentViolations.length
            }
        );
    }

    return null;
}

/**
 * Detectar actividad sospechosa
 */
function detectSuspiciousActivity(userId, activityType, details) {
    const key = `suspicious:${userId}`;
    const activities = threatScores.get(key) || [];
    const now = Date.now();

    // Limpiar actividades antiguas
    const recentActivities = activities.filter(
        item => now - item.timestamp < INCIDENT_CONFIG.SUSPICIOUS_WINDOW
    );

    // Agregar nueva actividad
    recentActivities.push({ timestamp: now, type: activityType, details });
    threatScores.set(key, recentActivities);

    // Verificar umbral
    if (recentActivities.length >= INCIDENT_CONFIG.SUSPICIOUS_ACTIVITY_THRESHOLD) {
        return createIncident(
            activityType,
            SEVERITY_LEVELS.HIGH,
            {
                userId,
                activities: recentActivities.map(a => a.type),
                details
            }
        );
    }

    return null;
}

/**
 * Detectar intento de SQL injection
 */
function detectSQLInjection(input, userId, ip) {
    const sqlPatterns = [
        /(\bUNION\b.*\bSELECT\b)/i,
        /(\bOR\b.*=.*)/i,
        /(\bAND\b.*=.*)/i,
        /(';.*--)/i,
        /(\bDROP\b.*\bTABLE\b)/i,
        /(\bINSERT\b.*\bINTO\b)/i,
        /(\bDELETE\b.*\bFROM\b)/i
    ];

    for (const pattern of sqlPatterns) {
        if (pattern.test(input)) {
            return createIncident(
                INCIDENT_TYPES.SQL_INJECTION,
                SEVERITY_LEVELS.CRITICAL,
                {
                    userId,
                    ip,
                    input: input.substring(0, 100), // Primeros 100 caracteres
                    pattern: pattern.toString()
                }
            );
        }
    }

    return null;
}

/**
 * Detectar intento de XSS
 */
function detectXSSAttempt(input, userId, ip) {
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=\s*["'][^"']*["']/gi,
        /<iframe/gi,
        /onerror\s*=/gi
    ];

    for (const pattern of xssPatterns) {
        if (pattern.test(input)) {
            return createIncident(
                INCIDENT_TYPES.XSS_ATTEMPT,
                SEVERITY_LEVELS.HIGH,
                {
                    userId,
                    ip,
                    input: input.substring(0, 100),
                    pattern: pattern.toString()
                }
            );
        }
    }

    return null;
}

// ============================================================================
// GESTIÓN DE INCIDENTES
// ============================================================================

/**
 * Crear nuevo incidente
 */
function createIncident(type, severity, data) {
    const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const incident = {
        id: incidentId,
        type,
        severity,
        status: 'active',
        data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        responseActions: []
    };

    activeIncidents.set(incidentId, incident);

    // Log forensic
    if (INCIDENT_CONFIG.ENABLE_FORENSICS) {
        logForensic(incident);
    }

    // Audit log
    audit.security('INCIDENT_CREATED', getSeverityName(severity), {
        incidentId,
        type,
        ...data
    });

    // Auto-responder
    respondToIncident(incident);

    return incident;
}

/**
 * Responder automáticamente a incidente
 */
async function respondToIncident(incident) {
    const actions = [];

    switch (incident.type) {
        case INCIDENT_TYPES.BRUTE_FORCE:
            // Bloquear IP
            if (incident.data.ip) {
                await blockIP(incident.data.ip, INCIDENT_CONFIG.IP_BLOCK_DURATION);
                actions.push({ type: 'ip_blocked', target: incident.data.ip });
            }

            // Lockdown de cuenta
            if (incident.data.userId) {
                await lockAccount(incident.data.userId, INCIDENT_CONFIG.ACCOUNT_LOCK_DURATION, 'brute_force');
                actions.push({ type: 'account_locked', target: incident.data.userId });
            }

            // Notificar Discord
            await notifyHigh('BRUTE_FORCE_DETECTED', {
                incidentId: incident.id,
                userId: incident.data.userId,
                ip: incident.data.ip,
                attempts: incident.data.attempts
            });

            break;

        case INCIDENT_TYPES.TOKEN_REUSE:
            // Lockdown inmediato
            if (incident.data.userId) {
                await lockAccount(incident.data.userId, INCIDENT_CONFIG.ACCOUNT_LOCK_DURATION, 'token_reuse');
                actions.push({ type: 'account_locked', target: incident.data.userId });
            }

            // Notificar crítico
            await notifyCritical('TOKEN_REUSE_INCIDENT', {
                incidentId: incident.id,
                userId: incident.data.userId,
                familyId: incident.data.familyId
            });

            break;

        case INCIDENT_TYPES.RATE_LIMIT_ABUSE:
            // Penalty temporal
            if (incident.data.userId) {
                await lockAccount(incident.data.userId, 600000, 'rate_abuse'); // 10 minutos
                actions.push({ type: 'temporary_ban', target: incident.data.userId });
            }
            break;

        case INCIDENT_TYPES.SQL_INJECTION:
        case INCIDENT_TYPES.XSS_ATTEMPT:
            // Bloqueo inmediato de IP
            if (incident.data.ip) {
                await blockIP(incident.data.ip, INCIDENT_CONFIG.IP_BLOCK_DURATION * 24); // 24 horas
                actions.push({ type: 'ip_blocked_extended', target: incident.data.ip });
            }

            // Ban permanente de usuario
            if (incident.data.userId) {
                await permanentBan(incident.data.userId, incident.type);
                actions.push({ type: 'permanent_ban', target: incident.data.userId });
            }

            // Alerta crítica
            await notifyCritical('INJECTION_ATTEMPT', {
                incidentId: incident.id,
                type: incident.type,
                userId: incident.data.userId,
                ip: incident.data.ip
            });

            break;

        case INCIDENT_TYPES.SUSPICIOUS_LOCATION:
            // Requerir re-autenticación
            if (incident.data.userId) {
                actions.push({ type: 'require_reauth', target: incident.data.userId });
            }
            break;
    }

    // Actualizar incidente con acciones tomadas
    incident.responseActions = actions;
    incident.updatedAt = Date.now();
    activeIncidents.set(incident.id, incident);

    audit.security('INCIDENT_RESPONSE', getSeverityName(incident.severity), {
        incidentId: incident.id,
        actions: actions.map(a => a.type)
    });
}

// ============================================================================
// ACCIONES DE RESPUESTA
// ============================================================================

/**
 * Bloquear IP
 */
async function blockIP(ip, duration) {
    blockedIPs.add(ip);

    // Auto-desbloquear después de duración
    if (duration > 0) {
        setTimeout(() => {
            blockedIPs.delete(ip);
            audit.security('IP_UNBLOCKED', 'info', { ip });
        }, duration);
    }

    audit.security('IP_BLOCKED', 'high', {
        ip,
        duration: duration / 1000,
        reason: 'automated_incident_response'
    });

    return { success: true, ip, duration };
}

/**
 * Verificar si IP está bloqueada
 */
function isIPBlocked(ip) {
    return blockedIPs.has(ip);
}

/**
 * Lockdown de cuenta
 */
async function lockAccount(userId, duration, reason) {
    const lockEnd = Date.now() + duration;

    lockedAccounts.set(userId, {
        lockedAt: Date.now(),
        lockEnd,
        reason,
        incidentCount: (lockedAccounts.get(userId)?.incidentCount || 0) + 1
    });

    // Auto-unlock después de duración
    if (duration > 0) {
        setTimeout(() => {
            lockedAccounts.delete(userId);
            audit.security('ACCOUNT_UNLOCKED', 'info', { userId });
        }, duration);
    }

    audit.security('ACCOUNT_LOCKED', 'high', {
        userId,
        duration: duration / 1000,
        reason
    });

    // Verificar si debe ser ban permanente
    const lockInfo = lockedAccounts.get(userId);
    if (lockInfo.incidentCount >= INCIDENT_CONFIG.PERMANENT_BAN_THRESHOLD) {
        await permanentBan(userId, 'repeated_incidents');
    }

    return { success: true, userId, lockEnd };
}

/**
 * Verificar si cuenta está bloqueada
 */
function isAccountLocked(userId) {
    const lockInfo = lockedAccounts.get(userId);
    if (!lockInfo) return false;

    // Verificar si expiró
    if (Date.now() > lockInfo.lockEnd) {
        lockedAccounts.delete(userId);
        return false;
    }

    return true;
}

/**
 * Ban permanente
 */
async function permanentBan(userId, reason) {
    lockedAccounts.set(userId, {
        lockedAt: Date.now(),
        lockEnd: Infinity,
        reason: `permanent_ban_${reason}`,
        permanent: true
    });

    audit.security('PERMANENT_BAN', 'critical', {
        userId,
        reason
    });

    await notifyCritical('PERMANENT_BAN_ISSUED', {
        userId,
        reason,
        timestamp: new Date().toISOString()
    });

    return { success: true, userId, permanent: true };
}

/**
 * Desbloquear manualmente (admin)
 */
function unlockAccount(userId, adminId) {
    const wasLocked = lockedAccounts.has(userId);
    lockedAccounts.delete(userId);

    if (wasLocked) {
        audit.admin('ACCOUNT_MANUALLY_UNLOCKED', 'medium', {
            userId,
            adminId
        });
    }

    return { success: wasLocked, userId };
}

/**
 * Desbloquear IP manualmente (admin)
 */
function unblockIP(ip, adminId) {
    const wasBlocked = blockedIPs.has(ip);
    blockedIPs.delete(ip);

    if (wasBlocked) {
        audit.admin('IP_MANUALLY_UNBLOCKED', 'medium', {
            ip,
            adminId
        });
    }

    return { success: wasBlocked, ip };
}

// ============================================================================
// FORENSICS
// ============================================================================

/**
 * Log forensic de incidente
 */
function logForensic(incident) {
    const forensicLog = {
        timestamp: new Date().toISOString(),
        incidentId: incident.id,
        type: incident.type,
        severity: getSeverityName(incident.severity),
        data: incident.data,
        environment: {
            nodeEnv: process.env.NODE_ENV,
            serverTime: Date.now(),
            serverVersion: process.version
        }
    };

    // En producción, esto debería ir a un sistema de logging dedicado
    // como CloudWatch, DataDog, o un SIEM
    console.log('[FORENSIC]', JSON.stringify(forensicLog, null, 2));

    audit.security('FORENSIC_LOG_CREATED', 'info', {
        incidentId: incident.id
    });
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Obtener nombre de severidad
 */
function getSeverityName(level) {
    const names = Object.entries(SEVERITY_LEVELS).find(([_, val]) => val === level);
    return names ? names[0].toLowerCase() : 'unknown';
}

/**
 * Obtener todos los incidentes activos
 */
function getActiveIncidents() {
    return Array.from(activeIncidents.values());
}

/**
 * Obtener incidente por ID
 */
function getIncident(incidentId) {
    return activeIncidents.get(incidentId);
}

/**
 * Resolver incidente
 */
function resolveIncident(incidentId, resolution) {
    const incident = activeIncidents.get(incidentId);
    if (!incident) return null;

    incident.status = 'resolved';
    incident.resolution = resolution;
    incident.resolvedAt = Date.now();

    activeIncidents.set(incidentId, incident);

    audit.security('INCIDENT_RESOLVED', 'info', {
        incidentId,
        resolution
    });

    return incident;
}

/**
 * Obtener estadísticas de seguridad
 */
function getSecurityStats() {
    const incidents = Array.from(activeIncidents.values());

    return {
        activeIncidents: incidents.filter(i => i.status === 'active').length,
        resolvedIncidents: incidents.filter(i => i.status === 'resolved').length,
        criticalIncidents: incidents.filter(i => i.severity === SEVERITY_LEVELS.CRITICAL).length,
        blockedIPs: blockedIPs.size,
        lockedAccounts: lockedAccounts.size,
        permanentBans: Array.from(lockedAccounts.values()).filter(l => l.permanent).length,
        incidentsByType: incidents.reduce((acc, inc) => {
            acc[inc.type] = (acc[inc.type] || 0) + 1;
            return acc;
        }, {})
    };
}

module.exports = {
    // Detection
    detectBruteForce,
    detectRateLimitAbuse,
    detectSuspiciousActivity,
    detectSQLInjection,
    detectXSSAttempt,

    // Incident management
    createIncident,
    respondToIncident,
    getIncident,
    getActiveIncidents,
    resolveIncident,

    // Response actions
    blockIP,
    isIPBlocked,
    lockAccount,
    isAccountLocked,
    permanentBan,
    unlockAccount,
    unblockIP,

    // Stats
    getSecurityStats,

    // Constants
    INCIDENT_TYPES,
    SEVERITY_LEVELS,
    INCIDENT_CONFIG
};
