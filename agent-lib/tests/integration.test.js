/**
 * Integration test — createRuntime + invokeWithPermissions.
 */
const { createRuntime, invokeWithPermissions } = require('../index');

describe('Agent Runtime — Integration', () => {
    let registry, permissions;

    beforeAll(() => {
        ({ registry, permissions } = createRuntime());
    });

    test('boots with core + MCP + plugin tools registered', () => {
        // 3 core + 12 MCP + 1 deploy-check + plugin tools
        expect(registry.size).toBeGreaterThanOrEqual(16);
        expect(registry.has('bridge-health')).toBe(true);
        expect(registry.has('validator-status')).toBe(true);
        expect(registry.has('gas-analytics')).toBe(true);
        expect(registry.has('mcp:analyze_gas_strategy')).toBe(true);
        expect(registry.has('mcp:slash_check')).toBe(true);
        expect(registry.has('deploy-check')).toBe(true);
    });

    test('admin can invoke bridge-health', async () => {
        const result = await invokeWithPermissions(
            registry, permissions,
            'bridge-health',
            { include_pending: true },
            { role: 'admin', address: '0xAdmin' }
        );
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('health');
    });

    test('viewer can invoke bridge-health (has runtime:read + bridge:status)', async () => {
        // viewer only has runtime:read, NOT bridge:status → should be denied
        const result = await invokeWithPermissions(
            registry, permissions,
            'bridge-health',
            {},
            { role: 'viewer', address: '0xViewer' }
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Permission denied');
        expect(result.denied).toContain('bridge:status');
    });

    test('operator can invoke bridge-health', async () => {
        const result = await invokeWithPermissions(
            registry, permissions,
            'bridge-health',
            {},
            { role: 'operator', address: '0xOperator' }
        );
        expect(result.success).toBe(true);
    });

    test('unknown tool returns not found', async () => {
        const result = await invokeWithPermissions(
            registry, permissions,
            'nonexistent',
            {},
            { role: 'admin', address: '0xAdmin' }
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
    });

    test('listing tools returns descriptors', () => {
        const tools = registry.list();
        expect(tools.length).toBeGreaterThanOrEqual(16);
        for (const t of tools) {
            expect(t).toHaveProperty('name');
            expect(t).toHaveProperty('permissions');
            expect(t).toHaveProperty('inputSchema');
        }
    });
});
