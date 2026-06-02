/**
 * agentService.js — Agent registry, metrics, and MCP tool orchestration.
 * Connects to: PostgreSQL (ai_logs, transactions), Redis (pub/sub), Aegis AI, MCP Gateway.
 */
const axios = require('axios');
const { query } = require('../db/pool');
const { redisClient, publish, cacheGet, cacheSet } = require('../cache/redis');

const AEGIS_URL = process.env.AEGIS_API_URL || 'http://localhost:8001/api/aegis';
const MCP_URL = process.env.MCP_API_URL || 'http://localhost:3002/api/mcp';

// ── MCP Circuit Breaker ──
const mcpBreaker = {
    failures: 0,
    lastFailure: 0,
    state: 'CLOSED',
    THRESHOLD: 3,
    RESET_MS: 30_000,
    isOpen() {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailure > this.RESET_MS) {
                this.state = 'HALF_OPEN';
                return false;
            }
            return true;
        }
        return false;
    },
    recordSuccess() { this.failures = 0; this.state = 'CLOSED'; },
    recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.THRESHOLD) {
            this.state = 'OPEN';
            console.warn(`[MCP] Circuit breaker OPEN after ${this.failures} failures`);
        }
    },
};

// ── Agent Registry (maps GROUPS from constants to live backend state) ───────
const AGENT_SECTORS = {
    mcp: { name: 'MCP Server Core', agents: ['orch', 'gas', 'swap'] },
    oracle: { name: 'Oráculo Aegis', agents: ['aegis', 'food', 'cold'] },
    ssi: { name: 'SSIaaS / Identidad', agents: ['did', 'por'] },
    dao: { name: 'DAO Core-Plugin', agents: ['gov', 'hr', 'depub', 'arb'] },
    baas: { name: 'BaaS SDK & Bridge', agents: ['bridge', 'sdk', 'audit'] },
    token: { name: 'Tokenomics & Pago', agents: ['tknomics', 'pay', 'stake'] },
    health: { name: 'Healthcare', agents: ['medrecord', 'pharmatrak', 'claimbot', 'biodata'] },
    automotive: { name: 'Automotriz', agents: ['vehiclenft', 'autoparts', 'fleetdefi', 'evcharge'] },
    manufacturing: { name: 'Manufactura', agents: ['qualitychain', 'digitaltwin', 'supplymrp', 'predmaint'] },
    agriculture: { name: 'Agricultura', agents: ['croptoken', 'agrisupply', 'aquafarm', 'landcadastral'] },
    insurance: { name: 'Seguros', agents: ['policynft', 'claimadjuster', 'parametric', 'reinsurance'] },
    education: { name: 'Educación', agents: ['coursetoken', 'skillbadge', 'edudao', 'scholarpool'] },
    entertainment: { name: 'Entretenimiento', agents: ['fantoken', 'eventticket', 'streamingrights', 'royaltydist'] },
    legal: { name: 'Legal', agents: ['smartlegal', 'evidencevault', 'ipregistry', 'arbitration'] },
    supplychain: { name: 'Supply Chain', agents: ['supplytracker', 'supplierscore', 'procurement', 'invoicefactoring'] },
    gobierno: { name: 'Gobierno', agents: ['citizenid', 'voting', 'publicbudget', 'landregistry'] },
    finanzas: { name: 'Finanzas', agents: ['creditscore', 'microlending', 'crowdfunding', 'treasuryvault'] },
    servicios: { name: 'Servicios', agents: ['freelance', 'subscription', 'loyalty', 'servicereputation', 'slamonitor', 'p2pmarketplace', 'charityvault'] },
};

class AgentService {
    /**
     * List all agents with live status from Aegis + DB metrics.
     */
    async listAgents() {
        // 1. Get Aegis system status
        let aegisData = null;
        try {
            const res = await axios.get(`${AEGIS_URL}/status`, { timeout: 5000 });
            aegisData = res.data?.data || res.data;
        } catch { /* Aegis offline */ }

        // 2. Get MCP tools count
        let mcpTools = [];
        try {
            const res = await axios.get(`${MCP_URL}/tools`, { timeout: 5000 });
            mcpTools = res.data?.tools || res.data || [];
        } catch { /* MCP offline */ }

        // 3. Get per-agent activity from DB (last 24h)
        let agentActivity = {};
        try {
            const result = await query(
                `SELECT module, COUNT(*) as actions, 
                        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as alerts,
                        MAX(created_at) as last_action
                 FROM ai_logs 
                 WHERE created_at > NOW() - INTERVAL '24 hours'
                 GROUP BY module`
            );
            for (const row of result.rows) {
                agentActivity[row.module] = {
                    actions_24h: parseInt(row.actions, 10),
                    alerts_24h: parseInt(row.alerts, 10),
                    last_action: row.last_action,
                };
            }
        } catch { /* DB unavailable */ }

        // 4. Build response
        const groups = Object.entries(AGENT_SECTORS).map(([groupId, group]) => ({
            id: groupId,
            name: group.name,
            agents: group.agents.map(agentId => ({
                id: agentId,
                group: groupId,
                activity: agentActivity[agentId] || { actions_24h: 0, alerts_24h: 0, last_action: null },
            })),
        }));

        return {
            total_agents: Object.values(AGENT_SECTORS).reduce((s, g) => s + g.agents.length, 0),
            total_groups: Object.keys(AGENT_SECTORS).length,
            mcp_tools: mcpTools.length || (Array.isArray(mcpTools) ? mcpTools.length : 0),
            aegis_status: aegisData ? (aegisData.system_status || 'online') : 'offline',
            aegis_mode: aegisData?.mode || 'unknown',
            aegis_models: aegisData?.models || {},
            groups,
        };
    }

    /**
     * Get metrics for a specific agent.
     */
    async getAgentMetrics(agentId, days = 7) {
        const safeDays = Math.min(parseInt(days, 10) || 7, 90);
        const empty = {
            agent_id: agentId,
            period_days: safeDays,
            source: 'core-db',
            stats: {
                total_actions: 0,
                critical_alerts: 0,
                warnings: 0,
                avg_confidence: null,
                on_chain_txs: 0,
                total_gas_used: '0',
            },
            timeseries: [],
            recent_logs: [],
        };

        // Recent logs for this agent
        let logsResult;
        let statsResult;
        let timeseriesResult;
        try {
            logsResult = await query(
                `SELECT id, action, severity, confidence, created_at, tx_hash, gas_used
                 FROM ai_logs
                 WHERE module = $1 AND created_at > NOW() - INTERVAL '${safeDays} days'
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [agentId]
            );

            // Aggregate stats
            statsResult = await query(
                `SELECT
                    COUNT(*) as total_actions,
                    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
                    COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_count,
                    AVG(confidence) as avg_confidence,
                    COUNT(DISTINCT tx_hash) FILTER (WHERE tx_hash IS NOT NULL) as on_chain_txs,
                    SUM(CAST(COALESCE(gas_used, '0') AS NUMERIC)) as total_gas
                 FROM ai_logs
                 WHERE module = $1 AND created_at > NOW() - INTERVAL '${safeDays} days'`,
                [agentId]
            );

            // Time-series for chart (daily buckets)
            timeseriesResult = await query(
                `SELECT DATE(created_at) as date, COUNT(*) as actions,
                        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as alerts
                 FROM ai_logs
                 WHERE module = $1 AND created_at > NOW() - INTERVAL '${safeDays} days'
                 GROUP BY DATE(created_at)
                 ORDER BY date`,
                [agentId]
            );
        } catch (error) {
            return { ...empty, source: 'core-db-unavailable', error: error.message };
        }

        const stats = statsResult.rows[0] || {};

        return {
            agent_id: agentId,
            period_days: safeDays,
            source: 'core-db',
            stats: {
                total_actions: parseInt(stats.total_actions, 10) || 0,
                critical_alerts: parseInt(stats.critical_count, 10) || 0,
                warnings: parseInt(stats.warning_count, 10) || 0,
                avg_confidence: stats.avg_confidence ? parseFloat(stats.avg_confidence).toFixed(3) : null,
                on_chain_txs: parseInt(stats.on_chain_txs, 10) || 0,
                total_gas_used: stats.total_gas || '0',
            },
            timeseries: timeseriesResult.rows.map(r => ({
                date: r.date,
                actions: parseInt(r.actions, 10),
                alerts: parseInt(r.alerts, 10),
            })),
            recent_logs: logsResult.rows,
        };
    }

    /**
     * Invoke an MCP tool via the AI Engine gateway.
     */
    async invokeMCPTool(toolName, parameters, userId) {
        // Circuit breaker check
        if (mcpBreaker.isOpen()) {
            throw new Error('MCP Gateway temporarily unavailable (circuit breaker open)');
        }

        // Log the invocation request
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, wallet_address)
             VALUES ($1, $2, 'info', $3::jsonb, $4)`,
            ['mcp_invoke', toolName, JSON.stringify({ tool: toolName, parameters }), userId || 'system']
        );

        let response;
        try {
            response = await axios.post(`${MCP_URL}/invoke`, {
                tool: toolName,
                parameters,
            }, { timeout: 15000 });
            mcpBreaker.recordSuccess();
        } catch (err) {
            mcpBreaker.recordFailure();
            throw err;
        }

        // Log result
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, output_data, wallet_address)
             VALUES ($1, $2, 'info', $3::jsonb, $4::jsonb, $5)`,
            [
                'mcp_result',
                toolName,
                JSON.stringify({ tool: toolName }),
                JSON.stringify(response.data?.result || response.data),
                userId || 'system',
            ]
        );

        // Publish event for real-time listeners
        try {
            await publish('event:mcp:invoke', {
                tool: toolName,
                timestamp: new Date().toISOString(),
                success: true,
            });
        } catch { /* Redis unavailable */ }

        return response.data;
    }

    /**
     * List available MCP tools from the gateway.
     */
    async listMCPTools() {
        const response = await axios.get(`${MCP_URL}/tools`, { timeout: 5000 });
        return response.data?.tools || response.data || [];
    }

    /**
     * Get aggregated platform-wide agent analytics.
     */
    async getAgentAnalytics() {
        const result = await query(
            `SELECT 
                module,
                COUNT(*) as total,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
                COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warnings,
                AVG(confidence) as avg_confidence,
                MAX(created_at) as last_activity
             FROM ai_logs 
             WHERE created_at > NOW() - INTERVAL '24 hours'
             GROUP BY module
             ORDER BY total DESC`
        );

        // Global BEZ burn estimate from transactions
        let burnEstimate = 0;
        try {
            const burnResult = await query(
                `SELECT SUM(CAST(COALESCE(gas_used, '0') AS NUMERIC)) as total_gas
                 FROM transactions 
                 WHERE created_at > NOW() - INTERVAL '24 hours'`
            );
            // Approximate: each gas unit ≈ 0.0001 BEZ burned
            burnEstimate = parseFloat(burnResult.rows[0]?.total_gas || 0) * 0.0001;
        } catch { /* table may not exist yet */ }

        return {
            agents_active: result.rows.length,
            total_actions_24h: result.rows.reduce((s, r) => s + parseInt(r.total, 10), 0),
            critical_alerts_24h: result.rows.reduce((s, r) => s + parseInt(r.critical, 10), 0),
            bez_burned_24h: burnEstimate.toFixed(4),
            per_agent: result.rows.map(r => ({
                module: r.module,
                actions: parseInt(r.total, 10),
                critical: parseInt(r.critical, 10),
                warnings: parseInt(r.warnings, 10),
                avg_confidence: r.avg_confidence ? parseFloat(r.avg_confidence).toFixed(3) : null,
                last_activity: r.last_activity,
            })),
        };
    }

    /**
     * Get real-time BEZ token data from blockchain + cache.
     */
    async getBEZTokenData() {
        let price = null;
        let totalBurned = null;
        let circulatingSupply = null;

        // Try Redis cache first
        try {
            const cached = await cacheGet('bez:token_data');
            if (cached) return cached;
        } catch { /* cache miss */ }

        // Fallback: query from Aegis
        try {
            const aegisRes = await axios.get(`${AEGIS_URL}/status`, { timeout: 3000 });
            const metrics = aegisRes.data?.data?.monitor_metrics;
            if (metrics) {
                price = metrics.bez_price || null;
                totalBurned = metrics.bez_burned || null;
            }
        } catch { /* Aegis offline */ }

        const data = {
            price: price || null,
            total_burned: totalBurned || 0,
            circulating_supply: circulatingSupply,
            last_updated: new Date().toISOString(),
            source: price ? 'aegis-oracle' : 'unavailable',
        };

        // Cache for 30s
        try {
            await cacheSet('bez:token_data', data, 30);
        } catch { /* */ }

        return data;
    }
}

module.exports = new AgentService();
