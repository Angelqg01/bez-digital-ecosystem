/**
 * Sprint 2 Integration Tests — Full runtime with commands, MCP proxy, sessions.
 */
const { createRuntime, invokeWithPermissions } = require('..');

// Mock axios for MCP proxy tools
jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({ status: 200, data: { mocked: true } }),
    get: jest.fn().mockResolvedValue({ status: 200, data: { status: 'ok' } }),
}));

describe('Sprint 2 Integration', () => {
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
        expect(runtime.registry.size).toBeGreaterThanOrEqual(16);
        expect(runtime.registry.has('bridge-health')).toBe(true);
        expect(runtime.registry.has('mcp:analyze_gas_strategy')).toBe(true);
        expect(runtime.registry.has('mcp:slash_check')).toBe(true);
    });

    test('command router has Sprint 2+ commands', () => {
        expect(runtime.router.size).toBeGreaterThanOrEqual(4);
        expect(runtime.router.has('bridge-health')).toBe(true);
        expect(runtime.router.has('validator-status')).toBe(true);
    });

    test('command dispatch via alias "bh"', async () => {
        const result = await runtime.router.dispatch('/bh', {
            registry: runtime.registry,
            permissions: runtime.permissions,
            user: { role: 'admin', address: '0xABC' },
        });
        expect(result.success).toBe(true);
        expect(result.command).toBe('bridge-health');
    });

    test('invokeWithPermissions works for MCP proxy tool (admin)', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'mcp:system_health',
            {},
            { role: 'admin', address: '0xDEF' },
        );
        expect(result.success).toBe(true);
        expect(result.meta.source).toBe('ai-engine');
    });

    test('invokeWithPermissions denies viewer for MCP tool', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'mcp:system_health',
            {},
            { role: 'viewer', address: '0x000' },
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Permission denied');
    });

    test('session tracks tool invocations', async () => {
        const sid = 'user:test-session';
        const session = await runtime.sessions.get(sid);
        expect(session.history).toHaveLength(0);

        await runtime.sessions.appendHistory(sid, {
            type: 'tool',
            name: 'mcp:analyze_gas_strategy',
            input: { hour_of_day: 10 },
            output: { mocked: true },
        });

        const updated = await runtime.sessions.get(sid);
        expect(updated.history).toHaveLength(1);
        expect(updated.lastTool).toBe('mcp:analyze_gas_strategy');
    });

    test('operator can invoke MCP tools', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'mcp:analyze_sentiment',
            { text: 'test' },
            { role: 'operator', address: '0xOP' },
        );
        expect(result.success).toBe(true);
    });

    test('tools list includes MCP tools with mcp: prefix', () => {
        const tools = runtime.registry.list();
        const mcpTools = tools.filter(t => t.name.startsWith('mcp:'));
        expect(mcpTools).toHaveLength(12);
    });

    test('commands list returns descriptors including Sprint 2 commands', () => {
        const cmds = runtime.router.list();
        expect(cmds.length).toBeGreaterThanOrEqual(2);
        const names = cmds.map(c => c.name);
        expect(names).toContain('bridge-health');
        expect(names).toContain('validator-status');
    });
});
