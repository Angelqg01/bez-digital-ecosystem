const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Campaign = require('../models/pg/Campaign');
const AdvertiserProfile = require('../models/pg/AdvertiserProfile');
const User = require('../models/pg/User');
const { protect: authMiddleware } = require('../middleware/auth.middleware');
const { verifyAdminToken: adminMiddleware } = require('../middleware/admin.middleware');

/**
 * GET /api/admin/ads/pending-queue
 * Obtener campañas pendientes de aprobación
 */
router.get('/pending-queue',
    authMiddleware,
    adminMiddleware,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
    ],
    async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;

            const { campaigns, total } = await Campaign.listForAdmin({ status: 'pending_approval', page, limit, fifo: true }); // FIFO

            res.json({
                success: true,
                data: campaigns,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching pending queue:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener cola de aprobación',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/admin/ads/approve/:id
 * Aprobar un anuncio
 */
router.post('/approve/:id',
    authMiddleware,
    adminMiddleware,
    param('id').isUUID().withMessage('ID de campaña inválido'),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            // Aprobación ATÓMICA: sólo pasa de pending_approval, y activa de inmediato si la fecha de inicio ya llegó.
            const campaign = await Campaign.approve(req.params.id, req.user._id);
            if (!campaign) {
                const existente = await Campaign.findById(req.params.id);
                return res.status(existente ? 400 : 404).json({
                    success: false,
                    error: existente ? 'Solo se pueden aprobar campañas pendientes' : 'Campaña no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Campaña aprobada exitosamente',
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    status: campaign.status,
                    approvedAt: campaign.approvedAt
                }
            });

        } catch (error) {
            console.error('Error approving campaign:', error);
            res.status(500).json({
                success: false,
                error: 'Error al aprobar campaña',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/admin/ads/reject/:id
 * Rechazar un anuncio
 */
router.post('/reject/:id',
    authMiddleware,
    adminMiddleware,
    [
        param('id').isUUID().withMessage('ID de campaña inválido'),
        body('reason').trim().notEmpty().withMessage('Razón de rechazo requerida')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { reason } = req.body;

            const campaign = await Campaign.transition(req.params.id, { desde: ['pending_approval'], hacia: 'rejected', rejectionReason: reason });
            if (!campaign) {
                const existente = await Campaign.findById(req.params.id);
                return res.status(existente ? 400 : 404).json({
                    success: false,
                    error: existente ? 'Solo se pueden rechazar campañas pendientes' : 'Campaña no encontrada'
                });
            }

            // TODO: Enviar notificación al anunciante

            res.json({
                success: true,
                message: 'Campaña rechazada',
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    status: campaign.status,
                    rejectionReason: campaign.rejectionReason
                }
            });

        } catch (error) {
            console.error('Error rejecting campaign:', error);
            res.status(500).json({
                success: false,
                error: 'Error al rechazar campaña',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/admin/ads/all-campaigns
 * Obtener todas las campañas del sistema
 */
router.get('/all-campaigns',
    authMiddleware,
    adminMiddleware,
    [
        query('status').optional().isIn(['draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'rejected', 'suspended']),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
    ],
    async (req, res) => {
        try {
            const { status, page = 1, limit = 20 } = req.query;

            const { campaigns, total } = await Campaign.listForAdmin({ status, page, limit, conWallet: true });

            res.json({
                success: true,
                data: campaigns,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching all campaigns:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener campañas',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/admin/ads/toggle-campaign/:id
 * Pausar/Reactivar forzosamente cualquier campaña
 */
router.post('/toggle-campaign/:id',
    authMiddleware,
    adminMiddleware,
    [
        param('id').isUUID().withMessage('ID de campaña inválido'),
        body('action').isIn(['pause', 'activate', 'suspend']).withMessage('Acción inválida'),
        body('reason').optional().trim()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { action, reason } = req.body;

            const existente = await Campaign.findById(req.params.id);
            if (!existente) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            let campaign = existente;
            switch (action) {
                case 'pause':
                    campaign = (await Campaign.transition(existente.id, { desde: ['active'], hacia: 'paused' })) || existente;
                    break;
                case 'activate': {
                    // No se reactiva la campaña de un anunciante suspendido (antes se podía saltar la suspensión).
                    const perfil = await AdvertiserProfile.findByUserId(existente.advertiserId);
                    if (perfil && perfil.isSuspended) {
                        return res.status(409).json({ success: false, error: 'El anunciante está suspendido: reactívalo primero' });
                    }
                    campaign = (await Campaign.transition(existente.id, { desde: ['paused', 'approved', 'suspended'], hacia: 'active', touchActive: true, clearSuspension: true })) || existente;
                    break;
                }
                case 'suspend':
                    campaign = (await Campaign.transition(existente.id, {
                        desde: Campaign.STATUSES, hacia: 'suspended', suspensionReason: reason || 'Suspendido por administrador'
                    })) || existente;
                    break;
            }

            res.json({
                success: true,
                message: `Campaña ${action === 'pause' ? 'pausada' : action === 'activate' ? 'activada' : 'suspendida'} exitosamente`,
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    status: campaign.status
                }
            });

        } catch (error) {
            console.error('Error toggling campaign:', error);
            res.status(500).json({
                success: false,
                error: 'Error al cambiar estado de campaña',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/admin/ads/advertisers
 * Obtener todos los anunciantes
 */
router.get('/advertisers',
    authMiddleware,
    adminMiddleware,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('suspended').optional().isBoolean().toBoolean()
    ],
    async (req, res) => {
        try {
            const { page = 1, limit = 20, suspended } = req.query;

            const { advertisers, total } = await AdvertiserProfile.list({ suspended: typeof suspended === 'boolean' ? suspended : null, page, limit });

            res.json({
                success: true,
                data: advertisers,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching advertisers:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener anunciantes',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/admin/ads/suspend-advertiser/:id
 * Suspender/Reactivar anunciante
 */
router.post('/suspend-advertiser/:id',
    authMiddleware,
    adminMiddleware,
    [
        param('id').isUUID().withMessage('ID de anunciante inválido'),
        body('suspend').isBoolean().withMessage('Campo suspend requerido'),
        body('reason').optional().trim()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { suspend, reason } = req.body;

            // Suspender/reactivar y, si se suspende, pasar a `suspended` sus campañas activas, aprobadas o pausadas (una transacción).
            const advertiser = await AdvertiserProfile.setSuspended(req.params.id, suspend, reason);
            if (!advertiser) {
                return res.status(404).json({
                    success: false,
                    error: 'Anunciante no encontrado'
                });
            }

            res.json({
                success: true,
                message: suspend ? 'Anunciante suspendido' : 'Anunciante reactivado',
                advertiser: {
                    id: advertiser.id,
                    projectName: advertiser.projectName,
                    isSuspended: advertiser.isSuspended
                }
            });

        } catch (error) {
            console.error('Error suspending advertiser:', error);
            res.status(500).json({
                success: false,
                error: 'Error al cambiar estado del anunciante',
                details: error.message
            });
        }
    }
);

module.exports = router;
