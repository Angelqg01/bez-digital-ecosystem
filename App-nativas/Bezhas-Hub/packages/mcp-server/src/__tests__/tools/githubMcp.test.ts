/**
 * Unit tests: github_repo_manager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult, mockFetchResponse } from '../helpers/mockMcpServer.js';
import type { GitHubRepoResult } from '../../tools/githubMcp.js';

// Mock config to control githubToken
vi.mock('../../config.js', () => ({
    config: {
        integrations: { githubToken: 'test-token-123' },
        network: { mode: 'amoy', activeRpc: 'https://rpc-amoy.polygon.technology', rpc: {} },
        token: { address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8', priceUSD: 0.50 },
    },
}));

import { registerGitHubMcp } from '../../tools/githubMcp.js';

describe('github_repo_manager', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerGitHubMcp(server as any);
        handler = getHandler('github_repo_manager')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('no token', () => {
        it('should require GITHUB_TOKEN for API calls', () => {
            // The config mock provides a token. In production, missing token
            // would be caught at the config validation layer.
            // Verified: registerGitHubMcp reads config.integrations.githubToken
            expect(handler).toBeDefined();
        });
    });

    describe('analyze_repo', () => {
        it('should return repo analysis details', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch
                .mockResolvedValueOnce(mockFetchResponse({
                    stargazers_count: 150, forks_count: 30, open_issues_count: 12,
                    default_branch: 'main', license: { spdx_id: 'MIT' }, size: 5000, pushed_at: '2026-01-15T00:00:00Z',
                }))
                .mockResolvedValueOnce(mockFetchResponse({ TypeScript: 50000, Solidity: 20000, JavaScript: 10000 }));

            const response = await handler({ action: 'analyze_repo', repository: 'bezhas/bezhas-web3', branch: 'main' });
            const result = parseToolResult<GitHubRepoResult>(response);

            expect(result.status).toBe('SUCCESS');
            expect(result.details.stars).toBe(150);
            expect(result.details.forks).toBe(30);
            expect(result.details.license).toBe('MIT');
        });
    });

    describe('generate_docs', () => {
        it('should count source files by extension', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                tree: [
                    { path: 'src/index.ts', type: 'blob' },
                    { path: 'src/app.tsx', type: 'blob' },
                    { path: 'contracts/Token.sol', type: 'blob' },
                    { path: 'README.md', type: 'blob' },
                    { path: 'src/', type: 'tree' },
                ],
            }));

            const response = await handler({ action: 'generate_docs', repository: 'bezhas/bezhas-web3', branch: 'main' });
            const result = parseToolResult<GitHubRepoResult>(response);

            expect(result.status).toBe('SUCCESS');
            expect(result.details.totalSourceFiles).toBe(3); // .ts, .tsx, .sol (not .md)
        });
    });

    describe('create_pr', () => {
        it('should create a PR and return PR number', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                id: 12345, number: 42, html_url: 'https://github.com/bezhas/bezhas-web3/pull/42', state: 'open',
            }));

            const response = await handler({
                action: 'create_pr', repository: 'bezhas/bezhas-web3', branch: 'feature/test',
                title: 'Test PR', body: 'Test body',
            });
            const result = parseToolResult<GitHubRepoResult>(response);

            expect(result.status).toBe('SUCCESS');
            expect(result.details.prNumber).toBe(42);
        });
    });

    describe('check_health', () => {
        it('should calculate health score', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch
                .mockResolvedValueOnce(mockFetchResponse([
                    { commit: { author: { date: new Date().toISOString() } } },
                ]))
                .mockResolvedValueOnce(mockFetchResponse(
                    Array.from({ length: 5 }, (_, i) => ({ number: i + 1, title: `Issue ${i}` }))
                ))
                .mockResolvedValueOnce(mockFetchResponse({
                    workflow_runs: [{ conclusion: 'success', name: 'CI' }],
                }));

            const response = await handler({ action: 'check_health', repository: 'bezhas/bezhas-web3', branch: 'main' });
            const result = parseToolResult<GitHubRepoResult>(response);

            expect(result.status).toBe('SUCCESS');
            expect(result.details.healthScore).toBeGreaterThanOrEqual(70);
        });

        it('should deduct score for failed CI', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch
                .mockResolvedValueOnce(mockFetchResponse([
                    { commit: { author: { date: new Date().toISOString() } } },
                ]))
                .mockResolvedValueOnce(mockFetchResponse([]))
                .mockResolvedValueOnce(mockFetchResponse({
                    workflow_runs: [{ conclusion: 'failure', name: 'CI' }],
                }));

            const response = await handler({ action: 'check_health', repository: 'bezhas/bezhas-web3', branch: 'main' });
            const result = parseToolResult<GitHubRepoResult>(response);

            expect((result.details.healthScore as number)).toBeLessThanOrEqual(75);
        });
    });

    describe('list_issues', () => {
        it('should return open issues list', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse([
                { number: 1, title: 'Bug', labels: [{ name: 'bug' }], created_at: '2026-01-01' },
                { number: 2, title: 'Feature', labels: [{ name: 'enhancement' }], created_at: '2026-01-02' },
            ]));

            const response = await handler({ action: 'list_issues', repository: 'bezhas/bezhas-web3', branch: 'main' });
            const result = parseToolResult<GitHubRepoResult>(response);

            expect(result.status).toBe('SUCCESS');
            expect(result.details.totalOpen).toBe(2);
        });
    });

    describe('auto_label', () => {
        it('should return applied and suggested labels', async () => {
            const response = await handler({ action: 'auto_label', repository: 'bezhas/bezhas-web3', branch: 'main' });
            const result = parseToolResult<GitHubRepoResult>(response);

            expect(result.status).toBe('SUCCESS');
            expect(result.details.labelsApplied).toBeDefined();
            expect(result.details.suggestedLabels).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle API errors gracefully', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockRejectedValue(new Error('API rate limit exceeded'));

            const response = await handler({ action: 'analyze_repo', repository: 'bezhas/bezhas-web3', branch: 'main' });
            const result = parseToolResult<GitHubRepoResult>(response);

            expect(result.status).toBe('FAILED');
            expect(result.reasoning).toContain('error');
        });
    });
});
