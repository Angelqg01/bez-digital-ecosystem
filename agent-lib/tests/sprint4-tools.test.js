/**
 * Tests for incident-report and sector-query tools — Sprint 4.
 */

describe('incident-report tool', () => {
    const tool = require('../tools/incident-report.tool');

    test('has correct name and permissions', () => {
        expect(tool.name).toBe('incident-report');
        expect(tool.permissions).toContain('runtime:write');
        expect(tool.permissions).toContain('incident:create');
    });

    test('requires sector, severity, title', () => {
        const { valid, errors } = tool.validateInput({});
        expect(valid).toBe(false);
        expect(errors.length).toBeGreaterThan(0);
    });

    test('accepts valid input', () => {
        const { valid } = tool.validateInput({
            sector: 'logistics',
            severity: 'high',
            title: 'Bridge delay detected',
        });
        expect(valid).toBe(true);
    });

    test('rejects invalid severity', () => {
        const { valid } = tool.validateInput({
            sector: 'logistics',
            severity: 'extreme',
            title: 'Test',
        });
        expect(valid).toBe(false);
    });

    test('execute returns incident with ID', async () => {
        const result = await tool.execute({
            sector: 'energy',
            severity: 'critical',
            title: 'Gas spike anomaly',
        }, { user: { address: '0xtest' } });

        expect(result.success).toBe(true);
        expect(result.data.incident_id).toMatch(/^INC-/);
        expect(result.data.status).toBe('open');
        expect(result.data.severity).toBe('critical');
        expect(result.data.sector).toBe('energy');
    });

    test('toDescriptor() returns valid descriptor', () => {
        const desc = tool.toDescriptor();
        expect(desc.name).toBe('incident-report');
        expect(desc.permissions).toEqual(expect.arrayContaining(['incident:create']));
    });
});

describe('sector-query tool', () => {
    const tool = require('../tools/sector-query.tool');

    test('has correct name and permissions', () => {
        expect(tool.name).toBe('sector-query');
        expect(tool.permissions).toContain('runtime:read');
    });

    test('requires sector parameter', () => {
        const { valid } = tool.validateInput({});
        expect(valid).toBe(false);
    });

    test('accepts valid sector', () => {
        const { valid } = tool.validateInput({ sector: 'logistics' });
        expect(valid).toBe(true);
    });

    test('returns known sector info', async () => {
        const result = await tool.execute({ sector: 'logistics' }, {});
        expect(result.success).toBe(true);
        expect(result.data.sector).toBe('logistics');
        expect(result.data.known).toBe(true);
        expect(result.data.status).toBe('active');
        expect(result.data.agents_count).toBe(4);
    });

    test('returns unknown for non-existent sector', async () => {
        const result = await tool.execute({ sector: 'nonexistent' }, {});
        expect(result.success).toBe(true);
        expect(result.data.known).toBe(false);
        expect(result.data.status).toBe('unknown');
        expect(result.data.available_sectors).toEqual(expect.arrayContaining(['logistics', 'finanzas']));
    });

    test('normalizes sector name', async () => {
        const result = await tool.execute({ sector: '  LOGISTICS  ' }, {});
        expect(result.data.sector).toBe('logistics');
        expect(result.data.known).toBe(true);
    });
});
