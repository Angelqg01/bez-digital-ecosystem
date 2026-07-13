/**
 * middleware/openclawAuth.js
 * Middleware Express para inyección automática del JWT Manager OpenClaw
 *
 * Uso en BeZhas_Blockchain:
 *   app.use('/api', openclawAuth.inject);
 *
 * Uso en BeZhas_web3:
 *   app.use('/api', openclawAuth.inject);
 *
 * Ambas plataformas usan el mismo ConfigManager → mismo token.
 */

'use strict';

const config = require('../lib/ConfigManager');
const token  = require('../lib/TokenManager');

// ─── Middleware de inyección de token ─────────────────────────────────────────
async function inject(req, res, next) {
  try {
    await config.load();
    const jwt = await token.getToken();

    // Enriquecer el request con contexto OpenClaw
    req.openClaw = {
      token:    jwt,
      apiUrl:   config.getUnifiedApiUrl(),
      platform: _detectPlatform(req),
    };

    // Headers de salida para el backend
    req.headers['x-openclaw-token']    = jwt;
    req.headers['x-bezhas-platform']   = req.openClaw.platform;

    next();
  } catch (err) {
    next(err);
  }
}

// ─── Middleware de verificación para rutas protegidas ─────────────────────────
async function requireManager(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido', code: 'NO_TOKEN' });
  }

  const incomingToken = authHeader.slice(7);
  const status = await token.verifyToken(incomingToken);

  if (!status.valid) {
    return res.status(401).json({ error: 'Token inválido o expirado', reason: status.reason });
  }

  // Verificación híbrida: ECDSA ya validada arriba + Dilithium3 PQC
  const pqcResult = token.verifyPqc(incomingToken);
  if (!pqcResult.valid) {
    return res.status(401).json({
      error:  'Firma post-cuántica inválida',
      reason: pqcResult.reason,
      code:   'PQC_INVALID',
    });
  }

  if (!status.roles?.includes('manager') && !status.roles?.includes('admin')) {
    return res.status(403).json({ error: 'Rol Manager requerido', roles: status.roles });
  }

  req.openClawManager = { ...status, pqcVerified: true };
  next();
}

// ─── Rate limiter simple por token ───────────────────────────────────────────
const _rateLimits = new Map();   // token → { count, resetAt }

function rateLimit(maxReq = 100, windowMs = 60_000) {
  return function openclawRateLimit(req, res, next) {
    const key   = req.openClaw?.token?.slice(-16) || req.ip;
    const now   = Date.now();
    let   entry = _rateLimits.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      _rateLimits.set(key, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit',     maxReq);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxReq - entry.count));
    res.setHeader('X-RateLimit-Reset',     new Date(entry.resetAt).toISOString());

    if (entry.count > maxReq) {
      return res.status(429).json({
        error:    'Rate limit excedido',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    next();
  };
}

// ─── Health check handler ────────────────────────────────────────────────────
async function healthHandler(req, res) {
  await config.load();
  const tokenStatus  = token.getStatus();
  const configStatus = config.getSafe();

  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    platform:  _detectPlatform(req),
    token: {
      hasToken:    tokenStatus.hasToken,
      expiresIn:   tokenStatus.expiresIn,
      needsRefresh: tokenStatus.needsRefresh,
    },
    config: {
      apiUrl:       configStatus.apiUrl,
      adminToken:   configStatus.adminToken,   // ya sanitizado por getSafe()
      skillsCount:  Object.keys(configStatus.skills?.entries || {}).length,
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _detectPlatform(req) {
  const explicit = req.headers['x-bezhas-platform'];
  if (explicit) return explicit;

  const host = req.headers.host || '';
  if (host.includes('3001') || host.includes('blockchain')) return 'blockchain';
  if (host.includes('3002') || host.includes('web3'))       return 'web3';
  return 'unknown';
}

module.exports = { inject, requireManager, rateLimit, healthHandler };
