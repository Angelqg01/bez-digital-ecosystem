/**
 * BeZhas API — WebSocket Broadcaster
 * Conexión en tiempo real entre Agent Runtime y bezhas-web3 frontend.
 *
 * Canales:
 *   /agent-runtime  → agentes, tareas, HITL
 *   /tokenomics     → snapshots, eventos tokenómicos
 *   /aegis          → alertas de seguridad
 *   /compliance     → checks y reportes
 *
 * Protocolo: JSON { type, data, timestamp }
 */

'use strict';

const { WebSocketServer } = require('ws');
const { createServer }    = require('http');
const url                 = require('url');

class BeZhasWebSocketServer {
  constructor(httpServer, manager) {
    this.manager = manager;
    this._wss    = new WebSocketServer({ server: httpServer });
    this._rooms  = new Map(); // room → Set<ws>
    this._rooms.set('/agent-runtime', new Set());
    this._rooms.set('/tokenomics',    new Set());
    this._rooms.set('/aegis',         new Set());
    this._rooms.set('/compliance',    new Set());

    this._wss.on('connection', (ws, req) => this._onConnection(ws, req));
    this._wireManagerEvents();
    console.log('[WebSocket] 🔌 Server iniciado');
  }

  // ─── CONEXIÓN ─────────────────────────────────────────────────────────────

  _onConnection(ws, req) {
    const path = url.parse(req.url).pathname || '/agent-runtime';
    const room = this._rooms.has(path) ? path : '/agent-runtime';

    this._rooms.get(room).add(ws);
    console.log(`[WebSocket] ✅ Cliente conectado → ${room} (total: ${this._rooms.get(room).size})`);

    // Enviar estado inicial al conectarse
    this._sendInitialState(ws, room);

    ws.on('close', () => {
      this._rooms.get(room)?.delete(ws);
      console.log(`[WebSocket] 🔌 Cliente desconectado (${room})`);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error de cliente:', err.message);
    });

    // Ping/pong keepalive cada 30s
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  }

  // ─── ESTADO INICIAL ───────────────────────────────────────────────────────

  async _sendInitialState(ws, room) {
    try {
      if (room === '/agent-runtime') {
        const agents = this.manager?.listAgents() || [];
        const tasks  = await this.manager?.memory?.listRecentTasks(20).catch(() => []) || [];
        const hitl   = await this.manager?.memory?.listPendingHITL().catch(() => []) || [];
        this._send(ws, 'init:agents',   { agents });
        this._send(ws, 'init:tasks',    { tasks });
        this._send(ws, 'init:hitl',     { pending: hitl });
      }

      if (room === '/tokenomics') {
        const snap = this.manager?._tokenomicsConnector?.getState() || null;
        if (snap) this._send(ws, 'tokenomics:snapshot', snap);
      }

      if (room === '/aegis') {
        const aegis   = this.manager?.aegis;
        const history = aegis?.getAlertHistory(20) || [];
        const stats   = aegis?.getStats() || {};
        this._send(ws, 'aegis:init', { alerts: history, stats });
      }
    } catch (err) {
      console.error('[WebSocket] Error enviando estado inicial:', err.message);
    }
  }

  // ─── WIRE MANAGER EVENTS ──────────────────────────────────────────────────

  _wireManagerEvents() {
    const mgr = this.manager;
    if (!mgr) return;

    // ── Agent Runtime ──────────────────────────────────────────────────────

    mgr.on('task:queued',    (task)         => this._broadcast('/agent-runtime', 'task:queued',    task));
    mgr.on('task:started',   (task)         => this._broadcast('/agent-runtime', 'task:started',   task));
    mgr.on('task:completed', ({ task, result }) => this._broadcast('/agent-runtime', 'task:completed', { ...task, result }));
    mgr.on('task:failed',    ({ task, error })  => this._broadcast('/agent-runtime', 'task:failed',    { ...task, error: error.message }));

    mgr.on('hitl:resolved', ({ taskId, approved, response }) =>
      this._broadcast('/agent-runtime', 'hitl:resolved', { taskId, approved, response })
    );

    // Re-emitir estado de agentes cuando cambian
    setInterval(() => {
      if (!mgr.listAgents) return;
      const agents = mgr.listAgents();
      this._broadcast('/agent-runtime', 'agent:updated', { agents });
    }, 5_000);

    // ── Tokenomics ─────────────────────────────────────────────────────────

    const tc = mgr._tokenomicsConnector;
    if (tc) {
      tc.on('snapshot', (snap) =>
        this._broadcast('/tokenomics', 'tokenomics:snapshot', snap)
      );
      tc.on('staking:staked',   (e) => this._broadcastEvent('/tokenomics', 'staked',   e));
      tc.on('staking:unstaked', (e) => this._broadcastEvent('/tokenomics', 'unstaked', e));
      tc.on('staking:rewards',  (e) => this._broadcastEvent('/tokenomics', 'rewards_claimed', e));
      tc.on('validator:slashed',(e) => this._broadcastEvent('/tokenomics', 'slashing', e));
      tc.on('bridge:deposit',   (e) => this._broadcastEvent('/tokenomics', 'bridge_deposit', e));
      tc.on('large:transfer',   (e) => this._broadcastEvent('/tokenomics', 'large_transfer', e));
      tc.on('anomaly:detected', (a) => {
        this._broadcast('/tokenomics', 'tokenomics:anomaly', a);
        this._broadcast('/aegis',      'aegis:alert',        { ...a, source: 'tokenomics' });
      });
    }

    // ── AEGIS ──────────────────────────────────────────────────────────────

    const aegis = mgr.aegis;
    if (aegis) {
      aegis.on('threat:detected', (t) => this._broadcast('/aegis', 'aegis:alert', t));
      aegis.on('threat:critical', (t) => {
        this._broadcast('/aegis',         'aegis:critical',  t);
        this._broadcast('/agent-runtime', 'aegis:critical',  t); // cross-room para HITL
      });
    }
  }

  // ─── API PÚBLICA ──────────────────────────────────────────────────────────

  /** Emitir HITL request a clientes /agent-runtime */
  broadcastHITL(taskId, context) {
    this._broadcast('/agent-runtime', 'hitl:new', {
      taskId, context,
      requestedAt: new Date().toISOString(),
    });
  }

  /** Emitir notificación de compliance */
  broadcastCompliance(data) {
    this._broadcast('/compliance', 'compliance:update', data);
    this._broadcast('/agent-runtime', 'compliance:update', data);
  }

  /** Emitir a una room */
  _broadcast(room, type, data) {
    const clients = this._rooms.get(room);
    if (!clients || clients.size === 0) return;
    const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(msg, err => { if (err) clients.delete(ws); });
      }
    }
  }

  _broadcastEvent(room, type, data) {
    this._broadcast(room, 'tokenomics:event', { type, ...data });
  }

  _send(ws, type, data) {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
  }

  // ─── KEEPALIVE ────────────────────────────────────────────────────────────

  startPing() {
    return setInterval(() => {
      for (const [, clients] of this._rooms) {
        for (const ws of clients) {
          if (!ws.isAlive) { ws.terminate(); clients.delete(ws); continue; }
          ws.isAlive = false;
          ws.ping();
        }
      }
    }, 30_000);
  }

  get stats() {
    const result = {};
    for (const [room, clients] of this._rooms) {
      result[room] = clients.size;
    }
    return result;
  }
}

module.exports = BeZhasWebSocketServer;
