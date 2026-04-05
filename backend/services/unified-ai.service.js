/**
 * Unified AI Service - BeZhas
 * 
 * Centraliza TODOS los servicios de AI en un solo punto de entrada.
 * Ahora utiliza ai-provider.service internamente para abstraer
 * la lógica de los distintos modelos (OpenAI, Gemini, Claude, DeepSeek).
 * 
 * @author BeZhas Team
 */

const pino = require('pino');
const logger = pino({ name: 'UnifiedAI' });
const aiProviderService = require('./ai-provider.service');

class UnifiedAIService {
    constructor() {
        this.mode = process.env.AI_MODE || 'HYBRID'; // LOCAL, CLOUD, HYBRID

        // Verifica los proveedores disponibles en el aiProviderService
        const availableProviders = aiProviderService.getAvailableProviders();
        this.primaryProvider = availableProviders.length > 0 ? availableProviders[0] : 'local';
        this.initialized = availableProviders.length > 0;

        logger.info(`Unified AI Service ready with providers: ${availableProviders.join(', ')}`);
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

            case 'MULTIMODAL_SEARCH':
                return this._multimodalSearch(payload.text, payload.mediaParts, payload.context);

            case 'LOGISTICS_IMAGE':
                return this._processLogisticsImage(payload.imagePart, payload.expectedStatusText);

            case 'FRAUD_DOCUMENT':
                return this._analyzeFraudDocument(payload.documentPart, payload.userHistoryText);

            case 'VIP_AUDIO':
                return this._processVipAudio(payload.audioPart, payload.userContext);

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
        if (this.mode === 'LOCAL' || !aiProviderService.isProviderAvailable('openai')) {
            // Busqueda simple por keywords (evitar bucle infinito)
            return context.filter(item =>
                item.toLowerCase().includes(query.toLowerCase())
            );
        }

        try {
            // Si está configurado Pinecone, buscaríamos ahí.
            // Para mantener la estabilidad hasta tener PINECONE_API_KEY, mockeamos semántica.
            const modelPrompt = `Filtra la información relevante de este contexto para la consulta: "${query}". Contexto original: ${JSON.stringify(context)}.`;
            const filteredResult = await aiProviderService.chat({
                provider: this.primaryProvider,
                model: 'gemini-2.0-flash', // modelo ligero por defecto
                messages: [{ role: 'user', content: modelPrompt }],
                maxTokens: 500
            });
            return [filteredResult.content || ''];
        } catch (error) {
            logger.error('Semantic search error', error);
            // Fallback
            return context.filter(item => item.toLowerCase().includes(query.toLowerCase()));
        }
    }

    /**
     * Búsqueda Multimodal usando Gemini Embedding 2
     */
    async _multimodalSearch(text, mediaParts = [], context = []) {
        try {
            // Ejemplo de cómo se llamaría al embedding
            const embedding = await aiProviderService.embed({
                provider: 'google',
                model: 'gemini-embedding-2-preview',
                text: text,
                multimodalParts: mediaParts
            });
            
            logger.info(`Generado embedding multimodal (${embedding.vector.length} dimensiones) para búsqueda cruzada`);
            
            // Aquí iría la búsqueda en Vector DB (Pinecone, pgvector, etc)
            // Por ahora mockeamos comprobación con el chat
            const parts = text ? [{text}] : [];
            parts.push(...mediaParts);

            const filteredResult = await aiProviderService.chat({
                provider: 'google',
                model: 'gemini-2.0-flash',
                messages: [{ role: 'user', content: [
                    {text: `Compara semánticamente mis medios adjuntos con este contexto de la base de datos: ${JSON.stringify(context)}. ¿Cuáles coinciden mejor?`},
                    ...parts
                ]}],
                maxTokens: 500
            });

            return {
                embeddingVector: embedding.vector,
                results: [filteredResult.content || ''],
                method: 'gemini-embedding-2-preview'
            };
        } catch (error) {
            logger.error('Multimodal search error', error);
            throw error;
        }
    }

    /**
     * Evaluación de Imágenes Logísticas y seguimiento
     */
    async _processLogisticsImage(imagePart, expectedStatusText) {
        try {
            // Usando embeddings para comparar la imagen vs estado esperado
            const imgEmbedding = await aiProviderService.embed({
                provider: 'google',
                text: '',
                multimodalParts: [imagePart] // e.g., { inlineData: { data: 'base64...', mimeType: 'image/jpeg' } }
            });

            const textEmbedding = await aiProviderService.embed({
                provider: 'google',
                text: expectedStatusText
            });

            // En un caso real se calcularía similitud de cosenos entre textEmbedding y imgEmbedding.
            // Retornamos un log y análisis usando el modelo de chat multimodal para mayor interpretabilidad.
            logger.info('Embeddings generados para Logística. Calculando coherencia visual-texto...');

            const analysis = await aiProviderService.chat({
                provider: 'google',
                model: 'gemini-2.0-flash',
                messages: [{ role: 'user', content: [
                    {text: `Analiza esta foto del paquete y valídala con el estado esperado: "${expectedStatusText}". ¿Coinciden? Responde con JSON: { "matches": boolean, "reason": "texto" }`},
                    imagePart
                ]}]
            });

            return JSON.parse(analysis.content.replace(/```json/g, '').replace(/```/g, ''));
        } catch (error) {
            logger.error('Logistics image processing error', error);
            return { error: 'Failed to process logistics multimodal data' };
        }
    }

    /**
     * Auditoría Anti-Fraude procesando documentos (PDF/Imágenes)
     */
    async _analyzeFraudDocument(documentPart, userHistoryText) {
        try {
            // Vectorizamos el documento y comparamos con historia del usuario
            const docEmbedding = await aiProviderService.embed({
                provider: 'google',
                text: '',
                multimodalParts: [documentPart] // Soporta PDF o imágenes en base64
            });

            const histEmbedding = await aiProviderService.embed({
                provider: 'google',
                text: userHistoryText
            });

            // Usamos modelo de chat multimodal para la explicación de la decisión
            const auditResult = await aiProviderService.chat({
                provider: 'google',
                model: 'gemini-2.0-flash',
                messages: [{ role: 'user', content: [
                    {text: `Eres el sistema Anti-Fraude de BeZhas. Compara el documento adjunto (KYC o recibo) con el historial del usuario: "${userHistoryText}". ¿Hay comportamientos sospechosos o inconsistencias?`},
                    documentPart
                ]}]
            });

            return {
                riskScore: 0.2, // Esto vendría de la distancia del embedding
                auditNotes: auditResult.content,
                docVectorSize: docEmbedding.vector.length,
                histVectorSize: histEmbedding.vector.length
            };
        } catch (error) {
            logger.error('Fraud document audit error', error);
            throw error;
        }
    }

    /**
     * Procesamiento de Audio VIP Nativo
     */
    async _processVipAudio(audioPart, userContext) {
        try {
            // Genera embedding del audio directamente (sin transcribir)
            const audioEmbedding = await aiProviderService.embed({
                provider: 'google',
                text: '',
                multimodalParts: [audioPart] // e.g., { inlineData: { data: 'b64...', mimeType: 'audio/mp3' } }
            });

            logger.info(`VIP Audio Embedding Vector (${audioEmbedding.vector.length}) generado.`);

            // Resuelve la petición procesando nativamente el audio
            const response = await aiProviderService.chat({
                provider: 'google',
                model: 'gemini-1.5-flash',
                messages: [{ role: 'user', content: [
                    {text: `El usuario VIP con contexto "${JSON.stringify(userContext)}" mandó este audio de voz. Responde a su petición amablemente y procesa cualquier acción necesaria.`},
                    audioPart
                ]}]
            });

            return {
                replyText: response.content,
                executedAction: 'AUDIO_PROCESSED_NATIVELY',
                audioEmbeddingSize: audioEmbedding.vector.length
            };

        } catch (error) {
            logger.error('VIP Audio processing error', error);
            throw error;
        }
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
        if (this.mode === 'LOCAL' || !this.initialized) {
            return this._localChatResponse(message);
        }

        try {
            // Integrar RAG antes de responder
            const relevantContext = await this._semanticSearch(message, context.page ? [`Contexto de página: ${context.page}`] : []);
            const finalSystemPrompt = `${systemPrompt}\n\nConocimiento en base de código:\n${relevantContext.join('\\n')}`;

            // Usar aiProviderService (ya maneja todos los proveedores automáticamente de acuerdo al `.env`)
            let providerToUse = this.primaryProvider;
            let modelToUse = providerToUse === 'google' ? 'gemini-1.5-pro' : (providerToUse === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

            // Determinar necesidad según el agente (si tuvieran rol de genAI heavy, dar deepseek o grok)
            if (context.systemRole === 'developer' && aiProviderService.isProviderAvailable('deepseek')) {
                providerToUse = 'deepseek';
                modelToUse = 'deepseek-chat';
            }

            const response = await aiProviderService.chat({
                provider: providerToUse,
                model: modelToUse,
                messages: [
                    { role: "system", content: finalSystemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.7,
                maxTokens: 1500
            });

            return {
                text: response.content,
                provider: response.provider,
                timestamp: new Date()
            };

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
            available: aiProviderService.getAvailableProviders()
        };
    }
}

// Singleton export
module.exports = new UnifiedAIService();
