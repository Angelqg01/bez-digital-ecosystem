const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Campaign = require('../models/campaign.model');
const AdvertiserProfile = require('../models/advertiserProfile.model');
const User = require('../models/user.model');
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

            const campaigns = await Campaign.find({ status: 'pending_approval' })
                .sort({ createdAt: 1 }) // FIFO
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('advertiserId', 'username email')
                .lean();

            const total = await Campaign.countDocuments({ status: 'pending_approval' });

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
    param('id').isMongoId().withMessage('ID de campaña inválido'),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const campaign = await Campaign.findById(req.params.id);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            if (campaign.status !== 'pending_approval') {
                return res.status(400).json({
                    success: false,
                    error: 'Solo se pueden aprobar campañas pendientes'
                });
            }

            campaign.status = 'approved';
            campaign.approvedAt = new Date();
            campaign.approvedBy = req.user._id;
            campaign.updatedAt = new Date();

            // Si la fecha de inicio es hoy o pasada, activar inmediatamente
            if (new Date(campaign.schedule.startDate) <= new Date()) {
                campaign.status = 'active';
                campaign.lastActiveAt = new Date();
            }

            await campaign.save();

            res.json({
                success: true,
                message: 'Campaña aprobada exitosamente',
                campaign: {
                    id: campaign._id,
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
        param('id').isMongoId().withMessage('ID de campaña inválido'),
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

            const campaign = await Campaign.findById(req.params.id);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            if (campaign.status !== 'pending_approval') {
                return res.status(400).json({
                    success: false,
                    error: 'Solo se pueden rechazar campañas pendientes'
                });
            }

            campaign.status = 'rejected';
            campaign.rejectionReason = reason;
            campaign.updatedAt = new Date();

            await campaign.save();

            // TODO: Enviar notificación al anunciante

            res.json({
                success: true,
                message: 'Campaña rechazada',
                campaign: {
                    id: campaign._id,
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

            const filter = {};
            if (status) filter.status = status;

            const campaigns = await Campaign.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('advertiserId', 'username email walletAddress')
                .lean();

            const total = await Campaign.countDocuments(filter);

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
        param('id').isMongoId().withMessage('ID de campaña inválido'),
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

            const campaign = await Campaign.findById(req.params.id);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            switch (action) {
                case 'pause':
                    if (campaign.status === 'active') {
                        campaign.status = 'paused';
                    }
                    break;

                case 'activate':
                    if (['paused', 'approved', 'suspended'].includes(campaign.status)) {
                        campaign.status = 'active';
                        campaign.lastActiveAt = new Date();
                        campaign.suspensionReason = undefined;
                    }
                    break;

                case 'suspend':
                    campaign.status = 'suspended';
                    campaign.suspensionReason = reason || 'Suspendido por administrador';
                    break;
            }

            campaign.updatedAt = new Date();
            await campaign.save();

            res.json({
                success: true,
                message: `Campaña ${action === 'pause' ? 'pausada' : action === 'activate' ? 'activada' : 'suspendida'} exitosamente`,
                campaign: {
                    id: campaign._id,
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

            const filter = {};
            if (typeof suspended === 'boolean') {
                filter.isSuspended = suspended;
            }

            const advertisers = await AdvertiserProfile.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('userId', 'username email walletAddress')
                .lean();

            const total = await AdvertiserProfile.countDocuments(filter);

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
        param('id').isMongoId().withMessage('ID de anunciante inválido'),
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

            const advertiser = await AdvertiserProfile.findById(req.params.id);

            if (!advertiser) {
                return res.status(404).json({
                    success: false,
                    error: 'Anunciante no encontrado'
                });
            }

            advertiser.isSuspended = suspend;
            advertiser.suspensionReason = suspend ? (reason || 'Suspendido por administrador') : undefined;
            advertiser.updatedAt = new Date();

            await advertiser.save();

            // Si se suspende, pausar todas sus campañas activas
            if (suspend) {
                await Campaign.updateMany(
                    {
                        $or: [
                            { advertiserId: advertiser.userId },
                            { advertiserWallet: advertiser.walletAddress }
                        ],
                        status: 'active'
                    },
                    {
                        $set: {
                            status: 'suspended',
                            suspensionReason: 'Anunciante suspendido',
                            updatedAt: new Date()
                        }
                    }
                );
            }

            res.json({
                success: true,
                message: suspend ? 'Anunciante suspendido' : 'Anunciante reactivado',
                advertiser: {
                    id: advertiser._id,
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
