/**
 * Unit tests: obliq_ai_sre
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult } from '../helpers/mockMcpServer.js';
import { registerObliqAiSre } from '../../tools/obliqAiSre.js';

describe('obliq_ai_sre', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerObliqAiSre(server as any);
        handler = getHandler('obliq_ai_sre')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('health_check', () => {
        it('should check service health with real endpoints', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            // Mock successful responses for bezhas.com and api.bezhas.com
            mockFetch
                .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => 'OK', json: async () => ({}) } as Response)
                .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => '{"status":"ok"}', json: async () => ({ status: 'ok' }) } as Response);

            const response = await handler({ action: 'health_check' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });

        it('should report degraded when a service is down', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch
                .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => 'OK', json: async () => ({}) } as Response)
                .mockRejectedValueOnce(new Error('Connection refused'));

            const response = await handler({ action: 'health_check' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('check_alerts', () => {
        it('should return alerts list', async () => {
            const response = await handler({ action: 'check_alerts' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('performance_metrics', () => {
        it('should return performance data', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers(), text: async () => 'OK', json: async () => ({}) } as Response);

            const response = await handler({ action: 'performance_metrics' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('analyze_logs', () => {
        it('should analyze log patterns', async () => {
            const response = await handler({ action: 'analyze_logs' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('incident_report', () => {
        it('should generate incident report', async () => {
            const response = await handler({ action: 'incident_report' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('health_report', () => {
        it('should generate comprehensive health report', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers(), text: async () => 'OK', json: async () => ({}) } as Response);

            const response = await handler({ action: 'health_report' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('error handling', () => {
        it('should handle complete network failure gracefully', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockRejectedValue(new Error('Network unreachable'));

            const response = await handler({ action: 'health_check' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
            // Should not throw
        });
    });
});
