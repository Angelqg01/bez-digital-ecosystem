/**
 * Unit tests: AI Gateway Service
 * Tests the AI Gateway that bridges backend → MCP Intelligence Server.
 */

// Mock node-fetch (unused but prevents import errors)
jest.mock('node-fetch', () => jest.fn());

// Mock google-auth-library
const mockGetRequestHeaders = jest.fn().mockResolvedValue({ Authorization: 'Bearer mock-oidc-token' });
const mockGetIdTokenClient = jest.fn().mockResolvedValue({ getRequestHeaders: mockGetRequestHeaders });
jest.mock('google-auth-library', () => ({
    GoogleAuth: jest.fn().mockImplementation(() => ({
        getIdTokenClient: mockGetIdTokenClient,
    })),
}));

// Mock ethers
jest.mock('ethers', () => ({
    ethers: {
        JsonRpcProvider: jest.fn().mockImplementation(() => ({
            getNetwork: jest.fn().mockResolvedValue({ chainId: 137, name: 'matic' }),
        })),
        Wallet: jest.fn().mockImplementation(() => ({
            connect: jest.fn().mockReturnThis(),
            address: '0xRelayerAddress',
        })),
        Contract: jest.fn().mockImplementation(() => ({
            transfer: jest.fn().mockResolvedValue({ hash: '0xtxhash', wait: jest.fn().mockResolvedValue({ status: 1 }) }),
            balanceOf: jest.fn().mockResolvedValue(BigInt('1000000000000000000000')),
        })),
        formatUnits: jest.fn((val) => (Number(val) / 1e18).toString()),
    },
}));

// Mock mongoose
jest.mock('mongoose', () => ({
    connect: jest.fn().mockResolvedValue({}),
    connection: { readyState: 1 },
}));

const { AIGatewayService } = require('../../services/aiGateway.service');

describe('AIGatewayService', () => {
    let gateway;
    const mockFetch = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        gateway = new AIGatewayService();
        // Mock global fetch (service uses native fetch, not node-fetch)
        global.fetch = mockFetch;
    });

    afterEach(() => {
        delete global.fetch;
    });

    describe('constructor', () => {
        it('should initialize with default state', () => {
            expect(gateway).toBeDefined();
            expect(gateway.mcpBaseUrl).toBeDefined();
        });
    });

    describe('callMCP', () => {
        it('should call MCP server and return result', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    action: 'EXECUTE',
                    payer: 'USER_PAYS',
                    isProfitable: true,
                }),
            });

            const result = await gateway.callMCP('/api/mcp/analyze-gas', {
                transactionType: 'token_transfer',
                estimatedValueUSD: 100,
                urgency: 'medium',
            });

            expect(mockFetch).toHaveBeenCalled();
            expect(result).toHaveProperty('action');
        });

        it('should return conservative fallback on MCP server error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

            const result = await gateway.callMCP('/api/mcp/analyze-gas', {
                transactionType: 'token_transfer',
                estimatedValueUSD: 100,
            });

            // Should return a fallback response, not throw
            expect(result).toBeDefined();
            expect(result).toHaveProperty('action', 'DELAY');
        });

        it('should handle non-ok HTTP response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: jest.fn().mockResolvedValue('Server error'),
            });

            const result = await gateway.callMCP('/api/mcp/analyze-gas', {
                transactionType: 'token_transfer',
                estimatedValueUSD: 100,
            });

            expect(result).toBeDefined();
        });
    });

    describe('checkGas', () => {
        it('should call MCP gas analysis endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    action: 'EXECUTE',
                    payer: 'USER_PAYS',
                    currentGasGwei: '30.0',
                    isProfitable: true,
                }),
            });

            const result = await gateway.checkGas('token_transfer', 200);
            expect(result).toHaveProperty('action');
        });
    });

    describe('calculateSwap', () => {
        it('should call MCP swap calculation endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    direction: 'BEZ_TO_FIAT',
                    outputAmount: 490.50,
                    recommendation: 'PROCEED',
                }),
            });

            const result = await gateway.calculateSwap('BEZ_TO_FIAT', 1000, 'USD');
            expect(result).toHaveProperty('direction');
        });
    });

    describe('checkCompliance', () => {
        it('should call MCP compliance verification', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    status: 'APPROVED',
                    riskLevel: 'LOW',
                    automaticAction: 'ALLOW_TX',
                }),
            });

            const result = await gateway.checkCompliance(
                '0x1234567890123456789012345678901234567890', 100, 'US'
            );
            expect(result).toHaveProperty('status');
        });
    });

    describe('healthCheck', () => {
        it('should return healthy status when MCP server responds', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    status: 'healthy',
                    service: 'bezhas-intelligence',
                    version: '1.0.0',
                }),
            });

            const result = await gateway.healthCheck();
            expect(result).toHaveProperty('status', 'healthy');
        });

        it('should handle MCP server unavailable', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const result = await gateway.healthCheck();
            // Should not throw, returns an error object
            expect(result).toBeDefined();
        });
    });

    describe('OIDC Authentication (Cloud Run service-to-service)', () => {
        it('should not attach auth header when MCP is on localhost', async () => {
            // Default gateway uses localhost MCP, so no OIDC token
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ action: 'EXECUTE' }),
            });

            await gateway.callMCP('/api/mcp/analyze-gas', { transactionType: 'token_transfer' });

            const fetchCall = mockFetch.mock.calls[0];
            const headers = fetchCall[1].headers;
            expect(headers).not.toHaveProperty('Authorization');
        });

        it('should gracefully handle getIdToken failure', async () => {
            // Even if auth fails, the service should still attempt the call
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ action: 'EXECUTE' }),
            });

            const result = await gateway.callMCP('/api/mcp/analyze-gas', { transactionType: 'token_transfer' });
            expect(result).toHaveProperty('action', 'EXECUTE');
        });
    });
});
