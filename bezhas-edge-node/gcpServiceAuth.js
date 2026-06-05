'use strict';

/**
 * Cloud Run service-to-service authentication.
 *
 * The private backends (bezhas-aegis, bezhas-ai-gateway, bezhas-agent-runtime)
 * are deployed with `--no-allow-unauthenticated`, so any call to them must carry
 * a Google-signed OIDC ID token whose audience is the target service URL.
 *
 * This installs a single global axios request interceptor that transparently
 * attaches such a token to outbound requests whose origin matches one of the
 * configured private services. It is a complete no-op in local development
 * (localhost targets) and fails open: if a token cannot be minted the request
 * still proceeds (preserving today's graceful-degradation behaviour).
 */

const axios = require('axios');

let GoogleAuth = null;
try {
  ({ GoogleAuth } = require('google-auth-library'));
} catch (_) {
  // Dependency missing — interceptor degrades to a no-op.
}

const PRIVATE_URL_ENV_VARS = [
  'AEGIS_URL',
  'AEGIS_API_URL',
  'AI_ENGINE_URL',
  'AI_GATEWAY_URL',
  'MCP_URL',
  'AGENT_RUNTIME_URL',
  'BEZHAS_AGENT_RUNTIME_URL',
];

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch (_) {
    return null;
  }
}

function isLocal(origin) {
  return !origin || origin.includes('localhost') || origin.includes('127.0.0.1');
}

function collectPrivateOrigins() {
  const set = new Set();
  for (const name of PRIVATE_URL_ENV_VARS) {
    const origin = originOf(process.env[name]);
    if (origin && !isLocal(origin)) set.add(origin);
  }
  return set;
}

const _clients = new Map();      // origin -> IdTokenClient
const _headerCache = new Map();  // origin -> { auth, exp }

async function authHeaderFor(origin) {
  if (!GoogleAuth) return null;
  const now = Date.now();
  const cached = _headerCache.get(origin);
  if (cached && cached.exp > now) return cached.auth;
  try {
    let client = _clients.get(origin);
    if (!client) {
      client = await new GoogleAuth().getIdTokenClient(origin);
      _clients.set(origin, client);
    }
    const headers = await client.getRequestHeaders();
    const auth = headers.Authorization || headers.authorization || null;
    // ID tokens live ~1h; refresh well before expiry.
    _headerCache.set(origin, { auth, exp: now + 45 * 60 * 1000 });
    return auth;
  } catch (_) {
    return null;
  }
}

let _installed = false;

/**
 * Install the global axios interceptor. Idempotent and safe to call always:
 * with no private origins configured (e.g. local dev) it does nothing.
 */
function install() {
  if (_installed) return;
  const privateOrigins = collectPrivateOrigins();
  if (privateOrigins.size === 0 || !GoogleAuth) return;
  _installed = true;

  axios.interceptors.request.use(async (config) => {
    try {
      const raw = config.url || '';
      const full = /^https?:\/\//i.test(raw) ? raw : `${config.baseURL || ''}${raw}`;
      const origin = originOf(full);
      if (origin && privateOrigins.has(origin)) {
        const auth = await authHeaderFor(origin);
        if (auth) {
          config.headers = config.headers || {};
          config.headers.Authorization = auth;
        }
      }
    } catch (_) {
      // fail open — never block an outbound call on auth wiring
    }
    return config;
  });
}

module.exports = { install, authHeaderFor, collectPrivateOrigins };
