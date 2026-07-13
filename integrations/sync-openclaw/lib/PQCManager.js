/**
 * PQCManager.js
 * Capa de firma post-cuántica (Dilithium3 / ML-DSA-65) para BeZhas.
 *
 * Esquema HÍBRIDO: ECDSA (clásica) + Dilithium3 (post-cuántica).
 * Ambas firmas deben ser válidas → acceso concedido.
 * Si Dilithium falla, ECDSA sigue protegiendo (transición segura).
 *
 * Estándar: NIST ML-DSA (FIPS 204) vía @noble/post-quantum
 */

'use strict';

const { ml_dsa65 } = require('@noble/post-quantum/ml-dsa.js');
const crypto       = require('crypto');

// ─── Gestión de par de claves en memoria ─────────────────────────────────────

let _seed       = null;   // Uint8Array(32) — seed maestra, nunca sale de memoria
let _publicKey  = null;   // Uint8Array — clave pública derivada
let _privateKey = null;   // Uint8Array — clave privada derivada

/**
 * Inicializa el par de claves Dilithium3.
 * Si se provee seed (hex) la usa; si no, genera una aleatoria para esta sesión.
 * NUNCA persiste nada a disco.
 */
function init(seedHex) {
  if (_publicKey) return;   // ya inicializado

  if (seedHex) {
    if (typeof seedHex !== 'string' || seedHex.length !== 64) {
      throw new Error('PQCManager: seed debe ser hex de 32 bytes (64 chars)');
    }
    _seed = Buffer.from(seedHex, 'hex');
  } else {
    _seed = crypto.randomBytes(32);
  }

  const keys  = ml_dsa65.keygen(_seed);
  _publicKey  = keys.publicKey;
  _privateKey = keys.secretKey;
}

/** Devuelve la clave pública en hex (para incluir en JWT header o distribuir) */
function getPublicKeyHex() {
  _assertInit();
  return Buffer.from(_publicKey).toString('hex');
}

/**
 * Firma un payload (string o Buffer) con Dilithium3.
 * Devuelve la firma en base64url para incluir en JWT.
 */
function sign(payload) {
  _assertInit();
  const msg = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  const sig  = ml_dsa65.sign(msg, _privateKey);   // API: sign(msg, secretKey)
  return _toBase64Url(sig);
}

/**
 * Verifica una firma Dilithium3.
 * @param {string} payload   - El mensaje original (string o Buffer)
 * @param {string} sigB64    - Firma en base64url
 * @param {string|Uint8Array} pubKeyHex - Clave pública del firmante (hex o Uint8Array)
 * @returns {{ valid: boolean, reason?: string }}
 */
function verify(payload, sigB64, pubKeyHex) {
  try {
    if (!sigB64) return { valid: false, reason: 'Firma vacía' };
    const msg    = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
    const sig    = Buffer.from(_fromBase64Url(sigB64), 'base64');
    const pubKey = typeof pubKeyHex === 'string'
      ? Buffer.from(pubKeyHex, 'hex')
      : pubKeyHex;

    // API en @noble/post-quantum v0.6.x: verify(sig, msg, publicKey)
    const ok = ml_dsa65.verify(sig, msg, pubKey);
    return { valid: ok };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/**
 * Añade la firma PQC a un JWT existente.
 * El JWT resultante tiene un claim extra `pqc` en el payload con:
 *   { alg: "ML-DSA-65", sig: "<base64url>", pub: "<hex>" }
 *
 * El mensaje firmado es: header.payload (los primeros dos segmentos del JWT).
 */
function signJwt(jwt) {
  _assertInit();
  const parts   = jwt.split('.');
  if (parts.length < 2) throw new Error('PQCManager.signJwt: JWT malformado');

  const message = `${parts[0]}.${parts[1]}`;
  const sig     = sign(message);

  // Decodificar payload, añadir claim pqc, re-codificar
  const payloadJson  = JSON.parse(Buffer.from(_fromBase64Url(parts[1]), 'base64').toString('utf8'));
  payloadJson.pqc    = { alg: 'ML-DSA-65', sig, pub: getPublicKeyHex() };
  const newPayloadB64 = _toBase64Url(Buffer.from(JSON.stringify(payloadJson)));

  // Reconstruir JWT (la firma ECDSA original queda intacta en parts[2])
  return `${parts[0]}.${newPayloadB64}.${parts[2] || ''}`;
}

/**
 * Verifica el claim PQC dentro de un JWT.
 * No verifica la firma ECDSA — eso lo hace el sistema estándar.
 * Devuelve { valid, alg, reason? }
 */
function verifyJwt(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return { valid: false, reason: 'JWT malformado' };

    const payload = JSON.parse(
      Buffer.from(_fromBase64Url(parts[1]), 'base64').toString('utf8')
    );

    if (!payload.pqc) return { valid: false, reason: 'Sin claim PQC en JWT' };

    const { sig, pub, alg } = payload.pqc;
    if (alg !== 'ML-DSA-65') return { valid: false, reason: `Algoritmo PQC desconocido: ${alg}` };

    // Reconstruir el mensaje original (header.payload SIN el claim pqc)
    const originalPayload = { ...payload };
    delete originalPayload.pqc;
    const originalPayloadB64 = _toBase64Url(Buffer.from(JSON.stringify(originalPayload)));
    const message = `${parts[0]}.${originalPayloadB64}`;

    const result = verify(message, sig, pub);
    return { ...result, alg };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/** Limpia las claves de memoria (logout / rotación) */
function clear() {
  _seed       = null;
  _publicKey  = null;
  _privateKey = null;
}

/** Estado del módulo para health checks */
function getStatus() {
  return {
    initialized: !!_publicKey,
    algorithm:   'ML-DSA-65 (Dilithium3)',
    standard:    'NIST FIPS 204',
    publicKey:   _publicKey ? getPublicKeyHex().slice(0, 32) + '…' : null,
  };
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function _assertInit() {
  if (!_publicKey) throw new Error('PQCManager: no inicializado — llama a init() primero');
}

function _toBase64Url(data) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _fromBase64Url(str) {
  const pad = str.length % 4;
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad ? 4 - pad : 0);
  return b64;
}

module.exports = { init, getPublicKeyHex, sign, verify, signJwt, verifyJwt, clear, getStatus };
