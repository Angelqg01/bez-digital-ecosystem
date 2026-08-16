/**
 * Sprint 4 Integration Tests — Full runtime with all Sprint 4 components.
 */
const { createRuntime, invokeWithPermissions } = require('..');

describe('Sprint 4 — Integration', () => {
    let runtime;

    beforeAll(() => {
        runtime = createRuntime({ loadPlugins: true });
    });

    // ── Runtime composition ───────────────────────────────────

    test('runtime has all 8 components', () => {
        expect(runtime).toHaveProperty('registry');
        expect(runtime).toHaveProperty('permissions');
        expect(runtime).toHaveProperty('router');
        expect(runtime).toHaveProperty('sessions');
        expect(runtime).toHaveProperty('plugins');
        expect(runtime).toHaveProperty('parity');
        expect(runtime).toHaveProperty('breaker');
        expect(runtime).toHaveProperty('eventBus');
    });

    // ── Tools ─────────────────────────────────────────────────

    test('has Sprint 4 tools registered (incident-report, sector-query)', () => {
        expect(runtime.registry.get('incident-report')).toBeDefined();
        expect(runtime.registry.get('sector-query')).toBeDefined();
    });

    test('total tools >= 24 (3 core + 12 MCP + 1 deploy-check + 2 Sprint4 + 6 plugin)', () => {
        expect(runtime.registry.size).toBeGreaterThanOrEqual(24);
    });

    // ── Commands ──────────────────────────────────────────────

    test('has /incident command registered', () => {
        const cmds = runtime.router.list();
        const names = cmds.map(c => c.name);
        expect(names).toContain('incident');
    });

    test('total commands >= 8 (5 core + 3 plugin)', () => {
        expect(runtime.router.size).toBeGreaterThanOrEqual(8);
    });

    // ── CircuitBreaker ────────────────────────────────────────

    test('circuit breaker starts in CLOSED for new circuit', () => {
        const status = runtime.breaker.getStatus('test-service');
        expect(status.state).toBe('CLOSED');
    });

    test('circuit breaker exec wraps async functions', async () => {
        const result = await runtime.breaker.exec('myservice', async () => 'hello');
        expect(result).toBe('hello');
    });

    // ── EventBus ──────────────────────────────────────────────

    test('eventBus publishes typed events', (done) => {
        runtime.eventBus.once('runtime-event', (event) => {
            expect(event.type).toBe('test:integration');
            expect(event.foo).toBe('bar');
            done();
        });
        runtime.eventBus.publish('test:integration', { foo: 'bar' });
    });

    // ── Rate Limiting ─────────────────────────────────────────

    test('rate limiting works via permissions engine', () => {
        const r = runtime.permissions.checkRateLimit('deploy-check', '0xtest');
        expect(r).toHaveProperty('allowed');
    });

    // ── invokeWithPermissions with new tools ──────────────────

    test('admin can invoke incident-report', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'incident-report',
            { sector: 'logistics', severity: 'low', title: 'Test incident' },
            { role: 'admin', address: '0xadmin' }
        );
        expect(result.success).toBe(true);
        expect(result.data.incident_id).toMatch(/^INC-/);
    });

    test('admin can invoke sector-query', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'sector-query',
            { sector: 'logistics' },
            { role: 'admin', address: '0xadmin' }
        );
        expect(result.success).toBe(true);
        expect(result.data.sector).toBe('logistics');
        expect(result.data.known).toBe(true);
    });

    test('viewer denied incident-report', async () => {
        const result = await invokeWithPermissions(
            runtime.registry,
            runtime.permissions,
            'incident-report',
            { sector: 'logistics', severity: 'low', title: 'Test' },
            { role: 'viewer', address: '0xview' }
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Permission denied');
    });

    // ── Plugins still loaded ──────────────────────────────────

    test('plugins remain loaded after Sprint 4 additions', () => {
        expect(runtime.plugins.size).toBeGreaterThanOrEqual(3);
    });
});
