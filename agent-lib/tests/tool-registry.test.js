/**
 * Tests for ToolRegistry — core of the Agent Runtime.
 */
const ToolRegistry = require('../core/ToolRegistry');
const BaseTool = require('../tools/_base.tool');

class MockTool extends BaseTool {
    constructor(name, opts = {}) {
        super({
            name,
            description: `Mock tool: ${name}`,
            permissions: opts.permissions || ['runtime:read'],
            sector: opts.sector || null,
            timeoutMs: opts.timeoutMs || 5000,
            inputSchema: opts.inputSchema || { type: 'object', properties: { value: { type: 'number' } } },
            outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        });
        this._handler = opts.handler || (async () => ({ success: true, data: { result: 'ok' } }));
    }
    async execute(params, context) {
        return this._handler(params, context);
    }
}

describe('ToolRegistry', () => {
    let registry;

    beforeEach(() => {
        registry = new ToolRegistry();
    });

    test('registers a tool and retrieves it', () => {
        const tool = new MockTool('test-tool');
        registry.register(tool);
        expect(registry.has('test-tool')).toBe(true);
        expect(registry.get('test-tool')).toBe(tool);
        expect(registry.size).toBe(1);
    });

    test('throws on duplicate registration', () => {
        registry.register(new MockTool('dup'));
        expect(() => registry.register(new MockTool('dup'))).toThrow('already registered');
    });

    test('throws on registering tool without name', () => {
        expect(() => registry.register({})).toThrow('without a name');
    });

    test('unregisters a tool', () => {
        registry.register(new MockTool('temp'));
        expect(registry.unregister('temp')).toBe(true);
        expect(registry.has('temp')).toBe(false);
        expect(registry.unregister('nonexistent')).toBe(false);
    });

    test('lists all tools as descriptors', () => {
        registry.register(new MockTool('a'));
        registry.register(new MockTool('b', { sector: 'logistics' }));
        const list = registry.list();
        expect(list).toHaveLength(2);
        expect(list[0]).toHaveProperty('name');
        expect(list[0]).toHaveProperty('permissions');
        expect(list[0]).toHaveProperty('inputSchema');
    });

    test('lists tools filtered by sector (includes global)', () => {
        registry.register(new MockTool('global-tool'));
        registry.register(new MockTool('logistics-tool', { sector: 'logistics' }));
        registry.register(new MockTool('defi-tool', { sector: 'defi' }));
        const logisticsTools = registry.list({ sector: 'logistics' });
        expect(logisticsTools).toHaveLength(2); // global + logistics
        expect(logisticsTools.map(t => t.name)).toContain('global-tool');
        expect(logisticsTools.map(t => t.name)).toContain('logistics-tool');
    });

    test('invoke succeeds with valid params', async () => {
        registry.register(new MockTool('invoke-test'));
        const result = await registry.invoke('invoke-test', { value: 42 }, { user: {} });
        expect(result.success).toBe(true);
        expect(result.data.result).toBe('ok');
    });

    test('invoke fails for unknown tool', async () => {
        const result = await registry.invoke('nonexistent', {}, {});
        expect(result.success).toBe(false);
        expect(result.meta.error).toContain('not found');
    });

    test('invoke fails with invalid params', async () => {
        registry.register(new MockTool('strict', {
            inputSchema: {
                type: 'object',
                required: ['value'],
                properties: { value: { type: 'number' } },
            },
        }));
        const result = await registry.invoke('strict', {}, {});
        expect(result.success).toBe(false);
        expect(result.meta.error).toBe('Invalid parameters');
    });

    test('invoke handles execution errors gracefully', async () => {
        registry.register(new MockTool('fail', {
            handler: async () => { throw new Error('boom'); },
        }));
        const result = await registry.invoke('fail', {}, {});
        expect(result.success).toBe(false);
        expect(result.meta.error).toBe('boom');
    });

    test('invoke handles timeout', async () => {
        registry.register(new MockTool('slow', {
            timeoutMs: 50,
            handler: () => new Promise(resolve => setTimeout(resolve, 200)),
        }));
        const result = await registry.invoke('slow', {}, {});
        expect(result.success).toBe(false);
        expect(result.meta.error).toContain('timed out');
    }, 10000);
});
