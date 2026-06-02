const { Router } = require('express');
console.log('Loading AI Routes...');
const OpenAI = require('openai');

const router = Router();

// OpenAI client
// const openai = new OpenAI({
//    apiKey: process.env.OPENAI_API_KEY || 'sk-test'
// });
const openai = { chat: { completions: { create: async () => ({ choices: [{ message: { content: 'Mock Response' } }] }) } } };

// Agentes predefinidos (en producción esto debería venir de una DB)
const AGENTS = [
    {
        id: 'bezhas-assistant',
        name: 'BeZhas Assistant',
        description: 'Asistente oficial de BeZhas. Te ayudo con la plataforma, BEZ tokens, NFTs y Web3.',
        systemPrompt: 'Eres el asistente oficial de BeZhas, una plataforma Web3 de redes sociales. Ayudas a los usuarios con preguntas sobre BEZ tokens, NFTs, staking, y navegación en la plataforma. Eres amigable, paciente y experto en blockchain.',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
        visibility: 'public',
        avatar: '🤖',
        personality: 'friendly',
        functions: ['getBezBalance', 'getUserNFTs']
    },
    {
        id: 'web3-expert',
        name: 'Web3 Expert',
        description: 'Experto técnico en blockchain, smart contracts y DeFi.',
        systemPrompt: 'Eres un experto en blockchain, smart contracts y DeFi. Proporcionas explicaciones técnicas detalladas sobre Web3, Ethereum, protocolos DeFi y seguridad en blockchain.',
        model: 'gpt-4o',
        temperature: 0.6,
        maxTokens: 2000,
        visibility: 'vip',
        avatar: '⚡',
        personality: 'technical',
        functions: ['getBezBalance', 'isVipUser', 'getUserNFTs']
    },
    {
        id: 'nft-advisor',
        name: 'NFT Advisor',
        description: 'Especialista en NFTs y arte digital. Te asesora en creación y venta de NFTs.',
        systemPrompt: 'Eres un especialista en NFTs y arte digital. Ayudas a los usuarios a crear, valorar y vender sus NFTs. Eres creativo, conoces las tendencias del mercado y proporcionas consejos prácticos.',
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxTokens: 1500,
        visibility: 'public',
        avatar: '🎨',
        personality: 'creative',
        functions: ['getUserNFTs', 'getMarketplaceListings']
    },
    {
        id: 'analytics-bot',
        name: 'Analytics Bot',
        description: 'Analista de datos especializado en métricas y estadísticas de BeZhas.',
        systemPrompt: 'Eres un analista de datos especializado en métricas de plataformas sociales y blockchain. Proporcionas insights basados en datos, análisis de tendencias y reportes de rendimiento.',
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 2000,
        visibility: 'vip',
        avatar: '📊',
        personality: 'analytical',
        functions: ['getUserStats', 'getTrendingTopics']
    }
];

// ==================== AGENTS ====================

// Listar agentes
router.get('/agents', async (req, res) => {
    console.log('GET /agents called');
    try {
        const visibility = req.query.visibility;
        let agents = AGENTS;

        if (visibility) {
            agents = agents.filter(a => a.visibility === visibility);
        }

        res.json(agents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener agente específico
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

// Chat normal
router.post('/chat', async (req, res) => {
    try {
        const { agentId, messages, userAddress } = req.body;

        if (!agentId || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Preparar mensajes con system prompt
        const systemMessage = {
            role: 'system',
            content: agent.systemPrompt
        };

        const allMessages = [systemMessage, ...messages];

        // Llamar a OpenAI
        const completion = await openai.chat.completions.create({
            model: agent.model,
            messages: allMessages,
            temperature: agent.temperature,
            max_tokens: agent.maxTokens
        });

        res.json(completion);
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Chat streaming
router.post('/chat/stream', async (req, res) => {
    try {
        const { agentId, messages, userAddress } = req.body;

        if (!agentId || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const systemMessage = {
            role: 'system',
            content: agent.systemPrompt
        };

        const stream = await openai.chat.completions.create({
            model: agent.model,
            messages: [systemMessage, ...messages],
            temperature: agent.temperature,
            max_tokens: agent.maxTokens,
            stream: true
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== MODELS ====================

// Listar modelos disponibles
router.get('/models', (req, res) => {
    try {
        const models = [
            {
                id: 'gpt-4o',
                provider: 'openai',
                name: 'GPT-4o',
                contextWindow: 128000,
                maxTokens: 4096
            },
            {
                id: 'gpt-4o-mini',
                provider: 'openai',
                name: 'GPT-4o Mini',
                contextWindow: 128000,
                maxTokens: 16384
            },
            {
                id: 'gpt-4-turbo',
                provider: 'openai',
                name: 'GPT-4 Turbo',
                contextWindow: 128000,
                maxTokens: 4096
            }
        ];
        res.json(models);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TOOLS ====================

// Listar herramientas disponibles
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

module.exports = router;