const { Router } = require('express');
const aiProviderService = require('../services/ai-provider.service');
const aiGuideService = require('../services/ai-guide.service');

const router = Router();

// Agentes predefinidos (en producción esto debería venir de una DB)
const AGENTS = [
    {
        id: 'bezhas-assistant',
        name: 'BeZhas Assistant',
        description:
            'Asistente oficial de BeZhas. Te ayudo con la plataforma, BEZ tokens, NFTs y Web3.',
        systemPrompt:
            'Eres el asistente oficial de BeZhas, una plataforma Web3 de redes sociales. Ayudas a los usuarios con preguntas sobre BEZ tokens, NFTs, staking, y navegación en la plataforma. Eres amigable, paciente y experto en blockchain.',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
        visibility: 'public',
        avatar: '🤖',
        personality: 'friendly',
        functions: ['getBezBalance', 'getUserNFTs'],
        enabled: true
    },
    {
        id: 'web3-expert',
        name: 'Web3 Expert',
        description: 'Experto técnico en blockchain, smart contracts y DeFi.',
        systemPrompt:
            'Eres un experto en blockchain, smart contracts y DeFi. Proporcionas explicaciones técnicas detalladas sobre Web3, Ethereum, protocolos DeFi y seguridad en blockchain.',
        model: 'gpt-4o',
        temperature: 0.6,
        maxTokens: 2000,
        visibility: 'vip',
        avatar: '⚡',
        personality: 'technical',
        functions: ['getBezBalance', 'isVipUser', 'getUserNFTs'],
        enabled: true
    },
    {
        id: 'nft-advisor',
        name: 'NFT Advisor',
        description:
            'Especialista en NFTs y arte digital. Te asesora en creación y venta de NFTs.',
        systemPrompt:
            'Eres un especialista en NFTs y arte digital. Ayudas a los usuarios a crear, valorar y vender sus NFTs. Eres creativo, conoces las tendencias del mercado y proporcionas consejos prácticos.',
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxTokens: 1500,
        visibility: 'public',
        avatar: '🎨',
        personality: 'creative',
        functions: ['getUserNFTs', 'getMarketplaceListings'],
        enabled: true
    },
    {
        id: 'gemini-assistant',
        name: 'Gemini 2.0 Flash',
        description: 'Asistente impulsado por Google Gemini 2.0 Flash. Rápido y versátil.',
        systemPrompt: 'Eres un asistente útil y versátil impulsado por Google Gemini. Ayudas a los usuarios con una amplia variedad de tareas.',
        model: 'gemini-2.0-flash',
        provider: 'google',
        temperature: 0.7,
        maxTokens: 2000,
        visibility: 'public',
        avatar: '✨',
        personality: 'helpful',
        enabled: true
    },
    {
        id: 'deepseek-assistant',
        name: 'DeepSeek Chat',
        description: 'Asistente impulsado por DeepSeek V3. Potente y eficiente.',
        systemPrompt: 'Eres un asistente útil y eficiente impulsado por DeepSeek. Ayudas a los usuarios con código y tareas complejas.',
        model: 'deepseek-chat',
        provider: 'deepseek',
        temperature: 0.7,
        maxTokens: 2000,
        visibility: 'public',
        avatar: '🐋',
        personality: 'helpful',
        enabled: true
    },
    {
        id: 'claude-assistant',
        name: 'Claude 3 Sonnet',
        description: 'Asistente inteligente impulsado por Anthropic Claude 3 Sonnet.',
        systemPrompt: 'Eres Claude, un asistente de IA creado por Anthropic. Eres útil, inofensivo y honesto.',
        model: 'claude-3-sonnet-20240229',
        provider: 'anthropic',
        temperature: 0.7,
        maxTokens: 2000,
        visibility: 'vip',
        avatar: '🧠',
        personality: 'intellectual',
        enabled: true
    },
    {
        id: 'analytics-bot',
        name: 'Analytics Bot',
        description: 'Analista de datos especializado en métricas y estadísticas de BeZhas.',
        systemPrompt:
            'Eres un analista de datos especializado en métricas de plataformas sociales y blockchain. Proporcionas insights basados en datos, análisis de tendencias y reportes de rendimiento.',
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 2000,
        visibility: 'vip',
        avatar: '📊',
        personality: 'analytical',
        functions: ['getUserStats', 'getTrendingTopics'],
        enabled: true
    }
];

// ==================== AGENTS ====================

router.get('/agents', async (req, res) => {
    try {
        const visibility = req.query.visibility;
        let agents = AGENTS.filter(a => a.enabled !== false);

        if (visibility) {
            agents = agents.filter(a => a.visibility === visibility);
        }

        res.json({ agents });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/agents/:id', async (req, res) => {
    try {
        const agent = AGENTS.find(a => a.id === req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        res.json(agent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CHAT ====================

router.post('/chat', async (req, res) => {
    try {
        const { agentId, messages } = req.body;

        if (!agentId || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Verificar si el agente está habilitado
        if (!agent.enabled) {
            return res.status(403).json({ error: 'Agent is disabled' });
        }

        // Moderación de contenido si está habilitada
        if (agent.enableModeration) {
            const lastUserMessage = messages[messages.length - 1];
            if (lastUserMessage && lastUserMessage.role === 'user') {
                const moderation = await aiProviderService.moderateContent(lastUserMessage.content);
                if (moderation.flagged) {
                    return res.status(400).json({
                        error: 'Content violates moderation policies',
                        categories: moderation.categories
                    });
                }
            }
        }

        const systemMessage = {
            role: 'system',
            content: agent.systemPrompt || agent.mainRole || 'You are a helpful assistant.'
        };

        const allMessages = [systemMessage, ...messages];

        // Usar el servicio multi-proveedor
        const response = await aiProviderService.chat({
            provider: agent.provider || 'openai',
            model: agent.model || 'gpt-4o-mini',
            messages: allMessages,
            temperature: agent.temperature || 0.7,
            maxTokens: agent.maxTokens || 2000,
            stream: false
        });

        res.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: response.model,
            provider: response.provider,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: response.content
                    },
                    finish_reason: 'stop'
                }
            ],
            usage: response.usage
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/chat/stream', async (req, res) => {
    try {
        const { agentId, messages } = req.body;

        if (!agentId || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Verificar si el agente está habilitado
        if (!agent.enabled) {
            return res.status(403).json({ error: 'Agent is disabled' });
        }

        // Moderación de contenido si está habilitada
        if (agent.enableModeration) {
            const lastUserMessage = messages[messages.length - 1];
            if (lastUserMessage && lastUserMessage.role === 'user') {
                const moderation = await aiProviderService.moderateContent(lastUserMessage.content);
                if (moderation.flagged) {
                    return res.status(400).json({
                        error: 'Content violates moderation policies',
                        categories: moderation.categories
                    });
                }
            }
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const systemMessage = {
            role: 'system',
            content: agent.systemPrompt || agent.mainRole || 'You are a helpful assistant.'
        };

        const allMessages = [systemMessage, ...messages];

        // Usar el servicio multi-proveedor con streaming
        const stream = await aiProviderService.chat({
            provider: agent.provider || 'openai',
            model: agent.model || 'gpt-4o-mini',
            messages: allMessages,
            temperature: agent.temperature || 0.7,
            maxTokens: agent.maxTokens || 2000,
            stream: true
        });

        // Manejar el stream según el proveedor
        const provider = agent.provider || 'openai';

        if (provider === 'openai' || provider === 'xai' || provider === 'deepseek') {
            // OpenAI-compatible streaming
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
            }
        } else if (provider === 'anthropic') {
            // Anthropic streaming
            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                    res.write(`data: ${JSON.stringify({ content: chunk.delta.text })}\n\n`);
                }
            }
        } else if (provider === 'google') {
            // Google Gemini streaming
            for await (const chunk of stream) {
                const text = chunk.text();
                if (text) {
                    res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
                }
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Stream error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// ==================== MODELS ====================

router.get('/models', (req, res) => {
    try {
        const availableProviders = aiProviderService.getAvailableProviders();

        const allModels = [
            // OpenAI
            { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', contextWindow: 128000, maxTokens: 4096 },
            { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', contextWindow: 128000, maxTokens: 16384 },
            { id: 'gpt-4-turbo', provider: 'openai', name: 'GPT-4 Turbo', contextWindow: 128000, maxTokens: 4096 },
            { id: 'gpt-4', provider: 'openai', name: 'GPT-4', contextWindow: 8192, maxTokens: 8192 },
            { id: 'gpt-3.5-turbo', provider: 'openai', name: 'GPT-3.5 Turbo', contextWindow: 16385, maxTokens: 4096 },

            // Anthropic (Claude)
            { id: 'claude-3-opus-20240229', provider: 'anthropic', name: 'Claude 3 Opus', contextWindow: 200000, maxTokens: 4096 },
            { id: 'claude-3-sonnet-20240229', provider: 'anthropic', name: 'Claude 3 Sonnet', contextWindow: 200000, maxTokens: 4096 },
            { id: 'claude-3-haiku-20240307', provider: 'anthropic', name: 'Claude 3 Haiku', contextWindow: 200000, maxTokens: 4096 },

            // Google Gemini
            { id: 'gemini-pro', provider: 'google', name: 'Gemini Pro', contextWindow: 32768, maxTokens: 8192 },
            { id: 'gemini-1.5-pro', provider: 'google', name: 'Gemini 1.5 Pro', contextWindow: 1000000, maxTokens: 8192 },
            { id: 'gemini-1.5-flash', provider: 'google', name: 'Gemini 1.5 Flash', contextWindow: 1000000, maxTokens: 8192 },

            // xAI (Grok)
            { id: 'grok-2', provider: 'xai', name: 'Grok 2', contextWindow: 128000, maxTokens: 4096 },
            { id: 'grok-1.5', provider: 'xai', name: 'Grok 1.5', contextWindow: 128000, maxTokens: 4096 },

            // DeepSeek
            { id: 'deepseek-chat', provider: 'deepseek', name: 'DeepSeek Chat', contextWindow: 32768, maxTokens: 4096 },
            { id: 'deepseek-coder', provider: 'deepseek', name: 'DeepSeek Coder', contextWindow: 32768, maxTokens: 4096 },
        ];

        // Filtrar solo modelos de proveedores disponibles
        const models = allModels.filter(model => availableProviders.includes(model.provider));

        res.json({
            models,
            availableProviders,
            totalModels: models.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TOOLS ====================

router.get('/tools', (req, res) => {
    try {
        const tools = [
            'getBezBalance',
            'isVipUser',
            'getUserNFTs',
            'getMarketplaceListings',
            'getUserProfile',
            'searchPosts',
            'getTrendingTopics',
            'getUserStats'
        ];
        res.json({ tools, definitions: [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ADMIN CONFIGURATION ====================

// Configuración general almacenada en memoria (en producción usar DB o archivo)
let generalConfig = {
    defaultModel: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.7,
    streamEnabled: true,
    vipAccessOnly: false,
    rateLimitPerUser: 50,
    enableFunctionCalling: true,
};

// API Keys almacenadas (en producción usar variable de entorno o secretos seguros)
const apiKeys = {
    openai: process.env.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    google: process.env.GOOGLE_API_KEY || ''
};

// GET configuración general
router.get('/config', (req, res) => {
    try {
        res.json({ config: generalConfig });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT actualizar configuración general
router.put('/config', (req, res) => {
    try {
        generalConfig = { ...generalConfig, ...req.body };
        res.json({
            success: true,
            config: generalConfig,
            message: 'Configuración actualizada correctamente'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT actualizar agente
router.put('/agents/:id', (req, res) => {
    try {
        const agentIndex = AGENTS.findIndex(a => a.id === req.params.id);
        if (agentIndex === -1) {
            return res.status(404).json({ error: 'Agente no encontrado' });
        }

        AGENTS[agentIndex] = { ...AGENTS[agentIndex], ...req.body };
        res.json({
            success: true,
            agent: AGENTS[agentIndex],
            message: 'Agente actualizado correctamente'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST crear nuevo agente
router.post('/agents', (req, res) => {
    try {
        const newAgent = {
            // Información básica
            id: req.body.id || `agent-${Date.now()}`,
            name: req.body.name || 'Nuevo Agente',
            description: req.body.description || '',
            avatar: req.body.avatar || '🤖',
            scope: req.body.scope || 'global',
            visibility: req.body.visibility || 'public',
            enabled: req.body.enabled !== undefined ? req.body.enabled : true,

            // Conocimiento y contexto
            systemPrompt: req.body.systemPrompt || '',
            mainRole: req.body.mainRole || '',
            groupContext: req.body.groupContext || '',
            targetAudience: req.body.targetAudience || '',
            specificFunctions: req.body.specificFunctions || [],

            // Comportamiento
            personality: req.body.personality || 'friendly',
            tone: req.body.tone || 'Amigable y Cercano',
            language: req.body.language || 'es',
            communicationStyle: req.body.communicationStyle || '',

            // Modelo y parámetros técnicos
            model: req.body.model || 'gpt-4o-mini',
            provider: req.body.provider || 'openai',
            temperature: req.body.temperature || 0.7,
            maxTokens: req.body.maxTokens || 2000,
            contextWindow: req.body.contextWindow || 4096,
            messageThreshold: req.body.messageThreshold || 15,

            // Moderación
            enableModeration: req.body.enableModeration !== undefined ? req.body.enableModeration : true,
            moderationRules: req.body.moderationRules || [],
            contentFilter: req.body.contentFilter || 'standard',

            // Características avanzadas
            memoryEnabled: req.body.memoryEnabled !== undefined ? req.body.memoryEnabled : true,
            functionsEnabled: req.body.functionsEnabled !== undefined ? req.body.functionsEnabled : true,
            availableFunctions: req.body.availableFunctions || [],
            shortcuts: req.body.shortcuts || [],
            actions: req.body.actions || [],

            // Sugerencias personalizadas
            canSuggestProducts: req.body.canSuggestProducts !== undefined ? req.body.canSuggestProducts : true,
            canSuggestCourses: req.body.canSuggestCourses !== undefined ? req.body.canSuggestCourses : true,
            canSuggestFriends: req.body.canSuggestFriends !== undefined ? req.body.canSuggestFriends : true,
            canSuggestGroups: req.body.canSuggestGroups !== undefined ? req.body.canSuggestGroups : true,
            canSuggestServices: req.body.canSuggestServices !== undefined ? req.body.canSuggestServices : true,

            // Apariencia UI
            appearance: req.body.appearance || 'timeless',
            uiBuilder: req.body.uiBuilder || 'standard',

            // Restricciones y ética
            privacyProtection: req.body.privacyProtection !== undefined ? req.body.privacyProtection : true,
            objectiveRecommendations: req.body.objectiveRecommendations !== undefined ? req.body.objectiveRecommendations : true,
            transparentLimitations: req.body.transparentLimitations !== undefined ? req.body.transparentLimitations : true,
            alwaysIdentifyAsAI: req.body.alwaysIdentifyAsAI !== undefined ? req.body.alwaysIdentifyAsAI : true,

            // Compatibilidad con estructura anterior
            functions: req.body.functions || req.body.availableFunctions || []
        };

        AGENTS.push(newAgent);
        res.json({
            success: true,
            agent: newAgent,
            message: 'Agente creado correctamente'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE eliminar agente
router.delete('/agents/:id', (req, res) => {
    try {
        const agentIndex = AGENTS.findIndex(a => a.id === req.params.id);
        if (agentIndex === -1) {
            return res.status(404).json({ error: 'Agente no encontrado' });
        }

        const deletedAgent = AGENTS.splice(agentIndex, 1)[0];
        res.json({
            success: true,
            agent: deletedAgent,
            message: 'Agente eliminado correctamente'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH habilitar/deshabilitar agente
router.patch('/agents/:id', (req, res) => {
    try {
        const agentIndex = AGENTS.findIndex(a => a.id === req.params.id);
        if (agentIndex === -1) {
            return res.status(404).json({ error: 'Agente no encontrado' });
        }

        AGENTS[agentIndex].enabled = req.body.enabled;
        res.json({
            success: true,
            agent: AGENTS[agentIndex],
            message: `Agente ${req.body.enabled ? 'activado' : 'desactivado'} correctamente`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST guardar API key
router.post('/api-keys', (req, res) => {
    try {
        const { provider, apiKey } = req.body;

        if (!provider || !apiKey) {
            return res.status(400).json({ error: 'Proveedor y API key son requeridos' });
        }

        if (!['openai', 'anthropic', 'google'].includes(provider)) {
            return res.status(400).json({ error: 'Proveedor no válido' });
        }

        apiKeys[provider] = apiKey;

        // En producción, actualizar variable de entorno o secreto seguro
        if (provider === 'openai') {
            process.env.OPENAI_API_KEY = apiKey;
        }

        res.json({
            success: true,
            message: 'API Key guardada correctamente'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET modelos disponibles
router.get('/models', (req, res) => {
    try {
        const models = [
            // OpenAI
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxTokens: 128000 },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxTokens: 128000 },
            { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', provider: 'openai', maxTokens: 128000 },

            // Anthropic
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', maxTokens: 200000 },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic', maxTokens: 200000 },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', maxTokens: 200000 },

            // Google Gemini
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', maxTokens: 1000000 },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', maxTokens: 1000000 },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', maxTokens: 1000000 },

            // DeepSeek
            { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', provider: 'deepseek', maxTokens: 32000 },
            { id: 'deepseek-coder', name: 'DeepSeek Coder (V2)', provider: 'deepseek', maxTokens: 32000 },

            // xAI
            { id: 'grok-2', name: 'Grok 2', provider: 'xai', maxTokens: 128000 },
        ];

        res.json({ success: true, models });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BEZHAS GUIDE CHAT ====================

/**
 * POST /api/ai/guide-chat
 * Endpoint para el Agente Guía Contextual de Bezhas
 * Responde según el rol del usuario (user/developer/admin)
 */
router.post('/guide-chat', async (req, res) => {
    try {
        const { message, pageContext, userRole } = req.body;

        // Validación
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Se requiere un mensaje válido',
                received: typeof message
            });
        }

        // Obtener respuesta del servicio
        const reply = await aiGuideService.getResponse(
            message,
            userRole || 'user',
            { page: pageContext || 'unknown' }
        );

        res.json({
            reply,
            role: userRole || 'user',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Guide Chat Error:', error);
        res.status(500).json({
            error: 'Error procesando la solicitud del guía',
            message: error.message
        });
    }
});

/**
 * GET /api/ai/guide-suggestions
 * Obtiene sugerencias rápidas según la página actual
 */
router.get('/guide-suggestions', (req, res) => {
    try {
        const { page, role } = req.query;

        const suggestions = aiGuideService.getSuggestionsForPage(
            page || '/',
            role || 'user'
        );

        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// HEALTH CHECK & STATUS
// ============================================

/**
 * GET /api/ai/health
 * Verifica estado de servicios de AI
 */
router.get('/health', async (req, res) => {
    try {
        const providers = aiProviderService.getAvailableProviders ?
            aiProviderService.getAvailableProviders() :
            ['openai', 'gemini', 'deepseek', 'anthropic'];

        res.json({
            success: true,
            service: 'AI Services',
            status: 'operational',
            providers,
            agents: AGENTS.filter(a => a.enabled).map(a => ({
                id: a.id,
                name: a.name,
                provider: a.provider || 'openai',
                visibility: a.visibility
            })),
            capabilities: {
                chat: true,
                imageGeneration: true,
                guideChat: true,
                streamingSupported: true
            },
            endpoints: [
                'GET /api/ai/agents',
                'GET /api/ai/agents/:agentId',
                'POST /api/ai/chat',
                'POST /api/ai/chat/stream',
                'POST /api/ai/generate-image',
                'POST /api/ai/guide-chat',
                'GET /api/ai/guide-suggestions',
                'GET /api/ai/health'
            ],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/ai/chat/stats
 * Estadísticas de uso del chat AI
 */
router.get('/chat/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            totalMessages: 0,
            activeChats: 0,
            modelUsage: {
                'gpt-4o-mini': 0,
                'gpt-4o': 0,
                'gemini-2.0-flash': 0,
                'deepseek-chat': 0,
                'claude-3-sonnet': 0
            },
            averageResponseTime: '0ms',
            errorRate: '0%'
        },
        note: 'Stats will be populated when the analytics system is active',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
