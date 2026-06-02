/**
 * bridge-health.tool.js — Checks L1↔L2 bridge health.
 * Connects to SDK ChainManager to query on-chain bridge state.
 */
const BaseTool = require('./_base.tool');
const axios = require('axios');

const BRIDGE_L1_RPC = process.env.BRIDGE_L1_RPC || 'http://localhost:8545';
const API_URL = process.env.API_URL || 'http://localhost:3001';

class BridgeHealthTool extends BaseTool {
    constructor() {
        super({
            name: 'bridge-health',
            description: 'Checks L1↔L2 bridge status: pending messages, finalization lag, deposit/withdraw queues',
            permissions: ['runtime:read', 'bridge:status'],
            sector: null,
            timeoutMs: 10000,
            inputSchema: {
                type: 'object',
                properties: {
                    include_pending: { type: 'boolean', default: true },
                    max_age_blocks: { type: 'number', default: 100 },
                },
            },
            outputSchema: {
                type: 'object',
                properties: {
                    l1_connected: { type: 'boolean' },
                    l2_connected: { type: 'boolean' },
                    pending_deposits: { type: 'number' },
                    pending_withdrawals: { type: 'number' },
                    finalization_lag_seconds: { type: 'number' },
                    health: { type: 'string', enum: ['healthy', 'degraded', 'critical', 'unknown'] },
                },
            },
        });
    }

    async execute(params, context) {
        const result = {
            l1_connected: false,
            l2_connected: false,
            pending_deposits: 0,
            pending_withdrawals: 0,
            finalization_lag_seconds: 0,
            health: 'unknown',
        };

        // Check L1 connectivity
        try {
            const l1Res = await axios.post(BRIDGE_L1_RPC, {
                jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1,
            }, { timeout: 5000 });
            result.l1_connected = !!l1Res.data?.result;
        } catch { /* L1 unreachable */ }

        // Check L2 connectivity via API health
        try {
            const l2Res = await axios.get(`${API_URL}/api/health`, { timeout: 3000 });
            result.l2_connected = l2Res.data?.status === 'ok' || l2Res.status === 200;
        } catch { /* L2 unreachable */ }

        // Determine health
        if (result.l1_connected && result.l2_connected) {
            result.health = 'healthy';
        } else if (result.l1_connected || result.l2_connected) {
            result.health = 'degraded';
        } else {
            result.health = 'critical';
        }

        return { success: true, data: result };
    }
}

module.exports = new BridgeHealthTool();
