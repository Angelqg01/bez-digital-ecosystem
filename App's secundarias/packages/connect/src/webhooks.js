// Webhook verification helpers for the receiving (3rd-party) side.
//
// BeZhas signs outbound deliveries (the CargoLink status fan-out) with
// HMAC-SHA256 over the RAW request body. This mirrors fanoutWebhooks() in
// api/services/cargoLinkLifecycle.js exactly:
//
//   header  X-BeZhas-Signature: sha256=<hex(hmacSha256(secret, rawBody))>
//   header  X-BeZhas-Event:     <eventName>   (e.g. ON_TRANSACTION_CREATED)
//   body    { event, bUid, status, posRef, escrowStatus, at }
//
// The inbound bank webhook (api/routes/webhooks.js) uses the same HMAC but a bare
// hex signature in X-Bank-Signature — `verify` accepts both forms.
//
// Stripe deliveries are NOT verified here — use the official `stripe` library
// (stripe.webhooks.constructEvent), same as the backend does.

import crypto from 'node:crypto';

/** Header names BeZhas sets on every signed delivery. */
export const SIGNATURE_HEADER = 'x-bezhas-signature';
export const EVENT_HEADER = 'x-bezhas-event';

/** Strip an optional `sha256=` (or `<alg>=`) prefix and lowercase the hex. */
function normalizeSignature(value) {
  const s = String(value).trim();
  const eq = s.indexOf('=');
  return (eq >= 0 ? s.slice(eq + 1) : s).toLowerCase();
}

/**
 * Compute the signature BeZhas sends for a raw body.
 * @param {string|Buffer} rawBody  The exact bytes received (do NOT re-stringify a parsed object).
 * @param {string} secret
 * @param {boolean} [withPrefix=false]  Return `sha256=<hex>` (as sent on the wire) when true.
 * @returns {string}
 */
export function sign(rawBody, secret, withPrefix = false) {
  const hex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return withPrefix ? `sha256=${hex}` : hex;
}

/**
 * Timing-safe verification of a BeZhas webhook signature. Accepts both the
 * `sha256=<hex>` form (CargoLink fan-out) and a bare `<hex>` (bank webhook).
 *
 * Express tip: capture the raw body, e.g.
 *   app.use('/bezhas-webhook', express.raw({ type: 'application/json' }))
 * then verify req.body (a Buffer) before JSON.parse.
 *
 * @param {string|Buffer} rawBody    Raw, unparsed request body.
 * @param {string} signature         Header value, e.g. req.headers['x-bezhas-signature'].
 * @param {string} secret            Shared webhook secret.
 * @returns {boolean}
 */
export function verify(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  let incoming;
  try {
    incoming = Buffer.from(normalizeSignature(signature), 'hex');
  } catch {
    return false;
  }
  // Lengths are public (hex of sha256 is always 64 chars) so this short-circuit is safe.
  if (incoming.length !== expected.length) return false;
  return crypto.timingSafeEqual(incoming, expected);
}

/**
 * Convenience guard that parses the body only after the signature checks out.
 * @param {string|Buffer} rawBody
 * @param {string} signatureHex
 * @param {string} secret
 * @returns {object} parsed JSON payload
 * @throws {Error} if the signature is invalid
 */
export function verifyAndParse(rawBody, signatureHex, secret) {
  if (!verify(rawBody, signatureHex, secret)) {
    const err = new Error('Invalid BeZhas webhook signature');
    err.code = 'INVALID_SIGNATURE';
    throw err;
  }
  return JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
}
