/**
 * blockchain-validator.tool.js — Fetches real on-chain data for a validator
 * by calling the BeZhas Platform API (ground truth).
 */
const BaseTool = require('./_base.tool');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

class BlockchainValidatorTool extends BaseTool {
    constructor() {
        super({
            name: 'blockchain:validator_info',
            description: 'Get real-time on-chain data for a validator: stake, tier, uptime, and last heartbeat.',
            permissions: ['runtime:read', 'validator:read'],
            sector: 'blockchain',
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
                    staked_bez: { type: 'number' },
                    tier_name: { type: 'string' },
                    uptime_pct: { type: 'number' },
                    is_active: { type: 'boolean' },
                    last_heartbeat: { type: 'string' },
                },
            },
        });
    }

    async execute(params, context) {
        try {
            // Call the Platform API (which uses ValidatorService)
            const res = await axios.get(`${API_URL}/validators/${params.operator}`, {
                timeout: 8000,
                headers: {
                    'Content-Type': 'application/json',
                    // Use system internal key or public read if allowed
                    'x-internal-key': process.env.INTERNAL_API_KEY || ''
                }
            });

            const data = res.data;
            return {
                success: true,
                data: {
                    operator: data.operator,
                    staked_bez: data.staked_bez,
                    tier_name: data.tier_name,
                    uptime_pct: data.uptime_pct,
                    is_active: data.is_active,
                    last_heartbeat: data.last_heartbeat,
                    total_rewards_bez: data.total_rewards_bez,
                    is_sequencer_eligible: data.is_sequencer_eligible
                },
            };
        } catch (err) {
            const status = err.response?.status;
            const message = err.response?.data?.error || err.message;
            return {
                success: false,
                data: null,
                meta: { error: `Platform API error (${status}): ${message}` },
            };
        }
    }
}

module.exports = new BlockchainValidatorTool();
