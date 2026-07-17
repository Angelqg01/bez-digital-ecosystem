'use strict';

/**
 * cargoIngestHub — third-party ingestion for BZ CargoLink (API-First hub).
 *
 * External systems (carriers, port authorities, customs single-window, LoRaWAN
 * network servers like ChirpStack) push status webhooks to
 *     POST /api/cargolink/v1/ingest/:providerId
 * The request is verified (HMAC-SHA256 over the RAW body + timestamp window +
 * single-use nonce), mapped declaratively to the canonical event payload and
 * fed into the SAME pipeline as proprietary hardware (cargoLinkIot.runPipeline
 * via ingestCanonical) — symmetric entries.
 *
 * Signature scheme (documented for integrators):
 *   headers:
 *     X-BeZhas-Timestamp: unix seconds
 *     X-BeZhas-Nonce:     unique string per request
 *     X-BeZhas-Signature: sha256=HEX( HMAC_SHA256(secret, `${timestamp}.${nonce}.${rawBody}`) )
 *   The timestamp must be within ±300s of server time; a (provider, nonce)
 *   pair is single-use (replay protection).
 *
 * Declarative mapping (cargolink_providers.mapping):
 *   {
 *     "buidField":   "shipment.reference",          // dot-path to the B-UID
 *     "eventField":  "status",                      // dot-path to the provider's event code
 *     "events":      { "SEAL_OPEN": "CONTAINER_UNSEALED", "POD": "CHECKPOINT_DELIVERED" },
 *     "systemIdField": "device.id",
 *     "timestampField": "occurred_at",
 *     "telemetryFields": {                          // provider path -> canonical metric
 *       "location.lat": "lat", "location.lng": "lng",
 *       "sensors.temp_c": "temperature", "sensors.humidity_pct": "humidity",
 *       "sensors.shock_g": "shock", "sensors.light_lux": "light",
 *       "sensors.pressure_hpa": "pressure", "seal.state": "seal"
 *     }
 *   }
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');
const iot = require('./cargoLinkIot');

const TIMESTAMP_TOLERANCE_S = 300;
const PROVIDER_KINDS = ['carrier', 'port_authority', 'customs', 'forwarder', 'network_server'];

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Dot-path getter: getPath({a:{b:1}}, 'a.b') → 1. */
function getPath(obj, path) {
  if (!path) return undefined;
  return String(path).split('.').reduce((acc, k) => (acc === null || acc === undefined ? undefined : acc[k]), obj);
}

/** Owner registers an external provider. Returns the HMAC secret once. */
async function registerProvider(req, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!['pos', 'admin'].includes(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot register providers (only pos/admin)`, 403);
  }
  if (!body.name) throw httpError('name is required (e.g. DHL_API, PORT_AUTHORITY_ALGECIRAS)', 400);
  const kind = body.kind || 'carrier';
  if (!PROVIDER_KINDS.includes(kind)) throw httpError(`Invalid kind. One of: ${PROVIDER_KINDS.join(', ')}`, 400);

  const providerId = `prv_${crypto.randomBytes(8).toString('hex')}`;
  const secret = `bzp_${crypto.randomBytes(24).toString('hex')}`;

  const { rows } = await query(
    `INSERT INTO cargolink_providers (provider_id, bezhas_id, name, kind, secret, mapping)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     RETURNING id, provider_id, name, kind, mapping, status, created_at`,
    [providerId, identity.bezhasId, body.name, kind, secret, JSON.stringify(body.mapping || {})]
  );
  return { success: true, provider: rows[0], secret, ingestUrl: `/api/cargolink/v1/ingest/${rows[0].provider_id}` };
}

async function listProviders(req) {
  const identity = await lifecycle.resolveIdentity(req);
  const { rows } = await query(
    `SELECT id, provider_id, name, kind, mapping, status, last_event_at, created_at
       FROM cargolink_providers WHERE bezhas_id = $1 ORDER BY created_at DESC`,
    [identity.bezhasId]
  );
  return { success: true, count: rows.length, providers: rows };
}

/**
 * Verify an inbound webhook: HMAC over the RAW body, timestamp window, nonce.
 * Pure except for the nonce insert. Returns the provider row.
 */
async function verifyInbound({ providerId, rawBody, headers }) {
  const { rows } = await query(
    `SELECT id, provider_id, bezhas_id, name, kind, secret, mapping, status
       FROM cargolink_providers WHERE provider_id = $1`,
    [providerId]
  );
  if (!rows.length) throw httpError('Unknown provider', 404);
  const provider = rows[0];
  if (provider.status !== 'active') throw httpError('Provider is not active', 403);

  const timestamp = headers['x-bezhas-timestamp'];
  const nonce = headers['x-bezhas-nonce'];
  const signatureHeader = headers['x-bezhas-signature'] || '';
  if (!timestamp || !nonce || !signatureHeader) {
    throw httpError('Missing X-BeZhas-Timestamp, X-BeZhas-Nonce or X-BeZhas-Signature header', 401);
  }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(skew) || skew > TIMESTAMP_TOLERANCE_S) {
    throw httpError(`Timestamp outside ±${TIMESTAMP_TOLERANCE_S}s window`, 401);
  }

  const expected = crypto
    .createHmac('sha256', provider.secret)
    .update(`${timestamp}.${nonce}.${rawBody}`)
    .digest('hex');
  const received = signatureHeader.replace(/^sha256=/, '');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw httpError('Invalid HMAC signature', 401);
  }

  // Replay protection: (provider, nonce) is single-use.
  try {
    await query(
      `INSERT INTO cargolink_ingest_nonces (provider_id, nonce) VALUES ($1, $2)`,
      [providerId, String(nonce).slice(0, 96)]
    );
  } catch (err) {
    if (String(err.message).includes('duplicate') || err.code === '23505') {
      throw httpError('Nonce already used (replay rejected)', 409);
    }
    throw err;
  }

  return provider;
}

/** Apply the provider's declarative mapping to its raw payload. Pure. */
function applyMapping(mapping = {}, payload = {}) {
  const providerEvent = getPath(payload, mapping.eventField);
  const eventType =
    (mapping.events && providerEvent !== undefined && mapping.events[providerEvent]) ||
    (typeof providerEvent === 'string' ? providerEvent : null);

  const telemetry = {};
  for (const [srcPath, metric] of Object.entries(mapping.telemetryFields || {})) {
    const v = getPath(payload, srcPath);
    if (v !== undefined && v !== null) telemetry[metric] = v;
  }

  return {
    bUid: getPath(payload, mapping.buidField || 'bUid') ?? payload.tracking_id ?? null,
    eventType,
    systemId: getPath(payload, mapping.systemIdField) ?? null,
    recordedAt: getPath(payload, mapping.timestampField) ?? null,
    telemetry,
  };
}

/**
 * Full inbound flow: verify → map → canonical pipeline. `rawBody` is the exact
 * byte string the sender signed (the route uses express.raw for this).
 */
async function ingestFromProvider({ providerId, rawBody, headers }) {
  const provider = await verifyInbound({ providerId, rawBody, headers });

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw httpError('Body is not valid JSON', 400);
  }

  const event = applyMapping(provider.mapping || {}, payload);
  if (!event.bUid) throw httpError('Mapped event has no B-UID (check mapping.buidField)', 422);

  const result = await iot.ingestCanonical({ provider, event });
  await query(`UPDATE cargolink_providers SET last_event_at = NOW() WHERE provider_id = $1`, [providerId]);

  return { ...result, provider: provider.name, eventType: event.eventType };
}

module.exports = {
  registerProvider,
  listProviders,
  verifyInbound,
  applyMapping,
  ingestFromProvider,
  getPath,
  TIMESTAMP_TOLERANCE_S,
};
