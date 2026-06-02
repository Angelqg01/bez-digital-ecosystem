/**
 * _base.cmd.js — Base class for all slash commands.
 * Commands wrap tool invocations with a human-friendly interface.
 */

class BaseCommand {
    /** @type {string} Slash command name, e.g. "bridge-health" (invoked as /bridge-health) */
    name = '';
    /** @type {string} Human-readable description */
    description = '';
    /** @type {string|null} Associated tool name (auto-invoked if set) */
    toolName = null;
    /** @type {string[]} Aliases, e.g. ["bh", "bridge"] */
    aliases = [];
    /** @type {string} Usage hint, e.g. "/bridge-health [--include-pending]" */
    usage = '';

    constructor(opts = {}) {
        Object.assign(this, opts);
        if (!this.name) throw new Error('Command must have a name');
    }

    /**
     * Parse raw argument string into params object.
     * Override in subclass for custom parsing.
     * Default: parses "--key value" and "--flag" patterns.
     * @param {string} argsStr — raw text after the command name
     * @returns {object}
     */
    parseArgs(argsStr = '') {
        const params = {};
        const tokens = argsStr.trim().split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.startsWith('--')) {
                const key = token.slice(2);
                const next = tokens[i + 1];
                if (!next || next.startsWith('--')) {
                    params[key] = true; // boolean flag
                } else {
                    // Try numeric coercion
                    const num = Number(next);
                    params[key] = isNaN(num) ? next : num;
                    i++;
                }
            }
        }
        return params;
    }

    /**
     * Execute the command. Override for custom logic.
     * Default implementation delegates to the associated tool.
     * @param {object} params — Parsed parameters
     * @param {{ registry: import('../core/ToolRegistry'), permissions: import('../core/PermissionEngine'), user: object, session?: object }} context
     * @returns {Promise<{ success: boolean, message: string, data?: any }>}
     */
    async run(params, context) {
        if (!this.toolName) {
            throw new Error(`Command "${this.name}": run() not implemented and no toolName set`);
        }

        const { registry, permissions, user } = context;
        const tool = registry.get(this.toolName);
        if (!tool) {
            return { success: false, message: `Tool "${this.toolName}" not found` };
        }

        // Permission check
        const check = permissions.check(user.role, tool.permissions, tool.sector);
        if (!check.allowed) {
            return {
                success: false,
                message: `Permission denied for /${this.name}`,
                denied: check.denied,
            };
        }

        const result = await registry.invoke(this.toolName, params, { user });
        return this.formatResult(result);
    }

    /**
     * Format a tool result into a command response.
     * Override in subclass for custom formatting.
     * @param {object} result — Tool result { success, data, meta }
     * @returns {{ success: boolean, message: string, data?: any }}
     */
    formatResult(result) {
        if (!result.success) {
            return {
                success: false,
                message: result.meta?.error || 'Command failed',
                data: result.data,
            };
        }
        return {
            success: true,
            message: `/${this.name} completed successfully`,
            data: result.data,
        };
    }

    /**
     * Return a JSON-serializable descriptor.
     */
    toDescriptor() {
        return {
            name: this.name,
            description: this.description,
            aliases: this.aliases,
            usage: this.usage,
            toolName: this.toolName,
        };
    }
}

module.exports = BaseCommand;
