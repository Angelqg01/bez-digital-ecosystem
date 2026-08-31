/**
 * ============================================================================
 * SECURITY ADMIN ROUTES - Day 6
 * ============================================================================
 * 
 * Endpoints de administración para:
 * - Métricas de seguridad (Prometheus)
 * - Gestión de incidentes
 * - Solicitudes GDPR
 * - Bloqueos y bans
 */

const express = require('express');
const router = express.Router();

// Middleware
const { protect, requireAdmin } = require('../middleware/auth.middleware');

// Services
const metrics = require('../middleware/securityMetrics');
const incidents = require('../middleware/incidentResponse');
const gdpr = require('../middleware/gdprCompliance');
const { audit } = require('../middleware/auditLogger');

// ============================================================================
// MÉTRICAS DE SEGURIDAD
// ============================================================================

/**
 * GET /api/security/metrics
 * Exportar métricas para Prometheus
 */
router.get('/metrics', metrics.metricsEndpoint);

/**
 * GET /api/security/metrics/snapshot
 * Obtener snapshot de métricas en JSON
 * Requiere: Admin
 */
router.get('/metrics/snapshot', protect, requireAdmin, async (req, res) => {
    try {
        const snapshot = await metrics.getMetricsSnapshot();
        res.json(snapshot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/security/metrics/score
 * Calcular security score basado en métricas
 * Requiere: Admin
 */
router.get('/metrics/score', protect, requireAdmin, async (req, res) => {
    try {
        const score = await metrics.calculateSecurityScore();
        const systemHealth = await metrics.getSecurityStats();

        res.json({
            score,
            health: systemHealth,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// GESTIÓN DE INCIDENTES
// ============================================================================

/**
 * GET /api/security/incidents
 * Listar todos los incidentes activos
 * Requiere: Admin
 */
router.get('/incidents', protect, requireAdmin, (req, res) => {
    try {
        const activeIncidents = incidents.getActiveIncidents();
        const stats = incidents.getSecurityStats();

        res.json({
            incidents: activeIncidents,
            stats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/security/incidents/:id
 * Obtener detalles de un incidente específico
 * Requiere: Admin
 */
router.get('/incidents/:id', protect, requireAdmin, (req, res) => {
    try {
        const incident = incidents.getIncident(req.params.id);

        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }

        res.json(incident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/security/incidents/:id/resolve
 * Resolver un incidente manualmente
 * Requiere: Admin
 */
router.post('/incidents/:id/resolve', protect, requireAdmin, (req, res) => {
    try {
        const { resolution } = req.body;

        const incident = incidents.resolveIncident(req.params.id, resolution);

        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }

        audit.admin('INCIDENT_MANUALLY_RESOLVED', 'medium', {
            incidentId: req.params.id,
            adminId: req.user.userId,
            resolution
        });

        res.json(incident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/security/stats
 * Estadísticas generales de seguridad
 * Requiere: Admin
 */
router.get('/stats', protect, requireAdmin, (req, res) => {
    try {
        const stats = incidents.getSecurityStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// BLOQUEOS Y BANS
// ============================================================================

/**
 * POST /api/security/block-ip
 * Bloquear una IP manualmente
 * Requiere: Admin
 */
router.post('/block-ip', protect, requireAdmin, async (req, res) => {
    try {
        const { ip, duration } = req.body;

        if (!ip) {
            return res.status(400).json({ error: 'IP address required' });
        }

        const result = await incidents.blockIP(ip, duration || 3600000);

        audit.admin('IP_MANUALLY_BLOCKED', 'high', {
            ip,
            duration,
            adminId: req.user.userId
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/security/unblock-ip
 * Desbloquear una IP manualmente
 * Requiere: Admin
 */
router.post('/unblock-ip', protect, requireAdmin, (req, res) => {
    try {
        const { ip } = req.body;

        if (!ip) {
            return res.status(400).json({ error: 'IP address required' });
        }

        const result = incidents.unblockIP(ip, req.user.userId);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/security/lock-account
 * Bloquear cuenta de usuario manualmente
 * Requiere: Admin
 */
router.post('/lock-account', protect, requireAdmin, async (req, res) => {
    try {
        const { userId, duration, reason } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const result = await incidents.lockAccount(
            userId,
            duration || 1800000,
            reason || 'manual_admin_lock'
        );

        audit.admin('ACCOUNT_MANUALLY_LOCKED', 'high', {
            targetUserId: userId,
            duration,
            reason,
            adminId: req.user.userId
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/security/unlock-account
 * Desbloquear cuenta de usuario manualmente
 * Requiere: Admin
 */
router.post('/unlock-account', protect, requireAdmin, (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const result = incidents.unlockAccount(userId, req.user.userId);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/security/permanent-ban
 * Ban permanente de usuario
 * Requiere: Admin
 */
router.post('/permanent-ban', protect, requireAdmin, async (req, res) => {
    try {
        const { userId, reason } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const result = await incidents.permanentBan(userId, reason || 'manual_admin_ban');

        audit.admin('PERMANENT_BAN_ISSUED', 'critical', {
            targetUserId: userId,
            reason,
            adminId: req.user.userId
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// SOLICITUDES GDPR
// ============================================================================

/**
 * POST /api/security/gdpr/export
 * Exportar datos del usuario (Right to Access)
 */
router.post('/gdpr/export', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const db = req.app.get('db');

        const result = await gdpr.exportUserData(userId, db);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json({
            requestId: result.requestId,
            data: result.data,
            format: result.format
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/security/gdpr/delete
 * Solicitar eliminación de datos (Right to Deletion)
 */
router.post('/gdpr/delete', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const db = req.app.get('db');
        const { reason } = req.body;

        const result = await gdpr.deleteUserData(userId, db, reason || 'user_request');

        if (!result.success) {
            return res.status(400).json({
                error: 'Cannot delete data',
                reason: result.reason
            });
        }

        res.json({
            requestId: result.requestId,
            status: 'completed',
            method: result.method
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/security/gdpr/rectify
 * Rectificar datos personales (Right to Rectification)
 */
router.post('/gdpr/rectify', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const db = req.app.get('db');
        const { updates } = req.body;

        const result = await gdpr.rectifyUserData(userId, updates, db);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json({
            requestId: result.requestId,
            updated: result.updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/security/gdpr/consents
 * Obtener consentimientos del usuario
 */
router.get('/gdpr/consents', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const db = req.app.get('db');

        const consents = await gdpr.getUserConsents(userId, db);
        res.json(consents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/security/gdpr/revoke-consent
 * Revocar consentimiento
 */
router.post('/gdpr/revoke-consent', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const db = req.app.get('db');
        const { consentType } = req.body;

        const result = await gdpr.revokeConsent(userId, consentType, db);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/security/gdpr/requests
 * Listar solicitudes GDPR del usuario
 */
router.get('/gdpr/requests', protect, (req, res) => {
    try {
        const userId = req.user.userId;
        const requests = gdpr.getUserGDPRRequests(userId);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/security/gdpr/stats
 * Estadísticas GDPR (Admin)
 * Requiere: Admin
 */
router.get('/gdpr/stats', protect, requireAdmin, (req, res) => {
    try {
        const stats = gdpr.getGDPRStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// CSP REPORT ENDPOINT
// ============================================================================

/**
 * POST /api/security/csp-report
 * Recibir reportes de violaciones CSP
 */
const { cspReportHandler, rateLimitCSPReports } = require('../middleware/securityHeaders');

router.post('/csp-report',
    express.json({ type: 'application/csp-report' }),
    rateLimitCSPReports,
    cspReportHandler
);

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/security/health
 * Health check del sistema de seguridad
 */
router.get('/health', async (req, res) => {
    try {
        const score = await metrics.calculateSecurityScore();
        const stats = incidents.getSecurityStats();

        res.json({
            status: 'healthy',
            securityScore: score,
            activeIncidents: stats.activeIncidents,
            blockedIPs: stats.blockedIPs,
            lockedAccounts: stats.lockedAccounts,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;
