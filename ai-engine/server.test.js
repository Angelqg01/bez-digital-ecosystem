const request = require('supertest');
const axios = require('axios');

process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

jest.mock('axios');

const { app } = require('./server');

const internalHeaders = { 'x-internal-key': process.env.INTERNAL_API_KEY || 'dev-internal-key' };

describe('AI Engine MCP endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /api/mcp/tools returns expanded tool registry', async () => {
        const res = await request(app).get('/api/mcp/tools').set(internalHeaders);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.tools)).toBe(true);
        expect(res.body.tools.length).toBeGreaterThanOrEqual(10);

        const toolNames = res.body.tools.map((t) => t.name);
        expect(toolNames).toContain('audit_contract');
        expect(toolNames).toContain('predict_demand');
        expect(toolNames).toContain('score_supplier');
        expect(toolNames).toContain('calculate_smart_swap');
        expect(toolNames).toContain('monitor_edge_node');
        expect(toolNames).toContain('assess_fraud_risk');
    });

    test('POST /api/mcp/invoke returns 400 for unknown tool', async () => {
        const res = await request(app)
            .post('/api/mcp/invoke')
            .set(internalHeaders)
            .send({ tool: 'unknown_tool', parameters: {} });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('POST /api/mcp/invoke executes score_supplier through proxy', async () => {
        axios.post.mockResolvedValueOnce({
            data: {
                success: true,
                score: 88,
                tier: 'A',
                approved: true,
            },
        });

        const res = await request(app)
            .post('/api/mcp/invoke')
            .set(internalHeaders)
            .send({
                tool: 'score_supplier',
                parameters: {
                    supplier_id: 'SUP-001',
                    on_time_delivery_pct: 95,
                    dispute_rate_pct: 1,
                    quality_incidents: 0,
                },
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.tool).toBe('score_supplier');
        expect(res.body.result.success).toBe(true);
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('POST /api/mcp/audit-contract validates required payload', async () => {
        const res = await request(app)
            .post('/api/mcp/audit-contract')
            .set(internalHeaders)
            .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/contract_address/i);
    });

    test('POST /api/mcp/predict-demand returns fallback when Aegis is unavailable', async () => {
        axios.post.mockRejectedValueOnce(new Error('Aegis offline'));

        const res = await request(app)
            .post('/api/mcp/predict-demand')
            .set(internalHeaders)
            .send({ sector: 'logistics', historical_volume: 1200, growth_rate_pct: 8 });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.fallback).toBe(true);
        expect(res.body.sector).toBe('logistics');
        expect(res.body.predicted_volume_24h).toBe(1200);
    });

    test('POST /api/mcp/score-supplier returns fallback when Aegis is unavailable', async () => {
        axios.post.mockRejectedValueOnce(new Error('Aegis offline'));

        const res = await request(app)
            .post('/api/mcp/score-supplier')
            .set(internalHeaders)
            .send({
                supplier_id: 'SUP-002',
                on_time_delivery_pct: 80,
                dispute_rate_pct: 5,
                quality_incidents: 2,
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.fallback).toBe(true);
        expect(res.body.score).toBe(50);
    });

    test('POST /api/mcp/calculate-smart-swap validates required fields', async () => {
        const res = await request(app)
            .post('/api/mcp/calculate-smart-swap')
            .set(internalHeaders)
            .send({ from_token: 'BEZ' }); // missing amount and to_token

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/amount|from_token|to_token/i);
    });

    test('POST /api/mcp/calculate-smart-swap returns fallback when Aegis is unavailable', async () => {
        axios.post.mockRejectedValueOnce(new Error('Aegis offline'));

        const res = await request(app)
            .post('/api/mcp/calculate-smart-swap')
            .set(internalHeaders)
            .send({ amount: 1000, from_token: 'BEZ', to_token: 'ETH', slippage_pct: 0.5 });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.fallback).toBe(true);
        expect(res.body.from_token).toBe('BEZ');
        expect(res.body.to_token).toBe('ETH');
        expect(res.body.estimated_output).toBeCloseTo(997, 0);
    });

    test('POST /api/mcp/monitor-edge-node validates required node_id', async () => {
        const res = await request(app)
            .post('/api/mcp/monitor-edge-node')
            .set(internalHeaders)
            .send({ uptime_hours: 100 }); // missing node_id

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/node_id/i);
    });

    test('POST /api/mcp/assess-fraud-risk validates required fields', async () => {
        const res = await request(app)
            .post('/api/mcp/assess-fraud-risk')
            .set(internalHeaders)
            .send({ wallet_address: '0xabc' }); // missing amount_bez and transaction_type

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/amount_bez|transaction_type/i);
    });

    test('POST /api/mcp/assess-fraud-risk returns fallback when Aegis is unavailable', async () => {
        axios.post.mockRejectedValueOnce(new Error('Aegis offline'));

        const res = await request(app)
            .post('/api/mcp/assess-fraud-risk')
            .set(internalHeaders)
            .send({ wallet_address: '0xabc123', amount_bez: 200, transaction_type: 'transfer' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.fallback).toBe(true);
        expect(res.body.risk).toBe('low');
        expect(res.body.fraud_score).toBe(10);
    });
});
