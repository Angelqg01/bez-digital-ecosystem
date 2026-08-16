/**
 * Command: /incident — Creates an incident report via the incident-report tool.
 *
 * Usage:
 *   /incident --sector logistics --severity high --title "Bridge delay detected"
 *   /incident -s energy -v critical -t "Gas spike anomaly"
 */
const BaseCommand = require('./_base.cmd');

class IncidentCommand extends BaseCommand {
    constructor() {
        super({
            name: 'incident',
            description: 'Create an incident report for Aegis AutoHealer',
            aliases: ['inc'],
            usage: '/incident --sector <sector> --severity <low|medium|high|critical> --title "<title>"',
            requiredRole: 'operator',
        });
    }

    async execute(args, context) {
        const parsed = this._parseArgs(args);

        const sector = parsed.sector || parsed.s || 'global';
        const severity = parsed.severity || parsed.v || 'medium';
        const title = parsed.title || parsed.t;

        if (!title) {
            return {
                success: false,
                message: 'Missing --title. Usage: /incident --sector logistics --severity high --title "Description"',
            };
        }

        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(severity)) {
            return {
                success: false,
                message: `Invalid severity "${severity}". Use: ${validSeverities.join(', ')}`,
            };
        }

        const { registry, permissions, user } = context;
        const tool = registry.get('incident-report');
        if (!tool) {
            return { success: false, message: 'incident-report tool not available' };
        }

        const check = permissions.check(user.role, tool.permissions);
        if (!check.allowed) {
            return { success: false, message: `Permission denied: requires ${tool.permissions.join(', ')}` };
        }

        const result = await registry.invoke('incident-report', { sector, severity, title }, { user });
        return {
            success: result.success,
            command: 'incident',
            data: result.data,
            message: result.success
                ? `Incident ${result.data.incident_id} created (${severity} — ${sector})`
                : result.error || 'Failed to create incident',
        };
    }

    /** @private Parse --key value or -k value args */
    _parseArgs(args) {
        const result = {};
        const tokens = args.trim().split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.startsWith('--')) {
                const key = token.slice(2);
                // Collect value — may be quoted
                let value = '';
                if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
                    i++;
                    // Handle quoted strings
                    if (tokens[i].startsWith('"')) {
                        const parts = [tokens[i].slice(1)];
                        while (i + 1 < tokens.length && !tokens[i].endsWith('"')) {
                            i++;
                            parts.push(tokens[i]);
                        }
                        value = parts.join(' ').replace(/"$/, '');
                    } else {
                        value = tokens[i];
                    }
                }
                result[key] = value || true;
            } else if (token.startsWith('-') && token.length === 2) {
                const key = token.slice(1);
                if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
                    i++;
                    result[key] = tokens[i];
                } else {
                    result[key] = true;
                }
            }
        }
        return result;
    }
}

module.exports = new IncidentCommand();
