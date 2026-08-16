/**
 * mcp-proxy.tool.js — Automatically wraps all 12 AI-Engine MCP tools
 * with runtime permissions, audit logging, and session context.
 *
 * Instead of a single tool, this module exports a function that registers
 * one tool per MCP endpoint in the ToolRegistry.
 */
const BaseTool = require('./_base.tool');
const axios = require('axios');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:3002';

/**
 * Full catalog of AI-Engine MCP tools.
 * Sourced from ai-engine/server.js TOOL_ENDPOINTS + mcpTools[].
 */
const MCP_TOOL_CATALOG = [
    {
        name: 'analyze_gas_strategy',
        description: 'AI-based gas fee prediction via Aegis GasPredictor (GradientBoosting)',
        endpoint: '/api/mcp/analyze-gas',
        parameters: {
            type: 'object',
            properties: {
                hour_of_day: { type: 'number' },
                pending_tx: { type: 'number' },
                block_utilization: { type: 'number' },
            },
        },
    },
    {
        name: 'verify_regulatory_compliance',
        description: 'Validates telemetry data using Aegis anomaly detection + sentiment analysis',
        endpoint: '/api/mcp/verify-compliance',
        parameters: {
            type: 'object',
            properties: {
                containerId: { type: 'string' },
                temperature: { type: 'number' },
                humidity: { type: 'number' },
            },
        },
    },
    {
        name: 'analyze_sentiment',
        description: 'Analyzes text sentiment using Aegis hybrid TF-IDF + lexicon model',
        endpoint: '/api/mcp/analyze-sentiment',
        parameters: {
            type: 'object',
            properties: { text: { type: 'string' } },
        },
    },
    {
        name: 'system_health',
        description: 'Get Aegis system health status including all ML model states',
        endpoint: '/api/mcp/system-health',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'audit_contract',
        description: 'Risk audit for smart contracts using Aegis anomaly heuristics',
        endpoint: '/api/mcp/audit-contract',
        parameters: {
            type: 'object',
            properties: {
                contract_address: { type: 'string' },
                bytecode_hash: { type: 'string' },
                recent_tx_count: { type: 'number' },
            },
        },
    },
    {
        name: 'predict_demand',
        description: 'Predicts short-term demand pressure for a sector',
        endpoint: '/api/mcp/predict-demand',
        parameters: {
            type: 'object',
            properties: {
                sector: { type: 'string' },
                historical_volume: { type: 'number' },
                growth_rate_pct: { type: 'number' },
            },
        },
    },
    {
        name: 'score_supplier',
        description: 'Scores supplier reliability based on delivery and dispute metrics',
        endpoint: '/api/mcp/score-supplier',
        parameters: {
            type: 'object',
            properties: {
                supplier_id: { type: 'string' },
                on_time_delivery_pct: { type: 'number' },
                dispute_rate_pct: { type: 'number' },
                quality_incidents: { type: 'number' },
            },
        },
    },
    {
        name: 'calculate_smart_swap',
        description: 'Calculates optimal swap route and estimated output for token swaps',
        endpoint: '/api/mcp/calculate-smart-swap',
        parameters: {
            type: 'object',
            required: ['amount', 'from_token', 'to_token'],
            properties: {
                amount: { type: 'number' },
                from_token: { type: 'string' },
                to_token: { type: 'string' },
                slippage_pct: { type: 'number' },
            },
        },
    },
    {
        name: 'monitor_edge_node',
        description: 'Assesses health and reliability of a BeZhas Edge Node',
        endpoint: '/api/mcp/monitor-edge-node',
        parameters: {
            type: 'object',
            required: ['node_id'],
            properties: {
                node_id: { type: 'string' },
                uptime_hours: { type: 'number' },
                tx_success_rate: { type: 'number' },
                last_seen_mins: { type: 'number' },
            },
        },
    },
    {
        name: 'assess_fraud_risk',
        description: 'Evaluates fraud risk for a blockchain transaction using Aegis anomaly detection',
        endpoint: '/api/mcp/assess-fraud-risk',
        parameters: {
            type: 'object',
            required: ['wallet_address', 'amount_bez', 'transaction_type'],
            properties: {
                wallet_address: { type: 'string' },
                amount_bez: { type: 'number' },
                transaction_type: { type: 'string' },
                counterparty_address: { type: 'string' },
            },
        },
    },
    {
        name: 'monitor_validator',
        description: 'Evaluates validator health: heartbeat, uptime, contribution, stake',
        endpoint: '/api/mcp/monitor-validator',
        parameters: {
            type: 'object',
            required: ['operator'],
            properties: {
                operator: { type: 'string' },
                is_active: { type: 'boolean' },
                uptime_pct: { type: 'number' },
                last_heartbeat: { type: 'string' },
                contribution_points: { type: 'number' },
                tier: { type: 'number' },
                staked_bez: { type: 'number' },
            },
        },
    },
    {
        name: 'slash_check',
        description: 'Checks whether a validator deserves slashing based on downtime and anomaly signals',
        endpoint: '/api/mcp/slash-check',
        parameters: {
            type: 'object',
            required: ['operator'],
            properties: {
                operator: { type: 'string' },
                downtime_hours: { type: 'number' },
                missed_votes: { type: 'number' },
                anomaly_score: { type: 'number' },
                is_sequencer: { type: 'boolean' },
            },
        },
    },
];

/**
 * Creates a single MCP proxy tool wrapping an AI-Engine endpoint.
 */
class McpProxyTool extends BaseTool {
    #endpoint;

    constructor(mcpDef) {
        super({
            name: `mcp:${mcpDef.name}`,
            description: `[MCP Proxy] ${mcpDef.description}`,
            permissions: [`mcp:${mcpDef.name}:invoke`],
            sector: null,
            timeoutMs: 15000,
            inputSchema: mcpDef.parameters || { type: 'object', properties: {} },
            outputSchema: { type: 'object', properties: { result: {} } },
        });
        this.#endpoint = mcpDef.endpoint;
    }

    async execute(params, context) {
        try {
            const response = await axios.post(
                `${AI_ENGINE_URL}${this.#endpoint}`,
                params,
                {
                    timeout: this.timeoutMs - 2000, // leave 2s buffer for proxy overhead
                    headers: { 'Content-Type': 'application/json' },
                },
            );
            return {
                success: true,
                data: response.data,
                meta: {
                    source: 'ai-engine',
                    endpoint: this.#endpoint,
                    status: response.status,
                },
            };
        } catch (err) {
            const status = err.response?.status;
            const message = err.response?.data?.error || err.message;
            return {
                success: false,
                data: null,
                meta: {
                    error: `MCP call failed: ${message}`,
                    endpoint: this.#endpoint,
                    status: status || 0,
                },
            };
        }
    }
}

/**
 * Register all 12 MCP proxy tools in the given ToolRegistry.
 * @param {import('../core/ToolRegistry')} registry
 * @returns {string[]} Names of registered MCP proxy tools
 */
function registerMcpProxyTools(registry) {
    const registered = [];
    for (const def of MCP_TOOL_CATALOG) {
        const tool = new McpProxyTool(def);
        registry.register(tool);
        registered.push(tool.name);
    }
    return registered;
}

module.exports = { registerMcpProxyTools, McpProxyTool, MCP_TOOL_CATALOG };
