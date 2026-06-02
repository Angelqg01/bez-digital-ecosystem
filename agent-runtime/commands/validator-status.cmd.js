/**
 * validator-status.cmd.js — /validator-status slash command.
 * Delegates to the validator-status tool and formats output.
 */
const BaseCommand = require('./_base.cmd');

class ValidatorStatusCommand extends BaseCommand {
    constructor() {
        super({
            name: 'validator-status',
            description: 'Check validator node health and uptime via Aegis',
            toolName: 'validator-status',
            aliases: ['vs', 'validator'],
            usage: '/validator-status --operator <address> [--uptime-pct <n>]',
        });
    }

    parseArgs(argsStr = '') {
        const base = super.parseArgs(argsStr);
        return {
            operator: base.operator || '0x0000000000000000000000000000000000000000',
            is_active: base['is-active'] ?? true,
            uptime_pct: base['uptime-pct'] ?? 99.0,
        };
    }

    formatResult(result) {
        if (!result.success) {
            return { success: false, message: `Validator check failed: ${result.meta?.error || 'unknown'}` };
        }
        const d = result.data;
        return {
            success: true,
            message: `Validator ${d.operator || 'unknown'}: ${d.status || d.health || 'checked'} | Uptime: ${d.uptime ?? 'N/A'}% | Risk: ${d.risk_level ?? 'N/A'}`,
            data: d,
        };
    }
}

module.exports = new ValidatorStatusCommand();
