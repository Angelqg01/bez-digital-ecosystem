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
const jwt                 = require('jsonwebtoken');
const { JWT_SECRET, AUTH_BYPASS } = require('./config/secrets');
const apiPQC              = require('./lib/apiPQC');

// ─── Requisitos de rol por room ────────────────────────────────────────────
// null = cualquier usuario autenticado
const ROOM_ROLES = {
  '/agent-runtime': ['admin', 'manager', 'operator'],
  '/tokenomics':    null,
  '/aegis':         ['admin', 'manager'],
  '/compliance':    ['admin', 'manager', 'compliance'],
};

// ─── Verificación JWT + PQC para el handshake WebSocket ───────────────────
function verifyWsToken(token, pqcSig, pqcPub) {
  if (!token) return { ok: false, reason: 'no-token' };

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return { ok: false, reason: `jwt-invalid: ${err.message}` };
  }

  // Verificación PQC out-of-band: sig en query ?pqcSig=&pqcPub= (opcional, legacy pasa)
  const pqcResult = pqcSig && pqcPub
    ? apiPQC.verifyToken(token, pqcSig, pqcPub)
    : { valid: false, reason: 'no-pqc-params' };

  if (pqcSig && pqcPub && !pqcResult.valid) {
    return { ok: false, reason: `pqc-invalid: ${pqcResult.reason}` };
  }

  return { ok: true, user, pqcVerified: pqcResult.valid };
}

class BeZhasWebSocketServer {
  constructor(httpServer, manager) {
    this.manager = manager;
    this._rooms  = new Map();
    for (const room of Object.keys(ROOM_ROLES)) this._rooms.set(room, new Set());

    this._wss = new WebSocketServer({
      server: httpServer,
      // ── Autenticación en el handshake HTTP Upgrade ─────────────────────
      verifyClient: ({ req }, cb) => {
        // Dev bypass: aceptar sin token (solo si AUTH_BYPASS activo)
        if (AUTH_BYPASS) {
          req._wsUser = { address: '0xDev', userId: 0, role: 'admin' };
          req._wsPqcVerified = false;
          return cb(true);
        }

        const parsed = url.parse(req.url, true);
        const token  = parsed.query.token
          || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const { sig: pqcSig, pub: pqcPub } = apiPQC.extractFromQuery(parsed.query);

        const result = verifyWsToken(token, pqcSig, pqcPub);
        if (!result.ok) {
          console.warn(`[WebSocket] Conexión rechazada: ${result.reason} — ${req.socket?.remoteAddress}`);
          return cb(false, 401, result.reason);
        }

        // Verificar rol para la room solicitada
        const path     = parsed.pathname || '/agent-runtime';
        const roomKey  = path in ROOM_ROLES ? path : '/agent-runtime';
        const required = ROOM_ROLES[roomKey];
        if (required !== null && !required.includes(result.user.role)) {
          console.warn(`[WebSocket] Acceso denegado a ${path} — rol '${result.user.role}' insuficiente`);
          return cb(false, 403, `role-required: ${required.join('|')}`);
        }

        req._wsUser       = result.user;
        req._wsPqcVerified = result.pqcVerified;
        cb(true);
      },
    });

    this._wss.on('connection', (ws, req) => this._onConnection(ws, req));
    this._wireManagerEvents();
    console.log('[WebSocket] Server iniciado con autenticación JWT+PQC');
  }

  // ─── CONEXIÓN ─────────────────────────────────────────────────────────────

  _onConnection(ws, req) {
    const parsed = url.parse(req.url);
    const path   = parsed.pathname || '/agent-runtime';
    const room   = this._rooms.has(path) ? path : '/agent-runtime';

    // Adjuntar identidad al socket
    ws.user        = req._wsUser;
    ws.pqcVerified = req._wsPqcVerified;
    ws.room        = room;

    this._rooms.get(room).add(ws);
    console.log(`[WebSocket] Conectado → ${room} | user:${ws.user?.userId} pqc:${ws.pqcVerified} (total: ${this._rooms.get(room).size})`);

    // Enviar estado inicial al conectarse
    this._sendInitialState(ws, room);

    ws.on('close', () => {
      this._rooms.get(room)?.delete(ws);
      console.log(`[WebSocket] Desconectado (${room}) | user:${ws.user?.userId}`);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error de cliente:', err.message);
    });

    // Ping/pong keepalive
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
