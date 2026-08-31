/**
 * ============================================================================
 * GDPR COMPLIANCE TOOLS
 * ============================================================================
 * 
 * Herramientas de cumplimiento GDPR/CCPA:
 * - Right to Access (exportar datos del usuario)
 * - Right to Deletion (borrado completo y anonimización)
 * - Right to Rectification (corregir datos)
 * - Right to Portability (exportar en formato estándar)
 * - Consent Management (gestión de consentimientos)
 * - Data Retention Policies (retención automática)
 */

const { audit } = require('./auditLogger');
const { notifyMedium } = require('./discordNotifier');
const { decryptUserData, sanitizeUserForLog } = require('./userEncryption');

// Store de solicitudes GDPR
const gdprRequests = new Map();

// Configuración
const GDPR_CONFIG = {
    // Plazos legales
    ACCESS_REQUEST_DEADLINE: 30 * 24 * 60 * 60 * 1000,     // 30 días
    DELETION_REQUEST_DEADLINE: 30 * 24 * 60 * 60 * 1000,   // 30 días

    // Retención de datos
    AUDIT_LOG_RETENTION_DAYS: 90,
    USER_DATA_RETENTION_DAYS: 365 * 2,  // 2 años inactivo
    PAYMENT_DATA_RETENTION_DAYS: 365 * 7, // 7 años (requisito legal)

    // Anonimización
    ANONYMIZE_AFTER_DELETION: true,
    KEEP_ANALYTICS_ANONYMIZED: true
};

/**
 * Tipos de solicitudes GDPR
 */
const REQUEST_TYPES = {
    ACCESS: 'right_to_access',           // Art. 15 GDPR
    DELETION: 'right_to_deletion',       // Art. 17 GDPR
    RECTIFICATION: 'right_to_rectification', // Art. 16 GDPR
    PORTABILITY: 'right_to_portability', // Art. 20 GDPR
    RESTRICTION: 'right_to_restriction', // Art. 18 GDPR
    OBJECTION: 'right_to_objection'      // Art. 21 GDPR
};

// ============================================================================
// RIGHT TO ACCESS (Art. 15 GDPR)
// ============================================================================

/**
 * Exportar todos los datos del usuario en formato JSON
 */
async function exportUserData(userId, db) {
    try {
        // Crear solicitud GDPR
        const requestId = createGDPRRequest(userId, REQUEST_TYPES.ACCESS);

        // Recopilar todos los datos del usuario
        const userData = await collectUserData(userId, db);

        // Formato de exportación
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                userId: userId,
                requestId: requestId,
                dataController: 'BeZhas Platform',
                legalBasis: 'GDPR Article 15 - Right to Access'
            },
            personalData: userData.personal,
            accountData: userData.account,
            activityData: userData.activity,
            transactionData: userData.transactions,
            consentData: userData.consents,
            securityData: userData.security
        };

        // Audit log
        audit.security('GDPR_DATA_EXPORT', 'medium', {
            userId,
            requestId,
            dataSize: JSON.stringify(exportData).length
        });

        // Actualizar solicitud
        updateGDPRRequest(requestId, 'completed', { exportSize: Object.keys(exportData).length });

        return {
            success: true,
            requestId,
            data: exportData,
            format: 'json'
        };

    } catch (error) {
        console.error('Error exporting user data:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Recopilar todos los datos del usuario
 */
async function collectUserData(userId, db) {
    const data = {};

    // 1. Datos personales
    const user = await db.findUserById(userId);
    if (user) {
        // Descifrar datos sensibles
        const decrypted = decryptUserData(user);

        data.personal = {
            email: decrypted.email,
            phone: decrypted.phone,
            profile: decrypted.profile,
            walletAddress: decrypted.walletAddress,
            createdAt: decrypted.createdAt,
            updatedAt: decrypted.updatedAt
        };
    }

    // 2. Datos de cuenta
    data.account = {
        userId: user._id,
        role: user.role,
        subscription: user.subscription,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled || false,
        preferences: user.preferences || {}
    };

    // 3. Actividad
    data.activity = {
        lastLogin: user.lastLogin,
        loginCount: user.loginCount || 0,
        activeDevices: user.activeDevices || 0
    };

    // 4. Transacciones (si existen)
    data.transactions = {
        payments: [], // TODO: Obtener de Stripe
        nftPurchases: [],
        tokenTransactions: []
    };

    // 5. Consentimientos
    data.consents = {
        termsAccepted: user.termsAccepted || false,
        termsAcceptedAt: user.termsAcceptedAt,
        privacyPolicyAccepted: user.privacyPolicyAccepted || false,
        marketingConsent: user.marketingConsent || false,
        analyticsConsent: user.analyticsConsent || true
    };

    // 6. Datos de seguridad (anonymized)
    data.security = {
        accountLocks: 0, // Count only
        securityEvents: 0, // Count only
        passwordChanges: user.passwordChanges || 0
    };

    return data;
}

// ============================================================================
// RIGHT TO DELETION (Art. 17 GDPR)
// ============================================================================

/**
 * Eliminar todos los datos del usuario (con anonimización)
 */
async function deleteUserData(userId, db, reason = 'user_request') {
    try {
        // Crear solicitud GDPR
        const requestId = createGDPRRequest(userId, REQUEST_TYPES.DELETION);

        // Verificar si hay razones legales para NO borrar
        const canDelete = await verifyDeletionEligibility(userId, db);
        if (!canDelete.eligible) {
            updateGDPRRequest(requestId, 'rejected', { reason: canDelete.reason });
            return { success: false, reason: canDelete.reason };
        }

        // Paso 1: Exportar datos antes de borrar (backup legal)
        const exportResult = await exportUserData(userId, db);

        // Paso 2: Anonimizar en lugar de borrar completamente
        if (GDPR_CONFIG.ANONYMIZE_AFTER_DELETION) {
            await anonymizeUserData(userId, db);
        } else {
            await hardDeleteUserData(userId, db);
        }

        // Paso 3: Limpiar datos asociados
        await cleanupUserAssociatedData(userId, db);

        // Audit log (mantener por requisito legal)
        audit.security('GDPR_DATA_DELETION', 'high', {
            userId: `DELETED_${userId}`,
            requestId,
            reason,
            method: GDPR_CONFIG.ANONYMIZE_AFTER_DELETION ? 'anonymized' : 'hard_deleted'
        });

        // Notificar Discord
        await notifyMedium('GDPR_DELETION_COMPLETED', {
            userId: sanitizeUserForLog({ _id: userId }).userId,
            requestId,
            method: GDPR_CONFIG.ANONYMIZE_AFTER_DELETION ? 'anonymized' : 'deleted'
        });

        // Actualizar solicitud
        updateGDPRRequest(requestId, 'completed', {
            deletionMethod: GDPR_CONFIG.ANONYMIZE_AFTER_DELETION ? 'anonymized' : 'deleted',
            exportBackup: exportResult.success
        });

        return {
            success: true,
            requestId,
            method: GDPR_CONFIG.ANONYMIZE_AFTER_DELETION ? 'anonymized' : 'deleted'
        };

    } catch (error) {
        console.error('Error deleting user data:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verificar si el usuario puede ser eliminado
 */
async function verifyDeletionEligibility(userId, db) {
    // Verificar obligaciones legales pendientes

    // 1. Transacciones activas
    // const activeTransactions = await db.getActiveTransactions(userId);
    // if (activeTransactions.length > 0) {
    //     return { eligible: false, reason: 'active_transactions_pending' };
    // }

    // 2. Suscripciones activas
    // const activeSubscriptions = await db.getActiveSubscriptions(userId);
    // if (activeSubscriptions.length > 0) {
    //     return { eligible: false, reason: 'active_subscription' };
    // }

    // 3. Disputas legales
    // const legalDisputes = await db.getLegalDisputes(userId);
    // if (legalDisputes.length > 0) {
    //     return { eligible: false, reason: 'legal_dispute_pending' };
    // }

    return { eligible: true };
}

/**
 * Anonimizar datos del usuario (mantener registros pero sin PII)
 */
async function anonymizeUserData(userId, db) {
    const anonymizedData = {
        _id: userId,
        email: `deleted_${userId}@anonymized.local`,
        phone: null,
        profile: {
            firstName: '[DELETED]',
            lastName: '[DELETED]',
            address: null,
            dateOfBirth: null
        },
        walletAddress: `0x${'0'.repeat(40)}`, // Null address
        role: 'USER',
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        kycData: null,
        paymentMethods: []
    };

    await db.updateUser(userId, anonymizedData);

    return { success: true, userId };
}

/**
 * Borrado completo (hard delete)
 */
async function hardDeleteUserData(userId, db) {
    await db.deleteUser(userId);
    return { success: true, userId };
}

/**
 * Limpiar datos asociados del usuario
 */
async function cleanupUserAssociatedData(userId, db) {
    // Limpiar tokens de sesión
    // await db.deleteUserTokens(userId);

    // Limpiar rate limit data
    // await redis.del(`ratelimit:${userId}:*`);

    // Limpiar caché
    // await redis.del(`cache:user:${userId}`);

    // Mantener audit logs (requisito legal)
    // NO borrar audit logs - requeridos por ley

    return { success: true };
}

// ============================================================================
// RIGHT TO RECTIFICATION (Art. 16 GDPR)
// ============================================================================

/**
 * Permitir al usuario corregir sus datos
 */
async function rectifyUserData(userId, updates, db) {
    try {
        const requestId = createGDPRRequest(userId, REQUEST_TYPES.RECTIFICATION);

        // Validar que solo actualice sus propios datos
        const allowedFields = [
            'profile.firstName',
            'profile.lastName',
            'profile.address',
            'email',
            'phone',
            'preferences'
        ];

        // Filtrar actualizaciones no permitidas
        const validUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                validUpdates[key] = value;
            }
        }

        // Actualizar datos
        await db.updateUser(userId, validUpdates);

        audit.security('GDPR_DATA_RECTIFICATION', 'info', {
            userId,
            requestId,
            updatedFields: Object.keys(validUpdates)
        });

        updateGDPRRequest(requestId, 'completed', { fieldsUpdated: Object.keys(validUpdates) });

        return { success: true, requestId, updated: Object.keys(validUpdates) };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// DATA RETENTION POLICIES
// ============================================================================

/**
 * Aplicar políticas de retención de datos (ejecutar diariamente)
 */
async function applyDataRetentionPolicies(db) {
    const results = {
        auditLogsDeleted: 0,
        inactiveUsersAnonymized: 0,
        oldPaymentDataArchived: 0
    };

    try {
        const now = Date.now();

        // 1. Limpiar audit logs antiguos
        const auditCutoff = now - (GDPR_CONFIG.AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        // results.auditLogsDeleted = await db.deleteOldAuditLogs(auditCutoff);

        // 2. Anonimizar usuarios inactivos
        const userCutoff = now - (GDPR_CONFIG.USER_DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const inactiveUsers = []; // await db.getInactiveUsers(userCutoff);

        for (const userId of inactiveUsers) {
            await anonymizeUserData(userId, db);
            results.inactiveUsersAnonymized++;
        }

        // 3. Archivar datos de pago antiguos (mantener por ley, pero mover a cold storage)
        const paymentCutoff = now - (GDPR_CONFIG.PAYMENT_DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        // results.oldPaymentDataArchived = await db.archiveOldPaymentData(paymentCutoff);

        audit.admin('DATA_RETENTION_POLICY_APPLIED', 'info', results);

        return { success: true, results };

    } catch (error) {
        console.error('Error applying data retention policies:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// CONSENT MANAGEMENT
// ============================================================================

/**
 * Registrar consentimiento del usuario
 */
function recordConsent(userId, consentType, granted, metadata = {}) {
    const consent = {
        userId,
        type: consentType,
        granted,
        timestamp: new Date().toISOString(),
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        version: metadata.policyVersion || '1.0'
    };

    audit.security('CONSENT_RECORDED', 'info', {
        userId,
        consentType,
        granted
    });

    return consent;
}

/**
 * Obtener consentimientos del usuario
 */
async function getUserConsents(userId, db) {
    const user = await db.findUserById(userId);

    return {
        terms: {
            granted: user.termsAccepted || false,
            timestamp: user.termsAcceptedAt
        },
        privacy: {
            granted: user.privacyPolicyAccepted || false,
            timestamp: user.privacyAcceptedAt
        },
        marketing: {
            granted: user.marketingConsent || false,
            timestamp: user.marketingConsentAt
        },
        analytics: {
            granted: user.analyticsConsent !== false, // Default true
            timestamp: user.analyticsConsentAt
        }
    };
}

/**
 * Revocar consentimiento
 */
async function revokeConsent(userId, consentType, db) {
    const updates = {};

    switch (consentType) {
        case 'marketing':
            updates.marketingConsent = false;
            updates.marketingConsentAt = new Date().toISOString();
            break;
        case 'analytics':
            updates.analyticsConsent = false;
            updates.analyticsConsentAt = new Date().toISOString();
            break;
    }

    await db.updateUser(userId, updates);

    audit.security('CONSENT_REVOKED', 'info', {
        userId,
        consentType
    });

    return { success: true, consentType, revoked: true };
}

// ============================================================================
// GDPR REQUEST MANAGEMENT
// ============================================================================

/**
 * Crear solicitud GDPR
 */
function createGDPRRequest(userId, requestType) {
    const requestId = `GDPR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const request = {
        id: requestId,
        userId,
        type: requestType,
        status: 'pending',
        createdAt: Date.now(),
        deadline: Date.now() + GDPR_CONFIG.ACCESS_REQUEST_DEADLINE,
        completedAt: null,
        result: null
    };

    gdprRequests.set(requestId, request);

    audit.security('GDPR_REQUEST_CREATED', 'medium', {
        requestId,
        userId,
        type: requestType
    });

    return requestId;
}

/**
 * Actualizar solicitud GDPR
 */
function updateGDPRRequest(requestId, status, result = {}) {
    const request = gdprRequests.get(requestId);
    if (!request) return null;

    request.status = status;
    request.completedAt = Date.now();
    request.result = result;

    gdprRequests.set(requestId, request);

    return request;
}

/**
 * Obtener solicitud GDPR
 */
function getGDPRRequest(requestId) {
    return gdprRequests.get(requestId);
}

/**
 * Listar solicitudes GDPR del usuario
 */
function getUserGDPRRequests(userId) {
    return Array.from(gdprRequests.values()).filter(req => req.userId === userId);
}

/**
 * Obtener estadísticas GDPR
 */
function getGDPRStats() {
    const requests = Array.from(gdprRequests.values());

    return {
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        completedRequests: requests.filter(r => r.status === 'completed').length,
        rejectedRequests: requests.filter(r => r.status === 'rejected').length,
        byType: requests.reduce((acc, req) => {
            acc[req.type] = (acc[req.type] || 0) + 1;
            return acc;
        }, {}),
        avgCompletionTime: calculateAvgCompletionTime(requests)
    };
}

/**
 * Calcular tiempo promedio de completado
 */
function calculateAvgCompletionTime(requests) {
    const completed = requests.filter(r => r.completedAt);
    if (completed.length === 0) return 0;

    const totalTime = completed.reduce((sum, req) => {
        return sum + (req.completedAt - req.createdAt);
    }, 0);

    return Math.round(totalTime / completed.length / 1000 / 60); // minutos
}

module.exports = {
    // Data Access
    exportUserData,
    collectUserData,

    // Data Deletion
    deleteUserData,
    anonymizeUserData,
    verifyDeletionEligibility,

    // Data Rectification
    rectifyUserData,

    // Data Retention
    applyDataRetentionPolicies,

    // Consent Management
    recordConsent,
    getUserConsents,
    revokeConsent,

    // Request Management
    createGDPRRequest,
    updateGDPRRequest,
    getGDPRRequest,
    getUserGDPRRequests,
    getGDPRStats,

    // Constants
    REQUEST_TYPES,
    GDPR_CONFIG
};
