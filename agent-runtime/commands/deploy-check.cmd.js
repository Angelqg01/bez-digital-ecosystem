/**
 * deploy-check.cmd.js — /deploy-check slash command.
 * Checks if a contract is deployed on a given chain.
 */
const BaseCommand = require('./_base.cmd');

class DeployCheckCommand extends BaseCommand {
    constructor() {
        super({
            name: 'deploy-check',
            description: 'Verify a contract deployment on a specific chain',
            toolName: 'deploy-check',
            aliases: ['dc', 'deploy'],
            usage: '/deploy-check --contract <name> [--chain <id>]',
        });
    }

    parseArgs(argsStr = '') {
        const base = super.parseArgs(argsStr);
        return {
            contract_name: base.contract || base.name || '',
            chain_id: base.chain || base['chain-id'] || 31337,
        };
    }

    formatResult(result) {
        if (!result.success) {
            return { success: false, message: `Deploy check failed: ${result.meta?.error || 'unknown'}` };
        }
        const d = result.data;
        const icon = d.deployed ? '✓' : '✗';
        return {
            success: true,
            message: `${icon} ${d.contract} on chain ${d.chain_id}: ${d.deployed ? `DEPLOYED at ${d.address}` : 'NOT FOUND'} (${d.all_contracts_count} contracts total)`,
            data: d,
        };
    }
}

module.exports = new DeployCheckCommand();
