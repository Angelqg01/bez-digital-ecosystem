/**
 * ============================================================================
 * MCP CONTEXT SERVICE — Blockchain Metadata Fetcher for RAG Pipeline
 * ============================================================================
 *
 * Bridges the MCP Intelligence Server with the RAG system by:
 * 1. Fetching real-time gas prices, token stats, and DAO proposals from MCP
 * 2. Formatting the data as enriched context for chatbot prompts
 * 3. Caching results to avoid excessive MCP calls
 *
 * MCP endpoints used:
 *   POST /api/mcp/analyze-gas     → Gas strategy analysis
 *   POST /api/mcp/blockscout      → Token holders, TX count, supply
 *   POST /api/mcp/calculate-swap  → Swap rate BEZ ↔ MATIC/USDT
 *   POST /api/mcp/tally-dao       → Active DAO proposals
 *
 * @requires axios
 */

const axios = require('axios');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const MCP_URL = process.env.MCP_SERVER_URL || 'http://localhost:8080';
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache
const REQUEST_TIMEOUT = 5000; // 5s per MCP call

class MCPContextService {
    constructor() {
        this._cache = new Map();
    }

    // ─── CACHE HELPERS ─────────────────────────────────────────────────────────
    _getCached(key) {
        const entry = this._cache.get(key);
        if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
            return entry.data;
        }
        this._cache.delete(key);
        return null;
    }

    _setCache(key, data) {
        this._cache.set(key, { data, ts: Date.now() });
    }

    // ─── MCP API CALLS ────────────────────────────────────────────────────────
    async _callMCP(endpoint, body = {}) {
        try {
            const response = await axios.post(`${MCP_URL}${endpoint}`, body, {
                timeout: REQUEST_TIMEOUT,
                headers: { 'Content-Type': 'application/json' },
            });
            return response.data;
        } catch (error) {
            console.warn(`⚠️ MCP call failed (${endpoint}):`, error.message);
            return null;
        }
    }

    // ─── FETCH LIVE BLOCKCHAIN DATA ────────────────────────────────────────────
    /**
     * Get current gas conditions from MCP.
     */
    async getGasContext() {
        const cached = this._getCached('gas');
        if (cached) return cached;

        const result = await this._callMCP('/api/mcp/analyze-gas', {
            transactionType: 'transfer',
            estimatedValueUSD: 10,
            urgency: 'medium',
        });

        if (result) {
            const ctx = {
                gasPriceGwei: result.currentGasGwei || result.gasPriceGwei || 'N/A',
                networkCostUSD: result.networkCostUSD || 'N/A',
                action: result.action || 'UNKNOWN',
                reasoning: result.reasoning || '',
            };
            this._setCache('gas', ctx);
            return ctx;
        }
        return null;
    }

    /**
     * Get BEZ token on-chain stats from MCP/Blockscout.
     */
    async getTokenStats() {
        const cached = this._getCached('token');
        if (cached) return cached;

        const result = await this._callMCP('/api/mcp/blockscout', {
            action: 'token_info',
        });

        // MCP /api/mcp/blockscout returns { action, status, data: { name, symbol, holders, totalSupply } }
        if (result && result.data) {
            const stats = result.data;
            const ctx = {
                holders: stats.holders || 'N/A',
                totalSupply: stats.totalSupply || 'N/A',
                transfers: stats.transfers || 'N/A',
                price: stats.price || 'N/A',
            };
            this._setCache('token', ctx);
            return ctx;
        }
        return null;
    }

    /**
     * Get BEZ swap rate from MCP.
     */
    async getSwapRate() {
        const cached = this._getCached('swap');
        if (cached) return cached;

        // MCP /api/mcp/calculate-swap uses direction + amount (not fromToken/toToken)
        const result = await this._callMCP('/api/mcp/calculate-swap', {
            direction: 'FIAT_TO_BEZ',
            amount: 1,
            fiatCurrency: 'USD',
        });

        if (result) {
            this._setCache('swap', result);
            return result;
        }
        return null;
    }

    /**
     * Get active DAO proposals from MCP.
     */
    async getDAOProposals() {
        const cached = this._getCached('dao');
        if (cached) return cached;

        const result = await this._callMCP('/api/mcp/tally-dao', {
            action: 'list_proposals',
            limit: 3,
        });

        // MCP /api/mcp/tally-dao returns { action, status, data: { proposals: [...] } }
        if (result && (result.data || result.result)) {
            const daoData = result.data || result.result;
            this._setCache('dao', daoData);
            return daoData;
        }
        return null;
    }

    // ─── AGGREGATE CONTEXT ─────────────────────────────────────────────────────
    /**
     * Fetch all MCP data sources in parallel and build a unified context string.
     * This is injected into the chatbot's system prompt for RAG.
     *
     * @returns {Promise<string>} Formatted context block for AI prompt
     */
    async getFullBlockchainContext() {
        const [gas, token, swap, dao] = await Promise.allSettled([
            this.getGasContext(),
            this.getTokenStats(),
            this.getSwapRate(),
            this.getDAOProposals(),
        ]);

        const parts = [];

        // Gas context
        const gasData = gas.status === 'fulfilled' && gas.value;
        if (gasData) {
            parts.push(
                `⛽ Gas: ${gasData.gasPriceGwei} Gwei | Costo red: $${gasData.networkCostUSD} | Recomendación: ${gasData.action}`
            );
        }

        // Token stats
        const tokenData = token.status === 'fulfilled' && token.value;
        if (tokenData) {
            parts.push(
                `🪙 BEZ Token: ${tokenData.holders} holders | Supply: ${tokenData.totalSupply} | Transfers: ${tokenData.transfers}`
            );
        }

        // Swap rate
        const swapData = swap.status === 'fulfilled' && swap.value;
        if (swapData && swapData.outputAmount) {
            parts.push(
                `💱 Swap: 1 MATIC → ${swapData.outputAmount} BEZ`
            );
        }

        // DAO proposals
        const daoData = dao.status === 'fulfilled' && dao.value;
        if (daoData) {
            const proposals = daoData.proposals || (Array.isArray(daoData) ? daoData : []);
            const proposalList = proposals
                .slice(0, 3)
                .map(p => `  • ${p.title || p.id || 'Proposal'} (${p.status || 'active'})`)
                .join('\n');
            if (proposalList) {
                parts.push(`🏛️ DAO Propuestas activas:\n${proposalList}`);
            }
        }

        if (parts.length === 0) {
            return ''; // No context available
        }

        return `\n--- DATOS BLOCKCHAIN EN TIEMPO REAL (MCP) ---\n${parts.join('\n')}\n--- FIN DATOS BLOCKCHAIN ---\n`;
    }
}

module.exports = new MCPContextService();
