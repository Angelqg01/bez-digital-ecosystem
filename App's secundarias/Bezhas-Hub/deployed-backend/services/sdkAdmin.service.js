const SDKConfig = require('../models/SDKConfig.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger') || console;

/**
 * SDK Admin Service
 * Business logic for managing SDK configuration, modules, AI models,
 * access tiers, and webhooks.
 */
class SDKAdminService {

    /**
     * Ensure MongoDB is connected before attempting operations
     * @throws {Error} with statusCode 503 if not connected
     */
    _ensureDbConnected() {
        if (mongoose.connection.readyState !== 1) {
            const err = new Error('MongoDB is not connected. SDK Admin features require a database connection.');
            err.statusCode = 503;
            throw err;
        }
    }

    // ── Global Config ──

    async getFullConfig() {
        this._ensureDbConnected();
        try {
            const config = await SDKConfig.getConfig();
            return config.toObject();
        } catch (error) {
            logger.error?.('SDKAdminService.getFullConfig error:', error) || console.error(error);
            throw error;
        }
    }

    async getOverview() {
        this._ensureDbConnected();
        try {
            const config = await SDKConfig.getConfig();
            return {
                sdkVersion: config.sdkVersion,
                isGloballyEnabled: config.isGloballyEnabled,
                maintenanceMode: config.maintenanceMode,
                totalModules: config.modules.length,
                enabledModules: config.modules.filter(m => m.isEnabled).length,
                totalAIModels: config.aiModels.length,
                activeAIModels: config.aiModels.filter(m => m.isActive).length,
                totalTiers: config.accessTiers.length,
                totalWebhooks: config.webhooks.length,
                activeWebhooks: config.webhooks.filter(w => w.isActive).length,
                mcpServer: config.mcpServer,
                globalRateLimit: config.globalRateLimit,
                logging: config.logging,
                security: {
                    requireApiKey: config.security.requireApiKey,
                    originsCount: config.security.allowedOrigins?.length || 0,
                    maxApiKeysPerUser: config.security.maxApiKeysPerUser
                },
                updatedAt: config.updatedAt,
                updatedBy: config.updatedBy
            };
        } catch (error) {
            logger.error?.('SDKAdminService.getOverview error:', error) || console.error(error);
            throw error;
        }
    }

    async updateGlobalSettings(settings, adminId) {
        this._ensureDbConnected();
        try {
            const allowedFields = [
                'isGloballyEnabled', 'maintenanceMode', 'maintenanceMessage',
                'sdkVersion', 'globalRateLimit', 'logging', 'security', 'notes'
            ];
            const updates = {};
            for (const key of allowedFields) {
                if (settings[key] !== undefined) {
                    updates[key] = settings[key];
                }
            }
            const config = await SDKConfig.updateConfig(updates, adminId);
            return config.toObject();
        } catch (error) {
            logger.error?.('SDKAdminService.updateGlobalSettings error:', error) || console.error(error);
            throw error;
        }
    }

    // ── Modules ──

    async getModules() {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        return config.modules;
    }

    async getModule(moduleId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const mod = config.modules.find(m => m.moduleId === moduleId);
        if (!mod) throw new Error(`Module '${moduleId}' not found`);
        return mod;
    }

    async updateModule(moduleId, updates, adminId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const mod = config.modules.find(m => m.moduleId === moduleId);
        if (!mod) throw new Error(`Module '${moduleId}' not found`);

        const allowedFields = [
            'displayName', 'description', 'version', 'isEnabled',
            'assignedModelConfig', 'endpoint', 'rateLimit', 'requiredTier'
        ];
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                mod[key] = updates[key];
            }
        }
        config.updatedBy = adminId;
        await config.save();
        return mod;
    }

    async toggleModule(moduleId, enabled, adminId) {
        return this.updateModule(moduleId, { isEnabled: enabled }, adminId);
    }

    // ── AI Models ──

    async getAIModels() {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        return config.aiModels;
    }

    async addAIModel(modelData, adminId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        config.aiModels.push(modelData);
        config.updatedBy = adminId;
        await config.save();
        return config.aiModels[config.aiModels.length - 1];
    }

    async updateAIModel(modelId, updates, adminId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const model = config.aiModels.id(modelId);
        if (!model) throw new Error(`AI Model '${modelId}' not found`);

        const allowedFields = [
            'provider', 'model', 'temperature', 'maxTokens', 'systemPrompt',
            'fallbackModel', 'rateLimitPerMinute', 'costPerTokenInput',
            'costPerTokenOutput', 'isActive'
        ];
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                model[key] = updates[key];
            }
        }
        config.updatedBy = adminId;
        await config.save();
        return model;
    }

    async deleteAIModel(modelId, adminId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const model = config.aiModels.id(modelId);
        if (!model) throw new Error(`AI Model '${modelId}' not found`);
        model.deleteOne();
        config.updatedBy = adminId;
        await config.save();
        return { deleted: true, modelId };
    }

    async toggleAIModel(modelId, active, adminId) {
        return this.updateAIModel(modelId, { isActive: active }, adminId);
    }

    // ── Access Tiers ──

    async getAccessTiers() {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        return config.accessTiers;
    }

    async updateAccessTier(tierName, updates, adminId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const tier = config.accessTiers.find(t => t.name === tierName);
        if (!tier) throw new Error(`Tier '${tierName}' not found`);

        const allowedFields = [
            'displayName', 'requestsPerDay', 'requestsPerMinute',
            'allowedModules', 'allowedModels', 'maxTokensPerRequest',
            'features', 'priceMonthlyUSD', 'priceBEZ'
        ];
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                tier[key] = updates[key];
            }
        }
        config.updatedBy = adminId;
        await config.save();
        return tier;
    }

    // ── Webhooks ──

    async getWebhooks() {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        return config.webhooks;
    }

    async addWebhook(webhookData, adminId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        config.webhooks.push(webhookData);
        config.updatedBy = adminId;
        await config.save();
        return config.webhooks[config.webhooks.length - 1];
    }

    async updateWebhook(webhookId, updates, adminId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const webhook = config.webhooks.id(webhookId);
        if (!webhook) throw new Error(`Webhook '${webhookId}' not found`);

        const allowedFields = ['name', 'url', 'events', 'secret', 'isActive', 'retryCount'];
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                webhook[key] = updates[key];
            }
        }
        config.updatedBy = adminId;
        await config.save();
        return webhook;
    }

    async deleteWebhook(webhookId, adminId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const webhook = config.webhooks.id(webhookId);
        if (!webhook) throw new Error(`Webhook '${webhookId}' not found`);
        webhook.deleteOne();
        config.updatedBy = adminId;
        await config.save();
        return { deleted: true, webhookId };
    }

    async testWebhook(webhookId) {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const webhook = config.webhooks.id(webhookId);
        if (!webhook) throw new Error(`Webhook '${webhookId}' not found`);

        try {
            const fetch = require('node-fetch');
            const crypto = require('crypto');
            const payload = {
                event: 'test',
                timestamp: new Date().toISOString(),
                data: { message: 'Webhook test from BeZhas SDK Admin' }
            };
            const body = JSON.stringify(payload);
            const headers = { 'Content-Type': 'application/json' };

            if (webhook.secret) {
                const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
                headers['x-bezhas-signature'] = signature;
            }

            const response = await fetch(webhook.url, { method: 'POST', headers, body, timeout: 10000 });
            webhook.lastTriggered = new Date();
            if (!response.ok) webhook.failureCount += 1;
            await config.save();

            return {
                success: response.ok,
                status: response.status,
                statusText: response.statusText
            };
        } catch (error) {
            webhook.failureCount += 1;
            await config.save();
            return { success: false, error: error.message };
        }
    }

    // ── MCP Server Health ──

    async checkMCPHealth() {
        this._ensureDbConnected();
        const config = await SDKConfig.getConfig();
        const mcpUrl = config.mcpServer?.url || process.env.MCP_SERVER_URL || 'http://bezhas-intelligence:8080';

        try {
            const fetch = require('node-fetch');
            const response = await fetch(`${mcpUrl}/api/mcp/health`, { timeout: 5000 });
            const data = await response.json();

            config.mcpServer = {
                ...config.mcpServer,
                url: mcpUrl,
                isConnected: response.ok,
                lastHealthCheck: new Date(),
                version: data.version || ''
            };
            await config.save();

            return { connected: true, ...data };
        } catch (error) {
            config.mcpServer = {
                ...config.mcpServer,
                isConnected: false,
                lastHealthCheck: new Date()
            };
            await config.save();
            return { connected: false, error: error.message };
        }
    }
}

module.exports = new SDKAdminService();
