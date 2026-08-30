'use strict';

/**
 * middleware/admin-auth.js — Puerta única del panel SuperAdmin.
 *
 * Existe porque `/api/admin-config` se montaba pelado: sin auth global en la
 * app, cualquiera podía leer y ESCRIBIR la wallet de Treasury, el safeWallet,
 * los límites diarios de gasto, el quorum de la DAO y el prompt SOUL de
 * OpenClaw con un solo curl.
 *
 * No reutiliza `authenticateToken` de security.js a propósito: ese acepta
 * cualquier JWT firmado con el secreto compartido (incluido el de un usuario
 * normal) y exige `role === 'admin'`, mientras que admin-auth.js emite
 * `role: 'SUPER_ADMIN'` con `issuer: 'bezhas-admin-auth'`. Validar el issuer
 * aquí es lo que impide que un token de usuario corriente —o uno del gateway—
 * sirva para entrar al panel.
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/secrets');

const ADMIN_ISSUER = 'bezhas-admin-auth';
const ADMIN_COOKIE = 'bezhas_admin_token';

/**
 * El token viaja en la cookie HttpOnly que pone /admin-auth/login. Se acepta
 * también el header Authorization para clientes no-navegador (curl, scripts de
 * operación), pero la cookie es el camino normal del panel.
 */
function extractAdminToken(req) {
  const fromCookie = req.cookies?.[ADMIN_COOKIE];
  if (fromCookie) return fromCookie;
  const header = req.headers['authorization'];
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

/** Verifica el token de admin. Devuelve el payload o null. Nunca lanza. */
function verifyAdminToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: ADMIN_ISSUER,
      algorithms: ['HS256'],   // sin esto se abre la confusión de algoritmo
    });
    return decoded.role === 'SUPER_ADMIN' ? decoded : null;
  } catch {
    return null;
  }
}

/** Middleware Express: corta con 401 si no hay sesión SuperAdmin válida. */
function requireSuperAdmin(req, res, next) {
  const decoded = verifyAdminToken(extractAdminToken(req));
  if (!decoded) {
    return res.status(401).json({
      error: 'Sesión SuperAdmin requerida',
      code: 'ADMIN_AUTH_REQUIRED',
    });
  }
  req.admin = decoded;
  next();
}

module.exports = { requireSuperAdmin, verifyAdminToken, extractAdminToken, ADMIN_COOKIE, ADMIN_ISSUER };
