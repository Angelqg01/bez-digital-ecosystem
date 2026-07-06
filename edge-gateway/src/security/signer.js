'use strict';

/**
 * signer.js — telemetry signing (Phase 2, anti-spoofing).
 *
 * Each Edge Node signs every telemetry payload so the backend can prove it came
 * from the registered device and was not tampered with in flight. Algorithm:
 * ECDSA over the NIST P-256 curve (secp256r1) with SHA-256 — chosen because it
 * is exactly what the ATECC608A / TPM 2.0 secure elements compute natively, so
 * the same canonicalization + verification works when the key moves from
 * software (dev) into hardware (production) with no protocol change.
 *
 * Signed bytes = canonical JSON of the payload WITHOUT its `sig` field (keys
 * sorted recursively, so signer and verifier always agree on the byte string).
 * `keyId` IS included in the signed data, so a key cannot be swapped.
 *
 * The `Signer` contract (so a hardware element can drop in later):
 *     { keyId: string, publicKeyPem: string, sign(payload) → sigBase64 }
 */

const crypto = require('crypto');

/** Deterministic JSON: object keys sorted recursively. Arrays keep order. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The exact bytes that get signed/verified for a payload (excludes `sig`). */
function signingMessage(payload) {
  const { sig, ...rest } = payload; // eslint-disable-line no-unused-vars
  return Buffer.from(stableStringify(rest), 'utf8');
}

/** Generate a fresh P-256 keypair (PEM). For dev/provisioning; prod uses HW. */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // == secp256r1 / P-256
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

/**
 * Software signer (holds the private key in-process). Hardware signers
 * (ATECC608A/TPM) implement the same `sign(payload)` contract but keep the key
 * inside the secure element.
 * @param {{ keyId:string, privateKeyPem:string }} opts
 */
function createSoftwareSigner({ keyId, privateKeyPem }) {
  if (!keyId) throw new Error('signer requires a keyId');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKeyPem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });

  return {
    keyId,
    publicKeyPem,
    /** Returns the base64 DER ECDSA signature over the canonical payload. */
    sign(payload) {
      return crypto.sign('sha256', signingMessage({ ...payload, keyId }), privateKey).toString('base64');
    },
  };
}

/**
 * Verify a signed payload against a public key (PEM).
 * @returns {boolean}
 */
function verify(payload, publicKeyPem) {
  if (!payload || !payload.sig) return false;
  try {
    const key = crypto.createPublicKey(publicKeyPem);
    return crypto.verify('sha256', signingMessage(payload), key, Buffer.from(payload.sig, 'base64'));
  } catch {
    return false;
  }
}

module.exports = { stableStringify, signingMessage, generateKeyPair, createSoftwareSigner, verify };
