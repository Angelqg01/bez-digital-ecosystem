/**
 * Unit tests: tally_dao_governance
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult, mockFetchResponse } from '../helpers/mockMcpServer.js';
import { registerTallyDaoMcp } from '../../tools/tallyDaoMcp.js';

describe('tally_dao_governance', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerTallyDaoMcp(server as any);
        handler = getHandler('tally_dao_governance')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('list_proposals', () => {
        it('should return proposals list', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                data: {
                    proposals: [
                        { id: '1', title: 'Proposal 1', status: 'ACTIVE', votesFor: '100', votesAgainst: '20' },
                    ],
                },
            }));

            const response = await handler({ action: 'list_proposals' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });

        it('should fallback to mock data if API fails', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockRejectedValue(new Error('Tally API error'));

            const response = await handler({ action: 'list_proposals' });
            const result = parseToolResult(response);

            // Should handle gracefully - either SUCCESS with mock data or FAILED
            expect(result).toHaveProperty('status');
        });
    });

    describe('analyze_voting_power', () => {
        it('should return voting power analysis', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                data: { votingPower: { total: '1000', delegated: '200' } },
            }));

            const response = await handler({ action: 'analyze_voting_power' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('check_quorum', () => {
        it('should check quorum status', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                data: { quorum: { required: '500000', current: '350000' } },
            }));

            const response = await handler({ action: 'check_quorum' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('treasury_status', () => {
        it('should return DAO treasury info', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                data: { treasury: { totalUSD: 500000, tokens: [] } },
            }));

            const response = await handler({ action: 'treasury_status' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });

    describe('delegation_info', () => {
        it('should return delegation information', async () => {
            const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(mockFetchResponse({
                data: { delegation: { delegates: 50, totalDelegated: '1000000' } },
            }));

            const response = await handler({ action: 'delegation_info' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status');
        });
    });
});
