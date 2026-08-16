/**
 * validator-status.tool.js — Queries validator health from Aegis ValidatorMonitor.
 */
const BaseTool = require('./_base.tool');
const axios = require('axios');

const AEGIS_URL = process.env.AEGIS_API_URL || 'http://localhost:8001';

class ValidatorStatusTool extends BaseTool {
    constructor() {
        super({
            name: 'validator-status',
            description: 'Evaluates validator health: heartbeat freshness, uptime, contribution activity, stake adequacy',
            permissions: ['runtime:read', 'validator:read'],
            sector: null,
            timeoutMs: 10000,
            inputSchema: {
                type: 'object',
                required: ['operator'],
                properties: {
                    operator: { type: 'string', description: 'Validator operator Ethereum address' },
                },
            },
            outputSchema: {
                type: 'object',
                properties: {
                    operator: { type: 'string' },
                    is_active: { type: 'boolean' },
                    uptime_pct: { type: 'number' },
                    health_score: { type: 'number' },
                    risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                    recommendation: { type: 'string' },
                },
            },
        });
    }

    async execute(params, context) {
        try {
            // Call Aegis validator monitor endpoint
            const res = await axios.post(`${AEGIS_URL}/api/aegis/monitor-validator`, {
                operator: params.operator,
            }, { timeout: 8000 });

            const data = res.data?.data || res.data;
            return {
                success: true,
                data: {
                    operator: params.operator,
                    is_active: data.is_active ?? false,
                    uptime_pct: data.uptime_pct ?? 0,
                    health_score: data.health_score ?? 0,
                    risk_level: data.risk_level || 'unknown',
                    recommendation: data.recommendation || 'No data available',
                },
            };
        } catch (err) {
            return {
                success: false,
                data: { operator: params.operator, health_score: 0, risk_level: 'unknown' },
                meta: { error: `Aegis unreachable: ${err.message}` },
            };
        }
    }
}

module.exports = new ValidatorStatusTool();
