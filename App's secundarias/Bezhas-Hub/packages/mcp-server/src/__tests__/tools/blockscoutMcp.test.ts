/**
 * Unit tests: blockscout_explorer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult, mockFetchResponse } from '../helpers/mockMcpServer.js';
import { registerBlockscoutMcp } from '../../tools/blockscoutMcp.js';

describe('blockscout_explorer', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerBlockscoutMcp(server as any);
        handler = getHandler('blockscout_explorer')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('token_info', () => {
        it('should return BEZ token information', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                name: 'BeZhas Token', symbol: 'BEZ', decimals: '18',
                total_supply: '1000000000000000000000000', holders: '2500',
                type: 'ERC-20', exchange_rate: '0.50',
            }));

            const response = await handler({ action: 'token_info' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('holder_analysis', () => {
        it('should analyze token holders', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                items: [
                    { address: { hash: '0x1234' }, value: '500000000000000000000000' },
                    { address: { hash: '0x5678' }, value: '200000000000000000000000' },
                ],
            }));

            const response = await handler({ action: 'holder_analysis' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('transaction_history', () => {
        it('should return transaction list', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                items: [
                    { hash: '0xabc', from: { hash: '0x1' }, to: { hash: '0x2' }, value: '1000', timestamp: '2026-01-01' },
                ],
            }));

            const response = await handler({ action: 'transaction_history' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('contract_status', () => {
        it('should check contract verification status', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                is_verified: true, name: 'BeZhasToken', compiler_version: 'v0.8.24',
                optimization_enabled: true, source_code: 'pragma solidity...',
            }));

            const response = await handler({ action: 'contract_status' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('address_balance', () => {
        it('should return address balance', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            // First call: /addresses/{address}
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                hash: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
                coin_balance: '10000000000000000000',
                transactions_count: 42,
                is_contract: false,
            }));
            // Second call: /addresses/{address}/token-balances
            mockFetch.mockResolvedValueOnce(mockFetchResponse([
                {
                    token: { address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
                    value: '500000000000000000000',
                },
            ]));

            const response = await handler({ action: 'address_balance', address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('supply_metrics', () => {
        it('should return supply metrics', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            // First call: /tokens/{address}
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                total_supply: '1000000000000000000000000000',
                holders: '2500',
                decimals: '18',
                circulating_market_cap: '500000',
            }));
            // Second call: /tokens/{address}/counters
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                transfers_count: '15000',
                token_transfers_count: '12000',
            }));

            const response = await handler({ action: 'supply_metrics' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('error handling', () => {
        it('should handle Blockscout API errors', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockRejectedValue(new Error('Blockscout API unavailable'));

            const response = await handler({ action: 'token_info' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'FAILED');
        });
    });
});
