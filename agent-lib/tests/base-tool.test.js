/**
 * Tests for BaseTool — input validation and descriptor generation.
 */
const BaseTool = require('../tools/_base.tool');

class TestTool extends BaseTool {
    constructor(overrides = {}) {
        super({
            name: 'test-tool',
            description: 'A test tool',
            permissions: ['runtime:read'],
            inputSchema: {
                type: 'object',
                required: ['address'],
                properties: {
                    address: { type: 'string' },
                    amount: { type: 'number' },
                },
            },
            ...overrides,
        });
    }
    async execute(params) {
        return { success: true, data: { echo: params } };
    }
}

describe('BaseTool', () => {
    test('throws if no name provided', () => {
        expect(() => new BaseTool({ name: '' })).toThrow('must have a name');
    });

    test('validates valid input', () => {
        const tool = new TestTool();
        const { valid, errors } = tool.validateInput({ address: '0x123', amount: 10 });
        expect(valid).toBe(true);
        expect(errors).toBeNull();
    });

    test('validates missing required field', () => {
        const tool = new TestTool();
        const { valid, errors } = tool.validateInput({ amount: 10 });
        expect(valid).toBe(false);
        expect(errors.length).toBeGreaterThan(0);
    });

    test('coerces types when possible', () => {
        const tool = new TestTool();
        const { valid } = tool.validateInput({ address: '0x123', amount: '10' });
        expect(valid).toBe(true); // coerceTypes: true
    });

    test('generates descriptor', () => {
        const tool = new TestTool();
        const desc = tool.toDescriptor();
        expect(desc.name).toBe('test-tool');
        expect(desc.permissions).toEqual(['runtime:read']);
        expect(desc.inputSchema.required).toContain('address');
        expect(desc).toHaveProperty('outputSchema');
        expect(desc).toHaveProperty('timeoutMs');
    });

    test('execute throws if not implemented', async () => {
        const base = new BaseTool({ name: 'raw' });
        await expect(base.execute({}, {})).rejects.toThrow('not implemented');
    });
});
