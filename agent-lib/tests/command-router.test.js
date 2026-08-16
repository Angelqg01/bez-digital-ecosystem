/**
 * Tests for CommandRouter — dispatch, aliases, error handling.
 */
const CommandRouter = require('../core/CommandRouter');
const BaseCommand = require('../commands/_base.cmd');

// Mock tool registry and permission engine for command context
function mockContext(overrides = {}) {
    const mockTool = {
        name: 'test-tool',
        permissions: ['runtime:read'],
        sector: null,
        execute: jest.fn().mockResolvedValue({ success: true, data: { status: 'ok' } }),
        validateInput: jest.fn().mockReturnValue({ valid: true, errors: null }),
        toDescriptor: () => ({ name: 'test-tool' }),
        timeoutMs: 5000,
    };

    return {
        registry: {
            get: jest.fn().mockReturnValue(mockTool),
            invoke: jest.fn().mockResolvedValue({ success: true, data: { status: 'ok' } }),
        },
        permissions: {
            check: jest.fn().mockReturnValue({ allowed: true }),
        },
        user: { role: 'operator', address: '0xABC', sectors: [] },
        ...overrides,
    };
}

describe('CommandRouter', () => {
    let router;

    beforeEach(() => {
        router = new CommandRouter();
    });

    test('registers a command', () => {
        const cmd = new BaseCommand({ name: 'test', description: 'Test cmd', aliases: ['t'] });
        cmd.run = jest.fn().mockResolvedValue({ success: true, message: 'done' });
        router.register(cmd);
        expect(router.size).toBe(1);
        expect(router.has('test')).toBe(true);
    });

    test('throws on duplicate command name', () => {
        const cmd = new BaseCommand({ name: 'dup', aliases: [] });
        cmd.run = jest.fn();
        router.register(cmd);
        const cmd2 = new BaseCommand({ name: 'dup', aliases: [] });
        expect(() => router.register(cmd2)).toThrow('already registered');
    });

    test('throws on duplicate alias', () => {
        const cmd1 = new BaseCommand({ name: 'cmd1', aliases: ['x'] });
        cmd1.run = jest.fn();
        const cmd2 = new BaseCommand({ name: 'cmd2', aliases: ['x'] });
        cmd2.run = jest.fn();
        router.register(cmd1);
        expect(() => router.register(cmd2)).toThrow('Alias "x" already mapped');
    });

    test('resolves by alias', () => {
        const cmd = new BaseCommand({ name: 'bridge-health', aliases: ['bh', 'bridge'] });
        cmd.run = jest.fn();
        router.register(cmd);
        expect(router.resolve('bh')).toBe(cmd);
        expect(router.resolve('bridge')).toBe(cmd);
        expect(router.resolve('bridge-health')).toBe(cmd);
    });

    test('dispatch with leading slash', async () => {
        const cmd = new BaseCommand({ name: 'test', aliases: [], toolName: 'test-tool' });
        cmd.run = jest.fn().mockResolvedValue({ success: true, message: 'ok', data: {} });
        router.register(cmd);

        const ctx = mockContext();
        const result = await router.dispatch('/test', ctx);
        expect(result.success).toBe(true);
        expect(result.command).toBe('test');
    });

    test('dispatch without leading slash', async () => {
        const cmd = new BaseCommand({ name: 'test', aliases: [] });
        cmd.run = jest.fn().mockResolvedValue({ success: true, message: 'ok' });
        router.register(cmd);

        const result = await router.dispatch('test --flag', mockContext());
        expect(result.success).toBe(true);
    });

    test('dispatch unknown command returns error', async () => {
        const result = await router.dispatch('/unknown', mockContext());
        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown command');
    });

    test('dispatch empty input returns error', async () => {
        const result = await router.dispatch('', mockContext());
        expect(result.success).toBe(false);
        expect(result.message).toBe('Empty command input');
    });

    test('dispatch via alias', async () => {
        const cmd = new BaseCommand({ name: 'bridge-health', aliases: ['bh'] });
        cmd.run = jest.fn().mockResolvedValue({ success: true, message: 'healthy' });
        router.register(cmd);

        const result = await router.dispatch('/bh', mockContext());
        expect(result.success).toBe(true);
        expect(result.command).toBe('bridge-health');
    });

    test('unregister removes command and aliases', () => {
        const cmd = new BaseCommand({ name: 'temp', aliases: ['t'] });
        cmd.run = jest.fn();
        router.register(cmd);
        expect(router.has('t')).toBe(true);

        router.unregister('temp');
        expect(router.has('temp')).toBe(false);
        expect(router.has('t')).toBe(false);
        expect(router.size).toBe(0);
    });

    test('list returns descriptors', () => {
        const cmd = new BaseCommand({ name: 'list-test', description: 'A test', aliases: ['lt'] });
        cmd.run = jest.fn();
        router.register(cmd);

        const list = router.list();
        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('list-test');
        expect(list[0].aliases).toEqual(['lt']);
    });

    test('dispatch catches command run errors', async () => {
        const cmd = new BaseCommand({ name: 'fail', aliases: [] });
        cmd.run = jest.fn().mockRejectedValue(new Error('boom'));
        router.register(cmd);

        const result = await router.dispatch('/fail', mockContext());
        expect(result.success).toBe(false);
        expect(result.message).toContain('boom');
    });
});
