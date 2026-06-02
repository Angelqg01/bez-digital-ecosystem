const sdkAdminService = require('../services/sdkAdmin.service');

/**
 * SDK Admin Controller
 * Handles HTTP request/response for SDK configuration management.
 */

// ── Global Config ──

exports.getOverview = async (req, res) => {
    try {
        const overview = await sdkAdminService.getOverview();
        res.json({ success: true, data: overview });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.getFullConfig = async (req, res) => {
    try {
        const config = await sdkAdminService.getFullConfig();
        res.json({ success: true, data: config });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.updateGlobalSettings = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const config = await sdkAdminService.updateGlobalSettings(req.body, adminId);
        res.json({ success: true, data: config, message: 'Configuración global actualizada' });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

// ── Modules ──

exports.getModules = async (req, res) => {
    try {
        const modules = await sdkAdminService.getModules();
        res.json({ success: true, data: modules });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.getModule = async (req, res) => {
    try {
        const mod = await sdkAdminService.getModule(req.params.moduleId);
        res.json({ success: true, data: mod });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.updateModule = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const mod = await sdkAdminService.updateModule(req.params.moduleId, req.body, adminId);
        res.json({ success: true, data: mod, message: `Módulo '${req.params.moduleId}' actualizado` });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.toggleModule = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'Field "enabled" (boolean) is required' });
        }
        const mod = await sdkAdminService.toggleModule(req.params.moduleId, enabled, adminId);
        res.json({ success: true, data: mod, message: `Módulo ${enabled ? 'activado' : 'desactivado'}` });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

// ── AI Models ──

exports.getAIModels = async (req, res) => {
    try {
        const models = await sdkAdminService.getAIModels();
        res.json({ success: true, data: models });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.addAIModel = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const { provider, model } = req.body;
        if (!provider || !model) {
            return res.status(400).json({ success: false, error: 'Fields "provider" and "model" are required' });
        }
        const newModel = await sdkAdminService.addAIModel(req.body, adminId);
        res.status(201).json({ success: true, data: newModel, message: 'Modelo AI agregado' });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.updateAIModel = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const model = await sdkAdminService.updateAIModel(req.params.modelId, req.body, adminId);
        res.json({ success: true, data: model, message: 'Modelo AI actualizado' });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.deleteAIModel = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const result = await sdkAdminService.deleteAIModel(req.params.modelId, adminId);
        res.json({ success: true, data: result, message: 'Modelo AI eliminado' });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.toggleAIModel = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const { active } = req.body;
        if (typeof active !== 'boolean') {
            return res.status(400).json({ success: false, error: 'Field "active" (boolean) is required' });
        }
        const model = await sdkAdminService.toggleAIModel(req.params.modelId, active, adminId);
        res.json({ success: true, data: model, message: `Modelo AI ${active ? 'activado' : 'desactivado'}` });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

// ── Access Tiers ──

exports.getAccessTiers = async (req, res) => {
    try {
        const tiers = await sdkAdminService.getAccessTiers();
        res.json({ success: true, data: tiers });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.updateAccessTier = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const tier = await sdkAdminService.updateAccessTier(req.params.tierName, req.body, adminId);
        res.json({ success: true, data: tier, message: `Tier '${req.params.tierName}' actualizado` });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

// ── Webhooks ──

exports.getWebhooks = async (req, res) => {
    try {
        const webhooks = await sdkAdminService.getWebhooks();
        res.json({ success: true, data: webhooks });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.addWebhook = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const { name, url } = req.body;
        if (!name || !url) {
            return res.status(400).json({ success: false, error: 'Fields "name" and "url" are required' });
        }
        const webhook = await sdkAdminService.addWebhook(req.body, adminId);
        res.status(201).json({ success: true, data: webhook, message: 'Webhook creado' });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.updateWebhook = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const webhook = await sdkAdminService.updateWebhook(req.params.webhookId, req.body, adminId);
        res.json({ success: true, data: webhook, message: 'Webhook actualizado' });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.deleteWebhook = async (req, res) => {
    try {
        const adminId = req.admin?.id || 'unknown';
        const result = await sdkAdminService.deleteWebhook(req.params.webhookId, adminId);
        res.json({ success: true, data: result, message: 'Webhook eliminado' });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

exports.testWebhook = async (req, res) => {
    try {
        const result = await sdkAdminService.testWebhook(req.params.webhookId);
        res.json({ success: true, data: result });
    } catch (error) {
        const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        res.status(status).json({ success: false, error: error.message });
    }
};

// ── MCP Server ──

exports.checkMCPHealth = async (req, res) => {
    try {
        const health = await sdkAdminService.checkMCPHealth();
        res.json({ success: true, data: health });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ success: false, error: error.message });
    }
};
