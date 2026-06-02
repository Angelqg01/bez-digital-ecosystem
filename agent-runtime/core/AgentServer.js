
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const CORE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'DEVOPS', 'SECURITY']);

function getRuntimeKey() {
  const key = process.env.AGENT_RUNTIME_API_KEY || process.env.INTERNAL_API_KEY;
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('AGENT_RUNTIME_API_KEY or INTERNAL_API_KEY is required in production');
  }
  return key || null;
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

class AgentServer {
  constructor(manager, port = 3001) {
    this.manager = manager;
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.CORE_CORS_ORIGINS ? process.env.CORE_CORS_ORIGINS.split(',') : ['http://localhost:3000'],
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocket();
  }

  setupMiddleware() {
    this.runtimeKey = getRuntimeKey();
    this.app.use(cors({
      origin: process.env.CORE_CORS_ORIGINS ? process.env.CORE_CORS_ORIGINS.split(',') : ['http://localhost:3000'],
      credentials: true,
    }));
    this.app.use(express.json());
  }

  requireCoreAuth(req, res, next) {
    const key = req.headers['x-internal-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const role = String(req.headers['x-bezhas-role'] || '').toUpperCase();
    const hasTrustedKey = this.runtimeKey && timingSafeEqualString(key, this.runtimeKey);
    const hasTrustedRole = hasTrustedKey && (!role || CORE_ROLES.has(role));
    if (!hasTrustedRole) return res.status(401).json({ success: false, error: 'Core authentication required' });
    next();
  }

  setupRoutes() {
    // Health check — must always respond for Cloud Run
    this.app.get('/api/health', (req, res) => {
      try {
        res.json({ status: 'ok', agents: this.manager.listAgents() });
      } catch {
        res.json({ status: 'degraded', agents: [] });
      }
    });

    // Orchestration manifest status
    this.app.get('/api/orchestration', this.requireCoreAuth.bind(this), (req, res) => {
      res.json({
        success: true,
        orchestration: this.manager.getOrchestrationStatus
          ? this.manager.getOrchestrationStatus()
          : null,
        agents: this.manager.listAgents(),
      });
    });

    // Resolve a task type to department/agent/KPIs
    this.app.get('/api/orchestration/route/:taskType', this.requireCoreAuth.bind(this), (req, res) => {
      const { taskType } = req.params;
      const route = this.manager.orchestration?.getRouteInfo(taskType) || null;
      res.json({ success: Boolean(route), route });
    });

    // Dispatch a task into the runtime queue
    this.app.post('/api/tasks', this.requireCoreAuth.bind(this), async (req, res) => {
      try {
        const { type, payload = {}, priority = 'normal', source = 'api', agentId } = req.body || {};
        if (!type) return res.status(400).json({ success: false, error: 'type is required' });

        const taskId = await this.manager.dispatch({ type, payload, priority, source, agentId });
        res.json({ success: true, taskId });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // List recent alerts/tasks
    this.app.get('/api/alerts', this.requireCoreAuth.bind(this), async (req, res) => {
      // Por ahora retornamos una lista simulada desde la memoria o el histórico de eventos
      // En una implementación real, esto vendría de Redis o una DB persistente
      const alerts = await this.manager.memory.getRecentAlerts ? await this.manager.memory.getRecentAlerts() : [];
      res.json(alerts);
    });

    // Recent orchestration events from Redis Streams
    this.app.get('/api/events', this.requireCoreAuth.bind(this), async (req, res) => {
      try {
        const stream = req.query.stream || 'bezhas:events:all';
        const limit = Math.min(Number(req.query.limit || 50), 200);
        const events = await this.manager.memory.listRecentEvents(stream, limit);
        res.json({ success: true, stream, events });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    this.app.get('/api/events/streams', this.requireCoreAuth.bind(this), async (req, res) => {
      try {
        const streams = await this.manager.memory.listEventStreams();
        res.json({ success: true, streams });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Endpoint para HITL (aprobación humana)
    this.app.post('/api/hitl/:taskId/resolve', this.requireCoreAuth.bind(this), async (req, res) => {
      const { taskId } = req.params;
      const { approved, response } = req.body;
      const success = await this.manager.resolveHITL(taskId, approved, response);
      res.json({ success });
    });
  }

  setupSocket() {
    this.io.use((socket, next) => {
      const key = socket.handshake.auth?.token || socket.handshake.headers['x-internal-key'];
      if (!this.runtimeKey || !timingSafeEqualString(key, this.runtimeKey)) {
        return next(new Error('Core socket authentication required'));
      }
      next();
    });
    this.io.on('connection', (socket) => {
      console.log(`[AgentServer] 👤 Cliente conectado: ${socket.id}`);
      
      // Enviar estado inicial
      socket.emit('system:status', { agents: this.manager.listAgents() });

      socket.on('disconnect', () => {
        console.log(`[AgentServer] 👤 Cliente desconectado: ${socket.id}`);
      });
    });

    // Escuchar eventos del AgentManager y retransmitirlos vía Socket.io
    this.manager.on('task:queued', (task) => {
      this.io.emit('alert:new', {
        id: task.id,
        type: task.type,
        severity: task.priority === 'critical' ? 'error' : (task.priority === 'high' ? 'warning' : 'info'),
        message: `Nueva tarea detectada: ${task.type}`,
        timestamp: task.createdAt,
        data: task.payload
      });
    });

    this.manager.on('hitl:resolved', (data) => {
      this.io.emit('hitl:update', data);
    });

    this.manager.on('task:completed', ({ task, result }) => {
      this.io.emit('task:completed', {
        id: task.id,
        type: task.type,
        departmentId: task.orchestration?.departmentId || null,
        routeAgentId: task.orchestration?.routeAgentId || null,
        timestamp: new Date().toISOString(),
        result,
      });
    });

    this.manager.on('task:failed', ({ task, error }) => {
      this.io.emit('task:failed', {
        id: task.id,
        type: task.type,
        departmentId: task.orchestration?.departmentId || null,
        routeAgentId: task.orchestration?.routeAgentId || null,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    });
    
    // Capturar logs de anomalías específicos del TokenomicsAgent si se emiten
    this.manager.on('tokenomics:anomaly', (anomaly) => {
      this.io.emit('alert:new', {
        id: `anomaly_${Date.now()}`,
        type: 'TOKENOMICS_ANOMALY',
        severity: anomaly.severity || 'warning',
        message: `Anomalía detectada en ${anomaly.type}`,
        timestamp: new Date().toISOString(),
        data: anomaly.details
      });
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`[AgentServer] 🌐 Servidor API + WebSocket activo en http://localhost:${this.port}`);
    });
  }
}

module.exports = AgentServer;
