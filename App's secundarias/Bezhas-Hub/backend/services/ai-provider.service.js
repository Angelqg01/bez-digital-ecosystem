const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AIProviderService - Servicio unificado para múltiples proveedores de IA
 * Soporta: OpenAI, Anthropic (Claude), Google (Gemini), xAI (Grok), DeepSeek
 */
class AIProviderService {
    constructor() {
        // Inicializar clientes de IA
        this.clients = {
            openai: null,
            anthropic: null,
            google: null,
            xai: null,
            deepseek: null
        };

        this.initializeClients();
    }

    initializeClients() {
        // OpenAI
        if (process.env.OPENAI_API_KEY) {
            this.clients.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
            console.log('✅ OpenAI client initialized');
        }

        // Anthropic (Claude)
        if (process.env.ANTHROPIC_API_KEY) {
            this.clients.anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY
            });
            console.log('✅ Anthropic client initialized');
        }

        // Google Gemini
        const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (googleKey) {
            this.clients.google = new GoogleGenerativeAI(googleKey);
            console.log('✅ Google Gemini client initialized');
        }

        // xAI (Grok) - Compatible con API de OpenAI
        if (process.env.XAI_API_KEY) {
            this.clients.xai = new OpenAI({
                apiKey: process.env.XAI_API_KEY,
                baseURL: 'https://api.x.ai/v1'
            });
            console.log('✅ xAI (Grok) client initialized');
        }

        // DeepSeek - Compatible con API de OpenAI
        if (process.env.DEEPSEEK_API_KEY) {
            this.clients.deepseek = new OpenAI({
                apiKey: process.env.DEEPSEEK_API_KEY,
                baseURL: 'https://api.deepseek.com'
            });
            console.log('✅ DeepSeek client initialized');
        }
    }

    /**
     * Chat completion unificado
     * @param {Object} options - Opciones de configuración
     * @param {string} options.provider - Proveedor (openai, anthropic, google, xai, deepseek)
     * @param {string} options.model - Modelo específico
     * @param {Array} options.messages - Array de mensajes
     * @param {number} options.temperature - Temperatura (0-2)
     * @param {number} options.maxTokens - Máximo de tokens
     * @param {boolean} options.stream - Activar streaming
     * @returns {Promise<Object>} - Respuesta del modelo
     */
    async chat(options) {
        const { provider, model, messages, temperature = 0.7, maxTokens = 2000, stream = false } = options;

        switch (provider) {
            case 'openai':
                return await this.chatOpenAI({ model, messages, temperature, maxTokens, stream });

            case 'anthropic':
                return await this.chatAnthropic({ model, messages, temperature, maxTokens, stream });

            case 'google':
                return await this.chatGoogle({ model, messages, temperature, maxTokens, stream });

            case 'xai':
                return await this.chatXAI({ model, messages, temperature, maxTokens, stream });

            case 'deepseek':
                return await this.chatDeepSeek({ model, messages, temperature, maxTokens, stream });

            default:
                throw new Error(`Proveedor no soportado: ${provider}`);
        }
    }

    /**
     * Generación de Embeddings (Unificado)
     * @param {Object} options 
     */
    async embed(options) {
        const { provider, text, model, multimodalParts } = options;
        
        // Prioridad: Google con Gemini Embedding 2 si hay partes multimodales
        if (multimodalParts && multimodalParts.length > 0) {
           if (provider === 'google' || this.clients.google) {
               return await this.embedGoogle({ 
                   model: model || 'text-embedding-004', // gemini-embedding-2-preview uses Parts
                   text, 
                   multimodalParts 
               });
           } else {
               throw new Error('Multimodal embeddings requieren proveedor Google (gemini-embedding-2-preview)');
           }
        }

        switch (provider) {
            case 'openai':
                return await this.embedOpenAI({ model, text });
            case 'google':
                return await this.embedGoogle({ model, text });
            // Others fallback or throw
            default:
                if (this.clients.openai) return await this.embedOpenAI({ model, text });
                if (this.clients.google) return await this.embedGoogle({ model, text });
                throw new Error(`Embedding no soportado para: ${provider}`);
        }
    }

    // ==================== OPENAI ====================
    async chatOpenAI({ model, messages, temperature, maxTokens, stream }) {
        if (!this.clients.openai) {
            throw new Error('OpenAI API key no configurada');
        }

        const response = await this.clients.openai.chat.completions.create({
            model: model || 'gpt-4o-mini',
            messages,
            temperature,
            max_tokens: maxTokens,
            stream
        });

        if (stream) {
            return response; // Devuelve el stream directamente
        }

        return {
            content: response.choices[0].message.content,
            usage: response.usage,
            model: response.model,
            provider: 'openai'
        };
    }

    // ==================== ANTHROPIC (CLAUDE) ====================
    async chatAnthropic({ model, messages, temperature, maxTokens, stream }) {
        if (!this.clients.anthropic) {
            throw new Error('Anthropic API key no configurada');
        }

        // Convertir formato de mensajes de OpenAI a Anthropic
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');

        const anthropicMessages = conversationMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));

        const response = await this.clients.anthropic.messages.create({
            model: model || 'claude-3-sonnet-20240229',
            max_tokens: maxTokens,
            temperature,
            system: systemMessage ? systemMessage.content : undefined,
            messages: anthropicMessages,
            stream
        });

        if (stream) {
            return response; // Devuelve el stream directamente
        }

        return {
            content: response.content[0].text,
            usage: {
                prompt_tokens: response.usage.input_tokens,
                completion_tokens: response.usage.output_tokens,
                total_tokens: response.usage.input_tokens + response.usage.output_tokens
            },
            model: response.model,
            provider: 'anthropic'
        };
    }

    // ==================== GOOGLE GEMINI ====================
    async chatGoogle({ model, messages, temperature, maxTokens, stream }) {
        if (!this.clients.google) {
            throw new Error('Google API key no configurada');
        }

        // Convertir formato de mensajes de OpenAI a Gemini
        const geminiModel = this.clients.google.getGenerativeModel({
            model: model || 'gemini-2.0-flash'
        });

        // Combinar mensajes en un solo prompt para Gemini
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');

        let prompt = '';
        if (systemMessage) {
            prompt += `${systemMessage.content}\n\n`;
        }

        conversationMessages.forEach(msg => {
            const role = msg.role === 'assistant' ? 'Model' : 'User';
            prompt += `${role}: ${msg.content}\n\n`;
        });

        const generationConfig = {
            temperature,
            maxOutputTokens: maxTokens,
        };

        try {
            if (stream) {
                const result = await geminiModel.generateContentStream(prompt, generationConfig);
                return result.stream;
            }

            const result = await geminiModel.generateContent(prompt, generationConfig);
            const response = await result.response;

            return {
                content: response.text(),
                usage: {
                    prompt_tokens: 0, 
                    completion_tokens: 0,
                    total_tokens: 0
                },
                model: model || 'gemini-pro',
                provider: 'google'
            };
        } catch (error) {
            console.error('❌ Google Gemini Chat Error:', error.message);
            throw error;
        }
    }

    async embedGoogle({ model, text, multimodalParts }) {
        if (!this.clients.google) {
            throw new Error('Google API key no configurada');
        }
        
        const embeddingModel = model || (multimodalParts ? 'gemini-embedding-2-preview' : 'text-embedding-004');
        const geminiModel = this.clients.google.getGenerativeModel({ model: embeddingModel });

        try {
            if (multimodalParts && multimodalParts.length > 0) {
                // gemini-embedding-2-preview permite arrays mixtos de texto y media (base64)
                const parts = [];
                if (text) parts.push({ text });
                parts.push(...multimodalParts);

                const result = await geminiModel.embedContent({
                    content: { parts }
                });
                return {
                    vector: result.embedding.values,
                    provider: 'google',
                    model: embeddingModel
                };
            } else {
                const result = await geminiModel.embedContent(text);
                return {
                    vector: result.embedding.values,
                    provider: 'google',
                    model: embeddingModel
                };
            }
        } catch (error) {
            console.error('Error Google Embedding:', error);
            throw error;
        }
    }

    // ==================== XAI (GROK) ====================
    async chatXAI({ model, messages, temperature, maxTokens, stream }) {
        if (!this.clients.xai) {
            throw new Error('xAI API key no configurada');
        }

        // xAI usa la misma API que OpenAI
        const response = await this.clients.xai.chat.completions.create({
            model: model || 'grok-2',
            messages,
            temperature,
            max_tokens: maxTokens,
            stream
        });

        if (stream) {
            return response;
        }

        return {
            content: response.choices[0].message.content,
            usage: response.usage,
            model: response.model,
            provider: 'xai'
        };
    }

    // ==================== DEEPSEEK ====================
    async chatDeepSeek({ model, messages, temperature, maxTokens, stream }) {
        if (!this.clients.deepseek) {
            throw new Error('DeepSeek API key no configurada');
        }

        // DeepSeek usa la misma API que OpenAI
        const response = await this.clients.deepseek.chat.completions.create({
            model: model || 'deepseek-chat',
            messages,
            temperature,
            max_tokens: maxTokens,
            stream
        });

        if (stream) {
            return response;
        }

        return {
            content: response.choices[0].message.content,
            usage: response.usage,
            model: response.model,
            provider: 'deepseek'
        };
    }

    /**
     * Verificar disponibilidad de proveedor
     */
    isProviderAvailable(provider) {
        return this.clients[provider] !== null;
    }

    /**
     * Obtener lista de proveedores disponibles
     */
    getAvailableProviders() {
        return Object.entries(this.clients)
            .filter(([_, client]) => client !== null)
            .map(([provider]) => provider);
    }

    // ==================== EMBEDDINGS GENERICOS ====================
    async embedOpenAI({ model, text }) {
        if (!this.clients.openai) throw new Error('OpenAI API key no configurada');
        const response = await this.clients.openai.embeddings.create({
            model: model || 'text-embedding-3-small',
            input: text,
        });
        return {
            vector: response.data[0].embedding,
            provider: 'openai',
            model: response.model
        };
    }

    /**
     * Moderación de contenido (usando OpenAI Moderation API)
     */
    async moderateContent(text) {
        if (!this.clients.openai) {
            console.warn('OpenAI no disponible para moderación, devolviendo seguro por defecto');
            return { flagged: false, categories: {} };
        }

        try {
            const moderation = await this.clients.openai.moderations.create({
                input: text
            });

            return {
                flagged: moderation.results[0].flagged,
                categories: moderation.results[0].categories,
                categoryScores: moderation.results[0].category_scores
            };
        } catch (error) {
            console.error('Error en moderación:', error);
            return { flagged: false, categories: {} };
        }
    }
}

// Singleton instance
const aiProviderService = new AIProviderService();

module.exports = aiProviderService;
