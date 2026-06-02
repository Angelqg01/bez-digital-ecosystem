/**
 * OpenClawClient.js
 * Cliente HTTP unificado para el backend OpenClaw
 *
 * - Inyecta automáticamente el JWT Manager en cada request
 * - Enruta a la plataforma correcta (blockchain / web3)
 * - Retry con backoff en errores transitorios
 * - Circuit breaker por plataforma
 */

'use strict';

const http   = require('http');
const https  = require('https');
const config = require('./ConfigManager');
const token  = require('./TokenManager');

// ─── Circuit breaker por plataforma ──────────────────────────────────────────
const circuitState = {
  blockchain: { failures: 0, openUntil: 0, state: 'closed' },
  web3:       { failures: 0, openUntil: 0, state: 'closed' },
};
const CIRCUIT_THRESHOLD = 5;    // fallos antes de abrir
const CIRCUIT_RESET_MS  = 30_000;

// ─── Constantes ───────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES        = 3;
const RETRY_STATUS       = new Set([408, 429, 502, 503, 504]);

// ─── Request base ──────────────────────────────────────────────────────────────
function rawRequest(baseUrl, path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url    = new URL(path, baseUrl);
    const lib    = url.protocol === 'https:' ? https : http;
    const method = options.method || 'GET';

    const bodyStr = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'BeZhas-OpenClaw/2.0',
        ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
        ...options.headers,
      },
    };

    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try   { data = JSON.parse(raw); }
        catch { data = raw; }
        resolve({
          ok:     res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(options.timeout || DEFAULT_TIMEOUT_MS, () => {
      req.destroy(new Error(`Timeout después de ${options.timeout || DEFAULT_TIMEOUT_MS}ms`));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Lógica de retry ─────────────────────────────────────────────────────────
async function withRetry(fn, maxRetries = MAX_RETRIES) {
  let lastErr;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await fn();
      if (result.ok || !RETRY_STATUS.has(result.status)) return result;
      lastErr = new Error(`HTTP ${result.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < maxRetries) {
      await new Promise(r => setTimeout(r, 500 * (2 ** i) + Math.random() * 100));
    }
  }
  throw lastErr;
}

// ─── Circuit breaker ─────────────────────────────────────────────────────────
function checkCircuit(platform) {
  const cb = circuitState[platform];
  if (!cb) return;

  if (cb.state === 'open') {
    if (Date.now() > cb.openUntil) {
      cb.state    = 'half-open';
      cb.failures = 0;
    } else {
      throw new Error(`Circuito abierto para plataforma '${platform}' — reintentando en ${Math.round((cb.openUntil - Date.now()) / 1000)}s`);
    }
  }
}

function recordSuccess(platform) {
  const cb = circuitState[platform];
  if (!cb) return;
  cb.failures = 0;
  cb.state    = 'closed';
}

function recordFailure(platform) {
  const cb = circuitState[platform];
  if (!cb) return;
  cb.failures++;
  if (cb.failures >= CIRCUIT_THRESHOLD) {
    cb.state    = 'open';
    cb.openUntil = Date.now() + CIRCUIT_RESET_MS;
    console.warn(`[OpenClawClient] ⚡ Circuito ABIERTO para '${platform}' hasta ${new Date(cb.openUntil).toISOString()}`);
  }
}

// ─── Cliente unificado ────────────────────────────────────────────────────────
class OpenClawClient {
  constructor(platform = 'blockchain') {
    this.platform = platform;
  }

  // ── Obtener la URL base de la plataforma ────────────────────────────────────
  async _baseUrl() {
    await config.load();
    const pCfg = config.getPlatformConfig(this.platform);
    return pCfg?.baseUrl || config.getUnifiedApiUrl();
  }

  // ── Request autenticado ─────────────────────────────────────────────────────
  async request(method, path, body = null, options = {}) {
    checkCircuit(this.platform);

    const [baseUrl, jwt] = await Promise.all([
      this._baseUrl(),
      token.getToken(),
    ]);

    const headers = {
      Authorization:         `Bearer ${jwt}`,
      'X-BeZhas-Platform':   this.platform,
      'X-BeZhas-Version':    '2.0',
      ...options.headers,
    };

    try {
      const res = await withRetry(
        () => rawRequest(baseUrl, path, { method, headers, timeout: options.timeout }, body),
        options.maxRetries ?? MAX_RETRIES,
      );

      recordSuccess(this.platform);

      if (!res.ok && !options.allowErrors) {
        const msg = res.data?.message || res.data?.error || `HTTP ${res.status}`;
        throw Object.assign(new Error(msg), { status: res.status, response: res.data });
      }

      return res;
    } catch (err) {
      recordFailure(this.platform);
      throw err;
    }
  }

  // ── Métodos HTTP ─────────────────────────────────────────────────────────────
  get    (path,       opts) { return this.request('GET',    path, null, opts); }
  post   (path, body, opts) { return this.request('POST',   path, body, opts); }
  put    (path, body, opts) { return this.request('PUT',    path, body, opts); }
  patch  (path, body, opts) { return this.request('PATCH',  path, body, opts); }
  delete (path,       opts) { return this.request('DELETE', path, null, opts); }

  // ── Métodos de negocio BeZhas ─────────────────────────────────────────────────

  async health() {
    const pCfg = config.getPlatformConfig(this.platform);
    const hPath = pCfg?.healthPath || '/health';
    return this.get(hPath, { allowErrors: true, maxRetries: 0 });
  }

  async getSkillStatus(skillName) {
    return this.get(`/api/skills/${encodeURIComponent(skillName)}/status`);
  }

  async invokeSkill(skillName, payload) {
    return this.post(`/api/skills/${encodeURIComponent(skillName)}/invoke`, payload);
  }

  async syncSkills(skillsConfig) {
    return this.post('/api/skills/sync', { skills: skillsConfig });
  }

  async getCircuitStatus() {
    return structuredClone(circuitState[this.platform] || {});
  }
}

// ─── Instancias pre-construidas ───────────────────────────────────────────────
const blockchainClient = new OpenClawClient('blockchain');
const web3Client       = new OpenClawClient('web3');

/**
 * Cliente unificado — opera sobre ambas plataformas en paralelo
 * cuando la operación debe aplicarse a las dos.
 */
const unifiedClient = {
  blockchain: blockchainClient,
  web3:       web3Client,

  /** Ejecuta fn en ambas plataformas concurrentemente; devuelve { blockchain, web3 } */
  async both(fn) {
    const [bc, w3] = await Promise.allSettled([
      fn(blockchainClient),
      fn(web3Client),
    ]);
    return {
      blockchain: bc.status === 'fulfilled' ? bc.value : { error: bc.reason?.message },
      web3:       w3.status === 'fulfilled' ? w3.value : { error: w3.reason?.message },
    };
  },

  /** Health de ambas plataformas */
  async healthAll() {
    return this.both(client => client.health());
  },

  /** Sincroniza skills en ambas plataformas */
  async syncSkillsAll(skillsConfig) {
    return this.both(client => client.syncSkills(skillsConfig));
  },
};

module.exports        = unifiedClient;
module.exports.OpenClawClient = OpenClawClient;
module.exports.blockchainClient = blockchainClient;
module.exports.web3Client       = web3Client;
