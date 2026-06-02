/**
 * ============================================================================
 * BEZHAS SDK - MCP INTEGRATION MODULE
 * ============================================================================
 * 
 * Cliente para conectar con el MCP Server de BeZhas
 * Permite usar herramientas de IA para automatización
 */

const axios = require('axios');

class MCPClient {
    /**
     * @param {Object} config - Configuración del MCP client
     * @param {string} config.serverUrl - URL del MCP server
     * @param {string} config.apiKey - API Key para autenticación
     */
    constructor(config) {
        this.serverUrl = config.serverUrl || 'http://localhost:3002';
        this.apiKey = config.apiKey;
        this.connected = false;

        this.axios = axios.create({
            baseURL: this.serverUrl,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            }
        });
    }

    /**
     * Conecta con el MCP server
     * @returns {Promise<Object>} Resultado de la conexión
     */
    async connect() {
        try {
            const response = await this.axios.get('/api/mcp/health');

            if (response.status === 200) {
                this.connected = true;
                return {
                    success: true,
                    message: 'Connected to MCP server',
                    serverInfo: response.data
                };
            }
        } catch (error) {
            this.connected = false;
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Lista herramientas disponibles en el MCP server
     * @returns {Promise<Object>} Lista de herramientas
     */
    async listAvailableTools() {
        try {
            const response = await this.axios.get('/api/mcp/tools');

            return {
                success: true,
                tools: response.data.tools,
                count: response.data.tools.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Llama a una herramienta del MCP server
     * @param {string} toolName - Nombre de la herramienta
     * @param {Object} args - Argumentos para la herramienta
     * @returns {Promise<Object>} Resultado de la herramienta
     */
    async callTool(toolName, args = {}) {
        try {
            // First, find the tool's endpoint
            const toolsResponse = await this.listAvailableTools();
            if (!toolsResponse.success) throw new Error('Failed to retrieve tools list');

            const tool = toolsResponse.tools.find(t => t.name === toolName);
            if (!tool || !tool.endpoint) {
                // Determine fallback endpoints manually if auto-resolution fails
                const endpointMap = {
                    'analyze_gas_strategy': '/api/mcp/analyze-gas',
                    'calculate_smart_swap': '/api/mcp/calculate-swap',
                    'verify_regulatory_compliance': '/api/mcp/verify-compliance',
                    'github_repo_manager': '/api/mcp/github',
                    'firecrawl_scraper': '/api/mcp/firecrawl',
                    'playwright_automation': '/api/mcp/playwright',
                    'blockscout_explorer': '/api/mcp/blockscout',
                    'skill_creator_ai': '/api/mcp/skill-creator',
                    'auditmos_security': '/api/mcp/auditmos',
                    'tally_dao_governance': '/api/mcp/tally-dao',
                    'obliq_ai_sre': '/api/mcp/obliq-sre',
                    'kinaxis_supply_chain': '/api/mcp/kinaxis',
                    'alpaca_markets': '/api/mcp/alpaca-markets'
                };

                const fallbackEndpoint = endpointMap[toolName];
                if (!fallbackEndpoint) throw new Error(`Tool ${toolName} not found or has no endpoint`);

                const response = await this.axios.post(fallbackEndpoint, args);
                return {
                    success: true,
                    toolName,
                    result: response.data,
                    executionTime: Date.now() // Mock standard MCP output expectation
                };
            }

            const response = await this.axios.post(tool.endpoint, args);

            return {
                success: true,
                toolName,
                result: response.data,
                executionTime: Date.now()
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Desconecta del MCP server
     */
    disconnect() {
        this.connected = false;
        return {
            success: true,
            message: 'Disconnected from MCP server'
        };
    }

    /**
     * Verifica si está conectado
     * @returns {boolean} Estado de conexión
     */
    isConnected() {
        return this.connected;
    }

    // ========================================
    // PAYMENT TOOLS
    // ========================================

    /**
     * Obtiene cotización de pago
     * @param {number} amount - Cantidad
     * @param {string} fromCurrency - Moneda origen
     * @param {string} toCurrency - Moneda destino
     * @returns {Promise<Object>} Cotización
     */
    async getPaymentQuote(amount, fromCurrency, toCurrency) {
        return this.callTool('get_payment_quote', {
            amount,
            fromCurrency,
            toCurrency
        });
    }

    /**
     * Procesa pago con Stripe
     * @param {string} userId - ID del usuario
     * @param {string} walletAddress - Dirección de wallet
     * @param {number} amount - Cantidad
     * @param {string} email - Email
     * @returns {Promise<Object>} Resultado del pago
     */
    async processStripePayment(userId, walletAddress, amount, email) {
        return this.callTool('process_stripe_payment', {
            userId,
            walletAddress,
            amount,
            email
        });
    }

    /**
     * Verifica estado de pago
     * @param {string} sessionId - ID de sesión
     * @returns {Promise<Object>} Estado del pago
     */
    async checkPaymentStatus(sessionId) {
        return this.callTool('check_payment_status', { sessionId });
    }

    /**
     * Obtiene balance de wallet
     * @param {string} walletAddress - Dirección de wallet
     * @returns {Promise<Object>} Balance
     */
    async getWalletBalance(walletAddress) {
        return this.callTool('get_wallet_balance', { walletAddress });
    }

    /**
     * Inicia pago crypto
     * @param {string} walletAddress - Dirección de wallet
     * @param {number} amount - Cantidad
     * @param {string} currency - Moneda
     * @returns {Promise<Object>} Instrucciones de pago
     */
    async initiateCryptoPayment(walletAddress, amount, currency) {
        return this.callTool('initiate_crypto_payment', {
            walletAddress,
            amount,
            currency
        });
    }

    // ========================================
    // AI AUDITING & COMPLIANCE TOOLS (FASE 5)
    // ========================================

    /**
     * Pide a la IA que verifique si los datos del contenedor cumplen las normativas.
     * @param {string} containerId - ID del contenedor (ej. MSKU1234)
     * @param {number} temperature - Temperatura detectada
     * @param {string} location - GPS Data
     */
    async verifyRegulatoryCompliance(containerId, temperature, location) {
        return this.callTool('verify_regulatory_compliance', {
            containerId,
            temperature,
            location
        });
    }

    /**
     * Analiza el mercado y el estado on-chain para recibir una recomendación de Gwei.
     */
    async analyzeGasStrategy() {
        return this.callTool('analyze_gas_strategy');
    }
}

module.exports = MCPClient;
