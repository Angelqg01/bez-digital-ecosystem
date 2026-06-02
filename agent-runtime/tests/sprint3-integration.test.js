/**
 * Sprint 3 Integration Tests — Full runtime with plugins, parity, commands.
 */
const { createRuntime, invokeWithPermissions } = require('..');

// Mock axios for MCP proxy + bridge-health tools
jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({ status: 200, data: { mocked: true } }),
    get: jest.fn().mockResolvedValue({ status: 200, data: { status: 'ok' } }),
}));

describe('Sprint 3 Integration', () => {
    let runtime;

    beforeEach(() => {
        runtime = createRuntime();
    });

    test('runtime exposes all 6 components', () => {
        expect(runtime.registry).toBeDefined();
        expect(runtime.permissions).toBeDefined();
        expect(runtime.router).toBeDefined();
        expect(runtime.sessions).toBeDefined();
        expect(runtime.plugins).toBeDefined();
        expect(runtime.parity).toBeDefined();
    });

    test('registry has core + MCP + deploy-check + plugin tools', () => {
        // 3 core + 12 MCP + 1 deploy-check + plugin tools (>=6)
        expect(runtime.registry.size).toBeGreaterThanOrEqual(22);
        expect(runtime.registry.has('deploy-check')).toBe(true);
        expect(runtime.registry.has('logistics:cargo-track')).toBe(true);
        expect(runtime.registry.has('finance:staking-info')).toBe(true);
        expect(runtime.registry.has('government:proposal-status')).toBe(true);
    });

    test('command router has Sprint 2 + Sprint 3 commands', () => {
        // 2 Sprint 2 + 2 Sprint 3 + plugin commands (>=3)
        expect(runtime.router.size).toBeGreaterThanOrEqual(7);
        expect(runtime.router.has('parity-audit')).toBe(true);
        expect(runtime.router.has('deploy-check')).toBe(true);
        expect(runtime.router.has('cargo-track')).toBe(true);
    });

    test('parity-audit command aliases work', () => {
        expect(runtime.router.has('pa')).toBe(true);
        expect(runtime.router.has('parity')).toBe(true);
    });

    test('deploy-check command aliases work', () => {
        expect(runtime.router.has('dc')).toBe(true);
        expect(runtime.router.has('deploy')).toBe(true);
    });

    test('deploy-check tool works for known contract', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'deploy-check',
            { contract_name: 'BEZCoinV2', chain_id: 31337 },
            { role: 'admin', address: '0xADMIN' },
        );
        expect(result.success).toBe(true);
        expect(result.data.deployed).toBe(true);
        expect(result.data.address).toMatch(/^0x/);
    });

    test('deploy-check tool works for unknown contract', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'deploy-check',
            { contract_name: 'DoesNotExist', chain_id: 31337 },
            { role: 'admin', address: '0xADMIN' },
        );
        expect(result.success).toBe(true);
        expect(result.data.deployed).toBe(false);
    });

    test('deploy-check requires admin/deployer role', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'deploy-check',
            { contract_name: 'BEZCoinV2' },
            { role: 'viewer', address: '0xVIEWER' },
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Permission denied');
    });

    test('parity audit runs via command dispatch (admin)', async () => {
        const result = await runtime.router.dispatch('/parity-audit', {
            registry: runtime.registry,
            permissions: runtime.permissions,
            plugins: runtime.plugins,
            user: { role: 'admin', address: '0xADMIN' },
        });
        expect(result.command).toBe('parity-audit');
        expect(result.data).toHaveProperty('summary');
        expect(result.data).toHaveProperty('checks');
    });

    test('parity audit denied for viewer', async () => {
        const result = await runtime.router.dispatch('/parity-audit', {
            registry: runtime.registry,
            permissions: runtime.permissions,
            user: { role: 'viewer', address: '0xVIEWER' },
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Permission denied');
    });

    test('plugin tools can be invoked via runtime', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'logistics:cargo-track',
            { container_id: 'CONT-123' },
            { role: 'admin', address: '0xADMIN' },
        );
        expect(result.success).toBe(true);
        expect(result.data.plugin).toBe('logistics');
    });

    test('plugins list shows all 3 sector plugins', () => {
        const list = runtime.plugins.list();
        expect(list.length).toBeGreaterThanOrEqual(3);
        const sectors = list.map(p => p.sector);
        expect(sectors).toContain('logistics');
        expect(sectors).toContain('finance');
        expect(sectors).toContain('government');
    });

    test('loadPlugins: false skips plugin loading', () => {
        const bare = createRuntime({ loadPlugins: false });
        // Should have 18 tools (3 core + 12 MCP + 1 deploy-check + 2 Sprint4), no plugin tools
        expect(bare.registry.size).toBeGreaterThanOrEqual(18);
        expect(bare.registry.has('logistics:cargo-track')).toBe(false);
    });

    test('sector filter on tools returns only matching sector + global', () => {
        const logistics = runtime.registry.list({ sector: 'logistics' });
        const logNames = logistics.map(t => t.name);
        // Should include logistics tools + all global (sector=null) tools
        expect(logNames).toContain('logistics:cargo-track');
        expect(logNames).toContain('bridge-health'); // global
    });
});
