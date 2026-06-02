/**
 * parity-audit.cmd.js — /parity-audit slash command.
 * Runs the full ParityChecker audit and returns a summary.
 */
const BaseCommand = require('./_base.cmd');
const ParityChecker = require('../core/ParityChecker');

class ParityAuditCommand extends BaseCommand {
    #parity;

    constructor() {
        super({
            name: 'parity-audit',
            description: 'Run a full ABI ↔ deployment ↔ SDK parity audit',
            toolName: null, // Custom logic, not delegating to a single tool
            aliases: ['pa', 'parity'],
            usage: '/parity-audit [--chain <id>]',
        });
        this.#parity = new ParityChecker();
    }

    async run(params, context) {
        const { permissions, user } = context;

        // Require admin or deployer role
        const check = permissions.check(user.role, ['runtime:admin', 'parity:audit']);
        if (!check.allowed) {
            return {
                success: false,
                message: `Permission denied for /parity-audit`,
                denied: check.denied,
            };
        }

        // Get plugin contracts if PluginLoader is available in context
        let pluginContracts = [];
        if (context.plugins) {
            pluginContracts = context.plugins.getAllContracts
                ? context.plugins.getAllContracts()
                : [];
        }

        const report = this.#parity.audit({ plugins: pluginContracts });

        return this.formatResult(report);
    }

    formatResult(report) {
        const s = report.summary;
        const statusIcon = report.passed ? '✓' : '✗';
        const lines = [
            `${statusIcon} Parity Audit: ${report.passed ? 'PASSED' : 'FAILED'}`,
            `  Total: ${s.total} | Pass: ${s.pass} | Warn: ${s.warn} | Fail: ${s.fail}`,
        ];

        // Add failed checks details
        const failures = report.checks.filter(c => c.status === 'fail');
        if (failures.length > 0) {
            lines.push('  Failures:');
            for (const f of failures.slice(0, 5)) {
                lines.push(`    - ${f.message}`);
            }
            if (failures.length > 5) {
                lines.push(`    ... and ${failures.length - 5} more`);
            }
        }

        return {
            success: report.passed,
            message: lines.join('\n'),
            data: report,
        };
    }
}

module.exports = new ParityAuditCommand();
