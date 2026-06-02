require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const PORT = process.env.PORT || 3002;
const AEGIS_URL = process.env.AEGIS_URL || 'http://localhost:8001';
const INTERNAL_ENGINE_BASE_URL = process.env.INTERNAL_ENGINE_BASE_URL || `http://127.0.0.1:${PORT}`;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || null;
if (!INTERNAL_API_KEY) {
    console.error('FATAL: INTERNAL_API_KEY required');
    process.exit(1);
}
const crypto = require('crypto');

const TOOL_ENDPOINTS = {
    analyze_gas_strategy: '/api/mcp/analyze-gas',
    verify_regulatory_compliance: '/api/mcp/verify-compliance',
    analyze_sentiment: '/api/mcp/analyze-sentiment',
    system_health: '/api/mcp/system-health',
    audit_contract: '/api/mcp/audit-contract',
    predict_demand: '/api/mcp/predict-demand',
    score_supplier: '/api/mcp/score-supplier',
    calculate_smart_swap: '/api/mcp/calculate-smart-swap',
    monitor_edge_node: '/api/mcp/monitor-edge-node',
    assess_fraud_risk: '/api/mcp/assess-fraud-risk',
    monitor_validator: '/api/mcp/monitor-validator',
    slash_check: '/api/mcp/slash-check'
};

async function validateWithAegis(payload) {
    return axios.post(`${AEGIS_URL}/api/aegis/validate`, payload, { timeout: 8000 });
}

// MCP standard tools registry
const mcpTools = [
    {
        name: "analyze_gas_strategy",
        description: "AI-based gas fee prediction via Aegis GasPredictor (GradientBoosting)",
        endpoint: "/api/mcp/analyze-gas",
        parameters: { type: "object", properties: { hour_of_day: { type: "number" }, pending_tx: { type: "number" }, block_utilization: { type: "number" } } }
    },
    {
        name: "verify_regulatory_compliance",
        description: "Validates telemetry data using Aegis anomaly detection + sentiment analysis",
        endpoint: "/api/mcp/verify-compliance",
        parameters: { type: "object", properties: { containerId: { type: "string" }, temperature: { type: "number" }, humidity: { type: "number" } } }
    },
    {
        name: "analyze_sentiment",
        description: "Analyzes text sentiment using Aegis hybrid TF-IDF + lexicon model",
        endpoint: "/api/mcp/analyze-sentiment",
        parameters: { type: "object", properties: { text: { type: "string" } } }
    },
    {
        name: "system_health",
        description: "Get Aegis system health status including all ML model states",
        endpoint: "/api/mcp/system-health",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "audit_contract",
        description: "Risk audit for smart contracts using Aegis anomaly heuristics",
        endpoint: "/api/mcp/audit-contract",
        parameters: {
            type: "object",
            properties: {
                contract_address: { type: "string" },
                bytecode_hash: { type: "string" },
                recent_tx_count: { type: "number" }
            }
        }
    },
    {
        name: "predict_demand",
        description: "Predicts short-term demand pressure for a sector",
        endpoint: "/api/mcp/predict-demand",
        parameters: {
            type: "object",
            properties: {
                sector: { type: "string" },
                historical_volume: { type: "number" },
                growth_rate_pct: { type: "number" }
            }
        }
    },
    {
        name: "score_supplier",
        description: "Scores supplier reliability based on delivery and dispute metrics",
        endpoint: "/api/mcp/score-supplier",
        parameters: {
            type: "object",
            properties: {
                supplier_id: { type: "string" },
                on_time_delivery_pct: { type: "number" },
                dispute_rate_pct: { type: "number" },
                quality_incidents: { type: "number" }
            }
        }
    },
    {
        name: "calculate_smart_swap",
        description: "Calculates optimal swap route and estimated output for token swaps via BeZhas liquidity pools",
        endpoint: "/api/mcp/calculate-smart-swap",
        parameters: {
            type: "object",
            required: ["amount", "from_token", "to_token"],
            properties: {
                amount: { type: "number", description: "Input token amount" },
                from_token: { type: "string", description: "Source token symbol (e.g. BEZ, ETH)" },
                to_token: { type: "string", description: "Target token symbol" },
                slippage_pct: { type: "number", description: "Max acceptable slippage percent (default 0.5)" }
            }
        }
    },
    {
        name: "monitor_edge_node",
        description: "Assesses health and reliability of a BeZhas Edge Node based on telemetry metrics",
        endpoint: "/api/mcp/monitor-edge-node",
        parameters: {
            type: "object",
            required: ["node_id"],
            properties: {
                node_id: { type: "string" },
                uptime_hours: { type: "number" },
                tx_success_rate: { type: "number", description: "Percent 0-100" },
                last_seen_mins: { type: "number", description: "Minutes since last heartbeat" }
            }
        }
    },
    {
        name: "assess_fraud_risk",
        description: "Evaluates fraud risk for a blockchain transaction using Aegis anomaly detection",
        endpoint: "/api/mcp/assess-fraud-risk",
        parameters: {
            type: "object",
            required: ["wallet_address", "amount_bez", "transaction_type"],
            properties: {
                wallet_address: { type: "string" },
                amount_bez: { type: "number" },
                transaction_type: { type: "string", description: "transfer | mint | stake | swap | withdraw" },
                counterparty_address: { type: "string" }
            }
        }
    },
    {
        name: "monitor_validator",
        description: "Evaluates validator health: heartbeat freshness, uptime, contribution activity, stake adequacy",
        endpoint: "/api/mcp/monitor-validator",
        parameters: {
            type: "object",
            required: ["operator"],
            properties: {
                operator: { type: "string", description: "Validator operator Ethereum address" },
                is_active: { type: "boolean" },
                uptime_pct: { type: "number", description: "Uptime percentage 0-100" },
                last_heartbeat: { type: "string", description: "ISO8601 timestamp of last heartbeat" },
                contribution_points: { type: "number" },
                tier: { type: "number", description: "Validator tier 1-4 (Bronze/Silver/Gold/Platinum)" },
                staked_bez: { type: "number" }
            }
        }
    },
    {
        name: "slash_check",
        description: "Checks whether a validator deserves slashing based on downtime, missed votes, and anomaly signals",
        endpoint: "/api/mcp/slash-check",
        parameters: {
            type: "object",
            required: ["operator"],
            properties: {
                operator: { type: "string", description: "Validator operator Ethereum address" },
                downtime_hours: { type: "number", description: "Hours since last heartbeat" },
                missed_votes: { type: "number", description: "DAO votes missed in current period" },
                anomaly_score: { type: "number", description: "Anomaly score 0-1 from fraud detection" },
                is_sequencer: { type: "boolean", description: "Whether this validator is currently sequencer" }
            }
        }
    }
];

// Health and discovery endpoints (MCP Standard)
function createApp() {
    const app = express();
    app.use(express.json());
    app.use(cors({
        origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
    }));

    // Internal API key authentication for all mutating endpoints
    const requireInternalAuth = (req, res, next) => {
        const key = req.headers['x-internal-key'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!key) return res.status(401).json({ error: 'Authentication required' });
        // Timing-safe comparison to prevent timing attacks
        const keyBuf = Buffer.from(key);
        const expectedBuf = Buffer.from(INTERNAL_API_KEY);
        if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
            return res.status(403).json({ error: 'Invalid API key' });
        }
        next();
    };

    // Simple in-memory rate limiter (per IP, 60 req/min)
    const _rateMap = new Map();
    const rateLimit = (req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        let entry = _rateMap.get(ip);
        if (!entry || now - entry.start > 60000) {
            entry = { start: now, count: 0 };
            _rateMap.set(ip, entry);
        }
        entry.count++;
        if (entry.count > 60) return res.status(429).json({ error: 'Rate limit exceeded' });
        next();
    };
    // Cleanup stale entries every 5 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of _rateMap) {
            if (now - entry.start > 120000) _rateMap.delete(ip);
        }
    }, 300000).unref();

    app.get('/api/mcp/health', (req, res) => {
        res.json({ status: "healthy", version: "2.0.0", protocol: "MCP" });
    });

    app.get('/api/mcp/tools', requireInternalAuth, (req, res) => {
        res.json({ success: true, tools: mcpTools });
    });

    app.post('/api/mcp/invoke', requireInternalAuth, rateLimit, async (req, res) => {
        try {
            const { tool, parameters } = req.body || {};
            if (!tool || !TOOL_ENDPOINTS[tool]) {
                return res.status(400).json({ success: false, error: 'Unknown tool' });
            }

            const endpoint = TOOL_ENDPOINTS[tool];
            const method = endpoint === '/api/mcp/system-health' ? 'get' : 'post';
            // Security: never trust user-controlled Host headers for internal calls.
            const targetUrl = `${INTERNAL_ENGINE_BASE_URL}${endpoint}`;

            const response = method === 'get'
                ? await axios.get(targetUrl, { timeout: 10000, headers: { 'x-internal-key': INTERNAL_API_KEY } })
                : await axios.post(targetUrl, parameters || {}, { timeout: 10000, headers: { 'x-internal-key': INTERNAL_API_KEY } });

            return res.json({ success: true, tool, result: response.data });
        } catch (err) {
            console.error('[MCP] invoke error:', err.message);
            return res.status(500).json({ success: false, error: 'Tool invocation failed', message: err.message });
        }
    });

    // Tool: Analyze Gas Strategy — proxies to Aegis /api/aegis/validate
    app.post('/api/mcp/analyze-gas', requireInternalAuth, async (req, res) => {
        try {
            const response = await validateWithAegis({
                type: 'transaction',
                data: req.body
            });

            const d = response.data;
            res.json({
                success: true,
                recommendation: d.gas_prediction?.recommendation || 'send_now',
                predicted_gas: d.gas_prediction?.predicted_gas || null,
                savings_pct: d.gas_prediction?.savings_pct || 0,
                confidence: d.gas_prediction?.confidence || 0,
                risk: d.risk || 'low',
                ai_model_used: "BeZhas-Aegis-GasPredictor-v2"
            });
        } catch (err) {
            console.error('[MCP] analyze-gas proxy error:', err.message);
            res.json({ success: true, recommendation: 'send_now', confidence: 0, fallback: true });
        }
    });

    // Tool: Verify Regulatory Compliance — proxies to Aegis /api/aegis/validate
    app.post('/api/mcp/verify-compliance', requireInternalAuth, async (req, res) => {
        try {
            const { containerId, temperature, humidity, location } = req.body;
            const response = await validateWithAegis({
                type: 'compliance',
                container_id: containerId,
                telemetry: { temperature, humidity, location }
            });

            const d = response.data;
            res.json({
                success: true,
                approved: d.approved,
                reason: d.risk === 'high' ? 'Anomaly detected in telemetry data' : 'Parameters within thresholds',
                risk: d.risk,
                score: d.score,
                confidence: d.score != null ? Math.abs(d.score) : 0.5,
                ai_model_used: "BeZhas-Aegis-AnomalyDetector-v2"
            });
        } catch (err) {
            // Fallback: basic range check
            const { temperature } = req.body || {};
            const approved = temperature != null ? (temperature >= -25 && temperature <= -10) : true;
            console.warn('[MCP] verify-compliance fallback:', err.message);
            res.json({ success: true, approved, reason: 'Aegis offline — basic range check', confidence: 0.5, fallback: true });
        }
    });

    // Tool: Analyze Sentiment — proxies to Aegis /aegis/v1/ingest/log then reads stats
    app.post('/api/mcp/analyze-sentiment', requireInternalAuth, async (req, res) => {
        try {
            const { text } = req.body;
            if (!text) return res.status(400).json({ success: false, error: 'text is required' });

            // Use the ingest/log endpoint with a single event, then query stats
            // For direct sentiment: we call the Aegis validate with a sentiment-type
            const response = await validateWithAegis({
                type: 'sentiment',
                data: { text }
            });

            res.json({
                success: true,
                sentiment: response.data.sentiment || 'neutral',
                score: response.data.score || 0,
                confidence: response.data.confidence || 0,
                ai_model_used: "BeZhas-Aegis-Sentiment-v2"
            });
        } catch (err) {
            console.error('[MCP] analyze-sentiment error:', err.message);
            res.json({ success: true, sentiment: 'neutral', score: 0, confidence: 0, fallback: true });
        }
    });

    // Tool: Audit Contract — risk scoring with Aegis anomaly pipeline
    app.post('/api/mcp/audit-contract', requireInternalAuth, async (req, res) => {
        try {
            const { contract_address, bytecode_hash, recent_tx_count = 0 } = req.body || {};
            if (!contract_address) {
                return res.status(400).json({ success: false, error: 'contract_address is required' });
            }

            const response = await validateWithAegis({
                type: 'contract_audit',
                data: { contract_address, bytecode_hash, recent_tx_count }
            });

            const d = response.data || {};
            const risk = d.risk || 'medium';

            return res.json({
                success: true,
                contract_address,
                approved: d.approved !== false,
                risk,
                score: d.score ?? null,
                recommendations: risk === 'high'
                    ? ['pause_high_risk_methods', 'run_slither_scan', 'enable_timelock']
                    : ['continue_monitoring', 'keep_daily_audit'],
                ai_model_used: 'BeZhas-Aegis-ContractAudit-v1'
            });
        } catch (err) {
            console.error('[MCP] audit-contract error:', err.message);
            return res.json({
                success: true,
                approved: true,
                risk: 'unknown',
                recommendations: ['manual_review_required'],
                fallback: true
            });
        }
    });

    // Tool: Predict Demand — hybrid estimate using sector growth and Aegis context
    app.post('/api/mcp/predict-demand', requireInternalAuth, async (req, res) => {
        try {
            const { sector = 'general', historical_volume = 0, growth_rate_pct = 0 } = req.body || {};
            const response = await validateWithAegis({
                type: 'demand_forecast',
                data: { sector, historical_volume, growth_rate_pct }
            });

            const modelSignal = Number(response.data?.score || 0);
            const base = Number(historical_volume) || 0;
            const growthMultiplier = 1 + ((Number(growth_rate_pct) || 0) / 100);
            const anomalyAdjustment = Math.max(0.75, Math.min(1.25, 1 + (modelSignal - 0.5) * 0.3));
            const forecast = Math.round(base * growthMultiplier * anomalyAdjustment);

            return res.json({
                success: true,
                sector,
                predicted_volume_24h: forecast,
                confidence: Math.min(0.95, 0.55 + Math.abs(modelSignal) * 0.4),
                ai_model_used: 'BeZhas-Aegis-DemandForecast-v1'
            });
        } catch (err) {
            console.error('[MCP] predict-demand error:', err.message);
            const { sector = 'general', historical_volume = 0 } = req.body || {};
            return res.json({
                success: true,
                sector,
                predicted_volume_24h: Math.round(Number(historical_volume) || 0),
                confidence: 0.4,
                fallback: true
            });
        }
    });

    // Tool: Score Supplier — reliability scoring for procurement workflows
    app.post('/api/mcp/score-supplier', requireInternalAuth, async (req, res) => {
        try {
            const {
                supplier_id,
                on_time_delivery_pct = 0,
                dispute_rate_pct = 0,
                quality_incidents = 0
            } = req.body || {};

            if (!supplier_id) {
                return res.status(400).json({ success: false, error: 'supplier_id is required' });
            }

            const response = await validateWithAegis({
                type: 'supplier_score',
                data: { supplier_id, on_time_delivery_pct, dispute_rate_pct, quality_incidents }
            });

            const anomalyScore = Number(response.data?.score || 0);
            const onTime = Math.max(0, Math.min(100, Number(on_time_delivery_pct) || 0));
            const disputePenalty = Math.max(0, Number(dispute_rate_pct) || 0) * 1.2;
            const qualityPenalty = Math.max(0, Number(quality_incidents) || 0) * 4;
            const anomalyPenalty = Math.max(0, anomalyScore) * 25;
            const supplierScore = Math.max(0, Math.min(100, Math.round(onTime - disputePenalty - qualityPenalty - anomalyPenalty)));

            return res.json({
                success: true,
                supplier_id,
                score: supplierScore,
                tier: supplierScore >= 85 ? 'A' : supplierScore >= 70 ? 'B' : supplierScore >= 50 ? 'C' : 'D',
                approved: supplierScore >= 60,
                ai_model_used: 'BeZhas-Aegis-SupplierScore-v1'
            });
        } catch (err) {
            console.error('[MCP] score-supplier error:', err.message);
            return res.json({ success: true, score: 50, tier: 'C', approved: false, fallback: true });
        }
    });

    // Tool: Calculate Smart Swap — optimal route from BeZhas liquidity pools
    app.post('/api/mcp/calculate-smart-swap', requireInternalAuth, async (req, res) => {
        try {
            const { amount, from_token, to_token, slippage_pct = 0.5 } = req.body || {};
            if (!amount || !from_token || !to_token) {
                return res.status(400).json({ success: false, error: 'amount, from_token, and to_token are required' });
            }

            const response = await validateWithAegis({
                type: 'swap_analysis',
                data: { amount, from_token, to_token, slippage_pct }
            });

            const d = response.data || {};
            const feeMultiplier = 1 - 0.003; // 0.3% pool fee
            const baseOutput = Number(amount) * feeMultiplier;
            const estimatedOutput = d.estimated_output ?? Number(baseOutput.toFixed(6));
            const priceImpact = d.price_impact_pct ?? Math.min(2.5, (Number(amount) / 10000) * 0.1);

            return res.json({
                success: true,
                from_token,
                to_token,
                input_amount: amount,
                estimated_output: estimatedOutput,
                price_impact_pct: priceImpact,
                max_slippage_pct: slippage_pct,
                route: d.route || [from_token, to_token],
                pool: 'BeZhas-LiquidityFarming-v1',
                ai_model_used: 'BeZhas-Aegis-SwapAnalyzer-v1'
            });
        } catch (err) {
            console.error('[MCP] calculate-smart-swap error:', err.message);
            const { amount = 0, from_token = '', to_token = '' } = req.body || {};
            return res.json({
                success: true,
                from_token,
                to_token,
                input_amount: amount,
                estimated_output: Number((Number(amount) * 0.997).toFixed(6)),
                price_impact_pct: 0.1,
                route: [from_token, to_token],
                fallback: true
            });
        }
    });

    // Tool: Monitor Edge Node — reliability scoring for BeZhas Edge Nodes
    app.post('/api/mcp/monitor-edge-node', requireInternalAuth, async (req, res) => {
        try {
            const {
                node_id,
                uptime_hours = 0,
                tx_success_rate = 100,
                last_seen_mins = 0
            } = req.body || {};

            if (!node_id) {
                return res.status(400).json({ success: false, error: 'node_id is required' });
            }

            const response = await validateWithAegis({
                type: 'node_health',
                data: { node_id, uptime_hours, tx_success_rate, last_seen_mins }
            });

            const d = response.data || {};
            const anomalyScore = Number(d.score || 0);
            const uptimeScore = Math.min(100, (Number(uptime_hours) / 720) * 40); // 720h = 30 days max
            const successScore = Math.max(0, Number(tx_success_rate) || 0) * 0.5;
            const latencyPenalty = Math.min(20, (Number(last_seen_mins) || 0) * 0.5);
            const anomalyPenalty = Math.max(0, anomalyScore) * 15;
            const healthScore = Math.max(0, Math.min(100, Math.round(uptimeScore + successScore - latencyPenalty - anomalyPenalty)));

            return res.json({
                success: true,
                node_id,
                health_score: healthScore,
                status: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'critical',
                online: Number(last_seen_mins) < 5,
                uptime_hours,
                tx_success_rate,
                ai_model_used: 'BeZhas-Aegis-NodeMonitor-v1'
            });
        } catch (err) {
            console.error('[MCP] monitor-edge-node error:', err.message);
            const { node_id = '', uptime_hours = 0, tx_success_rate = 100, last_seen_mins = 0 } = req.body || {};
            const basicScore = Math.max(0, Math.min(100, Math.round((Number(tx_success_rate) || 0) * 0.9 - (Number(last_seen_mins) || 0) * 0.5)));
            return res.json({
                success: true,
                node_id,
                health_score: basicScore,
                status: basicScore >= 80 ? 'healthy' : basicScore >= 50 ? 'degraded' : 'critical',
                online: Number(last_seen_mins) < 5,
                fallback: true
            });
        }
    });

    // Tool: Assess Fraud Risk — transaction anomaly detection for fraud prevention
    app.post('/api/mcp/assess-fraud-risk', requireInternalAuth, async (req, res) => {
        try {
            const {
                wallet_address,
                amount_bez,
                transaction_type,
                counterparty_address = null
            } = req.body || {};

            if (!wallet_address || !amount_bez || !transaction_type) {
                return res.status(400).json({ success: false, error: 'wallet_address, amount_bez, and transaction_type are required' });
            }

            const response = await validateWithAegis({
                type: 'fraud_assessment',
                data: { wallet_address, amount_bez, transaction_type, counterparty_address }
            });

            const d = response.data || {};
            const anomalyScore = Number(d.score || 0);
            const amountFlag = Number(amount_bez) > 50000;
            const riskFromModel = d.risk || (anomalyScore > 0.7 ? 'high' : anomalyScore > 0.4 ? 'medium' : 'low');

            return res.json({
                success: true,
                wallet_address,
                amount_bez,
                transaction_type,
                risk: riskFromModel,
                block_recommended: riskFromModel === 'high' || amountFlag,
                fraud_score: Math.round(anomalyScore * 100),
                flags: [
                    ...(amountFlag ? ['large_amount'] : []),
                    ...(riskFromModel === 'high' ? ['anomaly_detected'] : [])
                ],
                ai_model_used: 'BeZhas-Aegis-FraudDetector-v1'
            });
        } catch (err) {
            console.error('[MCP] assess-fraud-risk error:', err.message);
            const { wallet_address = '', amount_bez = 0, transaction_type = '' } = req.body || {};
            const largeAmount = Number(amount_bez) > 50000;
            return res.json({
                success: true,
                wallet_address,
                amount_bez,
                transaction_type,
                risk: largeAmount ? 'medium' : 'low',
                block_recommended: largeAmount,
                fraud_score: largeAmount ? 40 : 10,
                flags: largeAmount ? ['large_amount'] : [],
                fallback: true
            });
        }
    });

    // Tool: Monitor Validator — evaluates validator health via Aegis ValidatorMonitor
    app.post('/api/mcp/monitor-validator', requireInternalAuth, async (req, res) => {
        try {
            const {
                operator,
                is_active = true,
                uptime_pct = 100,
                last_heartbeat = new Date().toISOString(),
                contribution_points = 0,
                tier = 1,
                staked_bez = 0
            } = req.body || {};

            if (!operator) {
                return res.status(400).json({ success: false, error: 'operator address is required' });
            }

            const response = await validateWithAegis({
                type: 'validator_monitor',
                data: { operator, is_active, uptime_pct, last_heartbeat, contribution_points, tier, staked_bez }
            });

            const d = response.data || {};
            return res.json({
                success: true,
                operator,
                health_score: d.health_score ?? 100,
                status: d.status || 'healthy',
                alerts: d.alerts || [],
                ai_model_used: 'BeZhas-Aegis-ValidatorMonitor-v1'
            });
        } catch (err) {
            console.error('[MCP] monitor-validator error:', err.message);
            // Fallback: basic rule-based assessment
            const { operator = '', uptime_pct = 100, is_active = true } = req.body || {};
            const score = is_active ? Math.min(100, uptime_pct) : 0;
            return res.json({
                success: true,
                operator,
                health_score: score,
                status: score >= 70 ? 'healthy' : score >= 40 ? 'degraded' : 'critical',
                alerts: !is_active ? ['validator_inactive'] : [],
                fallback: true
            });
        }
    });

    // Tool: Slash Check — determines if a validator merits slashing
    app.post('/api/mcp/slash-check', requireInternalAuth, async (req, res) => {
        try {
            const {
                operator,
                downtime_hours = 0,
                missed_votes = 0,
                anomaly_score = 0,
                is_sequencer = false
            } = req.body || {};

            if (!operator) {
                return res.status(400).json({ success: false, error: 'operator address is required' });
            }

            const response = await validateWithAegis({
                type: 'slash_check',
                data: { operator, downtime_hours, missed_votes, anomaly_score, is_sequencer }
            });

            const d = response.data || {};
            return res.json({
                success: true,
                operator,
                should_slash: d.should_slash ?? false,
                severity: d.severity || 'none',
                reasons: d.reasons || [],
                recommended_penalty_pct: d.recommended_penalty_pct ?? 0,
                ai_model_used: 'BeZhas-Aegis-SlashCheck-v1'
            });
        } catch (err) {
            console.error('[MCP] slash-check error:', err.message);
            // Fallback: rule-based slashing logic
            const { operator = '', downtime_hours = 0, missed_votes = 0, anomaly_score = 0, is_sequencer = false } = req.body || {};
            const reasons = [];
            if (downtime_hours > 24) reasons.push('extended_downtime');
            if (missed_votes > 5) reasons.push('excessive_missed_votes');
            if (anomaly_score > 0.8) reasons.push('high_anomaly_score');
            if (is_sequencer && downtime_hours > 6) reasons.push('sequencer_downtime');

            const shouldSlash = reasons.length > 0;
            let severity = 'none';
            let penalty = 0;
            if (reasons.length >= 3) { severity = 'critical'; penalty = 10; }
            else if (reasons.length === 2) { severity = 'high'; penalty = 5; }
            else if (reasons.length === 1) { severity = 'medium'; penalty = 2; }

            return res.json({
                success: true,
                operator,
                should_slash: shouldSlash,
                severity,
                reasons,
                recommended_penalty_pct: penalty,
                fallback: true
            });
        }
    });

    // Tool: System Health — proxies to Aegis /api/aegis/status
    app.get('/api/mcp/system-health', requireInternalAuth, async (req, res) => {
        try {
            const [healthRes, statusRes] = await Promise.all([
                axios.get(`${AEGIS_URL}/aegis/v1/health`, { timeout: 5000 }),
                axios.get(`${AEGIS_URL}/api/aegis/status`, { timeout: 5000 }),
            ]);
            res.json({
                success: true,
                aegis_health: healthRes.data,
                aegis_status: statusRes.data?.data || statusRes.data,
            });
        } catch (err) {
            console.error('[MCP] system-health error:', err.message);
            res.json({ success: false, error: 'Aegis unreachable', message: err.message });
        }
    });

    return app;
}

const app = createApp();

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n===========================================`);
        console.log(`BeZhas AI-Engine (MCP Server) v2.0 Online`);
        console.log(`===========================================`);
        console.log(`Listening on port ${PORT}`);
        console.log(`Aegis proxy target: ${AEGIS_URL}`);
        console.log(`Available AI Tools: ${mcpTools.length}`);
        console.log(`Tools: ${mcpTools.map(t => t.name).join(', ')}`);
        console.log(`===========================================\n`);
    });
}

module.exports = {
    app,
    createApp,
    mcpTools,
    TOOL_ENDPOINTS,
};
