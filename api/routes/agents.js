/**
 * BeZhas API — Routes: Agents · Tasks · HITL · AEGIS · Telegram
 * Base: /api
 */

'use strict';

const { Router } = require('express');
const agentService = require('../services/agentService');
const { authenticateToken, requireRole } = require('../middleware/security');
const hitlMirror = require('../services/hitlMirror');
const agentRuntime = require('../services/agentRuntime');

module.exports = function agentsRouter(managerExplicito, wss) {
  const r = Router();

  /**
   * Enlace tardío con el runtime. Las rutas se montan de forma síncrona, pero
   * el runtime arranca despues (levanta cinco agentes y toca la cadena), así
   * que el manager se pide en cada petición en vez de capturarlo al montar.
   * El argumento explícito sigue mandando: lo usan `api/server.js` y los tests.
   */
  const getManager = () => managerExplicito || agentRuntime.getManager();

  /**
   * Sin runtime cableado, estas rutas devuelven 503 con el motivo, no un 500.
   *
   * `api/index.js` monta este router con `agentRoutes()` — sin argumentos —, así
   * que `manager` llega `undefined` y todo lo que lo tocaba reventaba con
   * "Cannot read properties of undefined (reading 'memory')". Un error que no
   * dice qué falta es peor que no tener el endpoint: parece una caída cuando en
   * realidad el runtime nunca se conectó.
   *
   * El cableado vive ahora en `services/agentRuntime.js` y lo arranca
   * `index.js`. Si falla (RPC caído, contratos sin configurar), la API sigue en
   * pie y estas rutas responden 503 con el motivo real.
   */
  const requiereRuntime = (req, res, next) => {
    if (getManager()) return next();
    return res.status(503).json({
      error: 'Agent runtime no cableado en este proceso',
      code: 'RUNTIME_NOT_WIRED',
      detail: `Cableado del runtime: ${agentRuntime.status().estado}${agentRuntime.status().motivo ? ' — ' + agentRuntime.status().motivo : ''}`,
    });
  };
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
      if (getManager()?.listAgents) {
        const agents = getManager().listAgents();
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
  r.get('/agents/:id', authenticateToken, requiereRuntime, (req, res) => {
    if (!getManager()?.getAgent) return res.status(404).json({ error: 'Runtime manager unavailable' });
    const agent = getManager().getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json(agent.getStats());
  });

  /** GET /api/agents/:id/memory — memoria del agente */
  r.get('/agents/:id/memory', authenticateToken, requiereRuntime, async (req, res) => {
    try {
      const memories = await getManager().memory.recallAll(req.params.id);
      res.json({ agentId: req.params.id, memories });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── TASKS ───────────────────────────────────────────────────────────────

  /** GET /api/tasks — tareas recientes */
  r.get('/tasks', authenticateToken, requiereRuntime, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit || '20');
      const tasks = await getManager().memory.listRecentTasks(limit);
      const queue = getManager().taskQueue?.getStatus() || {};
      res.json({ tasks, queue, count: tasks.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/tasks/:id — estado de una tarea */
  r.get('/tasks/:id', authenticateToken, requiereRuntime, async (req, res) => {
    try {
      const task = await getManager().memory.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
      res.json(task);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tasks — encolar nueva tarea */
  r.post('/tasks', authenticateToken, requiereRuntime, async (req, res) => {
    try {
      const { type, priority = 'normal', payload = {} } = req.body;
      if (!type) return res.status(400).json({ error: 'type requerido' });
      const taskId = await getManager().dispatch({ type, priority, source: 'api', payload });
      res.json({ ok: true, taskId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── HITL ────────────────────────────────────────────────────────────────

  // Estos tres endpoints estaban SIN autenticar: cualquiera que alcanzase la
  // API podía aprobar o rechazar una confirmación humana pendiente, que es
  // justo el control que separa a un agente de ejecutar algo irreversible.
  // Aprobar/rechazar exige además rol operativo, igual que la sala
  // '/agent-runtime' del WebSocket.
  const HITL_ROLES = ['admin', 'manager', 'operator'];

  /** GET /api/hitl/pending — confirmaciones pendientes */
  r.get('/hitl/pending', authenticateToken, requiereRuntime, requireRole(...HITL_ROLES), async (req, res) => {
    try {
      const pending = await getManager().memory.listPendingHITL();
      res.json({ pending, count: pending.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/hitl/approve/:taskId */
  r.post('/hitl/approve/:taskId', authenticateToken, requireRole(...HITL_ROLES), requiereRuntime, async (req, res) => {
    try {
      const approver = req.user?.address || req.user?.userId || 'unknown';
      const ok = await getManager().resolveHITL(req.params.taskId, true, req.body.response || `API approval by ${approver}`);
      // Mismo criterio que la cola SCADA: se refleja en business-ops para que
      // haya una sola bandeja y una sola auditoría, sin que esta ruta dependa
      // de que aquel servicio esté vivo.
      hitlMirror.mirror({ jobId: req.params.taskId, command: 'AGENT_TASK', approvedBy: approver }, 'approved');
      if (wss) wss.broadcastHITL(req.params.taskId, { resolved: true, approved: true });
      res.json({ ok, taskId: req.params.taskId, approved: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/hitl/reject/:taskId */
  r.post('/hitl/reject/:taskId', authenticateToken, requireRole(...HITL_ROLES), requiereRuntime, async (req, res) => {
    try {
      const approver = req.user?.address || req.user?.userId || 'unknown';
      const ok = await getManager().resolveHITL(req.params.taskId, false, req.body.response || `API rejection by ${approver}`);
      hitlMirror.mirror({ jobId: req.params.taskId, command: 'AGENT_TASK', approvedBy: approver, reason: req.body.response || null }, 'rejected');
      res.json({ ok, taskId: req.params.taskId, approved: false });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── AEGIS ───────────────────────────────────────────────────────────────

  /** GET /api/aegis/alerts — historial de alertas */
  r.get('/aegis/alerts', authenticateToken, requiereRuntime, async (req, res) => {
    try {
      const limit  = parseInt(req.query.limit || '50');
      const aegis  = getManager().aegis;
      const alerts = aegis?.getAlertHistory(limit) || [];
      const stats  = aegis?.getStats() || {};
      const last   = aegis?._lastBlock || 0;
      res.json({ alerts, stats, lastBlock: last, count: alerts.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/aegis/health */
  r.get('/aegis/health', async (req, res) => {
    try {
      const health = await getManager().aegis?.healthCheck() || { status: 'unavailable' };
      res.json(health);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── TELEGRAM STATUS ─────────────────────────────────────────────────────

  /** GET /api/telegram/status — expone allowedUsers, no puede ser público */
  r.get('/telegram/status', authenticateToken, requiereRuntime, requireRole('admin', 'manager'), (req, res) => {
    try {
      const tg = getManager()._telegram;
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
  r.get('/health', requiereRuntime, async (req, res) => {
    try {
      const [mem, bc, oc] = await Promise.allSettled([
        getManager().memory?.healthCheck(),
        getManager().blockchain?.healthCheck(),
        getManager().openclaw?.healthCheck(),
      ]);

      res.json({
        status:    'ok',
        timestamp: new Date().toISOString(),
        agents:    getManager().listAgents().length,
        memory:    mem.status  === 'fulfilled' ? mem.value  : { status: 'error' },
        blockchain:bc.status   === 'fulfilled' ? bc.value   : { status: 'error' },
        openclaw:  oc.status   === 'fulfilled' ? oc.value   : { status: 'error' },
        wss:       wss?.stats || {},
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/status — resumen del runtime para dashboard */
  r.get('/status', requiereRuntime, async (req, res) => {
    try {
      const agents  = getManager().listAgents();
      const queue   = getManager().taskQueue?.getStatus() || {};
      const hitl    = await getManager().memory?.listPendingHITL().catch(() => []);
      const tasks   = await getManager().memory?.listRecentTasks(5).catch(() => []);

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
