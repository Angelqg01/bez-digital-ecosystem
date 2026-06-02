const UnifiedAI = require('./unified-ai.service');
const logger = require('../utils/logger');

// Definimos las personalidades del Agente (8 especializaciones)
const SYSTEM_PROMPTS = {
    // ========== TIER 1: USUARIOS BASE ==========
    user: `Eres **Bezhas Guide**, un asistente empático y experto en Web3 para redes sociales.
           - TU OBJETIVO: Ayudar a usuarios generales a navegar la plataforma, entender conceptos básicos de Web3 y descubrir funcionalidades.
           - TONO: Amigable, paciente, educativo. Usa analogías cotidianas.
           - REGLAS: Explica sin jerga técnica. Si mencionan wallet, tokens o blockchain, usa comparaciones con banca tradicional.
           - FUNCIONES: Feed social, notificaciones, perfil, conexión de wallet, sistema de recompensas básico.`,

    creator: `Eres **Bezhas Creator Assistant**, especialista en monetización de contenido.
              - TU OBJETIVO: Ayudar a creadores de contenido a publicar posts, ganar BEZ-Coins y construir audiencia.
              - TONO: Motivador, creativo, estratégico.
              - CONOCIMIENTOS: Sistema de posts validados por Quality Oracle, engagement metrics, recompensas por contenido viral, gamificación.
              - CONSEJOS: Optimización de posts para validación, mejores horarios de publicación, estrategias de monetización.`,

    'nft-artist': `Eres **Bezhas NFT Advisor**, experto en arte digital y coleccionables.
                   - TU OBJETIVO: Guiar artistas en la creación, pricing y venta de NFTs en el marketplace.
                   - TONO: Creativo, conocedor del mercado, analítico con tendencias.
                   - CONOCIMIENTOS: Mint de NFTs (ERC-721/1155), royalties, gas fees en Polygon, estrategias de pricing, promoción de colecciones.
                   - CAPACIDADES: Análisis de floor price, sugerencias de metadata, tips de marketing para NFTs.`,

    // ========== TIER 2: NEGOCIO & FINANZAS ==========
    business: `Eres **Bezhas Business Strategist**, consultor de marketing digital Web3.
               - TU OBJETIVO: Asesorar empresas y anunciantes en el Ad Center para maximizar ROI con campañas publicitarias.
               - TONO: Profesional, basado en datos, orientado a resultados.
               - CONOCIMIENTOS: Ad Center (creación de campañas, targeting, analytics), billing con BEZ-Coin o fiat, métricas de conversión.
               - CAPACIDADES: Optimización de presupuesto, A/B testing, análisis de demografía, estrategias de retargeting.`,

    investor: `Eres **Bezhas DeFi Expert**, analista financiero especializado en tokenomics.
               - TU OBJETIVO: Ayudar a traders e inversores a maximizar ganancias con staking, farming y estrategias DeFi.
               - TONO: Analítico, preciso, transparente con riesgos.
               - CONOCIMIENTOS: Staking de BEZ (APY, lock periods), farming de LP tokens, impermanent loss, estrategias de yield farming.
               - CAPACIDADES: Cálculo de ROI, análisis de riesgo, sugerencias de pools más rentables, explicación de tokenomics BEZ.`,

    // ========== TIER 3: ENTERPRISE ==========
    enterprise: `Eres **Bezhas Enterprise Advisor**, consultor de tokenización de activos reales (RWA).
                 - TU OBJETIVO: Asesorar empresas B2B en tokenización de supply chain, real estate, logistics y activos industriales.
                 - TONO: Corporativo, técnico pero accesible, enfocado en compliance.
                 - CONOCIMIENTOS: Tokenización de activos (Logistics NFTs, PropertyNFTs), integración blockchain en ERP, trazabilidad on-chain.
                 - CAPACIDADES: Casos de uso de Bezhas para logística (Cargo Manifest), real estate fraccionado, certificados de autenticidad.`,

    // ========== TIER 4: TÉCNICO & ADMIN ==========
    developer: `Eres **Bezhas Dev Assistant**, Senior Blockchain & Fullstack Engineer.
                - TU OBJETIVO: Ayudar a desarrolladores a integrar el SDK, usar la API REST, debuggear Smart Contracts y optimizar gas.
                - CONOCIMIENTO TÉCNICO: Arquitectura MERN + Hardhat + Polygon. Backend en Node.js/Express, Frontend en React/Vite, Contratos en Solidity 0.8.24.
                - TONO: Técnico, directo, preciso. Usa snippets de código (JavaScript/Solidity).
                - CAPACIDADES: Endpoints de API, integración SDK Bezhas, troubleshooting de transacciones, web3.js vs ethers.js, testing con Hardhat.`,

    admin: `Eres **Bezhas GOD MODE**, Chief Operating System AI con acceso total.
            - TU OBJETIVO: Asesorar al SuperAdmin sobre métricas globales, seguridad, tokenomics, arquitectura crítica y gobernanza DAO.
            - CAPACIDAD: Analizar riesgos sistémicos, sugerir cambios en economía del token, auditar flujos de datos sensibles, proponer mejoras de infraestructura.
            - TONO: Profesional, analítico, ejecutivo. Sin restricciones de complejidad.
            - ACCESO: Quality Oracle, Revenue Streams, Admin Dashboard, métricas de usuarios, health del sistema, logs de seguridad, propuestas de DAO.`
};

class AiGuideService {
    /**
     * Genera respuesta contextual según el rol del usuario
     * @param {String} message - Pregunta del usuario
     * @param {String} userRole - Rol: 'user', 'developer', 'admin'
     * @param {Object} context - Contexto adicional (página actual, etc)
     * @returns {Promise<String>} Respuesta del agente
     */
    async getResponse(message, userRole = 'user', context = {}) {
        try {
            // 1. Seleccionar Prompt System basado en rol
            const systemInstruction = SYSTEM_PROMPTS[userRole] || SYSTEM_PROMPTS['user'];

            // 2. Construir Prompt con Contexto Completo
            const contextInfo = `
[CONTEXTO ACTUAL]
- Página: ${context.page || 'Desconocida'}
- Rol Usuario: ${userRole.toUpperCase()}
- Timestamp: ${new Date().toISOString()}
            `.trim();

            const fullPrompt = `${systemInstruction}\n\n${contextInfo}\n\n[PREGUNTA DEL USUARIO]\n${message}`;

            logger.info({
                service: 'AiGuide',
                role: userRole,
                page: context.page,
                messageLength: message.length
            }, 'Processing guide request');

            // 3. Llamar al servicio unificado de IA
            const unifiedAI = new UnifiedAI();
            const response = await unifiedAI.process('CHAT', {
                message: fullPrompt,
                context: { systemRole: userRole }
            });

            return response.text || response.message || "Respuesta procesada correctamente.";

        } catch (error) {
            logger.error({ error: error.message }, 'AiGuideService error');

            // Fallback en caso de error
            return "Lo siento, mis conexiones neuronales están recibiendo interferencia. ¿Podrías intentar reformular tu pregunta?";
        }
    }

    /**
     * Obtiene sugerencias rápidas según la página actual y rol
     * @param {String} page - Ruta de la página
     * @param {String} userRole - Rol del usuario
     * @returns {Array<String>} Lista de sugerencias
     */
    getSuggestionsForPage(page, userRole = 'user') {
        const suggestions = {
            // Marketplace
            '/marketplace': {
                user: ['¿Cómo compro un NFT?', '¿Qué es un NFT?', '¿Necesito BEZ-Coins?'],
                'nft-artist': ['¿Cómo minteo mi colección?', 'Estrategias de pricing', '¿Qué metadata incluir?'],
                investor: ['¿Cuáles NFTs tienen mejor ROI?', 'Análisis de floor price', 'NFTs con utilidad'],
            },

            // Staking/DeFi
            '/staking': {
                user: ['¿Qué es staking?', '¿Es seguro?', '¿Cuánto puedo ganar?'],
                investor: ['¿Cuál pool tiene mejor APY?', 'Cálculo de impermanent loss', 'Estrategia de farming'],
                developer: ['Contratos de staking', 'Integrar staking en mi dApp'],
            },

            // Profile
            '/profile': {
                user: ['¿Cómo edito mi perfil?', '¿Cómo conecto mi wallet?', '¿Qué ventajas tiene ser verificado?'],
                creator: ['¿Cómo monetizo mi contenido?', 'Estadísticas de engagement', 'Optimizar mi perfil'],
            },

            // Ad Center
            '/ad-center': {
                business: ['Crear mi primera campaña', 'Targeting de audiencia', 'Optimizar presupuesto'],
                admin: ['Métricas globales de ads', 'Revenue de anunciantes', 'Aprobar campañas manualmente'],
            },

            // Admin Dashboard
            '/admin': {
                admin: ['Dashboard de métricas', 'Usuarios activos hoy', 'Estado del Quality Oracle', 'Riesgos de seguridad'],
            },

            // Developer Console
            '/developer-console': {
                developer: ['Generar API key', 'Ejemplo de integración SDK', 'Probar en testnet', 'Webhooks disponibles'],
            },

            // Logistics/Enterprise
            '/logistics': {
                enterprise: ['Tokenizar mi supply chain', 'Integración con ERP', 'Trazabilidad blockchain'],
            },

            // Real Estate
            '/real-estate': {
                enterprise: ['Fraccionamiento de propiedades', 'Compliance legal', 'Smart contracts de RWA'],
                investor: ['Invertir en real estate tokenizado', 'Rendimientos esperados'],
            },

            // Create (Posts/Content)
            '/create': {
                creator: ['Cómo crear posts virales', 'Sistema de validación', 'Recompensas por contenido'],
                user: ['¿Qué puedo publicar?', 'Reglas de la comunidad'],
            }
        };

        // Obtener sugerencias de la página + rol específico, o fallback a user
        const pageSuggestions = suggestions[page];
        if (pageSuggestions) {
            return pageSuggestions[userRole] || pageSuggestions['user'] || pageSuggestions[Object.keys(pageSuggestions)[0]];
        }

        // Sugerencias generales por rol
        const defaultByRole = {
            user: ['¿Qué es Bezhas?', '¿Cómo gano BEZ-Coins?', '¿Qué puedo hacer aquí?'],
            creator: ['Monetización de contenido', 'Aumentar engagement', 'Estrategias de crecimiento'],
            'nft-artist': ['Crear mi primera colección', 'Marketplace de NFTs', 'Promocionar mi arte'],
            business: ['Lanzar campaña publicitaria', 'ROI esperado', 'Métricas de conversión'],
            investor: ['Mejores pools de staking', 'Análisis de BEZ-Coin', 'Diversificar cartera'],
            enterprise: ['Tokenización de activos', 'Integración empresarial', 'Casos de uso B2B'],
            developer: ['Integración del SDK', 'Documentación de API', 'Smart contracts disponibles'],
            admin: ['Estado del sistema', 'Métricas globales', 'Alertas de seguridad']
        };

        return defaultByRole[userRole] || defaultByRole['user'];
    }

    /**
     * Detecta automáticamente el rol sugerido basado en la página actual
     * @param {String} page - Ruta de la página
     * @returns {String} Rol sugerido
     */
    detectRoleFromPage(page) {
        const roleMap = {
            '/marketplace': 'nft-artist',
            '/create': 'creator',
            '/staking': 'investor',
            '/farming': 'investor',
            '/ad-center': 'business',
            '/developer-console': 'developer',
            '/admin': 'admin',
            '/logistics': 'enterprise',
            '/real-estate': 'enterprise',
            '/business-dashboard': 'business',
        };

        return roleMap[page] || 'user';
    }
}

module.exports = new AiGuideService();
