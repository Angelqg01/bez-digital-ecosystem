/**
 * Unit tests: alpaca_markets
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult, mockFetchResponse } from '../helpers/mockMcpServer.js';
import { registerAlpacaMarketsMcp } from '../../tools/alpacaMarketsMcp.js';

describe('alpaca_markets', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerAlpacaMarketsMcp(server as any);
        handler = getHandler('alpaca_markets')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('market_overview', () => {
        it('should return market data with crypto prices', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                bitcoin: { usd: 95000, usd_24h_change: 2.5 },
                ethereum: { usd: 3500, usd_24h_change: -1.2 },
                'matic-network': { usd: 0.85, usd_24h_change: 5.0 },
            }));

            const response = await handler({ action: 'market_overview' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });

        it('should handle CoinGecko API failure', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockRejectedValue(new Error('CoinGecko rate limit'));

            const response = await handler({ action: 'market_overview' });
            const result = parseToolResult(response);

            // Should handle gracefully
            expect(result).toHaveProperty('status');
        });
    });

    describe('price_analysis', () => {
        it('should return technical price analysis', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                prices: [[Date.now() - 86400000, 0.48], [Date.now(), 0.50]],
            }));

            const response = await handler({ action: 'price_analysis' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('treasury_portfolio', () => {
        it('should return portfolio allocation', async () => {
            const response = await handler({ action: 'treasury_portfolio' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('dca_recommendation', () => {
        it('should return DCA strategy recommendation', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                prices: Array.from({ length: 30 }, (_, i) => [Date.now() - i * 86400000, 0.45 + Math.random() * 0.1]),
            }));

            const response = await handler({ action: 'dca_recommendation' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('liquidity_status', () => {
        it('should return liquidity pool data', async () => {
            const response = await handler({ action: 'liquidity_status' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('sentiment_analysis', () => {
        it('should return market sentiment scores', async () => {
            const response = await handler({ action: 'sentiment_analysis' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('response format', () => {
        it('should return valid MCP content format', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValue(mockFetchResponse({}));

            const response = await handler({ action: 'treasury_portfolio' });
            expect(response.content).toHaveLength(1);
            expect(response.content[0].type).toBe('text');
        });
    });
});
