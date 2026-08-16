/**
 * Tests for PermissionEngine — RBAC + sector-scoped policies.
 */
const PermissionEngine = require('../core/PermissionEngine');
const path = require('path');

const POLICIES_PATH = path.join(__dirname, '..', 'permissions', 'policies.json');

describe('PermissionEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new PermissionEngine(POLICIES_PATH);
    });

    // ── Admin ──
    test('admin has access to everything', () => {
        const result = engine.check('admin', ['runtime:read', 'deploy:execute', 'parity:audit']);
        expect(result.allowed).toBe(true);
    });

    // ── Viewer ──
    test('viewer can read runtime', () => {
        const result = engine.check('viewer', ['runtime:read']);
        expect(result.allowed).toBe(true);
    });

    test('viewer cannot write', () => {
        const result = engine.check('viewer', ['runtime:write']);
        expect(result.allowed).toBe(false);
        expect(result.denied).toContain('runtime:write');
    });

    test('viewer cannot invoke MCP tools', () => {
        const result = engine.check('viewer', ['mcp:analyze_gas:invoke']);
        expect(result.allowed).toBe(false);
    });

    // ── Operator ──
    test('operator can invoke MCP tools', () => {
        const result = engine.check('operator', ['mcp:analyze_gas:invoke']);
        expect(result.allowed).toBe(true);
    });

    test('operator can read + write runtime', () => {
        const result = engine.check('operator', ['runtime:read', 'runtime:write']);
        expect(result.allowed).toBe(true);
    });

    test('operator cannot deploy', () => {
        const result = engine.check('operator', ['deploy:verify']);
        expect(result.allowed).toBe(false);
    });

    test('operator cannot run parity audit', () => {
        const result = engine.check('operator', ['parity:audit']);
        expect(result.allowed).toBe(false);
    });

    // ── Deployer ──
    test('deployer can verify and execute deploys', () => {
        const result = engine.check('deployer', ['deploy:verify', 'deploy:execute']);
        expect(result.allowed).toBe(true);
    });

    test('deployer can run parity audit', () => {
        const result = engine.check('deployer', ['parity:audit']);
        expect(result.allowed).toBe(true);
    });

    test('deployer cannot write to sectors', () => {
        const result = engine.check('deployer', ['sector:logistics:write']);
        expect(result.allowed).toBe(false);
    });

    // ── Sector-Admin ──
    test('sector-admin can access their assigned sector', () => {
        const result = engine.check('sector-admin', ['sector:logistics:read', 'sector:logistics:write'], 'logistics');
        expect(result.allowed).toBe(true);
    });

    test('sector-admin cannot access other sectors', () => {
        const result = engine.check('sector-admin', ['sector:defi:read'], 'logistics');
        expect(result.allowed).toBe(false);
    });

    test('sector-admin can read/write runtime', () => {
        const result = engine.check('sector-admin', ['runtime:read', 'runtime:write']);
        expect(result.allowed).toBe(true);
    });

    // ── Unknown role ──
    test('unknown role is denied', () => {
        const result = engine.check('hacker', ['runtime:read']);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Unknown role');
    });

    // ── Tool overrides ──
    test('returns tool override for incident-report', () => {
        const override = engine.getToolOverride('incident-report');
        expect(override).not.toBeNull();
        expect(override.minRole).toBe('operator');
        expect(override.requireAuditLog).toBe(true);
        expect(override.maxRatePerMinute).toBe(5);
    });

    test('returns null for tool without override', () => {
        const override = engine.getToolOverride('bridge-health');
        expect(override).toBeNull();
    });

    // ── Reload ──
    test('reload refreshes policies', () => {
        engine.reload(POLICIES_PATH);
        const result = engine.check('admin', ['anything']);
        expect(result.allowed).toBe(true);
    });
});
