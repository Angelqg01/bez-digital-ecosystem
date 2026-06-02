const request = require('supertest');
const { mockAgentService, mockQuery, makeToken } = require('../helpers');
const app = require('../../index');

const token = makeToken();
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

describe('Routes: /api/agents', () => {
    beforeEach(() => jest.clearAllMocks());

    /* ─── GET /api/agents ─── */
    describe('GET /', () => {
        it('returns agent registry', async () => {
            mockAgentService.listAgents.mockResolvedValueOnce({
                total_agents: 18, total_groups: 5, mcp_tools: 100, aegis_status: 'healthy',
                groups: [{ id: 'food', name: 'Food Oracle', agents: ['food-quality'] }],
            });
            const res = await auth(request(app).get('/api/agents')).expect(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.total_agents).toBe(18);
            expect(mockAgentService.listAgents).toHaveBeenCalledTimes(1);
        });

        it('requires authentication', async () => {
            await request(app).get('/api/agents').expect(401);
        });
    });

    /* ─── GET /api/agents/analytics ─── */
    describe('GET /analytics', () => {
        it('returns analytics data', async () => {
            mockAgentService.getAgentAnalytics.mockResolvedValueOnce({
                agents_active: 10, total_actions_24h: 250, critical_alerts_24h: 3, bez_burned_24h: 42.5,
                per_agent: [{ agent_id: 'food-quality', actions: 50 }],
            });
            const res = await auth(request(app).get('/api/agents/analytics')).expect(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.agents_active).toBe(10);
        });
    });

    /* ─── GET /api/agents/token ─── */
    describe('GET /token', () => {
        it('returns BEZ token data', async () => {
            mockAgentService.getBEZTokenData.mockResolvedValueOnce({
                price: 0.42, total_burned: '5000', circulating_supply: '95000',
            });
            const res = await auth(request(app).get('/api/agents/token')).expect(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.price).toBe(0.42);
        });
    });

    /* ─── GET /api/agents/mcp/tools ─── */
    describe('GET /mcp/tools', () => {
        it('returns MCP tools list', async () => {
            mockAgentService.listMCPTools.mockResolvedValueOnce([
                { name: 'scan_telemetry', description: 'Scan IoT data' },
            ]);
            const res = await auth(request(app).get('/api/agents/mcp/tools')).expect(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.tools).toHaveLength(1);
        });

        it('gracefully handles MCP gateway offline', async () => {
            mockAgentService.listMCPTools.mockRejectedValueOnce(new Error('ECONNREFUSED'));
            const res = await auth(request(app).get('/api/agents/mcp/tools')).expect(200);
            expect(res.body.data.note).toMatch(/offline/i);
        });
    });

    /* ─── POST /api/agents/mcp/invoke ─── */
    describe('POST /mcp/invoke', () => {
        it('invokes an MCP tool', async () => {
            mockAgentService.invokeMCPTool.mockResolvedValueOnce({
                status: 'ok', result: { score: 0.95 },
            });
            const res = await auth(request(app).post('/api/agents/mcp/invoke'))
                .send({ tool: 'get_token_price', parameters: { lat: 10.0 } })
                .expect(200);
            expect(res.body.status).toBe('success');
            expect(mockAgentService.invokeMCPTool).toHaveBeenCalledWith(
                'get_token_price', { lat: 10.0 }, expect.any(String)
            );
        });

        it('rejects tools not in allowlist', async () => {
            const res = await auth(request(app).post('/api/agents/mcp/invoke'))
                .send({ tool: 'scan_telemetry', parameters: { lat: 10.0 } })
                .expect(403);
            expect(res.body.error).toMatch(/allowlist/i);
        });

        it('validates tool name is required', async () => {
            const res = await auth(request(app).post('/api/agents/mcp/invoke'))
                .send({ parameters: {} })
                .expect(400);
            expect(res.body.errors).toBeDefined();
        });

        it('validates parameters must be object', async () => {
            const res = await auth(request(app).post('/api/agents/mcp/invoke'))
                .send({ tool: 'test', parameters: 'not-object' })
                .expect(400);
            expect(res.body.errors).toBeDefined();
        });

        it('rejects tool name exceeding max length', async () => {
            const res = await auth(request(app).post('/api/agents/mcp/invoke'))
                .send({ tool: 'x'.repeat(101), parameters: {} })
                .expect(400);
            expect(res.body.errors).toBeDefined();
        });
    });

    /* ─── GET /api/agents/:id/metrics ─── */
    describe('GET /:id/metrics', () => {
        it('returns agent metrics', async () => {
            mockAgentService.getAgentMetrics.mockResolvedValueOnce({
                agent_id: 'shiptrack', period_days: 7,
                stats: { total_actions: 150, critical_alerts: 2, avg_confidence: 0.92, on_chain_txs: 30 },
                timeseries: [{ date: '2026-01-01', actions: 20, alerts: 0 }],
                recent_logs: [],
            });
            const res = await auth(request(app).get('/api/agents/shiptrack/metrics')).expect(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.stats.total_actions).toBe(150);
            expect(mockAgentService.getAgentMetrics).toHaveBeenCalledWith('shiptrack', 7);
        });

        it('accepts custom days parameter', async () => {
            mockAgentService.getAgentMetrics.mockResolvedValueOnce({
                agent_id: 'food-quality', period_days: 30, stats: {}, timeseries: [], recent_logs: [],
            });
            const res = await auth(request(app).get('/api/agents/food-quality/metrics?days=30')).expect(200);
            expect(mockAgentService.getAgentMetrics).toHaveBeenCalledWith('food-quality', 30);
        });

        it('caps days at 90', async () => {
            mockAgentService.getAgentMetrics.mockResolvedValueOnce({
                agent_id: 'test', period_days: 90, stats: {}, timeseries: [], recent_logs: [],
            });
            await auth(request(app).get('/api/agents/test/metrics?days=999')).expect(200);
            expect(mockAgentService.getAgentMetrics).toHaveBeenCalledWith('test', 90);
        });
    });

    /* ─── GET /api/agents/stream (SSE) ─── */
    describe('GET /stream', () => {
        it('requires authentication via token query param', async () => {
            await request(app).get('/api/agents/stream').expect(401);
        });

        // SSE streams hang in supertest — verified auth rejection above;
        // full SSE integration is covered by e2e tests.
    });
});
