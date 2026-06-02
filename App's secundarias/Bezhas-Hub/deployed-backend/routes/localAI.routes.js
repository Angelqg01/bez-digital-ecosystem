const { Router } = require('express');
const UnifiedAI = require('../services/unified-ai.service');
const mlService = require('../services/ml.service');
const dataOracleService = require('../services/data-oracle.service');
const aiProviderService = require('../services/ai-provider.service');

const router = Router();

/**
 * ==================== PERSONAL AI CHAT ====================
 */

// Chat con IA personal
router.post('/personal/chat', async (req, res) => {
    try {
        const { userId, message, agentConfig, walletAddress } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        // Actualizar datos blockchain si se proporciona wallet
        if (walletAddress) {
            await personalAIService.updateBlockchainData(userId, walletAddress);
        }

        // Procesar mensaje con IA personal
        const response = await personalAIService.processMessage(
            userId,
            message,
            agentConfig || {}
        );

        res.json({
            success: true,
            ...response,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Personal AI chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Inicializar perfil de IA personal
router.post('/personal/init', async (req, res) => {
    try {
        const { userId, initialData } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const profile = await personalAIService.initializeUserProfile(userId, initialData || {});

        res.json({
            success: true,
            profile: {
                userId: profile.userId,
                preferences: profile.preferences,
                personality: profile.personality,
                interactionCount: profile.interactionCount
            }
        });
    } catch (error) {
        console.error('Error initializing personal AI:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener perfil de IA personal
router.get('/personal/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const profile = await personalAIService.getUserProfile(userId);

        res.json({
            success: true,
            profile: {
                userId: profile.userId,
                preferences: profile.preferences,
                personality: profile.personality,
                interactionCount: profile.interactionCount,
                knowledgeBase: profile.knowledgeBase,
                blockchain: profile.blockchain
            }
        });
    } catch (error) {
        console.error('Error getting personal AI profile:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar preferencias
router.put('/personal/preferences/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { preferences } = req.body;

        const updated = personalAIService.updatePreferences(userId, preferences);

        if (!updated) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        res.json({
            success: true,
            message: 'Preferences updated'
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener estadísticas del usuario
router.get('/personal/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const stats = personalAIService.getUserStats(userId);

        if (!stats) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ==================== MACHINE LEARNING ====================
 */

// Analizar sentimiento
router.post('/ml/sentiment', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text is required' });
        }

        const result = await mlService.analyzeSentiment(text);

        res.json({
            success: true,
            sentiment: result
        });
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generar recomendaciones
router.post('/ml/recommendations', async (req, res) => {
    try {
        const { userId, contentPool } = req.body;

        if (!userId || !contentPool || !Array.isArray(contentPool)) {
            return res.status(400).json({ error: 'userId and contentPool array are required' });
        }

        const recommendations = await personalAIService.generatePersonalizedRecommendations(
            userId,
            contentPool
        );

        res.json({
            success: true,
            recommendations,
            count: recommendations.length
        });
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clasificar contenido
router.post('/ml/classify', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text is required' });
        }

        const embedding = mlService.generateTextEmbedding(text);
        const classification = await mlService.classifyContent(embedding);

        res.json({
            success: true,
            classification
        });
    } catch (error) {
        console.error('Classification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener estadísticas de modelos ML
router.get('/ml/stats', (req, res) => {
    try {
        const stats = mlService.getStats();

        res.json({
            success: true,
            models: stats,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('ML stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ==================== DATA ORACLE ====================
 */

// Obtener precio de BEZ
router.get('/oracle/bez-price', async (req, res) => {
    try {
        const price = await dataOracleService.getBEZPrice();

        res.json({
            success: true,
            price,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('BEZ price error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener precio de cualquier token
router.get('/oracle/token-price/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const price = await dataOracleService.getTokenPrice(symbol);

        res.json({
            success: true,
            symbol,
            price,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Token price error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Obtener balance de usuario - PROTEGIDO
 * Solo el usuario conectado puede ver su propio balance
 * Otros usuarios reciben un mensaje de privacidad
 */
router.get('/oracle/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const requestingWallet = req.headers['x-wallet-address']?.toLowerCase();

        // PRIVACIDAD: Solo el propietario puede ver su balance
        if (!requestingWallet || requestingWallet !== address.toLowerCase()) {
            return res.status(403).json({
                success: false,
                error: 'PRIVACY_PROTECTED',
                message: 'El balance de otros usuarios es información privada',
                hint: 'Solo puedes consultar tu propio balance'
            });
        }

        const balance = await dataOracleService.getUserBEZBalance(address);

        res.json({
            success: true,
            address,
            balance,
            unit: 'BEZ',
            timestamp: Date.now(),
            private: true
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener recompensas de usuario
router.get('/oracle/rewards/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const rewards = await dataOracleService.getUserRewards(address);

        res.json({
            success: true,
            address,
            rewards,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Rewards error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Validar contenido en blockchain
router.post('/oracle/validate-content', async (req, res) => {
    try {
        const { contentId } = req.body;

        if (!contentId) {
            return res.status(400).json({ error: 'contentId is required' });
        }

        const validation = await dataOracleService.validateContent(contentId);

        res.json({
            success: true,
            validation
        });
    } catch (error) {
        console.error('Content validation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener datos de la red
router.get('/oracle/network', async (req, res) => {
    try {
        const networkData = await dataOracleService.getNetworkData();

        res.json({
            success: true,
            network: networkData,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Network data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener datos agregados para IA
router.post('/oracle/ai-data', async (req, res) => {
    try {
        const { userId, context } = req.body;

        const aggregatedData = await dataOracleService.getAggregatedDataForAI(
            userId,
            context || {}
        );

        res.json({
            success: true,
            data: aggregatedData
        });
    } catch (error) {
        console.error('AI data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check del oracle
router.get('/oracle/health', async (req, res) => {
    try {
        const health = await dataOracleService.healthCheck();

        res.json({
            success: true,
            health
        });
    } catch (error) {
        console.error('Oracle health check error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ==================== CHAT INTEGRADO ====================
 */

// Chat completo con todas las funcionalidades
router.post('/integrated/chat', async (req, res) => {
    try {
        const {
            userId,
            message,
            agentId,
            walletAddress,
            includeML = true,
            includeOracle = true
        } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        const results = {};

        // 1. Análisis de sentimiento (si ML está habilitado)
        if (includeML) {
            results.sentiment = await mlService.analyzeSentiment(message);
        }

        // 2. Datos del oracle (si está habilitado y hay wallet)
        if (includeOracle && walletAddress) {
            results.blockchainData = await dataOracleService.getAggregatedDataForAI(
                userId,
                { userAddress: walletAddress }
            );
        }

        // 3. Procesar con IA personal
        const personalAIResponse = await personalAIService.processMessage(
            userId,
            message,
            { agentId }
        );

        res.json({
            success: true,
            message: personalAIResponse.response,
            sentiment: results.sentiment || personalAIResponse.sentiment,
            blockchainData: results.blockchainData || personalAIResponse.blockchainData,
            profile: personalAIResponse.profile,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Integrated chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Streaming chat con IA personal
router.post('/integrated/chat/stream', async (req, res) => {
    try {
        const {
            userId,
            message,
            agentConfig,
            walletAddress
        } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Actualizar datos blockchain
        if (walletAddress) {
            await personalAIService.updateBlockchainData(userId, walletAddress);
        }

        // Obtener perfil y construir contexto
        const profile = await personalAIService.getUserProfile(userId);
        const sentiment = await mlService.analyzeSentiment(message);

        // Enviar datos iniciales
        res.write(`data: ${JSON.stringify({
            type: 'init',
            sentiment: sentiment.sentiment,
            profile: {
                interactionCount: profile.interactionCount
            }
        })}\n\n`);

        // Obtener historial
        const history = personalAIService.conversationHistory.get(userId) || [];

        // Construir mensajes
        const messages = [
            {
                role: 'system',
                content: personalAIService.buildPersonalizedPrompt(profile, message, sentiment, null)
            },
            ...history.slice(-10),
            {
                role: 'user',
                content: message
            }
        ];

        // Stream de la IA
        const stream = await aiProviderService.chat({
            provider: agentConfig?.provider || 'openai',
            model: agentConfig?.model || 'gpt-4o-mini',
            messages,
            temperature: personalAIService.calculateTemperature(profile),
            maxTokens: agentConfig?.maxTokens || 1000,
            stream: true
        });

        let fullResponse = '';

        // Enviar chunks
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                fullResponse += content;
                res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
            }
        }

        // Guardar en historial
        personalAIService.addToHistory(userId, {
            role: 'user',
            content: message,
            timestamp: Date.now()
        });

        personalAIService.addToHistory(userId, {
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now()
        });

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    } catch (error) {
        console.error('Stream error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

/**
 * ==================== UTILIDADES ====================
 */

// Health check general
router.get('/health', async (req, res) => {
    try {
        const [mlStats, oracleHealth] = await Promise.all([
            mlService.getStats(),
            dataOracleService.healthCheck()
        ]);

        res.json({
            success: true,
            services: {
                ml: {
                    status: 'active',
                    models: mlStats
                },
                oracle: {
                    status: oracleHealth.provider ? 'active' : 'demo',
                    ...oracleHealth
                },
                personalAI: {
                    status: 'active',
                    activeProfiles: personalAIService.userProfiles.size
                }
            },
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
