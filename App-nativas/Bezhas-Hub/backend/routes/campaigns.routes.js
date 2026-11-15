// backend/routes/campaigns.routes.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Campaign = require('../models/pg/Campaign');
const AdvertiserProfile = require('../models/pg/AdvertiserProfile');
const AdBalance = require('../models/pg/AdBalance');
const priceOracleService = require('../services/price-oracle.service');
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

const walletDe = (req) => req.user.walletAddress || req.user.wallet_address || null;
const idInvalido = param('id').isUUID().withMessage('ID de campaña inválido');
const fallo = (res, error, mensaje, estado = 500) => res.status(estado).json({ success: false, error: mensaje, ...(estado === 500 ? { details: error.message } : {}) });

/** Valida el resultado de express-validator; devuelve true si respondió con el 400. */
function conErrores(req, res) {
    const errors = validationResult(req);
    if (errors.isEmpty()) return false;
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
}

/** El fin no puede ser anterior al inicio (la base también lo impone con un CHECK). */
const fechasIncoherentes = (schedule) => schedule && schedule.endDate && schedule.startDate && new Date(schedule.endDate) < new Date(schedule.startDate);

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
        body('schedule.startDate').isISO8601().withMessage('Fecha de inicio inválida'),
        body('schedule.endDate').optional({ nullable: true }).isISO8601().withMessage('Fecha de fin inválida')
    ],
    async (req, res) => {
        try {
            if (conErrores(req, res)) return;

            const { name, objective, creative, targeting, budget, schedule } = req.body;
            if (fechasIncoherentes(schedule)) return fallo(res, null, 'La fecha de fin no puede ser anterior a la de inicio', 400);

            // Verificar que el usuario tenga perfil de anunciante
            const advertiserProfile = await AdvertiserProfile.findByUserId(req.user._id);

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

            // Verificar saldo suficiente (fiat + BEZ al precio del oráculo)
            const balance = await AdBalance.findByUserId(req.user._id);
            const bezEurPrice = balance && balance.bezBalance > 0 ? await priceOracleService.getBezEurPrice() : 0;
            const disponibleEur = balance ? AdBalance.availableEur(balance, bezEurPrice) : 0;
            const requerido = Number(budget.dailyBudget) * 3;

            if (!balance || disponibleEur < requerido) {
                return res.status(400).json({
                    success: false,
                    error: 'Saldo insuficiente. Se requiere al menos 3 días de presupuesto diario',
                    requiredAmount: requerido,
                    currentBalance: disponibleEur,
                    redirectTo: '/ad-center/billing'
                });
            }

            const campaign = await Campaign.create(req.user._id, walletDe(req), { name, objective, creative, targeting, budget, schedule }, 'pending_approval');

            res.status(201).json({
                success: true,
                message: 'Campaña creada exitosamente. Pendiente de aprobación.',
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    status: campaign.status,
                    createdAt: campaign.createdAt
                }
            });

        } catch (error) {
            console.error('Error creating campaign:', error);
            fallo(res, error, 'Error al crear la campaña');
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
        query('status').optional().isIn(Campaign.STATUSES),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
    ],
    async (req, res) => {
        try {
            if (conErrores(req, res)) return;
            const { status, page = 1, limit = 10 } = req.query;

            const { campaigns, total } = await Campaign.listByAdvertiser(req.user._id, { status, page, limit });

            res.json({
                success: true,
                data: campaigns,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });

        } catch (error) {
            console.error('Error fetching campaigns:', error);
            fallo(res, error, 'Error al obtener campañas');
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
            res.json({ success: true, data: await Campaign.summary(req.user._id) });
        } catch (error) {
            console.error('Error fetching campaign summary:', error);
            fallo(res, error, 'Error al obtener resumen');
        }
    }
);

/**
 * GET /api/campaigns/:id
 * Obtener detalles de una campaña específica
 */
router.get('/:id',
    authMiddleware,
    idInvalido,
    async (req, res) => {
        try {
            if (conErrores(req, res)) return;
            const campaign = await Campaign.findOwned(req.params.id, req.user._id);
            if (!campaign) return fallo(res, null, 'Campaña no encontrada', 404);
            res.json({ success: true, data: campaign });
        } catch (error) {
            console.error('Error fetching campaign:', error);
            fallo(res, error, 'Error al obtener la campaña');
        }
    }
);

/**
 * PUT /api/campaigns/:id
 * Editar una campaña (pausar, reanudar, actualizar)
 */
router.put('/:id',
    authMiddleware,
    idInvalido,
    [
        // Los límites del alta también rigen al editar (Mongoose los validaba en cada save).
        body('name').optional().trim().notEmpty(),
        body('creative.title').optional().trim().isLength({ min: 5, max: 100 }),
        body('creative.description').optional().trim().isLength({ min: 10, max: 300 }),
        body('creative.destinationUrl').optional().isURL(),
        body('budget.dailyBudget').optional().isFloat({ min: 5 }),
        body('budget.totalBudget').optional().isFloat({ min: 10 }),
        body('budget.bidAmount').optional().isFloat({ min: 0.01 }),
        body('schedule.startDate').optional().isISO8601(),
        body('schedule.endDate').optional({ nullable: true }).isISO8601()
    ],
    async (req, res) => {
        try {
            if (conErrores(req, res)) return;

            const campaign = await Campaign.findOwned(req.params.id, req.user._id);
            if (!campaign) return fallo(res, null, 'Campaña no encontrada', 404);

            let actualizada;
            if (req.body.action) {
                switch (req.body.action) {
                    case 'pause':
                        actualizada = await Campaign.transition(campaign.id, { desde: ['active'], hacia: 'paused', userId: req.user._id });
                        if (!actualizada) return fallo(res, null, 'Solo se pueden pausar campañas activas', 400);
                        break;

                    case 'resume': {
                        // Un anunciante suspendido no puede reanudar campañas.
                        const perfil = await AdvertiserProfile.findByUserId(req.user._id);
                        if (perfil && perfil.isSuspended) return fallo(res, null, 'Tu cuenta de anunciante está suspendida', 403);
                        actualizada = await Campaign.transition(campaign.id, { desde: ['paused'], hacia: 'active', userId: req.user._id, touchActive: true });
                        if (!actualizada) return fallo(res, null, 'Solo se pueden reanudar campañas pausadas', 400);
                        break;
                    }

                    default:
                        return fallo(res, null, 'Acción no válida', 400);
                }
            } else {
                // Edición de campos (solo permitido en draft o pending_approval)
                if (!['draft', 'pending_approval'].includes(campaign.status)) {
                    return fallo(res, null, 'No se puede editar una campaña en este estado', 400);
                }
                const cambios = {};
                ['name', 'creative', 'targeting', 'budget', 'schedule'].forEach((campo) => { if (req.body[campo]) cambios[campo] = req.body[campo]; });
                const previstas = { ...campaign.schedule, ...(cambios.schedule || {}) };
                if (fechasIncoherentes(previstas)) return fallo(res, null, 'La fecha de fin no puede ser anterior a la de inicio', 400);

                actualizada = await Campaign.updateEditable(campaign.id, req.user._id, cambios);
                if (!actualizada) return fallo(res, null, 'No se puede editar una campaña en este estado', 400);
            }

            res.json({ success: true, message: 'Campaña actualizada exitosamente', data: actualizada });

        } catch (error) {
            console.error('Error updating campaign:', error);
            fallo(res, error, 'Error al actualizar la campaña');
        }
    }
);

/**
 * DELETE /api/campaigns/:id
 * Eliminar una campaña (solo drafts)
 */
router.delete('/:id',
    authMiddleware,
    idInvalido,
    async (req, res) => {
        try {
            if (conErrores(req, res)) return;

            const campaign = await Campaign.findOwned(req.params.id, req.user._id);
            if (!campaign) return fallo(res, null, 'Campaña no encontrada', 404);
            if (campaign.status !== 'draft') return fallo(res, null, 'Solo se pueden eliminar campañas en borrador', 400);

            if (!(await Campaign.deleteDraft(campaign.id, req.user._id))) {
                return fallo(res, null, 'Solo se pueden eliminar campañas en borrador', 400);
            }
            res.json({ success: true, message: 'Campaña eliminada exitosamente' });

        } catch (error) {
            console.error('Error deleting campaign:', error);
            fallo(res, error, 'Error al eliminar la campaña');
        }
    }
);

/**
 * GET /api/campaigns/:id/analytics
 * Obtener analytics de una campaña
 */
router.get('/:id/analytics',
    authMiddleware,
    idInvalido,
    async (req, res) => {
        try {
            if (conErrores(req, res)) return;
            const campaign = await Campaign.findOwned(req.params.id, req.user._id);
            if (!campaign) return fallo(res, null, 'Campaña no encontrada', 404);

            const m = campaign.metrics;
            const ctr = m.impressions > 0 ? (m.clicks / m.impressions * 100).toFixed(2) : 0;
            const cpc = m.clicks > 0 ? (m.spent / m.clicks).toFixed(2) : 0;
            const cpm = m.impressions > 0 ? (m.spent / m.impressions * 1000).toFixed(2) : 0;
            const conversionRate = m.clicks > 0 ? (m.conversions / m.clicks * 100).toFixed(2) : 0;

            res.json({
                success: true,
                data: {
                    campaignId: campaign.id,
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
                        spent: m.spent,
                        remaining: campaign.budget.totalBudget - m.spent,
                        percentageUsed: `${(m.spent / campaign.budget.totalBudget * 100).toFixed(2)}%`
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
            fallo(res, error, 'Error al obtener analytics');
        }
    }
);

module.exports = router;
