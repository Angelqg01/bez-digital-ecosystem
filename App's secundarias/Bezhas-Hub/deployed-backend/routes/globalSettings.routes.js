const express = require('express');
const router = express.Router();
const GlobalSettings = require('../models/GlobalSettings.model');
const { verifyAdminToken } = require('../middleware/admin.middleware');
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * /api/admin/settings/global:
 *   get:
 *     summary: Get all global platform settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global settings retrieved successfully
 */
router.get('/', verifyAdminToken, async (req, res) => {
    try {
        const settings = await GlobalSettings.getSettings();

        res.json({
            success: true,
            settings: settings.toObject(),
            version: settings.version,
            lastUpdated: settings.updatedAt,
            lastUpdatedBy: settings.lastUpdatedBy,
        });
    } catch (error) {
        console.error('Error fetching global settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch global settings',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global:
 *   put:
 *     summary: Update global platform settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.put('/', verifyAdminToken, async (req, res) => {
    try {
        const updates = req.body;
        const adminId = req.admin?.id || req.user?.id || 'admin';

        // Remove protected fields
        delete updates._id;
        delete updates.createdAt;
        delete updates.updatedAt;
        delete updates.__v;

        const settings = await GlobalSettings.updateSettings(updates, adminId);

        res.json({
            success: true,
            message: 'Settings updated successfully',
            settings: settings.toObject(),
            version: settings.version,
        });
    } catch (error) {
        console.error('Error updating global settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update global settings',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/{section}:
 *   get:
 *     summary: Get a specific section of settings
 *     tags: [Admin Settings]
 */
router.get('/:section', verifyAdminToken, async (req, res) => {
    try {
        const { section } = req.params;
        const validSections = ['defi', 'fiat', 'token', 'farming', 'staking', 'dao', 'rwa', 'platform'];

        if (!validSections.includes(section)) {
            return res.status(400).json({
                success: false,
                error: `Invalid section. Valid sections: ${validSections.join(', ')}`,
            });
        }

        const settings = await GlobalSettings.getSettings();

        res.json({
            success: true,
            section,
            data: settings[section],
            version: settings.version,
        });
    } catch (error) {
        console.error('Error fetching section settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch section settings',
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/{section}:
 *   patch:
 *     summary: Update a specific section of settings
 *     tags: [Admin Settings]
 */
router.patch('/:section', verifyAdminToken, async (req, res) => {
    try {
        const { section } = req.params;
        const validSections = ['defi', 'fiat', 'token', 'farming', 'staking', 'dao', 'rwa', 'platform'];

        if (!validSections.includes(section)) {
            return res.status(400).json({
                success: false,
                error: `Invalid section. Valid sections: ${validSections.join(', ')}`,
            });
        }

        const adminId = req.admin?.id || req.user?.id || 'admin';
        const updates = { [section]: req.body };

        const settings = await GlobalSettings.updateSettings(updates, adminId);

        res.json({
            success: true,
            message: `${section} settings updated successfully`,
            section,
            data: settings[section],
            version: settings.version,
        });
    } catch (error) {
        console.error('Error updating section settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update section settings',
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/reset:
 *   post:
 *     summary: Reset all settings to defaults
 *     tags: [Admin Settings]
 */
router.post('/reset', verifyAdminToken, async (req, res) => {
    try {
        const adminId = req.admin?.id || req.user?.id || 'admin';

        // Delete existing and recreate with defaults
        await GlobalSettings.deleteOne({ _id: 'global_settings' });
        const settings = await GlobalSettings.create({
            _id: 'global_settings',
            lastUpdatedBy: adminId,
        });

        res.json({
            success: true,
            message: 'Settings reset to defaults',
            settings: settings.toObject(),
        });
    } catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset settings',
        });
    }
});

/**
 * Public endpoint to get settings relevant for frontend (non-sensitive)
 * No auth required
 */
router.get('/public/frontend', async (req, res) => {
    try {
        const settings = await GlobalSettings.getSettings();

        // Return only non-sensitive, frontend-relevant settings
        res.json({
            success: true,
            settings: {
                defi: {
                    enabled: settings.defi?.enabled,
                    swapFeePercent: settings.defi?.swapFeePercent,
                    maxSlippage: settings.defi?.maxSlippage,
                },
                fiat: {
                    enabled: settings.fiat?.enabled,
                    minPurchaseUSD: settings.fiat?.minPurchaseUSD,
                    maxPurchaseUSD: settings.fiat?.maxPurchaseUSD,
                    supportedCurrencies: settings.fiat?.supportedCurrencies,
                },
                token: {
                    contractAddress: settings.token?.contractAddress,
                    symbol: settings.token?.symbol,
                    decimals: settings.token?.decimals,
                },
                farming: {
                    enabled: settings.farming?.enabled,
                    defaultAPY: settings.farming?.defaultAPY,
                },
                staking: {
                    enabled: settings.staking?.enabled,
                    rewardRatePercent: settings.staking?.rewardRatePercent,
                    minStakeAmount: settings.staking?.minStakeAmount,
                },
                dao: {
                    enabled: settings.dao?.enabled,
                    quorumPercentage: settings.dao?.quorumPercentage,
                    votingPeriodDays: settings.dao?.votingPeriodDays,
                },
                rwa: {
                    enabled: settings.rwa?.enabled,
                    minInvestmentUSD: settings.rwa?.minInvestmentUSD,
                },
                platform: {
                    maintenanceMode: settings.platform?.maintenanceMode,
                    maintenanceMessage: settings.platform?.maintenanceMessage,
                    registrationEnabled: settings.platform?.registrationEnabled,
                },
            },
            version: settings.version,
        });
    } catch (error) {
        console.error('Error fetching public settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch settings',
        });
    }
});

module.exports = router;
