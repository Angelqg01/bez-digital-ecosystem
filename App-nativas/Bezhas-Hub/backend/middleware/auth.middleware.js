const jwt = require('jsonwebtoken');
const User = require('../models/pg/User');
const { UserRole } = require('../models/mockModels');
const mongoose = require('mongoose');
const { JWT_SECRET } = require('../config/authSecrets');

// Load Super Admin Wallets from environment
const SUPER_ADMIN_WALLETS = (process.env.SUPER_ADMIN_WALLETS || '')
  .split(',')
  .map(addr => addr.trim().toLowerCase())
  .filter(Boolean);

// Load Admin Wallets from environment
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
  .split(',')
  .map(addr => addr.trim().toLowerCase())
  .filter(Boolean);

/**
 * Check if a wallet address is a Super Admin
 */
function isSuperAdmin(walletAddress) {
  if (!walletAddress) return false;
  return SUPER_ADMIN_WALLETS.includes(walletAddress.toLowerCase());
}

/**
 * Ensure Super Admin role for whitelisted wallets
 * This function is called during login/auth to auto-upgrade Super Admins and Admins to VIP
 */
async function ensureSuperAdminRole(user) {
  if (!user || !user.walletAddress) return user;

  const wallet = user.walletAddress.toLowerCase();
  const isSuper = SUPER_ADMIN_WALLETS.includes(wallet);
  const isAdminUser = ADMIN_WALLETS.includes(wallet);

  if (isSuper || isAdminUser) {
    let changed = false;

    // Force upgrade to ADMIN if not already
    if (!user.roles || !user.roles.includes('ADMIN')) {
      user.roles = ['USER', 'ADMIN', 'DEVELOPER'];
      changed = true;
    }

    if (!user.isVerified) {
      user.isVerified = true;
      changed = true;
    }

    // Override VIP membership to grant all system capabilities freely
    if (!user.isVIP) {
      user.isVIP = true;
      changed = true;
    }

    if (user.subscription !== 'PREMIUM') {
      user.subscription = 'PREMIUM';
      changed = true;
    }

    if (user.vipTier !== 'platinum') {
      user.vipTier = 'platinum';
      changed = true;
    }

    if (changed) {
      await user.save();
      console.log(`🔐 Admin VIP detected: ${user.walletAddress} - Role upgraded to SUPER_ADMIN & PLATINUM VIP successfully!`);
    }
  }

  return user;
}

/** ¿Está activo el bypass de auth de desarrollo? Nunca en producción. */
function isDevBypassEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.AUTH_BYPASS_ENABLED === 'true';
}

/** Usuario ficticio del bypass. `__devBypass` lo marca para poder distinguirlo. */
function buildDevBypassUser(req) {
  const message = 'Bypassing authentication for development. A mock admin user is being used.';
  if (req.log && req.log.warn) req.log.warn(message);
  else console.warn(message);

  return {
    // Un ObjectId válido para que las consultas de mongoose no lancen CastError.
    _id: new mongoose.Types.ObjectId(),
    walletAddress: '0xDeAdBeEf00000000000000000000000000000001',
    username: 'dev_admin',
    roles: ['ADMIN', 'USER'],
    role: UserRole.ADMIN,
    __devBypass: true,
  };
}

/**
 * Resuelve el usuario autenticado a partir del `Authorization: Bearer`.
 * Devuelve null si no hay token, es inválido o el usuario ya no existe — quien
 * llama decide el código de error. Es el ÚNICO sitio del middleware que
 * establece identidad, para que `protect` y `requireAuth` no puedan divergir.
 */
async function authenticateFromJwt(req) {
  if (isDevBypassEnabled()) return buildDevBypassUser(req);

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer')) return null;

  const token = header.split(' ')[1];
  if (!token) return null;

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    // req.log no siempre existe (rutas montadas antes del logger), así que no
    // se puede llamar directamente: hacerlo convertía un 401 en un 500.
    const log = req.log && req.log.warn ? req.log.warn.bind(req.log) : console.warn;
    log({ err: error }, 'Token verification failed');
    return null;
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) return null;

  // Auto-Upgrade VIP/Admin for whitelisted accounts
  return ensureSuperAdminRole(user);
}

const protect = async (req, res, next) => {
  try {
    const user = await authenticateFromJwt(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authorized, token failed or missing' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal authentication error' });
  }
};

/**
 * Auth para rutas Web3.
 *
 * SEGURIDAD — este middleware autenticaba SÓLO con la cabecera
 * `X-Wallet-Address`: buscaba ese wallet en la BD y, si existía, daba por
 * autenticado a su dueño. La cabecera la pone el cliente, así que cualquiera que
 * conociera una dirección (son públicas: están en el explorador de bloques)
 * podía hacerse pasar por ella. Y como `admin.users.routes.js` monta
 * `requireAuth, requireAdmin`, bastaba con enviar la dirección de un admin para
 * banear usuarios, cambiar contraseñas o listar toda la base de usuarios.
 *
 * Ahora la identidad viene SIEMPRE de un JWT firmado. La cabecera se conserva
 * únicamente como pista y debe coincidir con el usuario autenticado; si no
 * coincide se rechaza, en vez de creerle. El frontend ya mandaba el
 * `Authorization: Bearer` en todas las llamadas (ver interceptor de
 * services/http.js), así que no cambia nada para el cliente legítimo.
 */
async function requireAuth(req, res, next) {
  try {
    const user = await authenticateFromJwt(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: valid authentication token required'
      });
    }

    // La cabecera ya no autentica; sólo se comprueba que no contradiga al token.
    // Un desajuste significa una sesión cruzada o un intento de suplantación.
    const claimedWallet = req.headers['x-wallet-address'] || req.body?.walletAddress;
    if (!user.__devBypass && claimedWallet && user.walletAddress
      && String(claimedWallet).toLowerCase() !== String(user.walletAddress).toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: wallet address does not match the authenticated session'
      });
    }

    // Check if user is banned (Super Admins cannot be banned)
    if (user.isBanned && !isSuperAdmin(user.walletAddress)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Account has been banned'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal authentication error'
    });
  }
}

/**
 * Middleware to verify admin privileges
 */
async function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required'
      });
    }

    // Check if user has admin or developer role
    if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.DEVELOPER) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin privileges required'
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal authorization error'
    });
  }
}

/**
 * Middleware to verify moderator or higher privileges
 */
async function requireModerator(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required'
      });
    }

    const allowedRoles = [UserRole.MODERATOR, UserRole.ADMIN, UserRole.DEVELOPER];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Moderator privileges required'
      });
    }

    next();
  } catch (error) {
    console.error('Moderator middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal authorization error'
    });
  }
}

/**
 * Middleware to verify ownership
 */
function requireOwnership(req, res, next) {
  const resourceWalletAddress = req.params.address || req.params.walletAddress;

  if (!resourceWalletAddress) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request: Resource identifier missing'
    });
  }

  // Allow if user is admin or owns the resource
  if (req.user.role === UserRole.ADMIN ||
    req.user.walletAddress.toLowerCase() === resourceWalletAddress.toLowerCase()) {
    return next();
  }

  res.status(403).json({
    success: false,
    error: 'Forbidden: You do not have permission to access this resource'
  });
}

module.exports = {
  protect,
  authenticateFromJwt,
  requireAuth,
  requireAdmin,
  requireModerator,
  requireOwnership,
  isSuperAdmin,
  ensureSuperAdminRole
};
