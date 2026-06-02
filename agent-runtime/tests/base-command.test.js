/**
 * Tests for BaseCommand — argument parsing, delegation to tools.
 */
const BaseCommand = require('../commands/_base.cmd');

describe('BaseCommand', () => {
    test('throws if no name', () => {
        expect(() => new BaseCommand({})).toThrow('must have a name');
    });

    test('parseArgs handles --key value pairs', () => {
        const cmd = new BaseCommand({ name: 'test' });
        const params = cmd.parseArgs('--name hello --count 42');
        expect(params.name).toBe('hello');
        expect(params.count).toBe(42);
    });

    test('parseArgs handles boolean flags', () => {
        const cmd = new BaseCommand({ name: 'test' });
        const params = cmd.parseArgs('--verbose --debug');
        expect(params.verbose).toBe(true);
        expect(params.debug).toBe(true);
    });

    test('parseArgs handles mixed flags and values', () => {
        const cmd = new BaseCommand({ name: 'test' });
        const params = cmd.parseArgs('--verbose --port 8080 --debug');
        expect(params.verbose).toBe(true);
        expect(params.port).toBe(8080);
        expect(params.debug).toBe(true);
    });

    test('parseArgs with empty string', () => {
        const cmd = new BaseCommand({ name: 'test' });
        const params = cmd.parseArgs('');
        expect(params).toEqual({});
    });

    test('run() without toolName throws', async () => {
        const cmd = new BaseCommand({ name: 'no-tool' });
        await expect(cmd.run({}, {})).rejects.toThrow('run() not implemented');
    });

    test('run() with toolName delegates to registry', async () => {
        const cmd = new BaseCommand({ name: 'delegated', toolName: 'my-tool' });

        const mockTool = {
            name: 'my-tool',
            permissions: ['runtime:read'],
            sector: null,
        };

        const context = {
            registry: {
                get: jest.fn().mockReturnValue(mockTool),
                invoke: jest.fn().mockResolvedValue({ success: true, data: { x: 1 } }),
            },
            permissions: {
                check: jest.fn().mockReturnValue({ allowed: true }),
            },
            user: { role: 'admin' },
        };

        const result = await cmd.run({}, context);
        expect(result.success).toBe(true);
        expect(context.registry.invoke).toHaveBeenCalledWith('my-tool', {}, { user: { role: 'admin' } });
    });

    test('run() returns permission denied when not allowed', async () => {
        const cmd = new BaseCommand({ name: 'denied', toolName: 'secret-tool' });

        const context = {
            registry: {
                get: jest.fn().mockReturnValue({ name: 'secret-tool', permissions: ['admin:only'], sector: null }),
            },
            permissions: {
                check: jest.fn().mockReturnValue({ allowed: false, denied: ['admin:only'] }),
            },
            user: { role: 'viewer' },
        };

        const result = await cmd.run({}, context);
        expect(result.success).toBe(false);
        expect(result.message).toContain('Permission denied');
    });

    test('run() returns error when tool not found', async () => {
        const cmd = new BaseCommand({ name: 'missing', toolName: 'ghost' });

        const context = {
            registry: { get: jest.fn().mockReturnValue(undefined) },
            permissions: { check: jest.fn() },
            user: { role: 'admin' },
        };

        const result = await cmd.run({}, context);
        expect(result.success).toBe(false);
        expect(result.message).toContain('not found');
    });

    test('toDescriptor() returns correct shape', () => {
        const cmd = new BaseCommand({
            name: 'desc-test',
            description: 'A test',
            aliases: ['dt'],
            usage: '/desc-test [--flag]',
            toolName: 'some-tool',
        });
        const desc = cmd.toDescriptor();
        expect(desc.name).toBe('desc-test');
        expect(desc.aliases).toEqual(['dt']);
        expect(desc.toolName).toBe('some-tool');
    });
});
