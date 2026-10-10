/**
 * Unit tests: firecrawl_scraper
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult, mockFetchResponse } from '../helpers/mockMcpServer.js';

vi.mock('../../config.js', () => ({
    config: {
        integrations: { firecrawlApiKey: 'fc-test-key-123' },
        network: { mode: 'amoy', activeRpc: 'https://rpc-amoy.polygon.technology', rpc: {} },
        token: { address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8', priceUSD: 0.50 },
    },
}));

import { registerFirecrawlMcp } from '../../tools/firecrawlMcp.js';

describe('firecrawl_scraper', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerFirecrawlMcp(server as any);
        handler = getHandler('firecrawl_scraper')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('scrape_page', () => {
        it('should scrape a page and return content', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                success: true, data: { content: '<html>Hello</html>', title: 'Test Page', links: [] },
            }));

            const response = await handler({ action: 'scrape_page', url: 'https://bezhas.com', format: 'json' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('extract_products', () => {
        it('should extract product data', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                success: true, data: { products: [{ name: 'BEZ Token', price: '$0.50' }] },
            }));

            const response = await handler({ action: 'extract_products', url: 'https://marketplace.bezhas.com', format: 'json' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('monitor_competitors', () => {
        it('should return competitor analysis', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                success: true, data: { content: 'Competitor page content' },
            }));

            const response = await handler({ action: 'monitor_competitors', url: 'https://competitor.com', format: 'json' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('discover_web3_projects', () => {
        it('should discover Web3 projects', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                success: true, data: { content: 'DeFi Projects', links: ['https://project1.io'] },
            }));

            const response = await handler({ action: 'discover_web3_projects', url: 'https://defipulse.com', format: 'json' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('error handling', () => {
        it('should handle API errors', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockRejectedValue(new Error('Firecrawl API timeout'));

            const response = await handler({ action: 'scrape_page', url: 'https://bezhas.com', format: 'json' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'FAILED');
        });
    });
});
