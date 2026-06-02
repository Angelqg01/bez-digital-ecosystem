/**
 * ============================================================================
 * BEZHAS SDK - API CLIENT WRAPPER
 * ============================================================================
 * 
 * Cliente unificado para todas las APIs del backend de BeZhas
 * Proporciona acceso a todos los servicios de la plataforma
 */

const VIPSubscriptionManager = require('./vip');
const StakingManager = require('./staking');
const PaymentsManager = require('./payments');
const RWAManager = require('./rwa');
const LogisticsManager = require('./logistics');
const MCPClient = require('./mcp-integration');

// Existing modules
const FarmingManager = require('./farming');
const GovernanceManager = require('./governance');
const MarketplaceManager = require('./marketplace');

class BeZhasAPIClient {
    /**
     * @param {Object} config - Configuración del cliente
     * @param {string} config.apiUrl - URL del backend API
     * @param {string} config.rpcUrl - URL del RPC de Polygon
     * @param {string} config.mcpServerUrl - URL del MCP server
     * @param {string} config.apiKey - API Key para autenticación
     * @param {string} config.network - Red blockchain (polygon, amoy)
     */
    constructor(config = {}) {
        this.config = {
            apiUrl: config.apiUrl || process.env.REACT_APP_API_URL || 'http://localhost:3001',
            rpcUrl: config.rpcUrl || process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com',
            mcpServerUrl: config.mcpServerUrl || 'http://localhost:3002',
            apiKey: config.apiKey,
            network: config.network || 'polygon',
            ...config
        };

        // Initialize all service managers
        this.vip = new VIPSubscriptionManager(this.config);
        this.staking = new StakingManager(this.config);
        this.payments = new PaymentsManager(this.config);
        this.rwa = new RWAManager(this.config);
        this.logistics = new LogisticsManager(this.config);
        this.mcp = new MCPClient({ serverUrl: this.config.mcpServerUrl, apiKey: this.config.apiKey });

        // Existing services
        this.farming = new FarmingManager(this.config);
        this.governance = new GovernanceManager(this.config);
        this.marketplace = new MarketplaceManager(this.config);
    }

    /**
     * Obtiene la configuración actual
     * @returns {Object} Configuración
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Actualiza la configuración
     * @param {Object} newConfig - Nueva configuración
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };

        // Reinitialize services with new config
        this.vip = new VIPSubscriptionManager(this.config);
        this.staking = new StakingManager(this.config);
        this.payments = new PaymentsManager(this.config);
        this.rwa = new RWAManager(this.config);
        this.logistics = new LogisticsManager(this.config);
        this.farming = new FarmingManager(this.config);
        this.governance = new GovernanceManager(this.config);
        this.marketplace = new MarketplaceManager(this.config);
    }

    /**
     * Conecta con el MCP server
     * @returns {Promise<Object>} Resultado de la conexión
     */
    async connectMCP() {
        return await this.mcp.connect();
    }

    /**
     * Verifica la salud de todos los servicios
     * @returns {Promise<Object>} Estado de los servicios
     */
    async healthCheck() {
        const results = {
            api: false,
            mcp: false,
            blockchain: false
        };

        try {
            // Check API
            const apiResponse = await this.payments.axios.get('/api/health/live');
            results.api = apiResponse.status === 200;
        } catch (error) {
            results.api = false;
        }

        try {
            // Check MCP
            const mcpResponse = await this.mcp.connect();
            results.mcp = mcpResponse.success;
        } catch (error) {
            results.mcp = false;
        }

        try {
            // Check Blockchain
            const blockNumber = await this.staking.provider.getBlockNumber();
            results.blockchain = blockNumber > 0;
        } catch (error) {
            results.blockchain = false;
        }

        return {
            success: Object.values(results).every(v => v),
            services: results,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = BeZhasAPIClient;
