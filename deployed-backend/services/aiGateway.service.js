/**
 * BeZhas AI Gateway Service
 * 
 * "Glue Logic" that connects the Backend to the MCP Intelligence Server.
 * 
 * Flow:
 *   1. User sends an intent (buy, transfer, swap, IoT ingest)
 *   2. This gateway consults the MCP Server for gas, compliance, and swap analysis
 *   3. If MCP approves → executes the transaction on BEZ contract automatically
 *   4. If MCP rejects  → returns the reason and suggested action
 * 
 * @contract BEZ Token: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8 (INMUTABLE)
 */

const { ethers } = require('ethers');
const { GoogleAuth } = require('google-auth-library');
const pino = require('pino');

const tokenomics = require('../config/tokenomics.config');
const logger = pino({ name: 'AIGateway' });

// ─── Configuration ─────────────────────────────────────────
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8080';
const BEZ_CONTRACT = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const RPC_URL = process.env.POLYGON_RPC_URL || process.env.RPC_URL || 'https://rpc-amoy.polygon.technology';
const RELAYER_KEY = process.env.RELAYER_PRIVATE_KEY || '';

// Cloud Run service-to-service authentication
const IS_CLOUD_RUN = !MCP_SERVER_URL.includes('localhost') && !MCP_SERVER_URL.includes('127.0.0.1');
let _authClient = null;

/**
 * Get an OIDC token for Cloud Run service-to-service calls.
 * Returns null in local development (localhost MCP).
 */
async function getIdToken() {
    if (!IS_CLOUD_RUN) return null;
    try {
        if (!_authClient) {
            const auth = new GoogleAuth();
            _authClient = await auth.getIdTokenClient(MCP_SERVER_URL);
        }
        const headers = await _authClient.getRequestHeaders();
        return headers.Authorization || null;
    } catch (error) {
        logger.error({ err: error }, '⚠️ Failed to get OIDC token for MCP');
        return null;
    }
}

const TOKEN_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)',
];

class AIGatewayService {
    constructor() {
        this.mcpBaseUrl = MCP_SERVER_URL;
        this.provider = null;
        this.relayerWallet = null;
        this.bezContract = null;
        this.initialized = false;
    }

    /**
     * Initialize blockchain connections
     */
    async initialize() {
        if (this.initialized) return;

        try {
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            await this.provider.getBlockNumber(); // Test connection

            if (RELAYER_KEY) {
                this.relayerWallet = new ethers.Wallet(RELAYER_KEY, this.provider);
                this.bezContract = new ethers.Contract(BEZ_CONTRACT, TOKEN_ABI, this.relayerWallet);
                logger.info('✅ AI Gateway initialized with Relayer wallet');
            } else {
                this.bezContract = new ethers.Contract(BEZ_CONTRACT, TOKEN_ABI, this.provider);
                logger.warn('⚠️ AI Gateway initialized in READ-ONLY mode (no RELAYER_PRIVATE_KEY)');
            }

            this.initialized = true;
        } catch (error) {
            logger.error({ err: error }, '❌ AI Gateway initialization failed');
            this.initialized = false;
        }
    }

    // ─── MCP Server Communication ────────────────────────────

    /**
     * Call a tool on the MCP Intelligence Server
     * @param {string} endpoint - API endpoint (e.g., '/api/mcp/analyze-gas')
     * @param {object} params - Tool parameters
     * @returns {Promise<object>} MCP response
     */
    async callMCP(endpoint, params) {
        const url = `${this.mcpBaseUrl}${endpoint}`;
        logger.info({ endpoint, params }, '📡 Calling MCP Intelligence Server');

        try {
            const headers = { 'Content-Type': 'application/json' };

            // Attach OIDC token for Cloud Run service-to-service auth
            const authToken = await getIdToken();
            if (authToken) {
                headers['Authorization'] = authToken;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(15000), // 15s timeout
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`MCP Error ${response.status}: ${error}`);
            }

            const result = await response.json();
            logger.info({ endpoint, result: result.action || result.status || result.recommendation }, '✅ MCP Response received');
            return result;
        } catch (error) {
            logger.error({ err: error, endpoint }, '❌ MCP Server unreachable');
            // Fallback: conservative defaults
            return {
                action: 'DELAY',
                status: 'MANUAL_REVIEW',
                recommendation: 'WAIT_BETTER_RATE',
                error: error.message,
                reasoning: 'MCP Server unavailable. Using conservative fallback.',
            };
        }
    }

    // ─── Intent Processing ───────────────────────────────────

    /**
     * Process a user intent end-to-end:
     * 1. Analyze gas strategy
     * 2. Verify compliance
     * 3. Execute transaction if approved
     * 
     * @param {object} intent - User intent
     * @param {string} intent.type - 'token_transfer' | 'marketplace_buy' | 'iot_ingest' | 'swap'
     * @param {string} intent.walletAddress - User's wallet
     * @param {number} intent.amountBEZ - Amount of BEZ tokens
     * @param {string} intent.recipientAddress - Destination wallet
     * @param {string} intent.fiatRegion - ISO country code
     * @param {number} intent.estimatedValueUSD - USD value of transaction
     * @param {string} intent.urgency - 'low' | 'medium' | 'high'
     * @returns {Promise<object>} Execution result
     */
    async processIntent(intent) {
        await this.initialize();

        const {
            type = 'token_transfer',
            walletAddress,
            amountBEZ,
            recipientAddress,
            fiatRegion = 'US',
            estimatedValueUSD,
            urgency = 'medium',
        } = intent;

        const valueUSD = estimatedValueUSD || (amountBEZ * tokenomics.price.usd);

        logger.info({ type, walletAddress, amountBEZ, valueUSD }, '🎯 Processing user intent');

        // ─── Step 1: Gas Strategy Analysis ─────────────────────
        const gasResult = await this.callMCP('/api/mcp/analyze-gas', {
            transactionType: type,
            estimatedValueUSD: valueUSD,
            urgency,
        });

        if (gasResult.action === 'DELAY') {
            return {
                executed: false,
                phase: 'gas_analysis',
                decision: gasResult,
                message: `⏳ Transaction delayed: ${gasResult.reasoning}`,
                retryAfterSeconds: 300, // Retry in 5 min
            };
        }

        if (gasResult.action === 'BATCH') {
            return {
                executed: false,
                phase: 'gas_analysis',
                decision: gasResult,
                message: '📦 Transaction queued for batching (IoT optimization)',
                batchId: `batch_${Date.now()}`,
            };
        }

        // ─── Step 2: Regulatory Compliance ─────────────────────
        const complianceResult = await this.callMCP('/api/mcp/verify-compliance', {
            walletAddress,
            amountBEZ: amountBEZ || 0,
            fiatRegion,
            transactionType: type === 'marketplace_buy' ? 'marketplace' : 'transfer',
        });

        if (complianceResult.automaticAction === 'BLOCK_TX') {
            return {
                executed: false,
                phase: 'compliance',
                decision: complianceResult,
                message: `🚫 Transaction blocked: ${complianceResult.reasoning}`,
            };
        }

        if (complianceResult.automaticAction === 'HOLD_FOR_REVIEW') {
            return {
                executed: false,
                phase: 'compliance',
                decision: complianceResult,
                message: `🔍 Transaction held for review: ${complianceResult.reasoning}`,
                requiresKYC: complianceResult.kycRequired,
            };
        }

        // ─── Step 3: Execute Transaction ───────────────────────
        // MCP gave green light (ALLOW_TX) → execute on-chain
        if (!this.relayerWallet && gasResult.payer === 'RELAYER_PAYS') {
            return {
                executed: false,
                phase: 'execution',
                message: '⚠️ Relayer wallet not configured. Cannot execute gasless transaction.',
                gasResult,
                complianceResult,
            };
        }

        try {
            let txResult;

            if (type === 'token_transfer' && recipientAddress && amountBEZ) {
                txResult = await this._executeTokenTransfer(recipientAddress, amountBEZ, gasResult.payer);
            } else {
                // For other types, return approval without execution
                txResult = {
                    approved: true,
                    message: 'MCP approved. Ready for frontend execution.',
                };
            }

            return {
                executed: !!txResult.txHash,
                phase: 'completed',
                gasAnalysis: gasResult,
                compliance: complianceResult,
                transaction: txResult,
                message: txResult.txHash
                    ? `✅ Transaction executed: ${txResult.txHash}`
                    : '✅ Transaction approved by MCP Intelligence',
            };
        } catch (error) {
            logger.error({ err: error }, '❌ Transaction execution failed');
            return {
                executed: false,
                phase: 'execution_error',
                gasAnalysis: gasResult,
                compliance: complianceResult,
                error: error.message,
                message: `❌ Execution failed: ${error.message}`,
            };
        }
    }

    /**
     * Execute a BEZ token transfer using Relayer or user wallet
     * @private
     */
    async _executeTokenTransfer(to, amountBEZ, payer) {
        if (!this.bezContract) {
            throw new Error('BEZ contract not initialized');
        }

        const decimals = await this.bezContract.decimals();
        const amount = ethers.parseUnits(String(amountBEZ), decimals);

        if (payer === 'RELAYER_PAYS' && this.relayerWallet) {
            // Gasless: Relayer executes on behalf of user
            logger.info({ to, amountBEZ, payer: 'RELAYER' }, '🔄 Executing via Relayer');
            const tx = await this.bezContract.transfer(to, amount);
            const receipt = await tx.wait();
            return {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                payer: 'RELAYER',
            };
        }

        // User pays: return approval for frontend to execute
        return {
            approved: true,
            to,
            amount: amount.toString(),
            contractAddress: BEZ_CONTRACT,
            message: 'Send this transaction from the frontend wallet.',
        };
    }

    // ─── Convenience Methods ─────────────────────────────────

    /**
     * Quick gas check (no compliance, no execution)
     */
    async checkGas(transactionType, estimatedValueUSD) {
        return this.callMCP('/api/mcp/analyze-gas', { transactionType, estimatedValueUSD });
    }

    /**
     * Quick swap calculation
     */
    async calculateSwap(direction, amount, fiatCurrency = 'USD') {
        return this.callMCP('/api/mcp/calculate-swap', { direction, amount, fiatCurrency });
    }

    /**
     * Quick compliance check
     */
    async checkCompliance(walletAddress, amountBEZ, fiatRegion) {
        return this.callMCP('/api/mcp/verify-compliance', { walletAddress, amountBEZ, fiatRegion });
    }

    /**
     * Health check on MCP server
     */
    async healthCheck() {
        try {
            const headers = {};
            const authToken = await getIdToken();
            if (authToken) {
                headers['Authorization'] = authToken;
            }

            const response = await fetch(`${this.mcpBaseUrl}/api/mcp/health`, {
                headers,
                signal: AbortSignal.timeout(5000),
            });
            return response.ok ? await response.json() : { status: 'unhealthy' };
        } catch {
            return { status: 'unreachable', mcpUrl: this.mcpBaseUrl };
        }
    }
}

// Singleton export
const aiGateway = new AIGatewayService();
module.exports = aiGateway;
module.exports.AIGatewayService = AIGatewayService;
