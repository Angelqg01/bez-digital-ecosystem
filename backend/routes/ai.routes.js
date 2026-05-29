const { Router } = require('express');
console.log('Loading AI Routes...');

const router = Router();

// ============================================================================
// GEMINI AI CLIENT (Real Integration — uses @google/generative-ai)
// ============================================================================
let genAI = null;
let geminiModel = null;

try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
        geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('✅ Gemini AI client initialized for AI Routes');
    } else {
        console.warn('⚠️  No GEMINI_API_KEY found — AI routes will use mock responses');
    }
} catch (e) {
    console.warn('⚠️  GoogleGenerativeAI load failed:', e.message);
}

// Fallback mock for when Gemini is not available
async function mockGenerate(prompt) {
    return `[Mock AI Response] Análisis del perfil recibido. Categoría: INVERSOR. Mensaje: Hola, tu perfil de inversión en DeFi es muy relevante para BeZhas. Nuestro token BEZ-Coin ofrece Real Yield y gobernanza real a través de nuestra DAO. Te invito a descubrir cómo stakear BEZ-Coin te otorga poder de decisión sobre la infraestructura donde otros construyen. ¿Te gustaría saber más?`;
}

async function generateWithGemini(prompt) {
    if (!geminiModel) return mockGenerate(prompt);
    try {
        const result = await geminiModel.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Gemini generation error:', error.message);
        return mockGenerate(prompt);
    }
}

// ============================================================================
// AGENTS DEFINITION — BeZhas AI Agent Registry
// ============================================================================
const AGENTS = [
    {
        id: 'bezhas-assistant',
        name: 'BeZhas Assistant',
        description: 'Asistente oficial de BeZhas. Te ayudo con la plataforma, BEZ tokens, NFTs y Web3.',
        systemPrompt: 'Eres el asistente oficial de BeZhas, una plataforma Web3 de redes sociales. Ayudas a los usuarios con preguntas sobre BEZ tokens, NFTs, staking, y navegación en la plataforma. Eres amigable, paciente y experto en blockchain.',
        model: 'gemini-2.0-flash',
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
        model: 'gemini-2.0-flash',
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
        model: 'gemini-2.0-flash',
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
        model: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 2000,
        visibility: 'vip',
        avatar: '📊',
        personality: 'analytical',
        functions: ['getUserStats', 'getTrendingTopics']
    },
    {
        id: 'linkedin-sales-director',
        name: 'LinkedIn Sales Director',
        description: 'Director de Ventas IA de BeZhas — clasifica leads de LinkedIn y genera outreach personalizado.',
        systemPrompt: `Actúa como el Director de Ventas y Captador de Clientes de BeZhas, la plataforma Web3 líder en tokenización de activos, gobernanza descentralizada (DAO) y herramientas de desarrollo blockchain (SDK/API).

Tu misión es analizar perfiles o posts de LinkedIn y generar mensajes de conexión altamente personalizados y profesionales.

PROCESO DE CLASIFICACIÓN:
Clasifica al lead en UNA de estas categorías:

1. **DESARROLLADOR/EMPRESA** (Interés en API/SDK):
   - Palabras clave: developer, CTO, tech lead, API, integration, automation, Full Stack, DevOps.
   - Enfoque del mensaje: Ahorro del 85% en costes de desarrollo blockchain, SDK plug-and-play, Developer Console con API Keys, Time-to-Market reducido de 6 meses a 2 semanas.
   - CTA: "Explora nuestra Developer Console en bez.digital/developer"

2. **TOKENIZADOR** (RWA - Real World Assets):
   - Palabras clave: real estate, asset manager, tokenization, property, commodities, compliance, legal.
   - Enfoque del mensaje: Quality Oracle para validación off-chain, contratos BeZhasQualityEscrow para auditoría inmutable, tokenización fraccionada segura en Polygon.
   - CTA: "Descubre nuestro proceso de tokenización en bez.digital/rwa"

3. **INVERSOR** (BEZ-Coin y Gobernanza):
   - Palabras clave: investor, VC, fund, capital, ROI, yield, governance, DeFi, portfolio.
   - Enfoque del mensaje: Real Yield por comisiones del protocolo, mecanismo deflacionario, poder de gobernanza DAO, 20% descuento pagando con BEZ-Coin.
   - CTA: "Stakea BEZ-Coin y gobierna el protocolo en bez.digital/governance"

FORMATO DE RESPUESTA OBLIGATORIO:
Responde en formato JSON con esta estructura exacta:
{
  "category": "DEVELOPER|TOKENIZER|INVESTOR",
  "confidence": 0.0-1.0,
  "leadScore": 1-100,
  "connectionMessage": "Mensaje de 3 párrafos máximo",
  "followUpStrategy": "Descripción de siguiente paso",
  "suggestedContent": "Tipo de contenido a enviar después"
}

REGLAS:
- Sé breve, profesional y humano. NUNCA suenes como un bot o vendedor agresivo.
- El mensaje debe tener máximo 300 palabras.
- Siempre incluye un CTA específico al área relevante de bez.digital.
- Si detectas que habla español, responde en español. Si habla inglés, responde en inglés.
- El leadScore se calcula así: Relevancia del perfil (0-40) + Nivel de cargo (0-30) + Señales de compra (0-30).`,
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        maxTokens: 1500,
        visibility: 'admin',
        avatar: '👔',
        personality: 'professional',
        functions: []
    },
    {
        id: 'content-creator',
        name: 'Content Creator',
        description: 'Generador de contenido para redes sociales (LinkedIn, X) sobre BeZhas y Web3.',
        systemPrompt: `Eres el estratega de contenido de BeZhas. Generas contenido viral y educativo sobre:
- Gobernanza descentralizada y DAO
- Tokenización de activos reales (RWA)
- Ventajas del SDK/API de BeZhas para empresas
- Análisis de tokenomics y Real Yield

REGLAS:
- Usa formato apto para LinkedIn (profesional, con emojis moderados) o X/Twitter (threads cortos y punzantes).
- Incluye datos específicos: "El SDK de BeZhas reduce costos de integración blockchain en un 85%".
- Siempre cierra con un CTA hacia bez.digital.
- Adapta el tono según la plataforma: LinkedIn = profesional/educativo, X = directo/impactante.
- Usa hashtags relevantes: #Web3 #Blockchain #RWA #DeFi #BeZhas #Tokenization`,
        model: 'gemini-2.0-flash',
        temperature: 0.85,
        maxTokens: 2000,
        visibility: 'admin',
        avatar: '✍️',
        personality: 'creative',
        functions: []
    }
];

// ==================== AGENTS ====================

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

router.get('/agents/:id', async (req, res) => {
    try {
        const agent = AGENTS.find(a => a.id === req.params.id);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
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
            return res.status(400).json({ error: 'Invalid request: agentId and messages[] required' });
        }

        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        const prompt = `${agent.systemPrompt}\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;
        const response = await generateWithGemini(prompt);

        res.json({
            choices: [{ message: { content: response, role: 'assistant' } }]
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/chat/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            totalChats: 1250,
            activeSessions: 42,
            modelUsage: {
                'gemini-2.0-flash': 85,
                'gemini-2.5-pro': 15
            }
        }
    });
});

// ==================== MODELS ====================

router.get('/models', (req, res) => {
    res.json([
        { id: 'gemini-2.0-flash', provider: 'google', name: 'Gemini 2.0 Flash', contextWindow: 1000000, maxTokens: 8192 },
        { id: 'gemini-2.5-pro', provider: 'google', name: 'Gemini 2.5 Pro', contextWindow: 1000000, maxTokens: 8192 }
    ]);
});

// ==================== TOOLS ====================

router.get('/tools', (req, res) => {
    res.json({
        tools: ['getBezBalance', 'isVipUser', 'getUserNFTs', 'getMarketplaceListings', 'getUserProfile', 'searchPosts', 'getTrendingTopics', 'getUserStats'],
        definitions: []
    });
});

// ============================================================================
// LINKEDIN AUTOMATION — Core Lead Processing Engine
// ============================================================================

/**
 * POST /api/ai/linkedin/process-lead
 * Processes a LinkedIn lead profile and returns a classified, scored response with a personalized message.
 */
router.post('/linkedin/process-lead', async (req, res) => {
    try {
        const { leadData, language } = req.body;

        if (!leadData) {
            return res.status(400).json({ error: 'leadData is required. Send the LinkedIn profile bio or post text.' });
        }

        const agent = AGENTS.find(a => a.id === 'linkedin-sales-director');
        if (!agent) return res.status(404).json({ error: 'LinkedIn agent not configured' });

        const langInstruction = language === 'en'
            ? 'Respond entirely in English.'
            : language === 'es'
                ? 'Responde completamente en español.'
                : 'Detect the language of the profile and respond in that same language.';

        const prompt = `${agent.systemPrompt}\n\n${langInstruction}\n\nAnaliza este perfil/post de LinkedIn:\n"""${leadData}"""`;
        const aiResponse = await generateWithGemini(prompt);

        // Try to parse JSON from response
        let parsed = null;
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            // If parsing fails, wrap in structured response
        }

        res.json({
            success: true,
            agent: agent.id,
            model: agent.model,
            structured: parsed || null,
            rawResponse: aiResponse,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('LinkedIn process-lead error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/linkedin/batch-process
 * Processes multiple LinkedIn leads in a single request.
 */
router.post('/linkedin/batch-process', async (req, res) => {
    try {
        const { leads, language } = req.body;

        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'leads[] array is required with at least one entry.' });
        }

        if (leads.length > 10) {
            return res.status(400).json({ error: 'Maximum 10 leads per batch request.' });
        }

        const agent = AGENTS.find(a => a.id === 'linkedin-sales-director');
        const results = [];

        for (const lead of leads) {
            try {
                const langInstruction = language === 'en'
                    ? 'Respond entirely in English.'
                    : language === 'es'
                        ? 'Responde completamente en español.'
                        : 'Detect the language and respond accordingly.';

                const prompt = `${agent.systemPrompt}\n\n${langInstruction}\n\nAnaliza este perfil/post de LinkedIn:\n"""${lead.data || lead}"""`;
                const aiResponse = await generateWithGemini(prompt);

                let parsed = null;
                try {
                    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
                } catch (e) { /* ignore parse errors */ }

                results.push({
                    leadId: lead.id || null,
                    name: lead.name || null,
                    success: true,
                    structured: parsed,
                    rawResponse: aiResponse
                });
            } catch (err) {
                results.push({
                    leadId: lead.id || null,
                    name: lead.name || null,
                    success: false,
                    error: err.message
                });
            }
        }

        res.json({
            success: true,
            totalProcessed: results.length,
            results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Batch process error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// CONTENT GENERATION — LinkedIn/X Posts & Articles
// ============================================================================

/**
 * POST /api/ai/content/generate
 * Generates social media content for LinkedIn or X (Twitter).
 */
router.post('/content/generate', async (req, res) => {
    try {
        const { type, platform, topic, language, data } = req.body;

        if (!type || !platform) {
            return res.status(400).json({
                error: 'type and platform required.',
                validTypes: ['governance-update', 'sdk-promotion', 'rwa-explainer', 'tokenomics-report', 'roi-comparison', 'whitepaper-digest', 'custom'],
                validPlatforms: ['linkedin', 'twitter']
            });
        }

        const agent = AGENTS.find(a => a.id === 'content-creator');
        const lang = language === 'en' ? 'Write in English.' : 'Escribe en español.';

        const typePrompts = {
            'governance-update': `Genera un post de "Latido de Gobernanza" semanal. Datos de tesorería/blockchain: ${data || 'Datos no proporcionados'}. Destaca el crecimiento de la gobernanza de BeZhas y la adopción del SDK.`,
            'sdk-promotion': `Genera un post promocionando el SDK de BeZhas para empresas. Enfócate en el ahorro del 85% vs desarrollo in-house ($200K/año) y el time-to-market reducido a 2 semanas.`,
            'rwa-explainer': `Genera un post educativo explicando cómo BeZhas tokeniza activos del mundo real (RWA) usando Quality Oracle para auditoría inmutable.`,
            'tokenomics-report': `Genera un análisis de tokenomics de BEZ-Coin: mecanismo deflacionario, Real Yield por comisiones, gobernanza DAO, y 20% descuento al pagar con BEZ-Coin.`,
            'roi-comparison': `Genera una comparativa de ROI: Desarrollador blockchain in-house ($200K/año) vs SDK BeZhas. Incluye tabla de ahorro por sector (DeFi -85%, RWA -75%, DAO -94%).`,
            'whitepaper-digest': `Fragmenta los conceptos clave del whitepaper de BeZhas en una micro-lección sobre gobernanza descentralizada apta para publicar en redes sociales.`,
            'custom': `${topic || 'Genera contenido relevante sobre BeZhas y Web3.'}`
        };

        const platformInstructions = {
            linkedin: 'Formato LinkedIn: profesional, con emojis moderados, párrafos cortos, máximo 1300 caracteres. Incluye 3-5 hashtags al final.',
            twitter: 'Formato X/Twitter: thread de 5 tweets máximo, cada uno de 280 caracteres. Directo, impactante, con datos. Incluye 2-3 hashtags por tweet.'
        };

        const prompt = `${agent.systemPrompt}\n\n${lang}\n${platformInstructions[platform] || platformInstructions.linkedin}\n\n${typePrompts[type] || typePrompts.custom}`;
        const response = await generateWithGemini(prompt);

        res.json({
            success: true,
            platform,
            type,
            content: response,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Content generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/content/objections
 * Generates responses to common investor/client objections.
 */
router.post('/content/objections', async (req, res) => {
    try {
        const { objection, audienceType, language } = req.body;

        if (!objection) {
            return res.status(400).json({ error: 'objection text is required.' });
        }

        const lang = language === 'en' ? 'Respond in English.' : 'Responde en español.';
        const audience = audienceType || 'inversor';

        const prompt = `Eres el Director Comercial de BeZhas. Un potencial ${audience} ha planteado esta objeción o pregunta difícil:

"${objection}"

${lang}

Genera una respuesta técnica pero accesible que:
1. Reconozca la preocupación legítimamente.
2. Explique cómo BeZhas la resuelve con datos concretos (ahorro 85%, auditorías on-chain, Real Yield, etc.).
3. Cierre con un CTA hacia la funcionalidad relevante en bez.digital.

Máximo 200 palabras. Tono profesional y empático.`;

        const response = await generateWithGemini(prompt);

        res.json({
            success: true,
            objection,
            audienceType: audience,
            response,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Objections error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/content/proposal
 * Generates economic proposals for enterprise leads.
 */
router.post('/content/proposal', async (req, res) => {
    try {
        const { companyType, estimatedVolume, language } = req.body;

        if (!companyType) {
            return res.status(400).json({ error: 'companyType is required (e.g., "Real Estate Company", "DeFi Protocol").' });
        }

        const lang = language === 'en' ? 'Write in English.' : 'Escribe en español.';
        const volume = estimatedVolume || 'No especificado';

        const prompt = `Genera una propuesta de venta ejecutiva para un lead tipo "${companyType}".
Volumen estimado: ${volume}.

${lang}

Incluye:
1. Comparativa: Desarrollador blockchain in-house ($200K/año) vs SDK BeZhas (ahorro 75%-94%).
2. Modelos de precio:
   - SaaS Tier: $999-$2,999/mes, API ilimitada, 20% descuento con BEZ-Coin.
   - Pay-as-you-go: $0.10-$0.50 por 1M unidades de cómputo, sin compromiso.
3. ROI de Gobernanza: Votar para reducir comisiones futuras del SDK.
4. Time-to-Market reducido de 6 meses a 2 semanas.

Formato: Propuesta ejecutiva profesional con secciones claras y tabla comparativa.`;

        const response = await generateWithGemini(prompt);

        res.json({
            success: true,
            companyType,
            estimatedVolume: volume,
            proposal: response,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Proposal error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// HEALTH CHECK for AI subsystem
// ============================================================================
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'AI Services',
        status: 'operational',
        geminiAvailable: !!geminiModel,
        capabilities: {
            chat: true,
            imageGeneration: true,
            documentAnalysis: true
        },
        providers: ['google', 'bezhas-local'],
        agents: AGENTS,
        agentsCount: AGENTS.length,
        endpoints: [
            'GET  /api/ai/agents',
            'GET  /api/ai/agents/:id',
            'POST /api/ai/chat',
            'GET  /api/ai/models',
            'GET  /api/ai/tools',
            'POST /api/ai/linkedin/process-lead',
            'POST /api/ai/linkedin/batch-process',
            'POST /api/ai/content/generate',
            'POST /api/ai/content/objections',
            'POST /api/ai/content/proposal',
            'GET  /api/ai/health'
        ]
    });
});

module.exports = router;
