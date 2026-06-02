const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { UserRole } = require('../models/mockModels');
const mongoose = require('mongoose');

// Load Super Admin Wallets from environment
const SUPER_ADMIN_WALLETS = (process.env.SUPER_ADMIN_WALLETS || '')
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
 * This function is called during login/auth to auto-upgrade Super Admins
 */
async function ensureSuperAdminRole(user) {
  if (!user || !user.walletAddress) return user;

  if (isSuperAdmin(user.walletAddress)) {
    // Force upgrade to ADMIN if not already
    if (user.role !== UserRole.ADMIN) {
      user.role = UserRole.ADMIN;
      user.isVerified = true;
      await user.save();
      console.log(`🔐 Super Admin detected: ${user.walletAddress} - Role upgraded to ADMIN`);
    }
  }

  return user;
}

const protect = async (req, res, next) => {
  // Check for auth bypass in development environment
  if (process.env.NODE_ENV === 'development' && process.env.AUTH_BYPASS_ENABLED === 'true') {
    // Use a valid ObjectId for mongoose queries to avoid CastError
    const devObjectId = new mongoose.Types.ObjectId();
    if (req.log && req.log.warn) {
      req.log.warn('Bypassing authentication for development. A mock admin user is being used.');
    } else {
      console.warn('Bypassing authentication for development. A mock admin user is being used.');
    }
    req.user = {
      _id: devObjectId,
      walletAddress: '0xDeAdBeEf00000000000000000000000000000001',
      username: 'dev_admin',
      roles: ['ADMIN', 'USER'],
      role: UserRole.ADMIN
    };
    return next();
  }

  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ error: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      req.log.error({ err: error }, 'Token verification failed');
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
};

/**
 * Alternative auth using wallet address (for Web3)
 */
async function requireAuth(req, res, next) {
  try {
    const walletAddress = req.headers['x-wallet-address'] || req.body.walletAddress;

    if (!walletAddress) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Wallet address required'
      });
    }

    // Find user by wallet address
    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not found'
      });
    }

    // Ensure Super Admin role if wallet is in whitelist
    user = await ensureSuperAdminRole(user);

    // Check if user is banned (Super Admins cannot be banned)
    if (user.isBanned && !isSuperAdmin(user.walletAddress)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Account has been banned'
      });
    }

    // Attach user to request
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
  requireAuth,
  requireAdmin,
  requireModerator,
  requireOwnership,
  isSuperAdmin,
  ensureSuperAdminRole
};
