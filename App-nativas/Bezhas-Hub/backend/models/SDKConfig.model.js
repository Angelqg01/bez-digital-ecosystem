const mongoose = require('mongoose');

/**
 * SDK Configuration Model
 * Manages SDK modules, AI model assignments, access tiers, and webhook integrations
 * for the BeZhas Platform unified SDK/AI admin system.
 */

// ── Sub-schemas ──

const AIModelConfigSchema = new mongoose.Schema({
    provider: {
        type: String,
        enum: ['openai', 'gemini', 'deepseek', 'anthropic', 'local', 'aegis'],
        required: true
    },
    model: { type: String, required: true }, // e.g., 'gpt-4o-mini', 'gemini-pro'
    temperature: { type: Number, default: 0.7, min: 0, max: 2 },
    maxTokens: { type: Number, default: 1000, min: 100, max: 32000 },
    systemPrompt: { type: String, default: '' },
    fallbackModel: { type: String, default: null }, // Fallback if primary fails
    rateLimitPerMinute: { type: Number, default: 60 },
    costPerTokenInput: { type: Number, default: 0 }, // USD per 1K tokens
    costPerTokenOutput: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { _id: true, timestamps: true });

const WebhookSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    events: [{ type: String }], // e.g., ['sdk.request', 'ai.completion', 'api.error']
    secret: { type: String, default: '' }, // HMAC signing secret
    isActive: { type: Boolean, default: true },
    retryCount: { type: Number, default: 3 },
    lastTriggered: { type: Date, default: null },
    failureCount: { type: Number, default: 0 }
}, { _id: true, timestamps: true });

const AccessTierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        enum: ['free', 'basic', 'pro', 'enterprise', 'internal']
    },
    displayName: { type: String, required: true },
    requestsPerDay: { type: Number, default: 100 },
    requestsPerMinute: { type: Number, default: 10 },
    allowedModules: [{ type: String }], // Module IDs this tier can access
    allowedModels: [{ type: String }], // AI model IDs this tier can use
    maxTokensPerRequest: { type: Number, default: 1000 },
    features: {
        streaming: { type: Boolean, default: false },
        webhooks: { type: Boolean, default: false },
        analytics: { type: Boolean, default: false },
        customPrompts: { type: Boolean, default: false }
    },
    priceMonthlyUSD: { type: Number, default: 0 },
    priceBEZ: { type: Number, default: 0 } // Price in BEZ tokens
}, { _id: true });

const SDKModuleSchema = new mongoose.Schema({
    moduleId: {
        type: String,
        required: true,
        enum: [
            'ai-chat',          // AI chatbot / guide
            'ai-moderation',    // Content moderation AI
            'ai-analytics',     // AI-powered analytics
            'gas-strategy',     // MCP gas optimization
            'smart-swap',       // MCP token swap calculator
            'compliance',       // MCP regulatory compliance
            'nft-toolkit',      // NFT minting/marketplace SDK
            'defi-toolkit',     // DeFi staking/farming SDK
            'social-graph',     // Social connections API
            'notifications',    // Push notifications SDK
            'bridge-api',       // Cross-chain bridge API
            'dao-governance'    // DAO voting/proposals API
        ]
    },
    displayName: { type: String, required: true },
    description: { type: String, default: '' },
    version: { type: String, default: '1.0.0' },
    isEnabled: { type: Boolean, default: true },
    assignedModel: { type: mongoose.Schema.Types.ObjectId, ref: 'SDKConfig' }, // For AI modules
    assignedModelConfig: AIModelConfigSchema, // Inline model config for this module
    endpoint: { type: String, default: '' }, // Base API endpoint
    rateLimit: { type: Number, default: 100 }, // Requests per minute
    requiredTier: {
        type: String,
        enum: ['free', 'basic', 'pro', 'enterprise', 'internal'],
        default: 'free'
    },
    stats: {
        totalRequests: { type: Number, default: 0 },
        totalErrors: { type: Number, default: 0 },
        avgResponseTime: { type: Number, default: 0 }, // ms
        lastUsed: { type: Date, default: null }
    }
}, { _id: true, timestamps: true });

// ── Main Schema ──

const SDKConfigSchema = new mongoose.Schema({
    // Global SDK settings
    sdkVersion: { type: String, default: '1.0.0' },
    isGloballyEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'SDK is under maintenance. Please try again later.' },

    // Modules registry
    modules: [SDKModuleSchema],

    // AI Models registry (global pool that modules can reference)
    aiModels: [AIModelConfigSchema],

    // Access tiers configuration
    accessTiers: [AccessTierSchema],

    // Webhooks
    webhooks: [WebhookSchema],

    // Global rate limiting
    globalRateLimit: {
        requestsPerMinute: { type: Number, default: 1000 },
        requestsPerDay: { type: Number, default: 100000 },
        burstLimit: { type: Number, default: 50 }
    },

    // Logging & monitoring
    logging: {
        level: { type: String, enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
        retentionDays: { type: Number, default: 30 },
        enableRequestLogs: { type: Boolean, default: true },
        enableAILogs: { type: Boolean, default: true }
    },

    // Security settings
    security: {
        requireApiKey: { type: Boolean, default: true },
        allowedOrigins: [{ type: String }], // CORS origins
        ipWhitelist: [{ type: String }],
        maxApiKeysPerUser: { type: Number, default: 5 }
    },

    // MCP Intelligence Server connection
    mcpServer: {
        url: { type: String, default: 'http://bezhas-intelligence:8080' },
        isConnected: { type: Boolean, default: false },
        lastHealthCheck: { type: Date, default: null },
        version: { type: String, default: '' }
    },

    // Metadata
    updatedBy: { type: String, default: '' }, // Admin wallet or ID
    notes: { type: String, default: '' }
}, {
    timestamps: true,
    collection: 'sdk_configs'
});

// Ensure only one config document exists (singleton pattern)
SDKConfigSchema.statics.getConfig = async function () {
    let config = await this.findOne();
    if (!config) {
        config = await this.create(getDefaultConfig());
    }
    return config;
};

SDKConfigSchema.statics.updateConfig = async function (updates, adminId) {
    let config = await this.findOne();
    if (!config) {
        config = await this.create({ ...getDefaultConfig(), ...updates, updatedBy: adminId });
    } else {
        Object.assign(config, updates, { updatedBy: adminId });
        await config.save();
    }
    return config;
};

// Default configuration factory
function getDefaultConfig() {
    return {
        sdkVersion: '1.0.0',
        isGloballyEnabled: true,
        modules: [
            {
                moduleId: 'ai-chat',
                displayName: 'AI Chat & Guide',
                description: 'Chatbot contextual para usuarios, developers y admins',
                isEnabled: true,
                endpoint: '/api/ai/guide-chat',
                requiredTier: 'free'
            },
            {
                moduleId: 'ai-moderation',
                displayName: 'AI Content Moderation',
                description: 'Moderación automática de contenido con IA',
                isEnabled: true,
                endpoint: '/api/ai/moderate',
                requiredTier: 'basic'
            },
            {
                moduleId: 'gas-strategy',
                displayName: 'Gas Strategy Optimizer',
                description: 'Optimización inteligente de gas via MCP Server',
                isEnabled: true,
                endpoint: '/api/ai-gateway/gas-strategy',
                requiredTier: 'pro'
            },
            {
                moduleId: 'smart-swap',
                displayName: 'Smart Swap Calculator',
                description: 'Calculadora BEZ↔FIAT con optimización de fees',
                isEnabled: true,
                endpoint: '/api/ai-gateway/smart-swap',
                requiredTier: 'pro'
            },
            {
                moduleId: 'compliance',
                displayName: 'Regulatory Compliance',
                description: 'Verificación AML/KYC automatizada',
                isEnabled: true,
                endpoint: '/api/ai-gateway/compliance',
                requiredTier: 'enterprise'
            },
            {
                moduleId: 'nft-toolkit',
                displayName: 'NFT Toolkit',
                description: 'SDK para minting, marketplace y gestión de NFTs',
                isEnabled: true,
                endpoint: '/api/nft',
                requiredTier: 'basic'
            },
            {
                moduleId: 'defi-toolkit',
                displayName: 'DeFi Toolkit',
                description: 'Staking, farming y yield optimization',
                isEnabled: true,
                endpoint: '/api/staking',
                requiredTier: 'pro'
            },
            {
                moduleId: 'bridge-api',
                displayName: 'Cross-Chain Bridge',
                description: 'API para bridge cross-chain de tokens',
                isEnabled: true,
                endpoint: '/api/v1/bridge',
                requiredTier: 'enterprise'
            }
        ],
        aiModels: [
            {
                provider: 'openai',
                model: 'gpt-4o-mini',
                temperature: 0.7,
                maxTokens: 1000,
                rateLimitPerMinute: 60,
                isActive: true
            },
            {
                provider: 'gemini',
                model: 'gemini-pro',
                temperature: 0.7,
                maxTokens: 2000,
                rateLimitPerMinute: 30,
                isActive: true
            },
            {
                provider: 'deepseek',
                model: 'deepseek-chat',
                temperature: 0.7,
                maxTokens: 1500,
                rateLimitPerMinute: 20,
                isActive: false
            }
        ],
        accessTiers: [
            {
                name: 'free',
                displayName: 'Free Tier',
                requestsPerDay: 100,
                requestsPerMinute: 5,
                allowedModules: ['ai-chat', 'social-graph', 'notifications'],
                maxTokensPerRequest: 500,
                features: { streaming: false, webhooks: false, analytics: false, customPrompts: false },
                priceMonthlyUSD: 0,
                priceBEZ: 0
            },
            {
                name: 'basic',
                displayName: 'Basic Developer',
                requestsPerDay: 1000,
                requestsPerMinute: 20,
                allowedModules: ['ai-chat', 'ai-moderation', 'nft-toolkit', 'social-graph', 'notifications'],
                maxTokensPerRequest: 1000,
                features: { streaming: true, webhooks: false, analytics: true, customPrompts: false },
                priceMonthlyUSD: 9.99,
                priceBEZ: 100
            },
            {
                name: 'pro',
                displayName: 'Pro Developer',
                requestsPerDay: 10000,
                requestsPerMinute: 60,
                allowedModules: ['ai-chat', 'ai-moderation', 'ai-analytics', 'gas-strategy', 'smart-swap', 'nft-toolkit', 'defi-toolkit', 'social-graph', 'notifications'],
                maxTokensPerRequest: 4000,
                features: { streaming: true, webhooks: true, analytics: true, customPrompts: true },
                priceMonthlyUSD: 49.99,
                priceBEZ: 500
            },
            {
                name: 'enterprise',
                displayName: 'Enterprise',
                requestsPerDay: 100000,
                requestsPerMinute: 200,
                allowedModules: ['ai-chat', 'ai-moderation', 'ai-analytics', 'gas-strategy', 'smart-swap', 'compliance', 'nft-toolkit', 'defi-toolkit', 'social-graph', 'notifications', 'bridge-api', 'dao-governance'],
                maxTokensPerRequest: 16000,
                features: { streaming: true, webhooks: true, analytics: true, customPrompts: true },
                priceMonthlyUSD: 199.99,
                priceBEZ: 2000
            }
        ],
        webhooks: [],
        security: {
            requireApiKey: true,
            allowedOrigins: ['https://bezhas.com', 'http://localhost:5173'],
            maxApiKeysPerUser: 5
        }
    };
}

module.exports = mongoose.model('SDKConfig', SDKConfigSchema);
