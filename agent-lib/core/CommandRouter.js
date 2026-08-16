/**
 * CommandRouter.js — Dispatches slash commands to the appropriate command handler.
 * Maintains a registry of commands with alias support and argument parsing.
 */

class CommandRouter {
    /** @type {Map<string, import('../commands/_base.cmd')>} name → command */
    #commands = new Map();
    /** @type {Map<string, string>} alias → canonical name */
    #aliases = new Map();

    /**
     * Register a command instance.
     * @param {import('../commands/_base.cmd')} command
     */
    register(command) {
        if (!command || !command.name) {
            throw new Error('Cannot register command without a name');
        }
        if (this.#commands.has(command.name)) {
            throw new Error(`Command "${command.name}" is already registered`);
        }
        this.#commands.set(command.name, command);

        // Register aliases
        for (const alias of command.aliases || []) {
            if (this.#aliases.has(alias)) {
                throw new Error(`Alias "${alias}" already mapped to "${this.#aliases.get(alias)}"`);
            }
            this.#aliases.set(alias, command.name);
        }
    }

    /**
     * Unregister a command and its aliases.
     * @param {string} name
     * @returns {boolean}
     */
    unregister(name) {
        const cmd = this.#commands.get(name);
        if (!cmd) return false;

        // Remove aliases
        for (const alias of cmd.aliases || []) {
            this.#aliases.delete(alias);
        }
        return this.#commands.delete(name);
    }

    /**
     * Resolve a command name or alias to the canonical command.
     * @param {string} nameOrAlias
     * @returns {import('../commands/_base.cmd')|undefined}
     */
    resolve(nameOrAlias) {
        const canonical = this.#aliases.get(nameOrAlias) || nameOrAlias;
        return this.#commands.get(canonical);
    }

    /**
     * Parse and dispatch a raw slash command string.
     * @param {string} input — e.g. "/bridge-health --include-pending"
     * @param {{ registry: *, permissions: *, user: object, session?: object }} context
     * @returns {Promise<{ success: boolean, message: string, data?: any, command?: string }>}
     */
    async dispatch(input, context) {
        if (!input || typeof input !== 'string') {
            return { success: false, message: 'Empty command input' };
        }

        // Strip leading slash
        const trimmed = input.trim();
        const raw = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

        // Split into command name and args
        const spaceIdx = raw.indexOf(' ');
        const cmdName = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
        const argsStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx + 1);

        const command = this.resolve(cmdName);
        if (!command) {
            return {
                success: false,
                message: `Unknown command: /${cmdName}`,
                command: cmdName,
                available: this.list().map(c => c.name),
            };
        }

        try {
            const params = command.parseArgs(argsStr);
            const result = await command.run(params, context);
            return { ...result, command: command.name };
        } catch (err) {
            return {
                success: false,
                message: `Command /${command.name} failed: ${err.message}`,
                command: command.name,
            };
        }
    }

    /**
     * List all registered command descriptors.
     * @returns {object[]}
     */
    list() {
        return Array.from(this.#commands.values()).map(c => c.toDescriptor());
    }

    /** @returns {boolean} */
    has(nameOrAlias) {
        const canonical = this.#aliases.get(nameOrAlias) || nameOrAlias;
        return this.#commands.has(canonical);
    }

    /** @returns {number} Total registered commands */
    get size() {
        return this.#commands.size;
    }
}

module.exports = CommandRouter;
