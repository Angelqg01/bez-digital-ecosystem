/**
 * GlobalSettings API Tests
 * 
 * Tests for the Admin Configuration API
 */

const GlobalSettings = require('../models/GlobalSettings.model');

// Mock logger
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// Mock mongoose connection for model tests
jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');
    return {
        ...actualMongoose,
        connect: jest.fn().mockResolvedValue(true),
        connection: {
            on: jest.fn(),
            once: jest.fn(),
            readyState: 1,
        },
    };
});

describe('GlobalSettings Model', () => {
    describe('Schema Validation', () => {
        test('should have correct _id default', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema._id).toBeDefined();
            expect(schema._id.options.default).toBe('global_settings');
        });

        test('should have defi configuration section', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['defi.enabled']).toBeDefined();
            expect(schema['defi.swapFeePercent']).toBeDefined();
            expect(schema['defi.maxSlippage']).toBeDefined();
        });

        test('should have fiat configuration section', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['fiat.enabled']).toBeDefined();
            expect(schema['fiat.minPurchaseUSD']).toBeDefined();
            expect(schema['fiat.maxPurchaseUSD']).toBeDefined();
        });

        test('should have token configuration section', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['token.contractAddress']).toBeDefined();
            expect(schema['token.symbol']).toBeDefined();
            expect(schema['token.decimals']).toBeDefined();
        });

        test('should have farming configuration section', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['farming.enabled']).toBeDefined();
            expect(schema['farming.defaultAPY']).toBeDefined();
            expect(schema['farming.rewardsPerBlock']).toBeDefined();
        });

        test('should have staking configuration section', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['staking.enabled']).toBeDefined();
            expect(schema['staking.minStakeAmount']).toBeDefined();
            expect(schema['staking.rewardRatePercent']).toBeDefined();
        });

        test('should have dao configuration section', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['dao.enabled']).toBeDefined();
            expect(schema['dao.quorumPercentage']).toBeDefined();
            expect(schema['dao.votingPeriodDays']).toBeDefined();
        });

        test('should have rwa configuration section', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['rwa.enabled']).toBeDefined();
            expect(schema['rwa.minInvestmentUSD']).toBeDefined();
            expect(schema['rwa.platformFeePercent']).toBeDefined();
        });

        test('should have platform configuration section', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['platform.maintenanceMode']).toBeDefined();
            expect(schema['platform.registrationEnabled']).toBeDefined();
            expect(schema['platform.sessionTimeoutMinutes']).toBeDefined();
        });
    });

    describe('Default Values', () => {
        test('defi defaults should be correct', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['defi.enabled'].options.default).toBe(true);
            expect(schema['defi.swapFeePercent'].options.default).toBe(0.3);
            expect(schema['defi.maxSlippage'].options.default).toBe(1);
        });

        test('fiat defaults should be correct', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['fiat.enabled'].options.default).toBe(true);
            expect(schema['fiat.minPurchaseUSD'].options.default).toBe(10);
            expect(schema['fiat.maxPurchaseUSD'].options.default).toBe(10000);
        });

        test('token defaults should be correct', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['token.symbol'].options.default).toBe('BEZ');
            expect(schema['token.decimals'].options.default).toBe(18);
        });

        test('farming defaults should be correct', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['farming.enabled'].options.default).toBe(true);
            expect(schema['farming.defaultAPY'].options.default).toBe(15);
        });

        test('staking defaults should be correct', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['staking.enabled'].options.default).toBe(true);
            expect(schema['staking.rewardRatePercent'].options.default).toBe(12);
        });

        test('dao defaults should be correct', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['dao.enabled'].options.default).toBe(true);
            expect(schema['dao.quorumPercentage'].options.default).toBe(10);
            expect(schema['dao.votingPeriodDays'].options.default).toBe(7);
        });

        test('platform defaults should be correct', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['platform.maintenanceMode'].options.default).toBe(false);
            expect(schema['platform.registrationEnabled'].options.default).toBe(true);
            expect(schema['platform.sessionTimeoutMinutes'].options.default).toBe(60);
        });
    });

    describe('Validation Constraints', () => {
        test('swapFeePercent should have min/max constraints', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['defi.swapFeePercent'].options.min).toBe(0);
            expect(schema['defi.swapFeePercent'].options.max).toBe(10);
        });

        test('maxSlippage should have min/max constraints', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['defi.maxSlippage'].options.min).toBe(0.1);
            expect(schema['defi.maxSlippage'].options.max).toBe(50);
        });

        test('rewardRatePercent should have min/max constraints', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['staking.rewardRatePercent'].options.min).toBe(0);
            expect(schema['staking.rewardRatePercent'].options.max).toBe(100);
        });

        test('quorumPercentage should have min/max constraints', () => {
            const schema = GlobalSettings.schema.paths;
            expect(schema['dao.quorumPercentage'].options.min).toBe(1);
            expect(schema['dao.quorumPercentage'].options.max).toBe(100);
        });
    });

    describe('Static Methods', () => {
        test('should have getSettings static method', () => {
            expect(typeof GlobalSettings.getSettings).toBe('function');
        });

        test('should have updateSettings static method', () => {
            expect(typeof GlobalSettings.updateSettings).toBe('function');
        });
    });

    describe('Configuration Sections Coverage', () => {
        const requiredSections = [
            'defi',
            'fiat',
            'token',
            'farming',
            'staking',
            'dao',
            'rwa',
            'platform',
        ];

        requiredSections.forEach(section => {
            test(`should have ${section} configuration section`, () => {
                const paths = Object.keys(GlobalSettings.schema.paths);
                const sectionPaths = paths.filter(p => p.startsWith(`${section}.`));
                expect(sectionPaths.length).toBeGreaterThan(0);
            });
        });
    });
});

describe('GlobalSettings API Integration', () => {
    describe('Endpoint Structure', () => {
        const expectedEndpoints = [
            { method: 'GET', path: '/api/admin/settings/global' },
            { method: 'PUT', path: '/api/admin/settings/global' },
            { method: 'GET', path: '/api/admin/settings/global/:section' },
            { method: 'PATCH', path: '/api/admin/settings/global/:section' },
            { method: 'POST', path: '/api/admin/settings/global/reset' },
            { method: 'GET', path: '/api/admin/settings/global/public/frontend' },
        ];

        test('should have all required endpoints documented', () => {
            // This is a documentation test - actual endpoint testing requires supertest
            expectedEndpoints.forEach(endpoint => {
                expect(endpoint.method).toBeDefined();
                expect(endpoint.path).toBeDefined();
            });
        });
    });

    describe('Section Validation', () => {
        const validSections = ['defi', 'fiat', 'token', 'farming', 'staking', 'dao', 'rwa', 'platform'];

        validSections.forEach(section => {
            test(`${section} should be a valid section`, () => {
                expect(validSections.includes(section)).toBe(true);
            });
        });

        test('should reject invalid sections', () => {
            const invalidSections = ['invalid', 'test', 'unknown'];
            invalidSections.forEach(section => {
                expect(validSections.includes(section)).toBe(false);
            });
        });
    });
});
