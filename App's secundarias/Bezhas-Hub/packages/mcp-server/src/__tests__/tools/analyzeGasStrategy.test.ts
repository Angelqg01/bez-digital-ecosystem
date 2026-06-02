/**
 * Unit tests: analyze_gas_strategy
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult } from '../helpers/mockMcpServer.js';
import type { GasStrategyResult } from '../../tools/analyzeGasStrategy.js';

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

import { registerGasStrategy } from '../../tools/analyzeGasStrategy.js';

function setGasPrice(gweiPrice: number, priorityGwei = 1.5) {
    mockGetFeeData.mockResolvedValue({
        gasPrice: BigInt(Math.round(gweiPrice * 1e9)),
        maxPriorityFeePerGas: BigInt(Math.round(priorityGwei * 1e9)),
    });
}

describe('analyze_gas_strategy', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerGasStrategy(server as any);
        handler = getHandler('analyze_gas_strategy')!;
        // Default: moderate gas (30 Gwei)
        setGasPrice(30);
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('IoT transactions', () => {
        it('should always use RELAYER_PAYS for iot_ingest', async () => {
            const response = await handler({ transactionType: 'iot_ingest', estimatedValueUSD: 100, urgency: 'medium' });
            const result = parseToolResult<GasStrategyResult>(response);
            expect(result.payer).toBe('RELAYER_PAYS');
        });

        it('should recommend BATCH for small IoT values', async () => {
            const response = await handler({ transactionType: 'iot_ingest', estimatedValueUSD: 3, urgency: 'medium' });
            const result = parseToolResult<GasStrategyResult>(response);
            expect(result.action).toBe('BATCH');
            expect(result.payer).toBe('RELAYER_PAYS');
        });
    });

    describe('gas price decisions', () => {
        it('should EXECUTE when gas is optimal and profitable', async () => {
            setGasPrice(20);
            const response = await handler({ transactionType: 'marketplace_buy', estimatedValueUSD: 500, urgency: 'medium' });
            const result = parseToolResult<GasStrategyResult>(response);
            expect(result.action).toBe('EXECUTE');
            expect(result.isProfitable).toBe(true);
        });

        it('should DELAY when gas is high and value is low', async () => {
            setGasPrice(400); // Above 300 Gwei threshold
            const response = await handler({ transactionType: 'token_transfer', estimatedValueUSD: 20, urgency: 'low' });
            const result = parseToolResult<GasStrategyResult>(response);
            expect(result.action).toBe('DELAY');
        });

        it('should override DELAY when urgency is high', async () => {
            setGasPrice(400);
            const response = await handler({ transactionType: 'token_transfer', estimatedValueUSD: 20, urgency: 'high' });
            const result = parseToolResult<GasStrategyResult>(response);
            // Should not DELAY despite high gas because urgency overrides
            expect(result.reasoning).toContain('urgency overrides');
        });
    });

    describe('profitability', () => {
        it('should calculate platform profit and fee burning', async () => {
            setGasPrice(20);
            const response = await handler({ transactionType: 'token_transfer', estimatedValueUSD: 100, urgency: 'medium' });
            const result = parseToolResult<GasStrategyResult>(response);
            expect(result.projectedPlatformProfit).toBeGreaterThan(0);
            expect(result.feeBurnAmount).toBeGreaterThan(0);
            expect(result.networkCostUSD).toBeGreaterThanOrEqual(0);
        });

        it('should have correct gas estimate per transaction type', async () => {
            const response = await handler({ transactionType: 'nft_mint', estimatedValueUSD: 100, urgency: 'medium' });
            const result = parseToolResult<GasStrategyResult>(response);
            expect(result.estimatedGasUnits).toBe(200_000);
        });
    });

    describe('response format', () => {
        it('should return valid GasStrategyResult', async () => {
            const response = await handler({ transactionType: 'token_transfer', estimatedValueUSD: 100, urgency: 'medium' });
            const result = parseToolResult<GasStrategyResult>(response);

            expect(result).toHaveProperty('action');
            expect(result).toHaveProperty('payer');
            expect(result).toHaveProperty('currentGasGwei');
            expect(result).toHaveProperty('maxPriorityFeeGwei');
            expect(result).toHaveProperty('networkCostUSD');
            expect(result).toHaveProperty('projectedPlatformProfit');
            expect(result).toHaveProperty('isProfitable');
            expect(result).toHaveProperty('estimatedGasUnits');
            expect(result).toHaveProperty('feeBurnAmount');
            expect(result).toHaveProperty('reasoning');
        });

        it('should return content array with text type', async () => {
            const response = await handler({ transactionType: 'token_transfer', estimatedValueUSD: 100 });
            expect(response.content).toHaveLength(1);
            expect(response.content[0].type).toBe('text');
        });
    });

    describe('error handling', () => {
        it('should handle RPC errors gracefully', async () => {
            mockGetFeeData.mockRejectedValue(new Error('Connection refused'));
            const response = await handler({ transactionType: 'token_transfer', estimatedValueUSD: 100, urgency: 'medium' });
            const result = parseToolResult(response);
            expect(result).toHaveProperty('error');
            expect(response.isError).toBe(true);
        });
    });
});
