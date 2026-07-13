/**
 * bezhas-pqc.js — Verificador PQC cliente-side para SubApps BeZhas
 *
 * Browser-safe (ESM puro, sin Node.js). Capacidades:
 *   1. parsePqcClaim(token)     — Lee el claim PQC del JWT sin verificar criptografía
 *   2. verifyPqcClaim(token)    — Verificación criptográfica completa (ML-DSA-65)
 *                                 requiere que @noble/post-quantum esté disponible
 *   3. getTokenPqcStatus(token) — Status compuesto: claim + verificación + metadatos
 *
 * Degradación elegante: si la lib PQC no está disponible, `verifyPqcClaim` devuelve
 * { verified: false, reason: 'lib-unavailable' } sin romper la app.
 *
 * @version 1.0.0
 * @standard NIST FIPS 204 (ML-DSA-65 / Dilithium3)
 */

// ─── Helpers base64url ────────────────────────────────────────────────────────

function b64urlDecode(str) {
  const pad = str.length % 4;
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad ? 4 - pad : 0);
  return atob(b64);
}

function b64urlToBytes(str) {
  const bin  = b64urlDecode(str);
  const out  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return out;
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Decodifica el payload de un JWT sin verificar firma.
 * @returns {object|null}
 */
export function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(b64urlDecode(part));
  } catch {
    return null;
  }
}

/**
 * Lee el claim PQC del token sin verificación criptográfica.
 * Útil para mostrar metadatos en UI antes de verificar.
 *
 * @returns {{ present: boolean, alg?: string, pub?: string, sig?: string }}
 */
export function parsePqcClaim(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.pqc) return { present: false };
  const { alg, pub, sig } = payload.pqc;
  return { present: true, alg, pub: pub?.slice(0, 16) + '…', sig: sig?.slice(0, 16) + '…' };
}

/**
 * Verificación criptográfica completa del claim PQC (ML-DSA-65).
 * Requiere que @noble/post-quantum esté instalado en el bundler de la SubApp.
 *
 * @param {string} token — JWT con claim pqc
 * @returns {Promise<{ verified: boolean, alg?: string, reason?: string }>}
 */
export async function verifyPqcClaim(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.pqc) return { verified: false, reason: 'no-claim' };

  const { alg, sig, pub } = payload.pqc;
  if (alg !== 'ML-DSA-65') return { verified: false, reason: `alg-unknown:${alg}` };
  if (!sig || !pub)         return { verified: false, reason: 'claim-incomplete' };

  // Cargar la librería PQC dinámicamente (degradación elegante si no está)
  let ml_dsa65;
  try {
    const mod = await import('@noble/post-quantum/ml-dsa.js');
    ml_dsa65  = mod.ml_dsa65;
  } catch {
    return { verified: false, reason: 'lib-unavailable' };
  }

  try {
    const parts = token.split('.');

    // Reconstruir el payload sin el claim pqc (mensaje original firmado)
    const cleanPayload = { ...payload };
    delete cleanPayload.pqc;
    const cleanB64 = btoa(JSON.stringify(cleanPayload))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const message  = new TextEncoder().encode(`${parts[0]}.${cleanB64}`);

    const sigBytes = b64urlToBytes(sig);
    const pubBytes = hexToBytes(pub);

    // API @noble/post-quantum v0.6.x: verify(sig, msg, publicKey)
    const ok = ml_dsa65.verify(sigBytes, message, pubBytes);
    return { verified: ok, alg };
  } catch (err) {
    return { verified: false, reason: err.message };
  }
}

/**
 * Status PQC completo de un token: parsing + verificación + metadatos humanos.
 * Usar en dashboards, DevConsole, y componente PQCBadge.
 *
 * @param {string} token
 * @returns {Promise<PqcStatus>}
 *
 * @typedef {Object} PqcStatus
 * @property {boolean}  hasClaim     — El token contiene claim PQC
 * @property {boolean}  verified     — La firma Dilithium3 es criptográficamente válida
 * @property {string}   alg          — Algoritmo PQC ('ML-DSA-65' | 'none')
 * @property {string}   level        — 'quantum-safe' | 'classical' | 'invalid'
 * @property {string}   label        — Etiqueta human-readable
 * @property {string}   [reason]     — Si verified=false, motivo
 * @property {string}   [pubSnippet] — Primeros 16 chars de la clave pública (display)
 * @property {number}   [exp]        — Expiración del JWT (Unix timestamp)
 */
export async function getTokenPqcStatus(token) {
  if (!token) {
    return { hasClaim: false, verified: false, alg: 'none', level: 'classical', label: 'Sin token' };
  }

  const payload = decodeJwtPayload(token);
  const exp     = payload?.exp ?? null;

  if (!payload?.pqc) {
    return {
      hasClaim:   false,
      verified:   false,
      alg:        'none',
      level:      'classical',
      label:      'Protección clásica (ECDSA)',
      exp,
    };
  }

  const result = await verifyPqcClaim(token);

  if (result.reason === 'lib-unavailable') {
    return {
      hasClaim:   true,
      verified:   false,
      alg:        payload.pqc.alg || 'ML-DSA-65',
      level:      'quantum-safe',
      label:      'Post-cuántico (verificación offline)',
      pubSnippet: payload.pqc.pub?.slice(0, 16) + '…',
      exp,
    };
  }

  return {
    hasClaim:   true,
    verified:   result.verified,
    alg:        result.alg || payload.pqc.alg,
    level:      result.verified ? 'quantum-safe' : 'invalid',
    label:      result.verified
      ? 'Post-cuántico verificado (ML-DSA-65)'
      : `Firma PQC inválida: ${result.reason ?? 'verification-failed'}`,
    pubSnippet: payload.pqc.pub?.slice(0, 16) + '…',
    reason:     result.verified ? undefined : (result.reason ?? 'verification-failed'),
    exp,
  };
}

/**
 * Fetch de la clave pública PQC desde el API de BeZhas.
 * Útil para SubApps que quieran verificar sin depender de la pub embebida en el token.
 *
 * @param {string} apiBase — e.g. 'https://api.bez.digital:3001'
 * @returns {Promise<{ publicKey: string, algorithm: string, standard: string } | null>}
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
