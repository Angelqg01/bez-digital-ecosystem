const express = require('express');
const router = express.Router();
const GlobalSettings = require('../models/pg/GlobalSettings');
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
            settings: settings,
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

        const settings = await GlobalSettings.updateSettings(updates, adminId, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
            method: req.method,
            path: req.originalUrl
        });

        res.json({
            success: true,
            message: 'Settings updated successfully',
            settings: settings,
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

        const settings = await GlobalSettings.updateSettings(updates, adminId, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
            method: req.method,
            path: req.originalUrl
        });

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
            settings: settings,
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

const AuditLog = require('../models/pg/AuditLog');

/**
 * @swagger
 * /api/admin/settings/global/audit:
 *   get:
 *     summary: Get audit logs for global settings
 *     tags: [Admin Settings]
 */
router.get('/audit/logs', verifyAdminToken, async (req, res) => {
    try {
        const logs = await AuditLog.find({ resource: 'global_settings' })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('user', 'username email');

        res.json({
            success: true,
            logs
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit logs'
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/rollback:
 *   post:
 *     summary: Rollback settings to a previous version
 *     tags: [Admin Settings]
 */
router.post('/rollback', verifyAdminToken, async (req, res) => {
    try {
        const { auditLogId } = req.body;
        if (!auditLogId) {
            return res.status(400).json({
                success: false,
                error: 'auditLogId is required'
            });
        }

        const adminId = req.admin?.id || req.user?.id || 'admin';
        const settings = await GlobalSettings.rollback(auditLogId, adminId);

        res.json({
            success: true,
            message: 'Settings rolled back successfully',
            settings: settings,
            version: settings.version
        });
    } catch (error) {
        console.error('Error performing rollback:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform rollback',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/export:
 *   get:
 *     summary: Export global settings to JSON file
 *     tags: [Admin Settings]
 */
router.get('/export', verifyAdminToken, async (req, res) => {
    try {
        const settings = await GlobalSettings.getSettings();
        const data = settings;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=bezhas-global-settings.json');
        res.send(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error exporting settings:', error);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

/**
 * @swagger
 * /api/admin/settings/global/import:
 *   post:
 *     summary: Import global settings from JSON
 *     tags: [Admin Settings]
 */
router.post('/import', verifyAdminToken, async (req, res) => {
    try {
        const { settingsData } = req.body;
        if (!settingsData) {
            return res.status(400).json({ success: false, error: 'Settings data required' });
        }

        const adminId = req.admin?.id || req.user?.id || 'admin';
        const previousSettings = await GlobalSettings.getSettings();
        const previousState = previousSettings;

        // Remove ID and internal fields from import
        delete settingsData._id;
        delete settingsData.createdAt;
        delete settingsData.updatedAt;
        delete settingsData.__v;

        const updatedSettings = await GlobalSettings.updateSettings(settingsData, adminId, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
            method: 'IMPORT_JSON',
            path: req.originalUrl
        });

        res.json({
            success: true,
            message: 'Settings imported and updated successfully',
            version: updatedSettings.version
        });
    } catch (error) {
        console.error('Error importing settings:', error);
        res.status(500).json({ success: false, error: 'Import failed', message: error.message });
    }
});

module.exports = router;
