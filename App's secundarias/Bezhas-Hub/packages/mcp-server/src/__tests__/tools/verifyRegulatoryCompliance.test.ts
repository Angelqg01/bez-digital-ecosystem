/**
 * Unit tests: verify_regulatory_compliance
 * Pure logic — no external API mocking needed.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult } from '../helpers/mockMcpServer.js';
import { registerCompliance } from '../../tools/verifyRegulatoryCompliance.js';
import type { ComplianceResult } from '../../tools/verifyRegulatoryCompliance.js';

describe('verify_regulatory_compliance', () => {
    let handler: Function;

    // A KYC-verified wallet (from the simulated set)
    const KYC_WALLET = '0x1234567890123456789012345678901234567890';
    // An unverified wallet
    const UNKNOWN_WALLET = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerCompliance(server as any);
        handler = getHandler('verify_regulatory_compliance')!;
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('sanctioned regions', () => {
        it('should REJECT transactions from North Korea (KP)', async () => {
            const response = await handler({
                walletAddress: KYC_WALLET, amountBEZ: 100, fiatRegion: 'KP', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.status).toBe('REJECTED');
            expect(result.automaticAction).toBe('BLOCK_TX');
            expect(result.flags).toContain('SANCTIONED_REGION');
            expect(result.riskLevel).toBe('CRITICAL');
        });

        it('should REJECT transactions from Iran (IR)', async () => {
            const response = await handler({
                walletAddress: UNKNOWN_WALLET, amountBEZ: 10, fiatRegion: 'IR', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.status).toBe('REJECTED');
            expect(result.riskScore).toBe(100);
        });

        it('should REJECT transactions from all sanctioned regions', async () => {
            const sanctioned = ['KP', 'IR', 'CU', 'SY', 'RU'];
            for (const region of sanctioned) {
                const response = await handler({
                    walletAddress: KYC_WALLET, amountBEZ: 10, fiatRegion: region, transactionType: 'transfer',
                });
                const result = parseToolResult<ComplianceResult>(response);
                expect(result.status).toBe('REJECTED');
            }
        });
    });

    describe('KYC requirements', () => {
        it('should require KYC for transactions > $10,000', async () => {
            // BEZ price ~$0.50, so 25000 BEZ ≈ $12,500
            const response = await handler({
                walletAddress: UNKNOWN_WALLET, amountBEZ: 25000, fiatRegion: 'US', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.kycRequired).toBe(true);
            expect(result.status).toBe('PENDING_KYC');
            expect(result.automaticAction).toBe('HOLD_FOR_REVIEW');
        });

        it('should APPROVE high-value tx with verified KYC wallet', async () => {
            const response = await handler({
                walletAddress: KYC_WALLET, amountBEZ: 25000, fiatRegion: 'US', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.kycVerified).toBe(true);
            expect(result.status).toBe('APPROVED');
            expect(result.automaticAction).toBe('ALLOW_TX');
        });

        it('should not require KYC for low-value transactions', async () => {
            const response = await handler({
                walletAddress: UNKNOWN_WALLET, amountBEZ: 100, fiatRegion: 'US', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.kycRequired).toBe(false);
        });
    });

    describe('structuring detection', () => {
        it('should flag possible structuring ($9,000 - $10,000 range)', async () => {
            // $9,500 worth ≈ 19000 BEZ at $0.50
            const response = await handler({
                walletAddress: UNKNOWN_WALLET, amountBEZ: 19000, fiatRegion: 'US', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.flags).toContain('POSSIBLE_STRUCTURING');
        });

        it('should NOT flag amounts well below $9,000', async () => {
            const response = await handler({
                walletAddress: UNKNOWN_WALLET, amountBEZ: 100, fiatRegion: 'US', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.flags).not.toContain('POSSIBLE_STRUCTURING');
        });
    });

    describe('risk scoring', () => {
        it('should be LOW risk for small transactions from safe regions', async () => {
            const response = await handler({
                walletAddress: KYC_WALLET, amountBEZ: 50, fiatRegion: 'US', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.riskLevel).toBe('LOW');
            expect(result.riskScore).toBe(0);
        });

        it('should cap risk score at 100', async () => {
            const response = await handler({
                walletAddress: UNKNOWN_WALLET, amountBEZ: 25000, fiatRegion: 'KP', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.riskScore).toBeLessThanOrEqual(100);
        });

        it('should flag UNVERIFIED_HIGH_AMOUNT for unverified wallets > $5,000', async () => {
            // $6,000 = 12000 BEZ at $0.50
            const response = await handler({
                walletAddress: UNKNOWN_WALLET, amountBEZ: 12000, fiatRegion: 'US', transactionType: 'swap',
            });
            const result = parseToolResult<ComplianceResult>(response);
            expect(result.flags).toContain('UNVERIFIED_HIGH_AMOUNT');
        });
    });

    describe('response format', () => {
        it('should have all required ComplianceResult fields', async () => {
            const response = await handler({
                walletAddress: KYC_WALLET, amountBEZ: 100, fiatRegion: 'US', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);

            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('kycRequired');
            expect(result).toHaveProperty('kycVerified');
            expect(result).toHaveProperty('riskScore');
            expect(result).toHaveProperty('riskLevel');
            expect(result).toHaveProperty('flags');
            expect(result).toHaveProperty('automaticAction');
            expect(result).toHaveProperty('totalValueUSD');
            expect(result).toHaveProperty('reasoning');
        });

        it('should calculate totalValueUSD correctly', async () => {
            const response = await handler({
                walletAddress: KYC_WALLET, amountBEZ: 200, fiatRegion: 'US', transactionType: 'transfer',
            });
            const result = parseToolResult<ComplianceResult>(response);
            // 200 BEZ * $0.50 = $100
            expect(result.totalValueUSD).toBe(100);
        });
    });
});
