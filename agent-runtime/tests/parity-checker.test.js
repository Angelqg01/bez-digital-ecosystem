/**
 * Tests for ParityChecker — deployment validation, ABI checks, audit.
 */
const ParityChecker = require('../core/ParityChecker');

describe('ParityChecker', () => {
    let parity;

    beforeAll(() => {
        parity = new ParityChecker();
    });

    describe('audit()', () => {
        test('returns a structured report', () => {
            const report = parity.audit();
            expect(report).toHaveProperty('passed');
            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('checks');
            expect(report).toHaveProperty('summary');
            expect(report.summary).toHaveProperty('total');
            expect(report.summary).toHaveProperty('pass');
            expect(report.summary).toHaveProperty('warn');
            expect(report.summary).toHaveProperty('fail');
        });

        test('report checks is an array', () => {
            const report = parity.audit();
            expect(Array.isArray(report.checks)).toBe(true);
            expect(report.checks.length).toBeGreaterThan(0);
        });

        test('each check has category, name, status, message', () => {
            const report = parity.audit();
            for (const check of report.checks) {
                expect(check).toHaveProperty('category');
                expect(check).toHaveProperty('name');
                expect(check).toHaveProperty('status');
                expect(check).toHaveProperty('message');
                expect(['pass', 'warn', 'fail']).toContain(check.status);
            }
        });

        test('summary totals match checks array', () => {
            const report = parity.audit();
            const { summary, checks } = report;
            expect(summary.total).toBe(checks.length);
            expect(summary.pass + summary.warn + summary.fail).toBe(summary.total);
        });

        test('deployment files are detected', () => {
            const report = parity.audit();
            const deployChecks = report.checks.filter(c => c.category === 'deployments');
            expect(deployChecks.length).toBeGreaterThan(0);
            // Should find at least 31337.json
            const anvil = deployChecks.find(c => c.name.includes('31337'));
            expect(anvil).toBeDefined();
        });

        test('address validity checks run', () => {
            const report = parity.audit();
            const addrChecks = report.checks.filter(c => c.category === 'address-validity');
            expect(addrChecks.length).toBeGreaterThan(0);
        });
    });

    describe('checkContract()', () => {
        test('finds BEZCoinV2 on chain 31337', () => {
            const result = parity.checkContract('BEZCoinV2', 31337);
            expect(result.exists).toBe(true);
            expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
        });

        test('finds StakingPool on chain 31337', () => {
            const result = parity.checkContract('StakingPool', 31337);
            expect(result.exists).toBe(true);
        });

        test('returns false for non-existent contract', () => {
            const result = parity.checkContract('NonExistent', 31337);
            expect(result.exists).toBe(false);
        });

        test('returns false for non-existent chain', () => {
            const result = parity.checkContract('BEZCoinV2', 99999);
            expect(result.exists).toBe(false);
        });

        test('accepts chainId as string or number', () => {
            const r1 = parity.checkContract('BEZCoinV2', 31337);
            const r2 = parity.checkContract('BEZCoinV2', '31337');
            expect(r1.exists).toBe(r2.exists);
        });
    });

    describe('getDeployedContracts()', () => {
        test('returns array of contract names for chain 31337', () => {
            const contracts = parity.getDeployedContracts(31337);
            expect(Array.isArray(contracts)).toBe(true);
            expect(contracts.length).toBeGreaterThan(0);
            expect(contracts).toContain('BEZCoinV2');
        });

        test('returns empty array for unknown chain', () => {
            const contracts = parity.getDeployedContracts(99999);
            expect(contracts).toEqual([]);
        });
    });

    describe('plugin contract checks', () => {
        test('audit with plugin contracts adds plugin-contracts category', () => {
            const report = parity.audit({
                plugins: [
                    { name: 'BEZCoinV2', sector: 'core', critical: true },
                    { name: 'FakeContract', sector: 'test', critical: false },
                ],
            });

            const pluginChecks = report.checks.filter(c => c.category === 'plugin-contracts');
            expect(pluginChecks.length).toBe(2);

            const bez = pluginChecks.find(c => c.name.includes('BEZCoinV2'));
            expect(bez.status).toBe('pass');

            const fake = pluginChecks.find(c => c.name.includes('FakeContract'));
            expect(fake.status).toBe('warn'); // not critical, so warn instead of fail
        });

        test('critical missing plugin contract is a fail', () => {
            const report = parity.audit({
                plugins: [
                    { name: 'MissingCritical', sector: 'test', critical: true },
                ],
            });

            const check = report.checks.find(c => c.name === 'plugin-contract-MissingCritical');
            expect(check.status).toBe('fail');
        });
    });

    describe('reload()', () => {
        test('reload does not throw', () => {
            expect(() => parity.reload()).not.toThrow();
        });

        test('data is still available after reload', () => {
            parity.reload();
            const result = parity.checkContract('BEZCoinV2', 31337);
            expect(result.exists).toBe(true);
        });
    });
});
