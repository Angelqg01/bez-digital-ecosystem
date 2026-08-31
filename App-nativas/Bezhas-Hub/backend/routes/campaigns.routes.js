// backend/routes/campaigns.routes.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Campaign = require('../models/campaign.model');
const AdvertiserProfile = require('../models/advertiserProfile.model');
const AdBalance = require('../models/adBalance.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'ads');
        try {
            await fs.mkdir(uploadsDir, { recursive: true });
            cb(null, uploadsDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'ad-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// Middleware de autenticación
const { protect: authMiddleware } = require('../middleware/auth.middleware');

/**
 * POST /api/campaigns/upload-creative
 * Subir imagen de creatividad
 */
router.post('/upload-creative',
    authMiddleware,
    upload.single('image'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No se proporcionó ninguna imagen'
                });
            }

            const imageUrl = `/uploads/ads/${req.file.filename}`;

            res.json({
                success: true,
                imageUrl,
                filename: req.file.filename,
                size: req.file.size
            });

        } catch (error) {
            console.error('Error uploading creative:', error);
            res.status(500).json({
                success: false,
                error: 'Error al subir la imagen',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/campaigns
 * Crear una nueva campaña
 */
router.post('/',
    authMiddleware,
    [
        body('name').trim().notEmpty().withMessage('El nombre es requerido'),
        body('objective').isIn(['clicks', 'impressions', 'conversions', 'video-views', 'engagement']).withMessage('Objetivo inválido'),
        body('creative.title').trim().isLength({ min: 5, max: 100 }).withMessage('Título debe tener entre 5 y 100 caracteres'),
        body('creative.description').trim().isLength({ min: 10, max: 300 }).withMessage('Descripción debe tener entre 10 y 300 caracteres'),
        body('creative.imageUrl').notEmpty().withMessage('Imagen requerida'),
        body('creative.destinationUrl').isURL().withMessage('URL de destino inválida'),
        body('budget.dailyBudget').isFloat({ min: 5 }).withMessage('Presupuesto diario mínimo: 5 EUR'),
        body('budget.totalBudget').isFloat({ min: 10 }).withMessage('Presupuesto total mínimo: 10 EUR'),
        body('budget.bidAmount').isFloat({ min: 0.01 }).withMessage('Puja mínima: 0.01 EUR'),
        body('schedule.startDate').isISO8601().withMessage('Fecha de inicio inválida')
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

            const {
                name,
                objective,
                creative,
                targeting,
                budget,
                schedule
            } = req.body;

            // Verificar que el usuario tenga perfil de anunciante
            const advertiserProfile = await AdvertiserProfile.findOne({
                $or: [
                    { userId: req.user._id },
                    { walletAddress: req.user.walletAddress }
                ]
            });

            if (!advertiserProfile) {
                return res.status(403).json({
                    success: false,
                    error: 'Debes completar tu perfil de anunciante primero',
                    redirectTo: '/ad-center/welcome/step-1'
                });
            }

            if (advertiserProfile.isSuspended) {
                return res.status(403).json({
                    success: false,
                    error: 'Tu cuenta de anunciante está suspendida',
                    reason: advertiserProfile.suspensionReason
                });
            }

            // Verificar saldo suficiente
            const balance = await AdBalance.findOne({
                $or: [
                    { userId: req.user._id },
                    { walletAddress: req.user.walletAddress }
                ]
            });

            if (!balance || !balance.hasSufficientBalance(budget.dailyBudget * 3)) {
                return res.status(400).json({
                    success: false,
                    error: 'Saldo insuficiente. Se requiere al menos 3 días de presupuesto diario',
                    requiredAmount: budget.dailyBudget * 3,
                    currentBalance: balance ? (balance.fiatBalance + balance.bezBalance) : 0,
                    redirectTo: '/ad-center/billing'
                });
            }

            // Crear campaña
            const campaign = new Campaign({
                advertiserId: req.user._id,
                advertiserWallet: req.user.walletAddress,
                name,
                objective,
                creative,
                targeting: targeting || {},
                budget,
                schedule,
                status: 'pending_approval'
            });

            await campaign.save();

            res.status(201).json({
                success: true,
                message: 'Campaña creada exitosamente. Pendiente de aprobación.',
                campaign: {
                    id: campaign._id,
                    name: campaign.name,
                    status: campaign.status,
                    createdAt: campaign.createdAt
                }
            });

        } catch (error) {
            console.error('Error creating campaign:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear la campaña',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/campaigns
 * Obtener todas las campañas del anunciante
 */
router.get('/',
    authMiddleware,
    [
        query('status').optional().isIn(['draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'rejected', 'suspended']),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
    ],
    async (req, res) => {
        try {
            const { status, page = 1, limit = 10 } = req.query;

            const filter = {
                $or: [
                    { advertiserId: req.user._id },
                    { advertiserWallet: req.user.walletAddress }
                ]
            };
            if (status) filter.status = status;

            const campaigns = await Campaign.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
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
            console.error('Error fetching campaigns:', error);

            // Fallback: devolver array vacío si MongoDB no está disponible
            if (error.message && error.message.includes('buffering timed out')) {
                return res.json({
                    success: true,
                    data: [],
                    pagination: { page: 1, limit: 10, total: 0, pages: 0 },
                    warning: 'Base de datos no disponible'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Error al obtener campañas',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/campaigns/:id
 * Obtener detalles de una campaña específica
 */
router.get('/:id',
    authMiddleware,
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

            const campaign = await Campaign.findOne({
                _id: req.params.id,
                $or: [
                    { advertiserId: req.user._id },
                    { advertiserWallet: req.user.walletAddress }
                ]
            }).lean();

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            res.json({
                success: true,
                data: campaign
            });

        } catch (error) {
            console.error('Error fetching campaign:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener la campaña',
                details: error.message
            });
        }
    }
);

/**
 * PUT /api/campaigns/:id
 * Editar una campaña (pausar, reanudar, actualizar)
 */
router.put('/:id',
    authMiddleware,
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

            const campaign = await Campaign.findOne({
                _id: req.params.id,
                $or: [
                    { advertiserId: req.user._id },
                    { advertiserWallet: req.user.walletAddress }
                ]
            });

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            // Manejar acciones específicas
            if (req.body.action) {
                switch (req.body.action) {
                    case 'pause':
                        if (campaign.status === 'active') {
                            campaign.status = 'paused';
                        } else {
                            return res.status(400).json({
                                success: false,
                                error: 'Solo se pueden pausar campañas activas'
                            });
                        }
                        break;

                    case 'resume':
                        if (campaign.status === 'paused') {
                            campaign.status = 'active';
                            campaign.lastActiveAt = new Date();
                        } else {
                            return res.status(400).json({
                                success: false,
                                error: 'Solo se pueden reanudar campañas pausadas'
                            });
                        }
                        break;

                    default:
                        return res.status(400).json({
                            success: false,
                            error: 'Acción no válida'
                        });
                }
            } else {
                // Edición de campos (solo permitido en draft o pending_approval)
                if (!['draft', 'pending_approval'].includes(campaign.status)) {
                    return res.status(400).json({
                        success: false,
                        error: 'No se puede editar una campaña en este estado'
                    });
                }

                const allowedFields = ['name', 'creative', 'targeting', 'budget', 'schedule'];
                allowedFields.forEach(field => {
                    if (req.body[field]) {
                        campaign[field] = { ...campaign[field].toObject(), ...req.body[field] };
                    }
                });
            }

            campaign.updatedAt = new Date();
            await campaign.save();

            res.json({
                success: true,
                message: 'Campaña actualizada exitosamente',
                data: campaign
            });

        } catch (error) {
            console.error('Error updating campaign:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar la campaña',
                details: error.message
            });
        }
    }
);

/**
 * DELETE /api/campaigns/:id
 * Eliminar una campaña (solo drafts)
 */
router.delete('/:id',
    authMiddleware,
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

            const campaign = await Campaign.findOne({
                _id: req.params.id,
                $or: [
                    { advertiserId: req.user._id },
                    { advertiserWallet: req.user.walletAddress }
                ]
            });

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            if (campaign.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: 'Solo se pueden eliminar campañas en borrador'
                });
            }

            await campaign.deleteOne();

            res.json({
                success: true,
                message: 'Campaña eliminada exitosamente'
            });

        } catch (error) {
            console.error('Error deleting campaign:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar la campaña',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/campaigns/:id/analytics
 * Obtener analytics de una campaña
 */
router.get('/:id/analytics',
    authMiddleware,
    param('id').isMongoId().withMessage('ID de campaña inválido'),
    async (req, res) => {
        try {
            const campaign = await Campaign.findOne({
                _id: req.params.id,
                $or: [
                    { advertiserId: req.user._id },
                    { advertiserWallet: req.user.walletAddress }
                ]
            }).lean();

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            // Calcular métricas
            const ctr = campaign.metrics.impressions > 0
                ? (campaign.metrics.clicks / campaign.metrics.impressions * 100).toFixed(2)
                : 0;

            const cpc = campaign.metrics.clicks > 0
                ? (campaign.metrics.spent / campaign.metrics.clicks).toFixed(2)
                : 0;

            const cpm = campaign.metrics.impressions > 0
                ? (campaign.metrics.spent / campaign.metrics.impressions * 1000).toFixed(2)
                : 0;

            const conversionRate = campaign.metrics.clicks > 0
                ? (campaign.metrics.conversions / campaign.metrics.clicks * 100).toFixed(2)
                : 0;

            res.json({
                success: true,
                data: {
                    campaignId: campaign._id,
                    campaignName: campaign.name,
                    status: campaign.status,
                    metrics: campaign.metrics,
                    calculated: {
                        ctr: `${ctr}%`,
                        cpc: `€${cpc}`,
                        cpm: `€${cpm}`,
                        conversionRate: `${conversionRate}%`
                    },
                    budget: {
                        total: campaign.budget.totalBudget,
                        daily: campaign.budget.dailyBudget,
                        spent: campaign.metrics.spent,
                        remaining: campaign.budget.totalBudget - campaign.metrics.spent,
                        percentageUsed: `${(campaign.metrics.spent / campaign.budget.totalBudget * 100).toFixed(2)}%`
                    },
                    schedule: {
                        startDate: campaign.schedule.startDate,
                        endDate: campaign.schedule.endDate,
                        daysRunning: campaign.lastActiveAt
                            ? Math.floor((new Date() - new Date(campaign.schedule.startDate)) / (1000 * 60 * 60 * 24))
                            : 0
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching campaign analytics:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener analytics',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/campaigns/stats/summary
 * Obtener resumen de todas las campañas del anunciante
 */
router.get('/stats/summary',
    authMiddleware,
    async (req, res) => {
        try {
            const campaigns = await Campaign.find({
                $or: [
                    { advertiserId: req.user._id },
                    { advertiserWallet: req.user.walletAddress }
                ]
            }).lean();

            const summary = {
                total: campaigns.length,
                byStatus: {
                    active: 0,
                    paused: 0,
                    pending: 0,
                    completed: 0,
                    rejected: 0
                },
                totalSpent: 0,
                totalImpressions: 0,
                totalClicks: 0,
                totalConversions: 0,
                averageCTR: 0,
                averageCPC: 0
            };

            campaigns.forEach(campaign => {
                summary.byStatus[campaign.status === 'pending_approval' ? 'pending' : campaign.status] =
                    (summary.byStatus[campaign.status === 'pending_approval' ? 'pending' : campaign.status] || 0) + 1;

                summary.totalSpent += campaign.metrics.spent || 0;
                summary.totalImpressions += campaign.metrics.impressions || 0;
                summary.totalClicks += campaign.metrics.clicks || 0;
                summary.totalConversions += campaign.metrics.conversions || 0;
            });

            if (summary.totalImpressions > 0) {
                summary.averageCTR = (summary.totalClicks / summary.totalImpressions * 100).toFixed(2);
            }

            if (summary.totalClicks > 0) {
                summary.averageCPC = (summary.totalSpent / summary.totalClicks).toFixed(2);
            }

            res.json({
                success: true,
                data: summary
            });

        } catch (error) {
            console.error('Error fetching campaign summary:', error);

            // Fallback: devolver summary vacío si MongoDB no está disponible
            if (error.message && (error.message.includes('buffering timed out') || error.message.includes('connect'))) {
                return res.json({
                    success: true,
                    data: {
                        total: 0,
                        byStatus: { active: 0, paused: 0, pending: 0, completed: 0, rejected: 0 },
                        totalSpent: 0,
                        totalImpressions: 0,
                        totalClicks: 0,
                        totalConversions: 0,
                        averageCTR: 0,
                        averageCPC: 0
                    },
                    warning: 'Base de datos no disponible'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Error al obtener resumen',
                details: error.message
            });
        }
    }
);

module.exports = router;
