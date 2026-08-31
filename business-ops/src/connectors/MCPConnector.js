'use strict';

const { spawn } = require('child_process');
const BaseConnector = require('./BaseConnector');

/**
 * MCPConnector — puente al ecosistema Model Context Protocol.
 *
 * MCP es el estándar (2025-2026) con el que CRMs, ERPs y miles de herramientas
 * exponen sus acciones a agentes de IA. Este conector habla el protocolo
 * directamente (JSON-RPC 2.0 sobre stdio, sin dependencias): OPERANT puede
 * enchufar cualquier servidor MCP como un conector más — y como todo conector,
 * cada invocación pasa por PolicyEngine/RedLines/HITL antes de ejecutarse.
 *
 *   const crm = new MCPConnector({
 *     tenantId,
 *     config: {
 *       name: 'twenty',                       // nombre del conector/categoría
 *       command: 'npx',                       // proceso del servidor MCP
 *       args: ['-y', 'twenty-mcp-server'],
 *       env: { TWENTY_API_KEY: '...' },
 *       policyCategory: 'external',           // categoría para PolicyEngine
 *     },
 *   });
 *
 * También soporta transporte HTTP (Streamable HTTP, spec 2025-03-26) para
 * servidores MCP remotos como Microsoft Learn:
 *
 *   const learn = new MCPConnector({
 *     tenantId,
 *     config: {
 *       name: 'microsoft-learn',
 *       url: 'https://learn.microsoft.com/api/mcp',
 *       policyCategory: 'external_read',
 *     },
 *   });
 *
 * Los agentes lo usan igual que siempre: connector.execute(tool, args), y con
 * describeTools() el bucle agéntico (thinkAndAct) expone al modelo las
 * herramientas reales del servidor con sus esquemas.
 */
class MCPConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = config.name || 'mcp';
    this.policyCategory = config.policyCategory || 'external';
    this.command = config.command;
    this.args = config.args || [];
    this.env = config.env || {};
    this.timeoutMs = config.timeoutMs || 30_000;

    // Transporte HTTP (spec 2025-03-26 Streamable HTTP). Si hay `url`, se usa
    // en lugar de stdio; el resto del contrato (execute/describeTools) no cambia.
    this.url = config.url || '';
    this.headers = config.headers || {};
    this._fetch = config.fetch || globalThis.fetch;
    this._sessionId = null;

    this._proc = null;
    this._nextId = 1;
    this._pending = new Map(); // id -> { resolve, reject, timer }
    this._buffer = '';
    this._tools = null;        // caché de tools/list
    this._initialized = null;  // promesa del handshake
  }

  get transport() { return this.url ? 'http' : 'stdio'; }

  // ── Ciclo de vida ──────────────────────────────────────────────

  /** Arranca el proceso del servidor MCP y hace el handshake initialize. */
  async connect() {
    if (this._initialized) return this._initialized;
    if (this.transport === 'http') {
      this._initialized = this._connectHttp();
      return this._initialized;
    }
    if (!this.command) throw new Error(`${this.name}: config.command o config.url requerido`);

    // En Windows, npx/uvx/npm son .cmd y necesitan shell; los binarios (.exe,
    // node) NO — y con shell, una ruta con espacios sin comillas rompería.
    const needsShell = this.config.shell ?? (
      process.platform === 'win32' &&
      (/\.(cmd|bat)$/i.test(this.command) || ['npx', 'uvx', 'npm', 'pnpm', 'yarn'].includes(this.command))
    );
    this._proc = spawn(needsShell ? `"${this.command}"` : this.command, this.args, {
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: needsShell,
    });
    this._proc.stdout.on('data', (chunk) => this._onData(chunk));
    this._proc.on('exit', (code) => this._onExit(code));
    this._proc.on('error', (err) => this._failAll(err));

    this._initialized = (async () => {
      await this._request('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'operant', version: '0.1.0' },
      });
      this._notify('notifications/initialized', {});
      return true;
    })();
    return this._initialized;
  }

  async disconnect() {
    if (this._proc) {
      this._proc.kill();
      this._proc = null;
    }
    this._sessionId = null;
    this._initialized = null;
    this._tools = null;
    this._failAll(new Error(`${this.name}: desconectado`));
    return true;
  }

  // ── Transporte HTTP (Streamable HTTP) ──────────────────────────
  async _connectHttp() {
    const initRes = await this._httpRpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'operant', version: '0.1.0' },
    });
    // El servidor puede devolver `Mcp-Session-Id` para stickiness.
    this._sessionId = initRes.__sessionId || null;
    // Notificación initialized (sin respuesta esperada).
    await this._httpRpc('notifications/initialized', {}, { notification: true }).catch(() => {});
    return initRes.__body;
  }

  async _httpRpc(method, params, { notification = false } = {}) {
    const body = notification
      ? { jsonrpc: '2.0', method, params }
      : { jsonrpc: '2.0', id: this._nextId++, method, params };
    const headers = {
      'Content-Type': 'application/json',
      // El spec exige aceptar ambos: JSON directo o SSE en streaming.
      Accept: 'application/json, text/event-stream',
      ...this.headers,
    };
    if (this._sessionId) headers['Mcp-Session-Id'] = this._sessionId;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res;
    try {
      res = await this._fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    } finally { clearTimeout(timer); }

    if (notification) return {};
    if (!res.ok) throw new Error(`${this.name}: HTTP ${res.status}`);

    // El servidor puede responder JSON directo o SSE con un evento `message`.
    const sessionId = res.headers?.get?.('mcp-session-id') || null;
    const ctype = (res.headers?.get?.('content-type') || '').toLowerCase();
    let payload;
    if (ctype.includes('text/event-stream')) {
      const text = await res.text();
      // Extrae la primera línea `data: {...}` (mensaje único, no streaming largo).
      const line = text.split('\n').find((l) => l.startsWith('data:'));
      if (!line) throw new Error(`${this.name}: SSE sin data`);
      payload = JSON.parse(line.slice(5).trim());
    } else {
      payload = await res.json();
    }
    if (payload.error) throw new Error(`${this.name}: ${payload.error.message || 'error JSON-RPC'}`);
    return { __body: payload.result || {}, __sessionId: sessionId, ...(payload.result || {}) };
  }

  // ── Contrato de conector ───────────────────────────────────────

  /** Ejecuta una herramienta del servidor MCP: execute(toolName, args). */
  async execute(method, args = {}) {
    await this.connect();
    const result = this.transport === 'http'
      ? (await this._httpRpc('tools/call', { name: method, arguments: args })).__body
      : await this._request('tools/call', { name: method, arguments: args });
    // Normaliza la respuesta MCP a algo directamente útil para los agentes.
    const text = (result.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    if (result.isError) throw new Error(`${this.name}.${method}: ${text || 'error del servidor MCP'}`);
    return { ok: true, text, structured: result.structuredContent ?? null };
  }

  /**
   * Herramientas reales del servidor (para el tool-use del modelo).
   * @returns {Promise<Array<{name, description, input_schema}>>}
   */
  async describeTools() {
    await this.connect();
    if (this._tools) return this._tools;
    const result = this.transport === 'http'
      ? (await this._httpRpc('tools/list', {})).__body
      : await this._request('tools/list', {});
    this._tools = (result.tools || []).map((t) => ({
      name: t.name,
      description: t.description || '',
      input_schema: t.inputSchema || { type: 'object' },
    }));
    return this._tools;
  }

  // ── JSON-RPC sobre stdio (transporte estándar de MCP) ──────────

  _request(method, params) {
    const id = this._nextId++;
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`${this.name}: timeout en ${method} (${this.timeoutMs}ms)`));
      }, this.timeoutMs);
      this._pending.set(id, { resolve, reject, timer });
      this._proc.stdin.write(msg + '\n');
    });
  }

  _notify(method, params) {
    this._proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  /** Mensajes delimitados por línea; puede llegar más de uno por chunk. */
  _onData(chunk) {
    this._buffer += chunk.toString('utf8');
    let idx;
    while ((idx = this._buffer.indexOf('\n')) >= 0) {
      const line = this._buffer.slice(0, idx).trim();
      this._buffer = this._buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; } // línea no-JSON (logs del server)
      if (msg.id === undefined || !this._pending.has(msg.id)) continue; // notificación/desconocido
      const p = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(`${this.name}: ${msg.error.message || 'error JSON-RPC'}`));
      else p.resolve(msg.result || {});
    }
  }

  _onExit(code) {
    this._failAll(new Error(`${this.name}: el servidor MCP terminó (código ${code})`));
    this._initialized = null;
  }

  _failAll(err) {
    for (const [, p] of this._pending) { clearTimeout(p.timer); p.reject(err); }
    this._pending.clear();
  }
}

module.exports = MCPConnector;
