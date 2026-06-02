const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const AdvertiserProfile = require('../models/advertiserProfile.model');
const { protect: authMiddleware } = require('../middleware/auth.middleware');

/**
 * POST /api/advertiser-profile
 * Crear o actualizar perfil de anunciante (Onboarding Wizard)
 */
router.post('/',
    authMiddleware,
    [
        body('businessType').isIn(['nft-project', 'content-creator', 'defi-dapp', 'web3-service', 'store', 'other']).withMessage('Tipo de negocio inválido'),
        body('projectName').trim().notEmpty().withMessage('Nombre del proyecto requerido'),
        body('country').optional().trim(),
        body('website').optional().isURL().withMessage('URL inválida'),
        body('businessGoals').optional().isArray()
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

            const { businessType, projectName, country, website, businessGoals, companyDetails } = req.body;

            // Buscar o crear perfil
            let profile = await AdvertiserProfile.findOne({
                $or: [
                    { userId: req.user._id },
                    { walletAddress: req.user.walletAddress }
                ]
            });

            if (profile) {
                // Actualizar existente
                profile.businessType = businessType;
                profile.projectName = projectName;
                profile.country = country;
                profile.website = website;
                profile.businessGoals = businessGoals || [];
                profile.companyDetails = companyDetails || profile.companyDetails;
                profile.updatedAt = new Date();
            } else {
                // Crear nuevo
                profile = new AdvertiserProfile({
                    userId: req.user._id,
                    walletAddress: req.user.walletAddress,
                    businessType,
                    projectName,
                    country,
                    website,
                    businessGoals: businessGoals || [],
                    companyDetails: companyDetails || {}
                });
            }

            await profile.save();

            res.json({
                success: true,
                message: profile.isNew ? 'Perfil creado exitosamente' : 'Perfil actualizado exitosamente',
                profile: {
                    id: profile._id,
                    projectName: profile.projectName,
                    businessType: profile.businessType,
                    isActive: profile.isActive,
                    isSuspended: profile.isSuspended
                }
            });

        } catch (error) {
            console.error('Error saving advertiser profile:', error);
            res.status(500).json({
                success: false,
                error: 'Error al guardar perfil',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/advertiser-profile
 * Obtener perfil del anunciante
 */
router.get('/',
    authMiddleware,
    async (req, res) => {
        try {
            const profile = await AdvertiserProfile.findOne({
                $or: [
                    { userId: req.user._id },
                    { walletAddress: req.user.walletAddress }
                ]
            }).lean();

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Perfil no encontrado',
                    needsOnboarding: true
                });
            }

            res.json({
                success: true,
                data: profile
            });

        } catch (error) {
            console.error('Error fetching advertiser profile:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener perfil',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/advertiser-profile/check
 * Verificar si el usuario tiene perfil (para redireccionar al wizard)
 */
router.get('/check',
    authMiddleware,
    async (req, res) => {
        try {
            const profile = await AdvertiserProfile.findOne({
                $or: [
                    { userId: req.user._id },
                    { walletAddress: req.user.walletAddress }
                ]
            }).lean();

            res.json({
                success: true,
                hasProfile: !!profile,
                isActive: profile?.isActive || false,
                isSuspended: profile?.isSuspended || false,
                needsOnboarding: !profile
            });

        } catch (error) {
            console.error('Error checking advertiser profile:', error);
            res.status(500).json({
                success: false,
                error: 'Error al verificar perfil',
                details: error.message
            });
        }
    }
);

module.exports = router;
