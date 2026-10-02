/**
 * Unit tests: playwright_automation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult, mockFetchResponse } from '../helpers/mockMcpServer.js';
import { registerPlaywrightMcp } from '../../tools/playwrightMcp.js';

describe('playwright_automation', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerPlaywrightMcp(server as any);
        handler = getHandler('playwright_automation')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('test_page_load', () => {
        it('should test page load and return metrics', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce({
                ok: true, status: 200, statusText: 'OK',
                headers: new Headers({ 'content-type': 'text/html', 'content-length': '5000' }),
                text: async () => '<html><title>BeZhas</title><body>Hello</body></html>',
                json: async () => ({}),
            } as Response);

            const response = await handler({ action: 'test_page_load', targetUrl: 'https://bezhas.com' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('test_wallet_flow', () => {
        it('should simulate wallet connection flow', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce({
                ok: true, status: 200, headers: new Headers(),
                text: async () => '<html><body>wallet connect web3modal</body></html>',
                json: async () => ({}),
            } as Response);

            const response = await handler({ action: 'test_wallet_flow', targetUrl: 'https://bezhas.com' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('audit_performance', () => {
        it('should return performance metrics', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce({
                ok: true, status: 200,
                headers: new Headers({ 'content-length': '50000' }),
                text: async () => '<html><head><script src="a.js"></script><link rel="stylesheet" href="a.css"/></head><body><img src="logo.png"/></body></html>',
                json: async () => ({}),
            } as Response);

            const response = await handler({ action: 'audit_performance', targetUrl: 'https://bezhas.com' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('audit_accessibility', () => {
        it('should check accessibility compliance', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce({
                ok: true, status: 200, headers: new Headers(),
                text: async () => '<html><head><title>BeZhas</title></head><body><img src="logo.png"><a href="/">Home</a></body></html>',
                json: async () => ({}),
            } as Response);

            const response = await handler({ action: 'audit_accessibility', targetUrl: 'https://bezhas.com' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('test_api_endpoints', () => {
        it('should test API health endpoint', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch
                .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => '{"status":"ok"}', json: async () => ({ status: 'ok' }) } as Response)
                .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => '{}', json: async () => ({}) } as Response)
                .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => '{}', json: async () => ({}) } as Response);

            const response = await handler({ action: 'test_api_endpoints', targetUrl: 'https://api.bezhas.com' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('error handling', () => {
        it('should handle fetch errors', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockRejectedValue(new Error('DNS resolution failed'));

            const response = await handler({ action: 'test_page_load', targetUrl: 'https://nonexistent.example.com' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'FAILED');
        });
    });
});
