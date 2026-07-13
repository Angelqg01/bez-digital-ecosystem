/**
 * api/lib/apiPQC.js — Singleton PQC (ML-DSA-65 / Dilithium3) para el servidor API.
 *
 * Diseño out-of-band: el JWT nunca se modifica.
 * Dilithium3 firma el JWT completo como bytes UTF-8.
 * La firma viaja junto al JWT (no dentro de él), preservando ECDSA intacta.
 *
 * Flujo de login:
 *   const token = jwt.sign(payload, JWT_SECRET);
 *   const { sig, pub } = apiPQC.signToken(token);
 *   res.json({ token, pqc: { sig, pub, alg: 'ML-DSA-65' } });
 *
 * Flujo de verificación REST:
 *   jwt.verify(token, JWT_SECRET)                        ← ECDSA
 *   apiPQC.verifyToken(token, pqcSig, pqcPub)           ← Dilithium3
 *
 * Flujo WebSocket:
 *   ws://host/room?token=JWT&pqcSig=SIG&pqcPub=PUB
 *
 * Flujo cliente (SubApps):
 *   Authorization: Bearer <token>
 *   X-PQC-Signature: <sig>        ← base64url
 *   X-PQC-Pubkey: <pub>           ← hex
 *
 * NUNCA persiste a disco — seed opcional vía BEZHAS_PQC_SEED (hex 64 chars).
 * Estándar: NIST FIPS 204 (ML-DSA-65 / Dilithium3).
 */

'use strict';

const { ml_dsa65 } = require('@noble/post-quantum/ml-dsa.js');
const crypto       = require('crypto');

// ─── Estado singleton ────────────────────────────────────────────────────────

let _publicKey = null;
let _secretKey = null;
let _initAt    = null;

function _ensureInit() {
  if (_publicKey) return;

  const seedHex = process.env.BEZHAS_PQC_SEED;
  let seed;

  if (seedHex) {
    if (seedHex.length !== 64) throw new Error('BEZHAS_PQC_SEED debe ser hex de 32 bytes (64 chars)');
    seed = Buffer.from(seedHex, 'hex');
  } else {
    seed = crypto.randomBytes(32);
  }

  const keys = ml_dsa65.keygen(seed);
  _publicKey  = keys.publicKey;
  _secretKey  = keys.secretKey;
  _initAt     = new Date().toISOString();

  const mode = seedHex ? 'determinista (BEZHAS_PQC_SEED)' : 'aleatoria (efímera)';
  console.log(`[PQC] ML-DSA-65 inicializado (${mode}) — pub: ${Buffer.from(_publicKey).toString('hex').slice(0, 16)}…`);
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Firma el JWT completo (los 3 segmentos como string UTF-8) con Dilithium3.
 * El JWT NO se modifica — solo se produce una firma externa.
 *
 * @param {string} token — JWT estándar (header.payload.ecdsaSig)
 * @returns {{ sig: string, pub: string }}
 *   sig — firma Dilithium3 en base64url
 *   pub — clave pública en hex (para que el receptor verifique sin estado)
 */
function signToken(token) {
  _ensureInit();
  if (!token || typeof token !== 'string') throw new Error('signToken: token debe ser un string no vacío');

  const message = Buffer.from(token, 'utf8');
  const sig     = ml_dsa65.sign(message, _secretKey);

  return {
    sig: _b64url(sig),
    pub: Buffer.from(_publicKey).toString('hex'),
  };
}

/**
 * Verifica la firma Dilithium3 sobre el JWT.
 * La clave pública del firmante viene embebida en los parámetros (sin estado).
 *
 * @param {string} token  — JWT original (no modificado)
 * @param {string} sig    — Firma en base64url
 * @param {string} pub    — Clave pública del firmante en hex
 * @returns {{ valid: boolean, alg?: string, reason?: string }}
 */
function verifyToken(token, sig, pub) {
  _ensureInit();
  if (!token) return { valid: false, reason: 'no-token' };
  if (!sig)   return { valid: false, reason: 'no-pqc-sig' };
  if (!pub)   return { valid: false, reason: 'no-pqc-pub' };

  try {
    const message  = Buffer.from(token, 'utf8');
    const sigBytes = Buffer.from(_unb64url(sig), 'base64');
    const pubBytes = Buffer.from(pub, 'hex');

    // API @noble/post-quantum v0.6.x: verify(sig, msg, publicKey)
    const ok = ml_dsa65.verify(sigBytes, message, pubBytes);
    return { valid: ok, alg: 'ML-DSA-65' };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/**
 * Extrae los parámetros PQC de los headers HTTP de una request.
 * @returns {{ sig: string|null, pub: string|null }}
 */
function extractFromHeaders(headers) {
  return {
    sig: headers['x-pqc-signature'] || null,
    pub: headers['x-pqc-pubkey']    || null,
  };
}

/**
 * Extrae los parámetros PQC de los query params de una URL (para WebSocket).
 * @returns {{ sig: string|null, pub: string|null }}
 */
function extractFromQuery(query) {
  return {
    sig: query.pqcSig || null,
    pub: query.pqcPub || null,
  };
}

/** Devuelve la clave pública del servidor en hex */
function getPublicKeyHex() {
  _ensureInit();
  return Buffer.from(_publicKey).toString('hex');
}

/** Info para el endpoint GET /auth/pqc-pubkey y health checks */
function getInfo() {
  _ensureInit();
  return {
    algorithm:  'ML-DSA-65',
    standard:   'NIST FIPS 204 (ML-DSA)',
    publicKey:  getPublicKeyHex(),
    persistent: !!process.env.BEZHAS_PQC_SEED,
    initAt:     _initAt,
    transport:  'out-of-band',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _b64url(data) {
  return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _unb64url(str) {
  const pad = str.length % 4;
  return str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad ? 4 - pad : 0);
}

module.exports = { signToken, verifyToken, extractFromHeaders, extractFromQuery, getPublicKeyHex, getInfo };
