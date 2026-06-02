/**
 * PluginLoader.js — Discovers and loads sector plugins from the plugins/ directory.
 * Each plugin provides a manifest.json with tools, commands, and contract dependencies.
 * Plugin tools are registered with "{sector}:{toolName}" naming convention.
 */
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const BaseTool = require('../tools/_base.tool');
const BaseCommand = require('../commands/_base.cmd');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');
const SCHEMA_PATH = path.join(PLUGINS_DIR, 'plugin-manifest.schema.json');

class PluginLoader {
    /** @type {Map<string, object>} pluginName → { manifest, tools[], commands[] } */
    #loaded = new Map();
    #ajv;
    #validateManifest;

    constructor() {
        this.#ajv = new Ajv({ allErrors: true });
        try {
            const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
            this.#validateManifest = this.#ajv.compile(schema);
        } catch {
            // If schema not found, accept any object with required fields
            this.#validateManifest = (obj) => !!(obj && obj.name && obj.sector);
            this.#validateManifest.errors = null;
        }
    }

    /**
     * Discover and load all plugins from the plugins directory.
     * @param {import('./ToolRegistry')} registry
     * @param {import('./CommandRouter')} [router] — optional, registers commands if provided
     * @returns {{ loaded: string[], errors: { plugin: string, error: string }[] }}
     */
    loadAll(registry, router = null) {
        const results = { loaded: [], errors: [] };

        let entries;
        try {
            entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
        } catch {
            return results; // No plugins directory
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const manifestPath = path.join(PLUGINS_DIR, entry.name, 'manifest.json');
            if (!fs.existsSync(manifestPath)) continue;

            try {
                const result = this.loadPlugin(manifestPath, registry, router);
                if (result.success) {
                    results.loaded.push(result.name);
                } else {
                    results.errors.push({ plugin: entry.name, error: result.error });
                }
            } catch (err) {
                results.errors.push({ plugin: entry.name, error: err.message });
            }
        }

        return results;
    }

    /**
     * Load a single plugin from a manifest file path.
     * @param {string} manifestPath
     * @param {import('./ToolRegistry')} registry
     * @param {import('./CommandRouter')} [router]
     * @returns {{ success: boolean, name?: string, error?: string }}
     */
    loadPlugin(manifestPath, registry, router = null) {
        let manifest;
        try {
            const raw = fs.readFileSync(manifestPath, 'utf-8');
            manifest = JSON.parse(raw);
        } catch (err) {
            return { success: false, error: `Failed to read manifest: ${err.message}` };
        }

        // Validate manifest
        const valid = this.#validateManifest(manifest);
        if (!valid) {
            const errors = this.#validateManifest.errors || [];
            return {
                success: false,
                error: `Invalid manifest: ${errors.map(e => `${e.instancePath} ${e.message}`).join(', ')}`,
            };
        }

        if (manifest.enabled === false) {
            return { success: false, name: manifest.name, error: 'Plugin is disabled' };
        }

        if (this.#loaded.has(manifest.name)) {
            return { success: false, name: manifest.name, error: 'Plugin already loaded' };
        }

        const registeredTools = [];
        const registeredCommands = [];

        // Register plugin tools with sector prefix
        for (const toolDef of manifest.tools || []) {
            const fullName = `${manifest.sector}:${toolDef.name}`;
            const tool = this.#createPluginTool(fullName, toolDef, manifest.sector);
            try {
                registry.register(tool);
                registeredTools.push(fullName);
            } catch (err) {
                // Rollback previously registered tools
                for (const name of registeredTools) registry.unregister(name);
                return { success: false, name: manifest.name, error: `Tool registration failed: ${err.message}` };
            }
        }

        // Register plugin commands
        if (router) {
            for (const cmdDef of manifest.commands || []) {
                const cmd = this.#createPluginCommand(cmdDef, manifest.sector);
                try {
                    router.register(cmd);
                    registeredCommands.push(cmdDef.name);
                } catch (err) {
                    // Rollback tools and commands
                    for (const name of registeredTools) registry.unregister(name);
                    for (const name of registeredCommands) router.unregister(name);
                    return { success: false, name: manifest.name, error: `Command registration failed: ${err.message}` };
                }
            }
        }

        this.#loaded.set(manifest.name, {
            manifest,
            tools: registeredTools,
            commands: registeredCommands,
        });

        return { success: true, name: manifest.name };
    }

    /**
     * Unload a plugin, removing its tools and commands.
     * @param {string} pluginName
     * @param {import('./ToolRegistry')} registry
     * @param {import('./CommandRouter')} [router]
     * @returns {boolean}
     */
    unloadPlugin(pluginName, registry, router = null) {
        const entry = this.#loaded.get(pluginName);
        if (!entry) return false;

        for (const toolName of entry.tools) registry.unregister(toolName);
        if (router) {
            for (const cmdName of entry.commands) router.unregister(cmdName);
        }

        this.#loaded.delete(pluginName);
        return true;
    }

    /**
     * List all loaded plugins with their metadata.
     * @returns {object[]}
     */
    list() {
        return Array.from(this.#loaded.entries()).map(([name, entry]) => ({
            name,
            sector: entry.manifest.sector,
            version: entry.manifest.version,
            tools: entry.tools,
            commands: entry.commands,
            contracts: entry.manifest.contracts || [],
        }));
    }

    /**
     * Get a loaded plugin's manifest.
     * @param {string} pluginName
     * @returns {object|null}
     */
    getManifest(pluginName) {
        return this.#loaded.get(pluginName)?.manifest || null;
    }

    /**
     * Get all contracts declared by all loaded plugins (for ParityChecker).
     * @returns {{ name: string, sector: string, critical: boolean }[]}
     */
    getAllContracts() {
        const contracts = [];
        for (const [, entry] of this.#loaded) {
            for (const c of entry.manifest.contracts || []) {
                contracts.push({
                    name: c.name,
                    sector: entry.manifest.sector,
                    critical: c.critical || false,
                });
            }
        }
        return contracts;
    }

    /** @returns {number} */
    get size() {
        return this.#loaded.size;
    }

    /**
     * Create a BaseTool instance from a plugin tool definition.
     * Plugin tools return a stub response (actual implementation would call contracts).
     * @private
     */
    #createPluginTool(fullName, toolDef, sector) {
        const tool = new BaseTool({
            name: fullName,
            description: `[Plugin:${sector}] ${toolDef.description}`,
            permissions: toolDef.permissions || ['runtime:read'],
            sector,
            timeoutMs: toolDef.timeoutMs || 15000,
            inputSchema: toolDef.inputSchema || { type: 'object', properties: {} },
        });

        // Override execute with a plugin stub
        tool.execute = async (params, context) => {
            return {
                success: true,
                data: {
                    plugin: sector,
                    tool: fullName,
                    params,
                    message: `Plugin tool ${fullName} executed (stub — connect to contract in production)`,
                },
                meta: { source: 'plugin', sector },
            };
        };

        return tool;
    }

    /**
     * Create a BaseCommand instance from a plugin command definition.
     * @private
     */
    #createPluginCommand(cmdDef, sector) {
        return new BaseCommand({
            name: cmdDef.name,
            description: cmdDef.description || `Plugin command for ${sector}`,
            toolName: cmdDef.toolName,
            aliases: cmdDef.aliases || [],
            usage: `/${cmdDef.name}`,
        });
    }
}

module.exports = PluginLoader;
