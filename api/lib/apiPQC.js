/**
 * api/lib/apiPQC.js
 * Singleton PQC (ML-DSA-65 / Dilithium3) para el servidor API.
 *
 * Se inicializa UNA vez al arrancar el proceso. La seed puede venir de
 * la variable de entorno BEZHAS_PQC_SEED (hex 64 chars). Si no se provee,
 * se genera aleatoria en memoria — todos los tokens son verificables durante
 * la vida del proceso pero no entre reinicios (rotación automática).
 *
 * Para persistencia entre reinicios: generar seed con `node -e
 * "console.log(require('crypto').randomBytes(32).toString('hex'))"` y
 * añadir BEZHAS_PQC_SEED al entorno/secreto de producción.
 */

'use strict';

const { ml_dsa65 } = require('@noble/post-quantum/ml-dsa.js');
const crypto       = require('crypto');

// ─── Estado singleton ────────────────────────────────────────────────────────

let _publicKey  = null;
let _privateKey = null;
let _initAt     = null;

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

  const keys  = ml_dsa65.keygen(seed);
  _publicKey  = keys.publicKey;
  _privateKey = keys.secretKey;
  _initAt     = new Date().toISOString();

  const mode = seedHex ? 'determinista (BEZHAS_PQC_SEED)' : 'aleatoria (efímera)';
  console.log(`[PQC] ML-DSA-65 inicializado (${mode}) — pub: ${Buffer.from(_publicKey).toString('hex').slice(0, 16)}…`);
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Firma el par header.payload de un JWT con Dilithium3.
 * Inserta el claim `pqc` en el payload y devuelve el JWT resultante.
 * La firma ECDSA original queda intacta (3ª parte del JWT).
 */
function signJwt(jwt) {
  _ensureInit();
  const parts = jwt.split('.');
  if (parts.length < 2) throw new Error('PQC.signJwt: JWT malformado');

  // Mensaje firmado = header.payload originales
  const message  = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  const sigBytes = ml_dsa65.sign(message, _privateKey);
  const sig      = _b64url(sigBytes);
  const pub      = Buffer.from(_publicKey).toString('hex');

  // Decodificar payload, añadir claim pqc, re-codificar
  const payloadObj = JSON.parse(Buffer.from(_unb64url(parts[1]), 'base64').toString('utf8'));
  payloadObj.pqc   = { alg: 'ML-DSA-65', sig, pub };

  const newPayload = _b64url(Buffer.from(JSON.stringify(payloadObj)));
  return `${parts[0]}.${newPayload}.${parts[2] || ''}`;
}

/**
 * Verifica el claim PQC dentro de un JWT.
 * @returns {{ valid: boolean, alg?: string, reason?: string }}
 */
function verifyJwt(jwt) {
  _ensureInit();
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return { valid: false, reason: 'JWT malformado' };

    const payload = JSON.parse(Buffer.from(_unb64url(parts[1]), 'base64').toString('utf8'));
    if (!payload.pqc) return { valid: false, reason: 'Sin claim PQC en JWT' };

    const { sig, pub, alg } = payload.pqc;
    if (alg !== 'ML-DSA-65') return { valid: false, reason: `Algoritmo PQC desconocido: ${alg}` };
    if (!sig)                  return { valid: false, reason: 'Firma PQC vacía' };

    // Reconstruir el mensaje original (header + payload SIN claim pqc)
    const clean = { ...payload };
    delete clean.pqc;
    const cleanPayloadB64 = _b64url(Buffer.from(JSON.stringify(clean)));
    const message = Buffer.from(`${parts[0]}.${cleanPayloadB64}`, 'utf8');

    const sigBuf    = Buffer.from(_unb64url(sig), 'base64');
    const pubKeyBuf = Buffer.from(pub, 'hex');

    // Verificar con la clave pública embebida en el token (permite rotación de keys)
    const ok = ml_dsa65.verify(sigBuf, message, pubKeyBuf);
    return { valid: ok, alg };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/** Devuelve la clave pública en hex (para distribución pública) */
function getPublicKeyHex() {
  _ensureInit();
  return Buffer.from(_publicKey).toString('hex');
}

/** Info para el endpoint /auth/pqc-pubkey y health checks */
function getInfo() {
  _ensureInit();
  return {
    algorithm:  'ML-DSA-65',
    standard:   'NIST FIPS 204 (ML-DSA)',
    publicKey:  getPublicKeyHex(),
    persistent: !!process.env.BEZHAS_PQC_SEED,
    initAt:     _initAt,
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

module.exports = { signJwt, verifyJwt, getPublicKeyHex, getInfo };
