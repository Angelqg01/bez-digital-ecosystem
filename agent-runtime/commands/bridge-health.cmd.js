/**
 * bridge-health.cmd.js — /bridge-health slash command.
 * Delegates to the bridge-health tool and formats output.
 */
const BaseCommand = require('./_base.cmd');

class BridgeHealthCommand extends BaseCommand {
    constructor() {
        super({
            name: 'bridge-health',
            description: 'Check L1↔L2 bridge connectivity and health status',
            toolName: 'bridge-health',
            aliases: ['bh', 'bridge'],
            usage: '/bridge-health [--include-pending] [--max-age-blocks <n>]',
        });
    }

    parseArgs(argsStr = '') {
        const base = super.parseArgs(argsStr);
        return {
            include_pending: base['include-pending'] ?? true,
            max_age_blocks: base['max-age-blocks'] ?? 100,
        };
    }

    formatResult(result) {
        if (!result.success) {
            return { success: false, message: `Bridge health check failed: ${result.meta?.error || 'unknown'}` };
        }
        const d = result.data;
        const icon = d.health === 'healthy' ? '✓' : d.health === 'degraded' ? '⚠' : '✗';
        return {
            success: true,
            message: `${icon} Bridge: ${d.health.toUpperCase()} | L1: ${d.l1_connected ? 'UP' : 'DOWN'} | L2: ${d.l2_connected ? 'UP' : 'DOWN'}`,
            data: d,
        };
    }
}

module.exports = new BridgeHealthCommand();
