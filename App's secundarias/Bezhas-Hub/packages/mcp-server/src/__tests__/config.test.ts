/**
 * Unit tests: MCP Server Configuration
 */
import { describe, it, expect } from 'vitest';
import { config } from '../config.js';

describe('MCP Server Config', () => {
    describe('network', () => {
        it('should have valid network mode', () => {
            expect(['mainnet', 'amoy', 'localhost']).toContain(config.network.mode);
        });

        it('should have RPC URLs for all networks', () => {
            expect(config.network.rpc.mainnet).toContain('polygon');
            expect(config.network.rpc.amoy).toContain('amoy');
            expect(config.network.rpc.localhost).toBe('http://localhost:8545');
        });

        it('activeRpc should return correct URL for current mode', () => {
            const expectedRpc = config.network.rpc[config.network.mode];
            expect(config.network.activeRpc).toBe(expectedRpc);
        });
    });

    describe('token', () => {
        it('should have the correct BEZ token address (immutable)', () => {
            expect(config.token.address).toBe('0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8');
        });

        it('should have 18 decimals', () => {
            expect(config.token.decimals).toBe(18);
        });

        it('should have a positive price', () => {
            expect(config.token.priceUSD).toBeGreaterThan(0);
        });

        it('should have standard ERC20 ABI functions', () => {
            const abiStr = config.token.abi.join(' ');
            expect(abiStr).toContain('transfer');
            expect(abiStr).toContain('balanceOf');
            expect(abiStr).toContain('totalSupply');
            expect(abiStr).toContain('decimals');
        });
    });

    describe('fees', () => {
        it('should have platform fee between 0 and 10%', () => {
            expect(config.fees.platformPercent).toBeGreaterThanOrEqual(0);
            expect(config.fees.platformPercent).toBeLessThanOrEqual(10);
        });

        it('should have fee burn percent between 0 and 100%', () => {
            expect(config.fees.feeBurnPercent).toBeGreaterThanOrEqual(0);
            expect(config.fees.feeBurnPercent).toBeLessThanOrEqual(100);
        });
    });

    describe('stripe', () => {
        it('should have Stripe fee configuration', () => {
            expect(config.stripe.feePercent).toBeGreaterThan(0);
            expect(config.stripe.feeFixedCents).toBeGreaterThanOrEqual(0);
        });
    });

    describe('gas', () => {
        it('should have gas thresholds', () => {
            expect(config.gas.highThresholdGwei).toBeGreaterThan(0);
            expect(config.gas.lowValueThresholdUSD).toBeGreaterThan(0);
        });

        it('should always use relayer for IoT', () => {
            expect(config.gas.iotAlwaysRelayer).toBe(true);
        });
    });

    describe('compliance', () => {
        it('should have high value threshold', () => {
            expect(config.compliance.highValueThresholdUSD).toBe(10000);
        });

        it('should have sanctioned regions list', () => {
            expect(config.compliance.sanctionedRegions).toContain('KP');
            expect(config.compliance.sanctionedRegions).toContain('IR');
            expect(config.compliance.sanctionedRegions.length).toBeGreaterThan(0);
        });
    });

    describe('integrations', () => {
        it('should have integration keys defined (may be empty strings)', () => {
            expect(config.integrations).toHaveProperty('githubToken');
            expect(config.integrations).toHaveProperty('firecrawlApiKey');
            expect(config.integrations).toHaveProperty('tallyApiKey');
            expect(config.integrations).toHaveProperty('alpacaApiKey');
            expect(config.integrations).toHaveProperty('alpacaSecretKey');
        });
    });

    describe('http', () => {
        it('should have a valid port', () => {
            expect(config.http.port).toBeGreaterThan(0);
            expect(config.http.port).toBeLessThanOrEqual(65535);
        });
    });
});
