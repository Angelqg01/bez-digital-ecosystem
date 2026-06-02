/**
 * Tests: sector-query tool
 */
const sectorQueryTool = require('../tools/sector-query.tool');

describe('sector-query tool', () => {
    test('has correct metadata', () => {
        expect(sectorQueryTool.name).toBe('sector-query');
        expect(sectorQueryTool.permissions).toContain('runtime:read');
        expect(sectorQueryTool.sector).toBeNull();
    });

    test('validates input — requires sector', () => {
        const { valid } = sectorQueryTool.validateInput({});
        expect(valid).toBe(false);
    });

    test('accepts valid input', () => {
        const { valid } = sectorQueryTool.validateInput({ sector: 'logistics' });
        expect(valid).toBe(true);
    });

    test('execute returns sector info for known sector', async () => {
        const result = await sectorQueryTool.execute(
            { sector: 'logistics' },
            { user: { address: '0x1' } }
        );
        expect(result.success).toBe(true);
        expect(result.data.sector).toBe('logistics');
        expect(result.data.known).toBe(true);
        expect(result.data.status).toBe('active');
        expect(result.data.agents_count).toBe(4);
    });

    test('execute returns unknown for non-existent sector', async () => {
        const result = await sectorQueryTool.execute(
            { sector: 'nonexistent' },
            { user: { address: '0x1' } }
        );
        expect(result.data.known).toBe(false);
        expect(result.data.status).toBe('unknown');
        expect(result.data.agents_count).toBe(0);
        expect(result.data.available_sectors).toBeDefined();
    });

    test('execute includes tools_count', async () => {
        const result = await sectorQueryTool.execute(
            { sector: 'defi', include_tools: true },
            { user: { address: '0x1' } }
        );
        expect(result.data).toHaveProperty('tools_count');
    });

    test('execute respects include_agents=false', async () => {
        const result = await sectorQueryTool.execute(
            { sector: 'health', include_agents: false },
            { user: { address: '0x1' } }
        );
        expect(result.data.agents_count).toBeUndefined();
    });

    test('normalizes sector name', async () => {
        const result = await sectorQueryTool.execute(
            { sector: '  LOGISTICS  ' },
            { user: { address: '0x1' } }
        );
        expect(result.data.sector).toBe('logistics');
        expect(result.data.known).toBe(true);
    });

    test('toDescriptor includes correct permissions', () => {
        const desc = sectorQueryTool.toDescriptor();
        expect(desc.name).toBe('sector-query');
        expect(desc.permissions).toContain('runtime:read');
    });
});
