/**
 * deploy-check.tool.js — Verifies a contract's deployment status
 * against the deployment JSONs and SDK registry.
 */
const BaseTool = require('./_base.tool');
const ParityChecker = require('../core/ParityChecker');

class DeployCheckTool extends BaseTool {
    #parity;

    constructor() {
        super({
            name: 'deploy-check',
            description: 'Verify a contract exists in deployments and matches SDK registry for a given chain',
            permissions: ['runtime:admin', 'deploy:verify'],
            sector: null,
            timeoutMs: 10000,
            inputSchema: {
                type: 'object',
                properties: {
                    contract_name: { type: 'string' },
                    chain_id: { type: 'number', default: 31337 },
                },
                required: ['contract_name'],
            },
            outputSchema: {
                type: 'object',
                properties: {
                    contract: { type: 'string' },
                    chain_id: { type: 'number' },
                    deployed: { type: 'boolean' },
                    address: { type: 'string' },
                    all_contracts: { type: 'array', items: { type: 'string' } },
                },
            },
        });
        this.#parity = new ParityChecker();
    }

    async execute(params, context) {
        const { contract_name, chain_id = 31337 } = params;

        const result = this.#parity.checkContract(contract_name, chain_id);
        const allContracts = this.#parity.getDeployedContracts(chain_id);

        return {
            success: true,
            data: {
                contract: contract_name,
                chain_id,
                deployed: result.exists,
                address: result.address || null,
                all_contracts_count: allContracts.length,
            },
        };
    }
}

module.exports = new DeployCheckTool();
