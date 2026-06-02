/**
 * BeZhas API — Routes: Agents · Tasks · HITL · AEGIS · Telegram
 * Base: /api
 */

'use strict';

const { Router } = require('express');
const agentService = require('../services/agentService');
const { authenticateToken } = require('../middleware/security');

module.exports = function agentsRouter(manager, wss) {
  const r = Router();
  const MCP_TOOL_ALLOWLIST = new Set([
    'get_token_price',
    'system_health',
    'analyze_gas_strategy',
    'verify_regulatory_compliance',
    'analyze_sentiment',
    'audit_contract',
    'predict_demand',
    'score_supplier',
    'calculate_smart_swap',
    'monitor_edge_node',
    'assess_fraud_risk',
  ]);

  // ─── AGENTS ──────────────────────────────────────────────────────────────

  async function listAgents(req, res) {
    try {
      if (manager?.listAgents) {
        const agents = manager.listAgents();
        return res.json({ agents, count: agents.length, source: 'runtime-manager' });
      }
      const data = await agentService.listAgents();
      return res.json({ status: 'success', data, ...data, source: 'agent-service' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }

  async function getAgentMetrics(req, res) {
    try {
      const days = Math.min(parseInt(req.query.days || '7', 10) || 7, 90);
      const data = await agentService.getAgentMetrics(req.params.id, days);
      res.json({ status: 'success', data, ...data });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }

  async function getAgentAnalytics(_req, res) {
    try {
      const data = await agentService.getAgentAnalytics();
      res.json({ status: 'success', data, ...data });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }

  async function listMCPTools(_req, res) {
    try {
      const tools = await agentService.listMCPTools();
      res.json({ status: 'success', data: { tools } });
    } catch {
      res.json({ status: 'success', data: { tools: [], note: 'MCP gateway offline' } });
    }
  }

  async function getTokenData(_req, res) {
    try {
      const data = await agentService.getBEZTokenData();
      res.json({ status: 'success', data, ...data });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }

  async function invokeMCP(req, res) {
    try {
      const { tool, parameters = {} } = req.body || {};
      if (!tool) return res.status(400).json({ errors: [{ msg: 'tool required', param: 'tool' }] });
      if (typeof tool !== 'string' || tool.length > 100) {
        return res.status(400).json({ errors: [{ msg: 'tool must be a string with max length 100', param: 'tool' }] });
      }
      if (parameters === null || Array.isArray(parameters) || typeof parameters !== 'object') {
        return res.status(400).json({ errors: [{ msg: 'parameters must be an object', param: 'parameters' }] });
      }
      if (!MCP_TOOL_ALLOWLIST.has(tool)) {
        return res.status(403).json({ error: `Tool '${tool}' is not in the MCP allowlist` });
      }
      const userId = req.user?.address || req.headers['x-wallet-address'] || 'agents-ui';
      const data = await agentService.invokeMCPTool(tool, parameters, userId);
      res.json({ status: 'success', data });
    } catch (e) { res.status(502).json({ error: e.message }); }
  }

  function streamAgents(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  }

  // Modern mount: app.use('/api/agents', agentsRouter())
  r.get('/', authenticateToken, listAgents);
  r.get('/analytics', authenticateToken, getAgentAnalytics);
  r.get('/token', authenticateToken, getTokenData);
  r.get('/mcp/tools', authenticateToken, listMCPTools);
  r.post('/mcp/invoke', authenticateToken, invokeMCP);
  r.get('/stream', authenticateToken, streamAgents);
  r.get('/:id/metrics', authenticateToken, getAgentMetrics);

  /** GET /api/agents — lista de agentes activos */
  r.get('/agents', authenticateToken, listAgents);

  /** GET /api/agents/:id/metrics — metricas reales desde Core DB */
  r.get('/agents/:id/metrics', authenticateToken, getAgentMetrics);

  /** GET /api/agents/token — tokenomics BEZ desde Aegis/Core */
  r.get('/agents/token', authenticateToken, getTokenData);

  /** GET /api/agents/analytics — analytics agregados */
  r.get('/agents/analytics', authenticateToken, getAgentAnalytics);

  /** GET /api/agents/mcp/tools — listado MCP */
  r.get('/agents/mcp/tools', authenticateToken, listMCPTools);

  /** POST /api/agents/mcp/invoke — invocacion MCP */
  r.post('/agents/mcp/invoke', authenticateToken, invokeMCP);

  /** GET /api/agents/:id — estado de un agente concreto */
  r.get('/agents/:id', (req, res) => {
    if (!manager?.getAgent) return res.status(404).json({ error: 'Runtime manager unavailable' });
    const agent = manager.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json(agent.getStats());
  });

  /** GET /api/agents/:id/memory — memoria del agente */
  r.get('/agents/:id/memory', async (req, res) => {
    try {
      const memories = await manager.memory.recallAll(req.params.id);
      res.json({ agentId: req.params.id, memories });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── TASKS ───────────────────────────────────────────────────────────────

  /** GET /api/tasks — tareas recientes */
  r.get('/tasks', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit || '20');
      const tasks = await manager.memory.listRecentTasks(limit);
      const queue = manager.taskQueue?.getStatus() || {};
      res.json({ tasks, queue, count: tasks.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/tasks/:id — estado de una tarea */
  r.get('/tasks/:id', async (req, res) => {
    try {
      const task = await manager.memory.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
      res.json(task);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tasks — encolar nueva tarea */
  r.post('/tasks', async (req, res) => {
    try {
      const { type, priority = 'normal', payload = {} } = req.body;
      if (!type) return res.status(400).json({ error: 'type requerido' });
      const taskId = await manager.dispatch({ type, priority, source: 'api', payload });
      res.json({ ok: true, taskId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── HITL ────────────────────────────────────────────────────────────────

  /** GET /api/hitl/pending — confirmaciones pendientes */
  r.get('/hitl/pending', async (req, res) => {
    try {
      const pending = await manager.memory.listPendingHITL();
      res.json({ pending, count: pending.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/hitl/approve/:taskId */
  r.post('/hitl/approve/:taskId', async (req, res) => {
    try {
      const ok = await manager.resolveHITL(req.params.taskId, true, req.body.response || 'API approval');
      if (wss) wss.broadcastHITL(req.params.taskId, { resolved: true, approved: true });
      res.json({ ok, taskId: req.params.taskId, approved: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/hitl/reject/:taskId */
  r.post('/hitl/reject/:taskId', async (req, res) => {
    try {
      const ok = await manager.resolveHITL(req.params.taskId, false, req.body.response || 'API rejection');
      res.json({ ok, taskId: req.params.taskId, approved: false });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── AEGIS ───────────────────────────────────────────────────────────────

  /** GET /api/aegis/alerts — historial de alertas */
  r.get('/aegis/alerts', async (req, res) => {
    try {
      const limit  = parseInt(req.query.limit || '50');
      const aegis  = manager.aegis;
      const alerts = aegis?.getAlertHistory(limit) || [];
      const stats  = aegis?.getStats() || {};
      const last   = aegis?._lastBlock || 0;
      res.json({ alerts, stats, lastBlock: last, count: alerts.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/aegis/health */
  r.get('/aegis/health', async (req, res) => {
    try {
      const health = await manager.aegis?.healthCheck() || { status: 'unavailable' };
      res.json(health);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── TELEGRAM STATUS ─────────────────────────────────────────────────────

  /** GET /api/telegram/status */
  r.get('/telegram/status', (req, res) => {
    try {
      const tg = manager._telegram;
      res.json({
        botActive:    !!tg && tg._running,
        botUsername:  tg?._botUsername || null,
        chatCount:    tg?.chatIds?.size || 0,
        allowedUsers: tg?.allowedUsers || [],
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── SYSTEM ──────────────────────────────────────────────────────────────

  /** GET /api/health — health check completo del sistema */
  r.get('/health', async (req, res) => {
    try {
      const [mem, bc, oc] = await Promise.allSettled([
        manager.memory?.healthCheck(),
        manager.blockchain?.healthCheck(),
        manager.openclaw?.healthCheck(),
      ]);

      res.json({
        status:    'ok',
        timestamp: new Date().toISOString(),
        agents:    manager.listAgents().length,
        memory:    mem.status  === 'fulfilled' ? mem.value  : { status: 'error' },
        blockchain:bc.status   === 'fulfilled' ? bc.value   : { status: 'error' },
        openclaw:  oc.status   === 'fulfilled' ? oc.value   : { status: 'error' },
        wss:       wss?.stats || {},
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/status — resumen del runtime para dashboard */
  r.get('/status', async (req, res) => {
    try {
      const agents  = manager.listAgents();
      const queue   = manager.taskQueue?.getStatus() || {};
      const hitl    = await manager.memory?.listPendingHITL().catch(() => []);
      const tasks   = await manager.memory?.listRecentTasks(5).catch(() => []);

      res.json({
        agents:  { count: agents.length, list: agents },
        queue,
        hitl:    { count: hitl?.length || 0 },
        tasks:   tasks?.slice(0, 5) || [],
        uptime:  process.uptime(),
        memory:  process.memoryUsage(),
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return r;
};
