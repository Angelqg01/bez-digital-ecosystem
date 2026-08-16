/**
 * Tests: Rate limiting in PermissionEngine
 */
const PermissionEngine = require('../core/PermissionEngine');

describe('PermissionEngine — Rate Limiting', () => {
    let engine;

    beforeEach(() => {
        engine = new PermissionEngine();
    });

    afterEach(() => {
        engine.resetRateLimits();
    });

    test('allows invocation when no override exists', () => {
        const result = engine.checkRateLimit('bridge-health', '0x123');
        expect(result.allowed).toBe(true);
    });

    test('allows invocations within limit', () => {
        // deploy-check has maxRatePerMinute: 2 in policies.json
        const r1 = engine.checkRateLimit('deploy-check', '0xabc');
        const r2 = engine.checkRateLimit('deploy-check', '0xabc');
        expect(r1.allowed).toBe(true);
        expect(r2.allowed).toBe(true);
    });

    test('blocks invocation when limit exceeded', () => {
        const tool = 'deploy-check'; // limit = 2/min
        engine.checkRateLimit(tool, '0xabc');
        engine.checkRateLimit(tool, '0xabc');
        const r3 = engine.checkRateLimit(tool, '0xabc');
        expect(r3.allowed).toBe(false);
        expect(r3.retryAfter).toBeGreaterThan(0);
    });

    test('rate limits are per-user', () => {
        const tool = 'deploy-check';
        engine.checkRateLimit(tool, '0xabc');
        engine.checkRateLimit(tool, '0xabc');
        // Different user should still be allowed
        const r = engine.checkRateLimit(tool, '0xdef');
        expect(r.allowed).toBe(true);
    });

    test('resetRateLimits clears all buckets', () => {
        const tool = 'deploy-check';
        engine.checkRateLimit(tool, '0xabc');
        engine.checkRateLimit(tool, '0xabc');
        engine.resetRateLimits();
        const r = engine.checkRateLimit(tool, '0xabc');
        expect(r.allowed).toBe(true);
    });

    test('incident-report has maxRatePerMinute: 5', () => {
        const tool = 'incident-report';
        for (let i = 0; i < 5; i++) {
            expect(engine.checkRateLimit(tool, '0xabc').allowed).toBe(true);
        }
        expect(engine.checkRateLimit(tool, '0xabc').allowed).toBe(false);
    });
});
