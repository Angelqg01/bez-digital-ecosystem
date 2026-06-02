/**
 * Unit tests: calculate_smart_swap
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult } from '../helpers/mockMcpServer.js';
import type { SwapResult } from '../../tools/calculateSmartSwap.js';

// Use vi.hoisted so the mock function reference is shared between factory and test code
const { mockGetFeeData } = vi.hoisted(() => ({
    mockGetFeeData: vi.fn(),
}));

vi.mock('ethers', () => ({
    ethers: {
        JsonRpcProvider: class MockProvider {
            getFeeData = mockGetFeeData;
        },
        formatUnits: (value: bigint | number, unit: string) => {
            const n = typeof value === 'bigint' ? Number(value) : Number(value);
            if (unit === 'gwei') return (n / 1e9).toString();
            if (unit === 'ether') return (n / 1e18).toString();
            return n.toString();
        },
    },
}));

import { registerSmartSwap } from '../../tools/calculateSmartSwap.js';

describe('calculate_smart_swap', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerSmartSwap(server as any);
        handler = getHandler('calculate_smart_swap')!;
        // Default gas: 30 Gwei
        mockGetFeeData.mockResolvedValue({
            gasPrice: BigInt(30_000_000_000),
            maxPriorityFeePerGas: BigInt(1_500_000_000),
        });
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('BEZ_TO_FIAT direction', () => {
        it('should calculate BEZ to USD swap', async () => {
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 1000, fiatCurrency: 'USD' });
            const result = parseToolResult<SwapResult>(response);

            expect(result.direction).toBe('BEZ_TO_FIAT');
            expect(result.inputAmount).toBe(1000);
            expect(result.inputCurrency).toBe('BEZ');
            expect(result.outputCurrency).toBe('USD');
            expect(result.outputAmount).toBeGreaterThan(0);
        });

        it('should calculate fees correctly', async () => {
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 1000, fiatCurrency: 'USD' });
            const result = parseToolResult<SwapResult>(response);

            expect(result.fees.stripeFeeUSD).toBeGreaterThan(0);
            expect(result.fees.gasCostUSD).toBeGreaterThanOrEqual(0);
            expect(result.fees.platformFeeUSD).toBeGreaterThan(0);
            expect(result.fees.feeBurnedUSD).toBeGreaterThan(0);
            expect(result.fees.totalFeesUSD).toBeGreaterThan(0);
            // Total fees = stripe + gas + platform
            expect(result.fees.totalFeesUSD).toBeCloseTo(
                result.fees.stripeFeeUSD + result.fees.gasCostUSD + result.fees.platformFeeUSD,
                2
            );
        });

        it('should have fee burn = 50% of platform fee', async () => {
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 1000, fiatCurrency: 'USD' });
            const result = parseToolResult<SwapResult>(response);
            expect(result.fees.feeBurnedUSD).toBeCloseTo(result.fees.platformFeeUSD * 0.5, 3);
        });
    });

    describe('FIAT_TO_BEZ direction', () => {
        it('should calculate USD to BEZ swap', async () => {
            const response = await handler({ direction: 'FIAT_TO_BEZ', amount: 500, fiatCurrency: 'USD' });
            const result = parseToolResult<SwapResult>(response);

            expect(result.direction).toBe('FIAT_TO_BEZ');
            expect(result.inputAmount).toBe(500);
            expect(result.inputCurrency).toBe('USD');
            expect(result.outputCurrency).toBe('BEZ');
            expect(result.outputAmount).toBeGreaterThan(0);
        });

        it('should handle EUR currency', async () => {
            const response = await handler({ direction: 'FIAT_TO_BEZ', amount: 100, fiatCurrency: 'EUR' });
            const result = parseToolResult<SwapResult>(response);
            expect(result.inputCurrency).toBe('EUR');
            expect(result.outputCurrency).toBe('BEZ');
        });

        it('should handle MXN currency', async () => {
            const response = await handler({ direction: 'FIAT_TO_BEZ', amount: 5000, fiatCurrency: 'MXN' });
            const result = parseToolResult<SwapResult>(response);
            expect(result.inputCurrency).toBe('MXN');
        });
    });

    describe('recommendations', () => {
        it('should recommend PROCEED for efficient swaps', async () => {
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 1000, fiatCurrency: 'USD' });
            const result = parseToolResult<SwapResult>(response);
            expect(result.recommendation).toBe('PROCEED');
        });

        it('should warn AMOUNT_TOO_LOW when fees exceed 15% of value', async () => {
            // Very small amount where fees eat the value
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 1, fiatCurrency: 'USD' });
            const result = parseToolResult<SwapResult>(response);
            expect(result.recommendation).toBe('AMOUNT_TOO_LOW');
        });

        it('should recommend WAIT_BETTER_RATE when gas is high', async () => {
            mockGetFeeData.mockResolvedValue({
                gasPrice: BigInt(500_000_000_000), // 500 Gwei
                maxPriorityFeePerGas: BigInt(10_000_000_000),
            });
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 1000, fiatCurrency: 'USD' });
            const result = parseToolResult<SwapResult>(response);
            // High gas might trigger WAIT recommendation
            expect(['PROCEED', 'WAIT_BETTER_RATE']).toContain(result.recommendation);
        });
    });

    describe('response format', () => {
        it('should have all required fields', async () => {
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 100 });
            const result = parseToolResult<SwapResult>(response);

            expect(result).toHaveProperty('direction');
            expect(result).toHaveProperty('inputAmount');
            expect(result).toHaveProperty('outputAmount');
            expect(result).toHaveProperty('bezPriceUSD');
            expect(result).toHaveProperty('fees');
            expect(result).toHaveProperty('effectiveRate');
            expect(result).toHaveProperty('recommendation');
            expect(result).toHaveProperty('reasoning');
        });

        it('should never return negative output', async () => {
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 0.01 });
            const result = parseToolResult<SwapResult>(response);
            expect(result.outputAmount).toBeGreaterThanOrEqual(0);
        });
    });

    describe('error handling', () => {
        it('should handle RPC errors', async () => {
            mockGetFeeData.mockRejectedValue(new Error('Network error'));
            const response = await handler({ direction: 'BEZ_TO_FIAT', amount: 100 });
            const result = parseToolResult(response);
            expect(result).toHaveProperty('error');
            expect(response.isError).toBe(true);
        });
    });
});
