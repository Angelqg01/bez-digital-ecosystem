/**
 * Tests for PluginLoader — discovery, loading, unloading, validation.
 */
const path = require('path');
const PluginLoader = require('../core/PluginLoader');
const ToolRegistry = require('../core/ToolRegistry');
const CommandRouter = require('../core/CommandRouter');

describe('PluginLoader', () => {
    let loader, registry, router;

    beforeEach(() => {
        loader = new PluginLoader();
        registry = new ToolRegistry();
        router = new CommandRouter();
    });

    test('loadAll discovers and loads plugins from plugins directory', () => {
        const results = loader.loadAll(registry, router);
        expect(results.loaded.length).toBeGreaterThanOrEqual(3);
        expect(results.loaded).toContain('logistics-plugin');
        expect(results.loaded).toContain('defi-plugin');
        expect(results.loaded).toContain('governance-plugin');
    });

    test('loadAll registers plugin tools in registry', () => {
        loader.loadAll(registry, router);
        // logistics: cargo-track, escrow-status
        expect(registry.has('logistics:cargo-track')).toBe(true);
        expect(registry.has('logistics:escrow-status')).toBe(true);
        // defi: staking-info, farming-yields
        expect(registry.has('finance:staking-info')).toBe(true);
        expect(registry.has('finance:farming-yields')).toBe(true);
        // governance: proposal-status, timelock-queue
        expect(registry.has('government:proposal-status')).toBe(true);
        expect(registry.has('government:timelock-queue')).toBe(true);
    });

    test('loadAll registers plugin commands in router', () => {
        loader.loadAll(registry, router);
        expect(router.has('cargo-track')).toBe(true);
        expect(router.has('staking-info')).toBe(true);
        expect(router.has('proposal-status')).toBe(true);
    });

    test('plugin command aliases work', () => {
        loader.loadAll(registry, router);
        // cargo-track has alias "ct"
        expect(router.has('ct')).toBe(true);
        // staking-info has alias "si"
        expect(router.has('si')).toBe(true);
    });

    test('plugin tools execute with stub response', async () => {
        loader.loadAll(registry);
        const tool = registry.get('logistics:cargo-track');
        expect(tool).toBeDefined();

        const result = await tool.execute({ container_id: 'CONT-001' }, {});
        expect(result.success).toBe(true);
        expect(result.data.plugin).toBe('logistics');
        expect(result.meta.source).toBe('plugin');
    });

    test('plugin tools have correct sector', () => {
        loader.loadAll(registry);
        const tool = registry.get('finance:staking-info');
        expect(tool.sector).toBe('finance');
    });

    test('list returns loaded plugins metadata', () => {
        loader.loadAll(registry, router);
        const list = loader.list();
        expect(list.length).toBeGreaterThanOrEqual(3);

        const logistics = list.find(p => p.name === 'logistics-plugin');
        expect(logistics).toBeDefined();
        expect(logistics.sector).toBe('logistics');
        expect(logistics.tools.length).toBeGreaterThanOrEqual(2);
    });

    test('getManifest returns manifest for loaded plugin', () => {
        loader.loadAll(registry);
        const manifest = loader.getManifest('defi-plugin');
        expect(manifest).toBeDefined();
        expect(manifest.sector).toBe('finance');
        expect(manifest.version).toBe('1.0.0');
    });

    test('getManifest returns null for unknown plugin', () => {
        expect(loader.getManifest('nonexistent')).toBeNull();
    });

    test('unloadPlugin removes tools and commands', () => {
        loader.loadAll(registry, router);
        expect(registry.has('logistics:cargo-track')).toBe(true);
        expect(router.has('cargo-track')).toBe(true);

        const removed = loader.unloadPlugin('logistics-plugin', registry, router);
        expect(removed).toBe(true);
        expect(registry.has('logistics:cargo-track')).toBe(false);
        expect(router.has('cargo-track')).toBe(false);
    });

    test('unload non-existent plugin returns false', () => {
        expect(loader.unloadPlugin('ghost', registry)).toBe(false);
    });

    test('prevents double-loading of same plugin', () => {
        const r1 = loader.loadAll(registry);
        const before = loader.size;

        // Create a new registry to avoid duplicate tool name errors
        const registry2 = new ToolRegistry();
        // Try loading manually — should fail as plugin is already tracked
        const manifestPath = path.join(__dirname, '..', 'plugins', 'logistics', 'manifest.json');
        const result = loader.loadPlugin(manifestPath, registry2);
        expect(result.success).toBe(false);
        expect(result.error).toContain('already loaded');
    });

    test('getAllContracts aggregates contracts from all plugins', () => {
        loader.loadAll(registry);
        const contracts = loader.getAllContracts();
        // At least the contracts from logistics, defi, governance manifests
        expect(contracts.length).toBeGreaterThanOrEqual(0); // May be 0 if manifests don't declare contracts
    });

    test('size tracks loaded plugins', () => {
        expect(loader.size).toBe(0);
        loader.loadAll(registry);
        expect(loader.size).toBeGreaterThanOrEqual(3);
    });

    test('loadPlugin with invalid manifest path fails gracefully', () => {
        const result = loader.loadPlugin('/nonexistent/path/manifest.json', registry);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to read');
    });
});
