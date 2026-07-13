/**
 * bezhas-pqc.js — Verificador PQC cliente-side para SubApps BeZhas
 *
 * Diseño out-of-band: el JWT no se modifica.
 * La firma Dilithium3 viaja junto al JWT (no dentro de él), llegando al cliente
 * en la respuesta de login: { token, pqc: { sig, pub, alg } }.
 *
 * El cliente almacena { token, pqcSig, pqcPub } y envía en cada petición:
 *   Authorization: Bearer <token>
 *   X-PQC-Signature: <sig>   (base64url)
 *   X-PQC-Pubkey: <pub>      (hex)
 *
 * Capacidades de este módulo:
 *   1. verifyTokenPqc(token, sig, pub)  — verificación criptográfica completa
 *   2. getSessionPqcStatus(session)     — status compuesto para UI (PQCBadge)
 *   3. fetchPqcPublicKey(apiBase)       — fetch de la clave pública del servidor
 *   4. makeAuthHeaders(token, pqcSig, pqcPub) — headers para peticiones fetch
 *   5. makeWsUrl(baseUrl, token, pqcSig, pqcPub) — URL con params PQC para WebSocket
 *
 * Browser-safe: ESM puro, sin Node.js. Degradación elegante si lib PQC no disponible.
 *
 * @version 2.0.0
 * @standard NIST FIPS 204 (ML-DSA-65 / Dilithium3)
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function b64urlDecode(str) {
  const pad = str.length % 4;
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad ? 4 - pad : 0);
  return atob(b64);
}

function b64urlToBytes(str) {
  const bin = b64urlDecode(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return out;
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(b64urlDecode(part));
  } catch {
    return null;
  }
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Verificación criptográfica ML-DSA-65 de la firma PQC out-of-band.
 * La firma es sobre el JWT completo (string UTF-8), no sobre un campo del payload.
 *
 * @param {string} token  — JWT estándar (no modificado)
 * @param {string} sig    — Firma Dilithium3 en base64url
 * @param {string} pub    — Clave pública del firmante en hex
 * @returns {Promise<{ verified: boolean, alg?: string, reason?: string }>}
 */
export async function verifyTokenPqc(token, sig, pub) {
  if (!token) return { verified: false, reason: 'no-token' };
  if (!sig)   return { verified: false, reason: 'no-sig' };
  if (!pub)   return { verified: false, reason: 'no-pub' };

  let ml_dsa65;
  try {
    const mod = await import('@noble/post-quantum/ml-dsa.js');
    ml_dsa65  = mod.ml_dsa65;
  } catch {
    return { verified: false, reason: 'lib-unavailable' };
  }

  try {
    const message  = new TextEncoder().encode(token);
    const sigBytes = b64urlToBytes(sig);
    const pubBytes = hexToBytes(pub);

    // API @noble/post-quantum v0.6.x: verify(sig, msg, publicKey)
    const ok = ml_dsa65.verify(sigBytes, message, pubBytes);
    return { verified: ok, alg: 'ML-DSA-65', reason: ok ? undefined : 'verification-failed' };
  } catch (err) {
    return { verified: false, reason: err.message };
  }
}

/**
 * Status PQC completo de una sesión: { token, pqcSig, pqcPub } o { token, pqc: { sig, pub } }.
 * Realiza verificación criptográfica y devuelve metadatos para la UI.
 *
 * @param {object} session — sesión de bezhas-wallet-auth (campos token y pqc/pqcSig/pqcPub)
 * @returns {Promise<PqcStatus>}
 *
 * @typedef {Object} PqcStatus
 * @property {boolean}  hasPqc     — La sesión tiene firma PQC adjunta
 * @property {boolean}  verified   — La firma Dilithium3 es criptográficamente válida
 * @property {string}   alg        — Algoritmo PQC ('ML-DSA-65' | 'none')
 * @property {string}   level      — 'quantum-safe' | 'classical' | 'invalid'
 * @property {string}   label      — Etiqueta human-readable
 * @property {string}   [reason]   — Motivo si verified=false
 * @property {string}   [pubSnip]  — Primeros 16 chars de la clave pública
 * @property {number}   [exp]      — Expiración del JWT (Unix timestamp)
 */
export async function getSessionPqcStatus(session) {
  if (!session?.token) {
    return { hasPqc: false, verified: false, alg: 'none', level: 'classical', label: 'Sin sesión' };
  }

  const payload = decodeJwtPayload(session.token);
  const exp     = payload?.exp ?? null;

  // Normalizar: la sesión puede almacenar { pqcSig, pqcPub } o { pqc: { sig, pub } }
  const sig = session.pqcSig || session.pqc?.sig || null;
  const pub = session.pqcPub || session.pqc?.pub || null;

  if (!sig || !pub) {
    return {
      hasPqc:   false,
      verified:  false,
      alg:       'none',
      level:     'classical',
      label:     'Protección clásica (ECDSA)',
      exp,
    };
  }

  const result = await verifyTokenPqc(session.token, sig, pub);

  if (result.reason === 'lib-unavailable') {
    return {
      hasPqc:   true,
      verified:  false,
      alg:       'ML-DSA-65',
      level:     'quantum-safe',
      label:     'Post-cuántico (verificación offline)',
      pubSnip:   pub.slice(0, 16) + '…',
      exp,
    };
  }

  return {
    hasPqc:   true,
    verified:  result.verified,
    alg:       result.alg || 'ML-DSA-65',
    level:     result.verified ? 'quantum-safe' : 'invalid',
    label:     result.verified
      ? 'Post-cuántico verificado (ML-DSA-65)'
      : `Firma PQC inválida: ${result.reason ?? 'verification-failed'}`,
    pubSnip:   pub.slice(0, 16) + '…',
    reason:    result.verified ? undefined : (result.reason ?? 'verification-failed'),
    exp,
  };
}

/**
 * Fetch de la clave pública PQC del servidor API.
 * Útil para verificar firmas sin depender del pub embebido en la respuesta de login.
 *
 * @param {string} apiBase — e.g. 'https://api.bez.digital:3001'
 * @returns {Promise<{ publicKey: string, algorithm: string, standard: string, transport: string } | null>}
 */
export async function fetchPqcPublicKey(apiBase) {
  try {
    const res = await fetch(`${apiBase}/auth/pqc-pubkey`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Construye los headers HTTP para incluir autenticación JWT+PQC en peticiones fetch.
 *
 * @param {string} token    — JWT
 * @param {string} pqcSig   — Firma PQC (base64url)
 * @param {string} pqcPub   — Clave pública (hex)
 * @returns {Record<string, string>}
 */
export function makeAuthHeaders(token, pqcSig, pqcPub) {
  const headers = { Authorization: `Bearer ${token}` };
  if (pqcSig) headers['X-PQC-Signature'] = pqcSig;
  if (pqcPub) headers['X-PQC-Pubkey']    = pqcPub;
  return headers;
}

/**
 * Construye la URL de un WebSocket con parámetros PQC en el query string.
 *
 * @param {string} baseUrl  — e.g. 'wss://api.bez.digital:3001/agent-runtime'
 * @param {string} token    — JWT
 * @param {string} pqcSig   — Firma PQC (base64url), opcional
 * @param {string} pqcPub   — Clave pública (hex), opcional
 * @returns {string}
 */
export function makeWsUrl(baseUrl, token, pqcSig, pqcPub) {
  const url = new URL(baseUrl);
  url.searchParams.set('token', token);
  if (pqcSig) url.searchParams.set('pqcSig', pqcSig);
  if (pqcPub) url.searchParams.set('pqcPub', pqcPub);
  return url.toString();
}

// ─── Legacy shim (compatibilidad v1.0.0) ─────────────────────────────────────
// Estas funciones permiten que código antiguo que referenciaba parsePqcClaim /
// getTokenPqcStatus siga funcionando sin cambios.

/** @deprecated Usar getSessionPqcStatus({ token }) */
export async function getTokenPqcStatus(token) {
  return getSessionPqcStatus({ token });
}

/** @deprecated Usar el campo pqc de la respuesta de login */
export function parsePqcClaim(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.pqc) return { present: false };
  const { alg, pub, sig } = payload.pqc;
  return { present: true, alg, pub: pub?.slice(0, 16) + '…', sig: sig?.slice(0, 16) + '…' };
}
