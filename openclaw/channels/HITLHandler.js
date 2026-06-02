/**
 * BeZhas Agent Runtime — HITLHandler
 * Intercepta peticiones Human-in-the-Loop del AgentManager
 * y las envía al canal de Telegram como botones inline.
 *
 * Flujo:
 *   AgentManager.requestHumanApproval(taskId, context)
 *      ↓
 *   OpenClawConnector.sendHITLRequest(...)  ← llama al endpoint HTTP
 *      ↓
 *   HITLHandler.handle(taskId, context)    ← interceptado aquí
 *      ↓
 *   ChannelRouter.sendHITLToTelegram()
 *      ↓
 *   Usuario ve botones ✅ / ❌ en Telegram
 *      ↓
 *   TelegramChannel._processCallbackQuery()
 *      ↓
 *   AgentManager.resolveHITL(taskId, approved)
 */

'use strict';

const http = require('http');

class HITLHandler {
  /**
   * @param {ChannelRouter} router
   * @param {AgentManager} manager
   * @param {object} opts
   */
  constructor(router, manager, opts = {}) {
    this.router  = router;
    this.manager = manager;
    this.port    = opts.port || parseInt(process.env.HITL_PORT || '3099');
    this._server = null;
  }

  // ─────────────────────────────────────────────
  // HTTP SERVER — recibe peticiones del OpenClawConnector
  // ─────────────────────────────────────────────

  async start() {
    this._server = http.createServer(async (req, res) => {
      const body = await this._readBody(req);

      // POST /hitl/request — AgentManager solicita confirmación
      if (req.method === 'POST' && req.url === '/hitl/request') {
        return this._handleRequest(res, body);
      }

      // POST /hitl/approve/:taskId — callback API (alternativa a Telegram)
      if (req.method === 'POST' && req.url?.startsWith('/hitl/approve/')) {
        const taskId = req.url.replace('/hitl/approve/', '');
        return this._handleResolve(res, taskId, true, body.response);
      }

      // POST /hitl/reject/:taskId
      if (req.method === 'POST' && req.url?.startsWith('/hitl/reject/')) {
        const taskId = req.url.replace('/hitl/reject/', '');
        return this._handleResolve(res, taskId, false, body.response);
      }

      // GET /hitl/pending — lista confirmaciones pendientes
      if (req.method === 'GET' && req.url === '/hitl/pending') {
        return this._handlePending(res);
      }

      this._json(res, 404, { error: 'Not found' });
    });

    await new Promise(resolve => this._server.listen(this.port, resolve));
    console.log(`[HITLHandler] 👤 HITL server escuchando en :${this.port}`);
  }

  async stop() {
    if (this._server) {
      await new Promise(resolve => this._server.close(resolve));
      console.log('[HITLHandler] 🛑 HITL server detenido');
    }
  }

  // ─────────────────────────────────────────────
  // HANDLERS HTTP
  // ─────────────────────────────────────────────

  async _handleRequest(res, body) {
    const { task_id, context } = body;
    if (!task_id) return this._json(res, 400, { error: 'task_id requerido' });

    console.log(`[HITLHandler] 📨 HITL request recibida: ${task_id}`);

    try {
      // Enviar a Telegram via ChannelRouter
      await this.router.sendHITLToTelegram(task_id, context);
      this._json(res, 200, { ok: true, taskId: task_id, channel: 'telegram' });
    } catch (err) {
      console.error('[HITLHandler] ❌ Error enviando a Telegram:', err.message);
      this._json(res, 500, { error: err.message });
    }
  }

  async _handleResolve(res, taskId, approved, response = '') {
    console.log(`[HITLHandler] ✅ Resolución API: ${taskId} → ${approved ? 'APROBADO' : 'RECHAZADO'}`);
    const ok = await this.manager.resolveHITL(taskId, approved, response);
    this._json(res, 200, { ok, taskId, approved });
  }

  async _handlePending(res) {
    const pending = await this.manager.memory.listPendingHITL().catch(() => []);
    this._json(res, 200, { pending, count: pending.length });
  }

  // ─────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────

  _json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  _readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data || '{}')); }
        catch { resolve({}); }
      });
      req.on('error', reject);
    });
  }
}

module.exports = HITLHandler;
