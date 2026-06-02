/**
 * gas-analytics.tool.js — AI-based gas fee prediction via Aegis GasPredictor.
 */
const BaseTool = require('./_base.tool');
const axios = require('axios');

const AEGIS_URL = process.env.AEGIS_API_URL || 'http://localhost:8001';

class GasAnalyticsTool extends BaseTool {
    constructor() {
        super({
            name: 'gas-analytics',
            description: 'AI-based gas fee prediction and optimization recommendations via Aegis GasPredictor',
            permissions: ['runtime:read'],
            sector: null,
            timeoutMs: 8000,
            inputSchema: {
                type: 'object',
                properties: {
                    hour_of_day: { type: 'number', description: 'Current hour 0-23' },
                    pending_tx: { type: 'number', description: 'Pending transactions in mempool' },
                    block_utilization: { type: 'number', description: 'Current block utilization 0-1' },
                },
            },
            outputSchema: {
                type: 'object',
                properties: {
                    predicted_gas_gwei: { type: 'number' },
                    confidence: { type: 'number' },
                    recommendation: { type: 'string' },
                    optimal_hour: { type: 'number' },
                },
            },
        });
    }

    async execute(params, context) {
        const payload = {
            hour_of_day: params.hour_of_day ?? new Date().getHours(),
            pending_tx: params.pending_tx ?? 0,
            block_utilization: params.block_utilization ?? 0.5,
        };

        try {
            const res = await axios.post(`${AEGIS_URL}/api/aegis/analyze-gas`, payload, {
                timeout: 6000,
            });

            const data = res.data?.data || res.data;
            return {
                success: true,
                data: {
                    predicted_gas_gwei: data.predicted_gas_gwei ?? data.predicted_gas ?? 0,
                    confidence: data.confidence ?? 0,
                    recommendation: data.recommendation || 'No recommendation available',
                    optimal_hour: data.optimal_hour ?? null,
                },
            };
        } catch (err) {
            return {
                success: false,
                data: null,
                meta: { error: `Aegis GasPredictor unreachable: ${err.message}` },
            };
        }
    }
}

module.exports = new GasAnalyticsTool();
