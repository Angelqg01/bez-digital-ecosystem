/**
 * TokenManager.js
 * Gestión del ciclo de vida del JWT Manager (adminToken)
 *
 * - Una sola cuenta Manager para BeZhas_Blockchain + BeZhas_web3
 * - Auto-refresh antes de expiración
 * - Cache en memoria (no en disco por seguridad)
 * - Reintento automático con backoff exponencial
 */

'use strict';

const https  = require('https');
const http   = require('http');
const config = require('./ConfigManager');
const pqc    = require('./PQCManager');

// ─── Estado ───────────────────────────────────────────────────────────────────
let _token         = null;    // JWT activo en memoria
let _tokenExp      = 0;       // timestamp de expiración (ms)
let _refreshTimer  = null;
let _refreshing    = null;    // Promise en vuelo (evita refrescos paralelos)

const REFRESH_MARGIN_MS  = 5 * 60 * 1000;   // refrescar 5 min antes de expirar
const MAX_RETRIES        = 3;
const RETRY_BASE_MS      = 500;

// ─── PQC: inicializar Dilithium3 al arrancar ──────────────────────────────────
// La seed puede venir de ENV (hex 64 chars). Si no, se genera aleatoria en memoria.
// NUNCA se persiste a disco — solo vive en este proceso.
pqc.init(process.env.BEZHAS_PQC_SEED || undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Decodifica payload JWT sin verificar firma (solo lectura de exp) */
function decodeJwtPayload(jwt) {
  try {
    const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/** Solicitud HTTP/HTTPS simple (sin axios ni node-fetch para mínimas deps) */
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const lib    = url.startsWith('https') ? https : http;
    const parsed = new URL(url);
    const opts   = {
      hostname: parsed.hostname,
      port:     parsed.port || (url.startsWith('https') ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  { 'Content-Type': 'application/json', ...options.headers },
    };

    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/** Backoff exponencial con jitter */
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const delay = RETRY_BASE_MS * (2 ** attempt) + Math.random() * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Devuelve el token activo.
 * Si está a punto de expirar, lo renueva de forma transparente.
 * Lanza si no hay token configurado y no se puede obtener uno.
 */
async function getToken() {
  await config.load();

  // Usar el token configurado estáticamente (adminToken del .json / ENV)
  const staticToken = config.getAdminToken();
  if (staticToken && !_token) {
    _token = staticToken;
    const payload = decodeJwtPayload(staticToken);
    _tokenExp = payload?.exp ? payload.exp * 1000 : Date.now() + 24 * 3600 * 1000;
    _scheduleRefresh();
  }

  // Refrescar si está próximo a expirar
  if (_token && _needsRefresh()) {
    await refreshToken();
  }

  if (!_token) throw new Error('TokenManager: no hay adminToken disponible');

  return _token;
}

/**
 * Fuerza renovación del JWT llamando al endpoint de refresh.
 * Múltiples llamadas simultáneas comparten la misma Promise.
 */
async function refreshToken() {
  if (_refreshing) return _refreshing;

  _refreshing = retryWithBackoff(async () => {
    const apiUrl = config.getUnifiedApiUrl();
    const res = await httpRequest(
      `${apiUrl}/auth/refresh`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${_token}` },
      },
    );

    if (res.status !== 200) {
      throw new Error(`Token refresh falló: HTTP ${res.status} — ${JSON.stringify(res.body)}`);
    }

    const newToken = res.body?.token || res.body?.accessToken;
    if (!newToken) throw new Error('Token refresh: respuesta sin token');

    _setToken(newToken);
    return newToken;
  });

  try    { return await _refreshing; }
  finally { _refreshing = null; }
}

/**
 * Login inicial: obtiene un token nuevo con credenciales.
 * Alternativa cuando no hay token previo.
 */
async function login(credentials) {
  await config.load();
  const apiUrl = config.getUnifiedApiUrl();

  return retryWithBackoff(async () => {
    const res = await httpRequest(
      `${apiUrl}/auth/login`,
      { method: 'POST' },
      credentials,
    );

    if (res.status !== 200) {
      throw new Error(`Login falló: HTTP ${res.status} — ${JSON.stringify(res.body)}`);
    }

    const token = res.body?.token || res.body?.accessToken;
    if (!token) throw new Error('Login: respuesta sin token');

    _setToken(token);

    // Persistir en config
    config.set('adminToken', token);

    return token;
  });
}

/** Revoca el token activo en el servidor y lo borra localmente */
async function logout() {
  if (!_token) return;

  try {
    const apiUrl = config.getUnifiedApiUrl();
    await httpRequest(
      `${apiUrl}/auth/logout`,
      { method: 'POST', headers: { Authorization: `Bearer ${_token}` } },
    );
  } catch { /* ignorar errores de red en logout */ }

  _clearToken();
  config.set('adminToken', '');
}

/**
 * Verifica si el token activo es válido contra el servidor.
 * Devuelve { valid, expiresIn, roles } o { valid: false, reason }.
 */
async function verifyToken(token) {
  const t = token || _token;
  if (!t) return { valid: false, reason: 'Sin token' };

  try {
    const apiUrl = config.getUnifiedApiUrl();
    const res = await httpRequest(
      `${apiUrl}/auth/verify`,
      { method: 'GET', headers: { Authorization: `Bearer ${t}` } },
    );

    if (res.status === 200) {
      const payload = decodeJwtPayload(t);
      return {
        valid:     true,
        expiresIn: payload?.exp ? payload.exp * 1000 - Date.now() : null,
        roles:     payload?.roles || [],
        platforms: payload?.platforms || [],
      };
    }
    return { valid: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/**
 * Verifica la firma PQC (Dilithium3) del token activo o del token provisto.
 * Complementa a verifyToken() que verifica la firma ECDSA vía API.
 * Ambas deben ser válidas para considerar el token íntegro.
 */
function verifyPqc(token) {
  const t = token || _token;
  if (!t) return { valid: false, reason: 'Sin token' };
  return pqc.verifyJwt(t);
}

/** Estado actual del token (para health checks) */
function getStatus() {
  const payload = _token ? decodeJwtPayload(_token) : null;
  return {
    hasToken:    !!_token,
    expiresAt:   _tokenExp ? new Date(_tokenExp).toISOString() : null,
    expiresIn:   _tokenExp ? Math.round((_tokenExp - Date.now()) / 1000) + 's' : null,
    needsRefresh: _needsRefresh(),
    roles:       payload?.roles    || [],
    platforms:   payload?.platforms || [],
    sub:         payload?.sub      || null,
    pqc:         pqc.getStatus(),
  };
}

// ─── Internals ────────────────────────────────────────────────────────────────

function _setToken(jwt) {
  // Añadir firma Dilithium3 al JWT antes de guardarlo en memoria
  const signedJwt = pqc.signJwt(jwt);
  _token    = signedJwt;
  const payload = decodeJwtPayload(signedJwt);
  _tokenExp = payload?.exp ? payload.exp * 1000 : Date.now() + 24 * 3600 * 1000;
  _scheduleRefresh();
}

function _clearToken() {
  _token    = null;
  _tokenExp = 0;
  clearTimeout(_refreshTimer);
  _refreshTimer = null;
}

function _needsRefresh() {
  if (!_token || !_tokenExp) return false;
  return Date.now() >= _tokenExp - REFRESH_MARGIN_MS;
}

function _scheduleRefresh() {
  clearTimeout(_refreshTimer);
  if (!_tokenExp) return;

  const ms = _tokenExp - Date.now() - REFRESH_MARGIN_MS;
  if (ms <= 0) return;

  _refreshTimer = setTimeout(() => {
    refreshToken().catch(err => {
      console.error('[TokenManager] Auto-refresh falló:', err.message);
    });
  }, ms);

  // Evitar que el timer bloquee el proceso al cerrar
  if (_refreshTimer.unref) _refreshTimer.unref();
}

module.exports = { getToken, refreshToken, login, logout, verifyToken, verifyPqc, getStatus };
