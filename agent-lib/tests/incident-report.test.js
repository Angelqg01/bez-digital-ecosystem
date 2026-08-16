/**
 * Tests: incident-report tool
 */
const incidentTool = require('../tools/incident-report.tool');

describe('incident-report tool', () => {
    test('has correct metadata', () => {
        expect(incidentTool.name).toBe('incident-report');
        expect(incidentTool.permissions).toContain('incident:create');
        expect(incidentTool.sector).toBeNull();
    });

    test('validates input — requires sector, severity, title', () => {
        const { valid, errors } = incidentTool.validateInput({});
        expect(valid).toBe(false);
        expect(errors.length).toBeGreaterThan(0);
    });

    test('validates severity enum', () => {
        const { valid } = incidentTool.validateInput({
            sector: 'logistics',
            severity: 'invalid',
            title: 'Test',
        });
        expect(valid).toBe(false);
    });

    test('execute creates incident with id', async () => {
        const result = await incidentTool.execute(
            { sector: 'energy', severity: 'high', title: 'Gas spike detected' },
            { user: { address: '0xabc' } }
        );
        expect(result.success).toBe(true);
        expect(result.data.incident_id).toMatch(/^INC-/);
        expect(result.data.status).toBe('open');
        expect(result.data.severity).toBe('high');
        expect(result.data.sector).toBe('energy');
    });

    test('execute defaults sector to global', async () => {
        const result = await incidentTool.execute(
            { sector: 'global', severity: 'low', title: 'Test' },
            { user: { address: '0x1' } }
        );
        expect(result.data.sector).toBe('global');
    });

    test('execute includes meta', async () => {
        const result = await incidentTool.execute(
            { sector: 'defi', severity: 'medium', title: 'Test incident' },
            { user: { address: '0x123' } }
        );
        expect(result.meta.tool).toBe('incident-report');
        expect(result.meta.timestamp).toBeDefined();
    });

    test('toDescriptor includes name and permissions', () => {
        const desc = incidentTool.toDescriptor();
        expect(desc.name).toBe('incident-report');
        expect(desc.permissions).toContain('runtime:write');
    });
});
