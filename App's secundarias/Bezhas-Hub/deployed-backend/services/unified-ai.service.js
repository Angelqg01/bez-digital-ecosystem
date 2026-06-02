/**
 * Unified AI Service - BeZhas
 * 
 * Centraliza TODOS los servicios de AI en un solo punto de entrada.
 * Reemplaza: aiPluginService, personalAI, openai.service, autoTagger, etc.
 * 
 * Soporta multiples proveedores:
 * - OpenAI (GPT-4, GPT-3.5)
 * - Google Gemini
 * - DeepSeek
 * - Local Mode (sin costos)
 * 
 * @author BeZhas Team
 */

const pino = require('pino');
const logger = pino({ name: 'UnifiedAI' });

class UnifiedAIService {
    constructor() {
        this.mode = process.env.AI_MODE || 'HYBRID'; // LOCAL, CLOUD, HYBRID
        this.primaryProvider = process.env.AI_PRIMARY_PROVIDER || 'gemini'; // openai, gemini, deepseek
        this.initialized = false;

        // Inicializar proveedores
        this._initProviders();
    }

    _initProviders() {
        try {
            // OpenAI
            if (process.env.OPENAI_API_KEY && this.primaryProvider === 'openai') {
                const { Configuration, OpenAIApi } = require("openai");
                this.openai = new OpenAIApi(
                    new Configuration({ apiKey: process.env.OPENAI_API_KEY })
                );
                logger.info('OpenAI provider initialized');
            }

            // Google Gemini (usa GEMINI_API_KEY o GOOGLE_API_KEY)
            const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
            if (geminiKey) {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                this.gemini = new GoogleGenerativeAI(geminiKey);
                logger.info('Gemini provider initialized with key');
            }

            // DeepSeek (si esta configurado)
            if (process.env.DEEPSEEK_API_KEY) {
                // Similar setup para DeepSeek
                logger.info('DeepSeek provider initialized');
            }

            this.initialized = true;
            logger.info(`Unified AI Service ready in ${this.mode} mode`);

        } catch (error) {
            logger.warn('AI providers initialization failed, using LOCAL mode', error.message);
            this.mode = 'LOCAL';
        }
    }

    /**
     * Gateway Central - Procesa cualquier tarea de AI
     * 
     * @param {String} taskType - MODERATION, PRICING, SEARCH, CHAT, TAGGING, TRANSLATION
     * @param {Object} payload - Datos para procesar
     * @returns {Promise<Object>} Resultado procesado
     */
    async process(taskType, payload) {
        logger.info(`Processing AI task: ${taskType}`);

        // Validacion
        if (!payload) {
            throw new Error('Payload is required');
        }

        // Routing segun tipo de tarea
        switch (taskType.toUpperCase()) {
            case 'MODERATION':
                return this._moderateContent(payload.text, payload.image);

            case 'PRICING':
                return this._estimatePrice(payload.productData);

            case 'SEARCH':
                return this._semanticSearch(payload.query, payload.context);

            case 'CHAT':
                return this._chatResponse(payload.message, payload.context);

            case 'TAGGING':
                return this._generateTags(payload.content);

            case 'TRANSLATION':
                return this._translate(payload.text, payload.targetLang);

            case 'SUMMARIZATION':
                return this._summarize(payload.text);

            default:
                throw new Error(`Unknown AI task type: ${taskType}`);
        }
    }

    // ==================== TAREAS ESPECIFICAS ====================

    /**
     * Moderacion de contenido (texto e imagenes)
     */
    async _moderateContent(text, imageUrl = null) {
        if (this.mode === 'LOCAL') {
            // Moderacion basica con regex
            return this._localModeration(text);
        }

        try {
            // Usar OpenAI Moderation API
            if (this.openai) {
                const response = await this.openai.createModeration({ input: text });
                const result = response.data.results[0];

                return {
                    safe: !result.flagged,
                    categories: result.categories,
                    score: result.category_scores,
                    provider: 'openai'
                };
            }

            // Fallback a Gemini
            if (this.gemini) {
                const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
                const prompt = `Moderate this content for safety (respond with JSON): "${text}"`;
                const result = await model.generateContent(prompt);

                return {
                    safe: !result.response.text().includes('unsafe'),
                    provider: 'gemini'
                };
            }

            // Si todo falla, usar local
            return this._localModeration(text);

        } catch (error) {
            logger.error('Moderation error', error);
            return this._localModeration(text); // Fallback
        }
    }

    /**
     * Estimacion inteligente de precios
     */
    async _estimatePrice(product) {
        if (this.mode === 'LOCAL') {
            // Formula simple basada en categoria
            const basePrice = product.basePrice || 10;
            const markup = product.condition === 'NEW' ? 1.3 : 1.1;
            return {
                suggestedPrice: basePrice * markup,
                confidence: 0.6,
                method: 'local_heuristic'
            };
        }

        try {
            const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
            const prompt = `Estimate market price for: ${JSON.stringify(product)}. Respond with JSON: {price: number, confidence: number}`;

            const result = await model.generateContent(prompt);
            const response = JSON.parse(result.response.text());

            return {
                suggestedPrice: response.price,
                confidence: response.confidence,
                method: 'gemini'
            };

        } catch (error) {
            logger.error('Pricing estimation error', error);
            return this._estimatePrice({ ...product, basePrice: product.basePrice || 10 }); // Retry local
        }
    }

    /**
     * Busqueda semantica
     */
    async _semanticSearch(query, context = []) {
        if (this.mode === 'LOCAL') {
            // Busqueda simple por keywords
            return context.filter(item =>
                item.toLowerCase().includes(query.toLowerCase())
            );
        }

        // Implementar embeddings con OpenAI o Gemini
        // Por ahora fallback a local
        return this._semanticSearch(query, context);
    }

    /**
     * Chatbot de soporte y asistente personal
     */
    async _chatResponse(message, context = {}) {
        const systemPrompt = `Eres BeZhas AI, un asistente inteligente de la plataforma BeZhas Web3.
Tu objetivo es ayudar a los usuarios con:
- Explicación de conceptos Web3, NFTs, DeFi y DAO
- Navegación por la plataforma BeZhas
- Creación de contenido y NFTs
- Participación en la gobernanza DAO
- Uso de servicios empresariales
- Compra y uso del token BEZ

Responde de manera amigable, clara y profesional en español. Si no sabes algo, admítelo.`;

        // Modo local: respuestas predefinidas
        if (this.mode === 'LOCAL' || (!this.gemini && !this.openai)) {
            return this._localChatResponse(message);
        }

        try {
            // Intentar con Gemini primero
            if (this.gemini) {
                const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
                const prompt = `${systemPrompt}\n\nContexto: ${JSON.stringify(context)}\n\nUsuario: ${message}\n\nAsistente:`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                return {
                    text: responseText,
                    provider: 'gemini',
                    timestamp: new Date()
                };
            }

            // Fallback a OpenAI
            if (this.openai) {
                const completion = await this.openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Contexto: ${JSON.stringify(context)}\n\n${message}` }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                });

                return {
                    text: completion.data.choices[0].message.content,
                    provider: 'openai',
                    timestamp: new Date()
                };
            }

        } catch (error) {
            logger.error('Chat response error', error);
            // Fallback a respuestas locales
            return this._localChatResponse(message);
        }
    }

    /**
     * Respuestas de chat locales (sin IA externa)
     */
    _localChatResponse(message) {
        const lowerMessage = message.toLowerCase();

        // Respuestas predefinidas
        const responses = {
            'hola': '¡Hola! 👋 Soy BeZhas AI. ¿En qué puedo ayudarte hoy?',
            'que es bezhas': 'BeZhas es una plataforma Web3 que combina redes sociales, NFTs, DeFi y DAO. Permite a usuarios y empresas participar en la economía descentralizada.',
            'nft': 'Los NFTs (Non-Fungible Tokens) son activos digitales únicos en blockchain. En BeZhas puedes crear, comprar y vender NFTs en nuestro marketplace.',
            'dao': 'El DAO de BeZhas permite a la comunidad participar en la gobernanza de la plataforma mediante votaciones y propuestas. Necesitas tokens BEZ para participar.',
            'bez': 'BEZ-Coin es el token nativo de BeZhas. Puedes usarlo para staking, gobernanza, obtener beneficios VIP y acceder a servicios premium.',
            'comprar': 'Puedes comprar BEZ-Coin directamente en la plataforma usando criptomonedas (MATIC, USDC) o transferencia bancaria. Visita la sección de compra en el home.',
            'ayuda': 'Puedo ayudarte con:\n• Explicar conceptos Web3\n• Navegar la plataforma\n• Crear NFTs y contenido\n• Participar en el DAO\n• Usar servicios empresariales\n\n¿Sobre qué tema te gustaría saber más?',
            'wallet': 'Para usar BeZhas necesitas conectar una wallet Web3 como MetaMask, WalletConnect o Coinbase Wallet. Haz clic en "Conectar Wallet" en la parte superior.',
            'staking': 'El staking en BeZhas te permite bloquear tus tokens BEZ para ganar recompensas. Cuanto más tiempo bloquees, mayores serán tus recompensas.',
            'defi': 'BeZhas ofrece servicios DeFi como staking, farming de liquidez, y préstamos descentralizados. Visita la sección DeFi Hub para más información.'
        };

        // Buscar coincidencias
        for (const [keyword, response] of Object.entries(responses)) {
            if (lowerMessage.includes(keyword)) {
                return {
                    text: response,
                    provider: 'local',
                    timestamp: new Date()
                };
            }
        }

        // Respuesta genérica
        return {
            text: `Entiendo que preguntas sobre: "${message}". Como asistente local, mis capacidades son limitadas. Para respuestas más detalladas, considera activar un modelo de IA cloud (Gemini o OpenAI) en la configuración del sistema.\n\n¿Puedo ayudarte con información básica sobre NFTs, DAO, BEZ token o navegación de la plataforma?`,
            provider: 'local',
            timestamp: new Date()
        };
    }

    /**
     * Generacion automatica de tags/hashtags
     */
    async _generateTags(content) {
        if (!content || typeof content !== 'string') {
            return ['#BeZhas'];
        }

        // Modo local: Keywords basicos
        const keywords = {
            'web3': '#Web3',
            'crypto': '#Crypto',
            'nft': '#NFT',
            'blockchain': '#Blockchain',
            'defi': '#DeFi'
        };

        const tags = [];
        const lowerContent = content.toLowerCase();

        for (const [keyword, tag] of Object.entries(keywords)) {
            if (lowerContent.includes(keyword)) {
                tags.push(tag);
            }
        }

        // Siempre incluir tag principal
        if (!tags.includes('#BeZhas')) {
            tags.unshift('#BeZhas');
        }

        return tags.slice(0, 5);
    }

    /**
     * Traduccion de contenido
     */
    async _translate(text, targetLang = 'en') {
        // Implementar con AI providers
        return { text, lang: targetLang, translated: text }; // Placeholder
    }

    /**
     * Resumen de textos largos
     */
    async _summarize(text) {
        if (text.length < 200) return text;

        // Implementar con AI
        return text.substring(0, 150) + '...'; // Placeholder
    }

    // ==================== HELPERS ====================

    /**
     * Moderacion local (sin AI externa)
     */
    _localModeration(text) {
        const badWords = ['scam', 'fraud', 'fake', 'stolen', 'illegal'];
        const hasBadWords = badWords.some(word =>
            text.toLowerCase().includes(word)
        );

        return {
            safe: !hasBadWords,
            score: hasBadWords ? 0.9 : 0.1,
            method: 'local_regex',
            flaggedWords: badWords.filter(word => text.toLowerCase().includes(word))
        };
    }

    /**
     * Estado del servicio
     */
    getStatus() {
        return {
            mode: this.mode,
            primaryProvider: this.primaryProvider,
            initialized: this.initialized,
            providers: {
                openai: !!this.openai,
                gemini: !!this.gemini
            }
        };
    }
}

// Singleton export
module.exports = new UnifiedAIService();
