/**
 * ToolRegistry.js — Central registry for all runtime tools.
 * Maintains a map of tool name → tool instance. Supports dynamic registration
 * (plugins) and static registration (core tools).
 */

class ToolRegistry {
    /** @type {Map<string, import('../tools/_base.tool')>} */
    #tools = new Map();

    /**
     * Register a tool instance.
     * @param {import('../tools/_base.tool')} tool
     */
    register(tool) {
        if (!tool || !tool.name) {
            throw new Error('Cannot register tool without a name');
        }
        if (this.#tools.has(tool.name)) {
            throw new Error(`Tool "${tool.name}" is already registered`);
        }
        this.#tools.set(tool.name, tool);
    }

    /**
     * Unregister a tool by name (used by plugins on unload).
     * @param {string} name
     * @returns {boolean}
     */
    unregister(name) {
        return this.#tools.delete(name);
    }

    /**
     * Get a tool by name.
     * @param {string} name
     * @returns {import('../tools/_base.tool')|undefined}
     */
    get(name) {
        return this.#tools.get(name);
    }

    /**
     * Check if a tool exists.
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
        return this.#tools.has(name);
    }

    /**
     * List all registered tool descriptors, optionally filtered by sector.
     * @param {{ sector?: string }} [filter]
     * @returns {object[]}
     */
    list(filter = {}) {
        const tools = Array.from(this.#tools.values());
        if (filter.sector) {
            return tools
                .filter(t => t.sector === filter.sector || t.sector === null)
                .map(t => t.toDescriptor());
        }
        return tools.map(t => t.toDescriptor());
    }

    /**
     * Invoke a tool by name with params and context.
     * Validates input, checks timeout, returns result.
     * @param {string} name
     * @param {object} params
     * @param {object} context — { user, session, permissions }
     * @returns {Promise<{ success: boolean, data: any, meta?: object }>}
     */
    async invoke(name, params, context) {
        const tool = this.#tools.get(name);
        if (!tool) {
            return { success: false, data: null, meta: { error: `Tool "${name}" not found` } };
        }

        // Validate input
        const validation = tool.validateInput(params);
        if (!validation.valid) {
            return { success: false, data: null, meta: { error: 'Invalid parameters', details: validation.errors } };
        }

        // Execute with timeout
        const controller = new AbortController();
        const execContext = { ...context, abortSignal: controller.signal };

        try {
            const result = await Promise.race([
                tool.execute(params, execContext),
                new Promise((_, reject) => {
                    setTimeout(() => {
                        controller.abort();
                        reject(new Error(`Tool "${name}" timed out after ${tool.timeoutMs}ms`));
                    }, tool.timeoutMs);
                }),
            ]);
            return result;
        } catch (err) {
            return { success: false, data: null, meta: { error: err.message } };
        }
    }

    /** @returns {number} Total registered tools */
    get size() {
        return this.#tools.size;
    }
}

module.exports = ToolRegistry;
