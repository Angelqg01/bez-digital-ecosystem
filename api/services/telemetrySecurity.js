'use strict';

/**
 * telemetrySecurity — verifies signed Edge Node telemetry (Phase 2, anti-spoofing).
 *
 * Mirror of edge-gateway/src/security/signer.js: same canonicalization (sorted
 * keys, `sig` excluded) and the same algorithm — ECDSA P-256 (secp256r1) / SHA-256
 * — so a payload signed by an Edge Node (software key in dev, ATECC608A/TPM in
 * production) verifies here. Node public keys are registered per `keyId`.
 *
 * Enforcement is gated so the existing simulator (unsigned) keeps working until
 * real devices are provisioned:
 *   VPP_REQUIRE_SIGNED_TELEMETRY=true  → unsigned telemetry is rejected.
 *   (default false)                    → unsigned accepted; signed-but-invalid
 *                                        is ALWAYS treated as spoofing.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Deterministic JSON — MUST match the Edge signer byte-for-byte. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function signingMessage(payload) {
  const { sig, ...rest } = payload; // eslint-disable-line no-unused-vars
  return Buffer.from(stableStringify(rest), 'utf8');
}

/** keyId → public key PEM. */
const keyRegistry = new Map();

function registerKey(keyId, publicKeyPem) {
  if (!keyId || !publicKeyPem) return false;
  keyRegistry.set(keyId, publicKeyPem);
  return true;
}

function getKey(keyId) { return keyRegistry.get(keyId) || null; }
function knownKeyIds() { return [...keyRegistry.keys()]; }

/**
 * Load node public keys from a directory of `<keyId>.pub.pem` files (dev) and/or
 * a JSON env var VPP_NODE_KEYS = { "<keyId>": "<pem>" }. Best-effort.
 */
function loadKeys({ dir = process.env.VPP_KEYS_DIR, envJson = process.env.VPP_NODE_KEYS } = {}) {
  let loaded = 0;
  if (envJson) {
    try {
      const obj = JSON.parse(envJson);
      for (const [k, v] of Object.entries(obj)) if (registerKey(k, v)) loaded++;
    } catch { /* ignore malformed env */ }
  }
  if (dir && fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.pub.pem')) continue;
      const keyId = f.replace(/\.pub\.pem$/, '');
      try { if (registerKey(keyId, fs.readFileSync(path.join(dir, f), 'utf8'))) loaded++; } catch { /* skip */ }
    }
  }
  return loaded;
}

function isEnforced() { return String(process.env.VPP_REQUIRE_SIGNED_TELEMETRY || '').toLowerCase() === 'true'; }

/**
 * Verify a payload's signature.
 * @returns {{ signed:boolean, valid:boolean, reason:string }}
 *   signed=false → no sig present.
 *   valid=true   → signature matches a registered key.
 */
function verifyPayload(payload) {
  if (!payload || !payload.sig) return { signed: false, valid: false, reason: 'unsigned' };
  const pem = payload.keyId ? getKey(payload.keyId) : null;
  if (!pem) return { signed: true, valid: false, reason: payload.keyId ? 'unknown_key' : 'missing_keyId' };
  try {
    const ok = crypto.verify('sha256', signingMessage(payload), crypto.createPublicKey(pem), Buffer.from(payload.sig, 'base64'));
    return { signed: true, valid: ok, reason: ok ? 'ok' : 'bad_signature' };
  } catch (err) {
    return { signed: true, valid: false, reason: `verify_error:${err.message}` };
  }
}

/** Test helper. */
function _reset() { keyRegistry.clear(); }

module.exports = {
  stableStringify, signingMessage,
  registerKey, getKey, knownKeyIds, loadKeys,
  isEnforced, verifyPayload, _reset,
};
