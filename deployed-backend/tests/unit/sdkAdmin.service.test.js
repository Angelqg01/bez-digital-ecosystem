/**
 * Unit tests: SDKAdmin Service
 * Tests the SDK admin service for configuration management.
 */

// Mock the SDKConfig model before requiring the service
const mockConfig = {
    sdkVersion: '1.0.0',
    isGloballyEnabled: true,
    maintenanceMode: false,
    maintenanceMessage: '',
    modules: [
        { moduleId: 'chat', displayName: 'AI Chat', isEnabled: true, version: '1.0.0' },
        { moduleId: 'marketplace', displayName: 'Marketplace', isEnabled: false, version: '1.0.0' },
        { moduleId: 'governance', displayName: 'DAO Governance', isEnabled: true, version: '1.0.0' },
    ],
    aiModels: [
        { _id: 'model-1', provider: 'openai', model: 'gpt-4', isActive: true, temperature: 0.7 },
        { _id: 'model-2', provider: 'google', model: 'gemini-pro', isActive: false, temperature: 0.5 },
    ],
    accessTiers: [
        { name: 'free', displayName: 'Free', requestsPerDay: 100 },
        { name: 'pro', displayName: 'Pro', requestsPerDay: 10000 },
    ],
    webhooks: [
        { _id: 'wh-1', name: 'Deploy Hook', url: 'https://hooks.example.com/deploy', isActive: true, failureCount: 0 },
        { _id: 'wh-2', name: 'Alert Hook', url: 'https://hooks.example.com/alert', isActive: false, failureCount: 0 },
    ],
    mcpServer: { url: 'http://bezhas-intelligence:8080', isConnected: true },
    globalRateLimit: 1000,
    logging: { level: 'info', enabled: true },
    security: {
        requireApiKey: true,
        allowedOrigins: ['https://bezhas.com', 'https://api.bezhas.com'],
        maxApiKeysPerUser: 5,
    },
    updatedAt: new Date('2026-01-15T00:00:00Z'),
    updatedBy: 'admin-wallet-0x123',
    notes: '',
    toObject() { return { ...this }; },
    save: jest.fn().mockResolvedValue(true),
};

// Add Mongoose-like subdocument helper
mockConfig.aiModels.id = jest.fn((id) => mockConfig.aiModels.find(m => m._id === id));
mockConfig.webhooks.id = jest.fn((id) => mockConfig.webhooks.find(w => w._id === id));

// Add deleteOne to model items
mockConfig.aiModels.forEach(m => { m.deleteOne = jest.fn(); });
mockConfig.webhooks.forEach(w => { w.deleteOne = jest.fn(); });

jest.mock('../../models/SDKConfig.model', () => ({
    getConfig: jest.fn(() => Promise.resolve(mockConfig)),
    updateConfig: jest.fn((updates, adminId) => {
        Object.assign(mockConfig, updates, { updatedBy: adminId });
        return Promise.resolve(mockConfig);
    }),
}));

jest.mock('../../utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
}));

const sdkAdminService = require('../../services/sdkAdmin.service');
const SDKConfig = require('../../models/SDKConfig.model');

describe('SDKAdminService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockConfig.save.mockResolvedValue(true);
        // Re-setup mocks after resetMocks clears implementations
        SDKConfig.getConfig.mockResolvedValue(mockConfig);
        SDKConfig.updateConfig.mockImplementation((updates, adminId) => {
            Object.assign(mockConfig, updates, { updatedBy: adminId });
            return Promise.resolve(mockConfig);
        });
        // Re-setup Mongoose-like subdoc helpers (resetMocks clears them)
        mockConfig.aiModels.id = jest.fn((id) => mockConfig.aiModels.find(m => m._id === id));
        mockConfig.webhooks.id = jest.fn((id) => mockConfig.webhooks.find(w => w._id === id));
        mockConfig.aiModels.forEach(m => { m.deleteOne = jest.fn(); });
        mockConfig.webhooks.forEach(w => { w.deleteOne = jest.fn(); });
    });

    // ── Global Config ──

    describe('getFullConfig', () => {
        it('should return full config as plain object', async () => {
            const result = await sdkAdminService.getFullConfig();
            expect(result).toHaveProperty('sdkVersion', '1.0.0');
            expect(result).toHaveProperty('isGloballyEnabled', true);
            expect(result).toHaveProperty('modules');
            expect(result).toHaveProperty('aiModels');
        });
    });

    describe('getOverview', () => {
        it('should return overview with computed fields', async () => {
            const result = await sdkAdminService.getOverview();

            expect(result.sdkVersion).toBe('1.0.0');
            expect(result.isGloballyEnabled).toBe(true);
            expect(result.totalModules).toBe(3);
            expect(result.enabledModules).toBe(2);
            expect(result.totalAIModels).toBe(2);
            expect(result.activeAIModels).toBe(1);
            expect(result.totalTiers).toBe(2);
            expect(result.totalWebhooks).toBe(2);
            expect(result.activeWebhooks).toBe(1);
        });

        it('should include security info', async () => {
            const result = await sdkAdminService.getOverview();
            expect(result.security.requireApiKey).toBe(true);
            expect(result.security.originsCount).toBe(2);
            expect(result.security.maxApiKeysPerUser).toBe(5);
        });
    });

    describe('updateGlobalSettings', () => {
        it('should update allowed fields only', async () => {
            const SDKConfig = require('../../models/SDKConfig.model');
            await sdkAdminService.updateGlobalSettings(
                { isGloballyEnabled: false, sdkVersion: '2.0.0', hackField: 'bad' },
                'admin-0x456'
            );
            expect(SDKConfig.updateConfig).toHaveBeenCalledWith(
                expect.objectContaining({ isGloballyEnabled: false, sdkVersion: '2.0.0' }),
                'admin-0x456'
            );
            // hackField should not be in the update
            const calledUpdates = SDKConfig.updateConfig.mock.calls[0][0];
            expect(calledUpdates).not.toHaveProperty('hackField');
        });
    });

    // ── Modules ──

    describe('getModules', () => {
        it('should return all modules', async () => {
            const modules = await sdkAdminService.getModules();
            expect(modules).toHaveLength(3);
        });
    });

    describe('getModule', () => {
        it('should return a specific module by ID', async () => {
            const mod = await sdkAdminService.getModule('chat');
            expect(mod.displayName).toBe('AI Chat');
            expect(mod.isEnabled).toBe(true);
        });

        it('should throw for non-existent module', async () => {
            await expect(sdkAdminService.getModule('nonexistent'))
                .rejects.toThrow("Module 'nonexistent' not found");
        });
    });

    describe('updateModule', () => {
        it('should update module fields and save', async () => {
            const mod = await sdkAdminService.updateModule('chat', { displayName: 'Updated Chat' }, 'admin');
            expect(mod.displayName).toBe('Updated Chat');
            expect(mockConfig.save).toHaveBeenCalled();
        });

        it('should throw for non-existent module', async () => {
            await expect(sdkAdminService.updateModule('missing', {}, 'admin'))
                .rejects.toThrow("Module 'missing' not found");
        });
    });

    describe('toggleModule', () => {
        it('should toggle module enabled state', async () => {
            const mod = await sdkAdminService.toggleModule('marketplace', true, 'admin');
            expect(mod.isEnabled).toBe(true);
        });
    });

    // ── AI Models ──

    describe('getAIModels', () => {
        it('should return all AI models', async () => {
            const models = await sdkAdminService.getAIModels();
            expect(models).toHaveLength(2);
        });
    });

    describe('addAIModel', () => {
        it('should add a new AI model', async () => {
            const newModel = { provider: 'anthropic', model: 'claude-3', isActive: true };
            const result = await sdkAdminService.addAIModel(newModel, 'admin');
            expect(result).toEqual(expect.objectContaining({ provider: 'anthropic' }));
            expect(mockConfig.save).toHaveBeenCalled();
        });
    });

    describe('updateAIModel', () => {
        it('should update an AI model by ID', async () => {
            const result = await sdkAdminService.updateAIModel('model-1', { temperature: 0.9 }, 'admin');
            expect(result.temperature).toBe(0.9);
            expect(mockConfig.save).toHaveBeenCalled();
        });

        it('should throw for non-existent model', async () => {
            await expect(sdkAdminService.updateAIModel('missing', {}, 'admin'))
                .rejects.toThrow("AI Model 'missing' not found");
        });
    });

    describe('deleteAIModel', () => {
        it('should delete an AI model', async () => {
            const result = await sdkAdminService.deleteAIModel('model-1', 'admin');
            expect(result.deleted).toBe(true);
            expect(result.modelId).toBe('model-1');
        });
    });

    // ── Access Tiers ──

    describe('getAccessTiers', () => {
        it('should return all access tiers', async () => {
            const tiers = await sdkAdminService.getAccessTiers();
            expect(tiers).toHaveLength(2);
            expect(tiers[0].name).toBe('free');
        });
    });

    describe('updateAccessTier', () => {
        it('should update a tier', async () => {
            const result = await sdkAdminService.updateAccessTier('pro', { requestsPerDay: 50000 }, 'admin');
            expect(result.requestsPerDay).toBe(50000);
        });

        it('should throw for non-existent tier', async () => {
            await expect(sdkAdminService.updateAccessTier('enterprise', {}, 'admin'))
                .rejects.toThrow("Tier 'enterprise' not found");
        });
    });

    // ── Webhooks ──

    describe('getWebhooks', () => {
        it('should return all webhooks', async () => {
            const webhooks = await sdkAdminService.getWebhooks();
            expect(webhooks).toHaveLength(2);
        });
    });

    describe('addWebhook', () => {
        it('should add a new webhook', async () => {
            const newWebhook = { name: 'New Hook', url: 'https://hooks.example.com/new', isActive: true };
            const result = await sdkAdminService.addWebhook(newWebhook, 'admin');
            expect(result).toEqual(expect.objectContaining({ name: 'New Hook' }));
        });
    });

    describe('updateWebhook', () => {
        it('should update webhook fields', async () => {
            const result = await sdkAdminService.updateWebhook('wh-1', { name: 'Updated Hook' }, 'admin');
            expect(result.name).toBe('Updated Hook');
        });

        it('should throw for non-existent webhook', async () => {
            await expect(sdkAdminService.updateWebhook('wh-missing', {}, 'admin'))
                .rejects.toThrow("Webhook 'wh-missing' not found");
        });
    });

    describe('deleteWebhook', () => {
        it('should delete a webhook', async () => {
            const result = await sdkAdminService.deleteWebhook('wh-1', 'admin');
            expect(result.deleted).toBe(true);
        });
    });
});
