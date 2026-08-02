import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { query } from '../db.js';
import { JWT_SECRET, JWT_ACCESS_TTL } from '../config/authSecrets.js';

const router = Router();

// Secreto y TTL compartidos con la API core y el Hub — ver src/config/authSecrets.js.
const JWT_EXPIRY = JWT_ACCESS_TTL;

// Scopes granulares por recurso, tal y como los publica la documentación
// (wallet:read, billing:write…). Se mapean sobre los roles que YA existían para
// que los JWT emitidos antes de esta capa sigan funcionando sin cambios.
const USER_SCOPES = [
  'subapp:user',
  'wallet:read', 'contracts:read',
  'billing:read', 'billing:write',
  'purescan:read', 'purescan:analyze',
  'sphere:chat',
  'gas:read', 'gas:write',
];
const ENTERPRISE_SCOPES = [
  ...USER_SCOPES,
  'subapp:enterprise',
  'cargolink:*', 'energy:*', 'vision:*', 'nodes:read',
];

const roleScopes = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['core:admin', 'core:developer', 'core:security', 'developer:api', 'mcp:invoke', ...ENTERPRISE_SCOPES, 'nodes:*', 'contracts:*'],
  DEVELOPER: ['core:developer', 'developer:api', 'mcp:invoke', 'contracts:*', 'nodes:*', ...USER_SCOPES],
  DEVOPS: ['core:developer', 'core:security', 'mcp:invoke', 'nodes:*'],
  SECURITY: ['core:security', 'mcp:invoke'],
  ENTERPRISE: ENTERPRISE_SCOPES,
  USER: USER_SCOPES,
};

function getScopes(user = {}) {
  const explicitScopes = Array.isArray(user.scopes) ? user.scopes : [];
  const role = String(user.role || user.accountType || user.account_type || 'USER').toUpperCase();
  return new Set([...explicitScopes, ...(roleScopes[role] || roleScopes.USER)]);
}

// In-memory nonce store (replace with Redis in production)
const nonces = new Map();

/** GET /api/auth/nonce?address=0x... — Generate SIWE nonce */
router.get('/nonce', (req, res) => {
  const { address } = req.query;
  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Valid Ethereum address required' });
  }

  const nonce = ethers.hexlify(ethers.randomBytes(16));
  nonces.set(address.toLowerCase(), { nonce, timestamp: Date.now() });

  res.json({
    nonce,
    message: `Sign this message to authenticate with BeZhas Ecosystem.\n\nAddress: ${address}\nNonce: ${nonce}\nChain: 2708\nTimestamp: ${new Date().toISOString()}`,
  });
});

/** POST /api/auth/verify — Verify SIWE signature and issue JWT */
router.post('/verify', async (req, res) => {
  try {
    const { address, signature, message } = req.body;
    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'address, signature, and message required' });
    }

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Verify nonce
    const stored = nonces.get(address.toLowerCase());
    if (!stored || Date.now() - stored.timestamp > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Nonce expired. Request a new one.' });
    }
    nonces.delete(address.toLowerCase());

    // ── Unified BeZhas-ID Resolution ──
    const targetAddress = address.toLowerCase();
    
    // Check if user already exists in PostgreSQL
    const checkRes = await query('SELECT * FROM users WHERE wallet_address = $1', [targetAddress]);
    let dbUser = checkRes.rows[0];

    if (!dbUser) {
      console.log(`[GATEWAY AUTH] Registering new wallet user ${targetAddress} globally...`);
      const referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const insertQuery = `
        INSERT INTO users (
          username, wallet_address, roles, is_wallet_verified, affiliate_referral_code
        ) VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *;
      `;
      const insertValues = [
        `User_${targetAddress.slice(0, 6)}`,
        targetAddress,
        JSON.stringify(['USER']),
        true,
        referralCode
      ];
      const insertRes = await query(insertQuery, insertValues);
      dbUser = insertRes.rows[0];
    } else {
      console.log(`[GATEWAY AUTH] Found existing global user for ${targetAddress}. BeZhas-ID: ${dbUser.id || dbUser._id}`);
    }

    const userId = dbUser.id || dbUser._id;
    const userRole = Array.isArray(dbUser.roles) ? dbUser.roles[0] : 'USER';

    // Issue JWT with centralized BeZhas-ID in the sub claim!
    const token = jwt.sign(
      {
        sub: userId,
        walletAddress: targetAddress,
        did: `did:bezhas:${targetAddress}`,
        chainId: 2708,
        role: userRole,
        scopes: ['subapp:user'],
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      token,
      expiresIn: JWT_EXPIRY,
      did: `did:bezhas:${targetAddress}`,
      address: targetAddress,
      userId: userId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed: ' + error.message });
  }
});

/** GET /api/auth/me — Get current user from JWT */
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    res.json({
      address: payload.sub,
      did: payload.did,
      chainId: payload.chainId,
      authenticated: true,
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

/** POST /api/auth/resolve-did — Resolve DID to address */
router.post('/resolve-did', (req, res) => {
  const { did } = req.body;
  if (!did?.startsWith('did:bezhas:')) {
    return res.status(400).json({ error: 'Invalid BeZhas DID format' });
  }

  const address = did.replace('did:bezhas:', '');
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'DID contains invalid address' });
  }

  res.json({
    did,
    address,
    method: 'bezhas',
    resolved: true,
    // In production: fetch on-chain DID document
    document: {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: did,
      verificationMethod: [{
        id: `${did}#key-1`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: did,
        blockchainAccountId: `eip155:2708:${address}`,
      }],
    },
  });
});

// JWT middleware for other routes
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * ¿Un scope concedido cubre el requerido?
 * Soporta comodín total (`*`) y de recurso (`billing:*` cubre `billing:write`).
 * No hay herencia implícita: `x:write` NO concede `x:read`.
 */
function scopeSatisfies(granted, needed) {
  const g = String(granted).toLowerCase();
  const n = String(needed).toLowerCase();
  if (g === '*' || g === n) return true;
  return g.endsWith(':*') && n.startsWith(g.slice(0, -1));
}

export function requireScope(scope) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      const scopes = getScopes(req.user);
      for (const granted of scopes) {
        if (scopeSatisfies(granted, scope)) return next();
      }
      return res.status(403).json({
        error: `Missing required scope: ${scope}`,
        code: 'SCOPE_DENIED',
        requiredScope: scope,
      });
    });
  };
}

export { scopeSatisfies, getScopes };

export function requireNodeHeartbeat(req, res, next) {
  const key = req.headers['x-node-api-key'] || req.headers['x-api-key'];
  const expected = process.env.NODE_HEARTBEAT_API_KEY;
  if (expected && key === expected) return next();
  return requireScope('node:heartbeat')(req, res, next);
}

export { router as authRouter };
