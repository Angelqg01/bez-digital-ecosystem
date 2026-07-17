'use strict';

/**
 * cargoLinkIot — IoT / hardware ingestion for BZ CargoLink (v2: unified hub).
 *
 * Devices (GPS, temp/humidity, shock, RFID, e-seals, light, barometric, BLE)
 * register under a BeZhas_ID and optionally bind to a B-UID. They push telemetry
 * which is normalized into ONE canonical event shape, rule-checked (cold-chain /
 * shock / light / pressure / seal / geofence), graded by the dispute oracle and
 * — on moderate/critical verdicts — holds the BEZ escrow (DISPUTED) besides
 * fanning out the signed webhook. Third-party providers (cargoIngestHub) feed
 * the SAME pipeline via ingestCanonical(): hardware and external APIs are
 * symmetric entries.
 *
 * Edge trust levels:
 *   key    — device authenticated with its bearer key (default)
 *   signed — payload additionally carries a secp256k1 signature verified
 *            against the device's registered signer_address
 *   hmac   — third-party webhook verified via HMAC-SHA256 (cargoIngestHub)
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');
const geofence = require('./cargoGeofence');
const oracle = require('./cargoDisputeOracle');

const DEFAULT_CONFIG = {
  tempMin: 2,
  tempMax: 8,
  shockMax: 5,          // g
  lightMaxLux: 50,      // light inside a sealed unit above this = intrusion
  humidityMin: null,    // % — rule active only when configured
  humidityMax: null,
  pressureMinHpa: null, // hPa — rule active only when configured (air cargo)
  pressureMaxHpa: null,
};

const DEVICE_TYPES = ['gps', 'temp', 'shock', 'rfid', 'multi', 'eseal', 'light', 'baro', 'ble', 'humidity'];

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hashKey(key = '') {
  return key ? crypto.createHash('sha256').update(key).digest('hex') : null;
}

function getKey(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-device-key'] || '';
}

/** Owner registers a device. Returns the device key once (store it on the device). */
async function registerDevice(req, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!['pos', 'admin'].includes(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot register devices (only pos/admin)`, 403);
  }
  const type = body.type || 'multi';
  if (!DEVICE_TYPES.includes(type)) throw httpError(`Invalid device type. One of: ${DEVICE_TYPES.join(', ')}`, 400);

  let signerAddress = null;
  if (body.signerAddress) {
    if (!ethers.isAddress(body.signerAddress)) throw httpError('signerAddress is not a valid address', 400);
    signerAddress = ethers.getAddress(body.signerAddress);
  }

  const deviceId = body.deviceId || `dev_${crypto.randomBytes(6).toString('hex')}`;
  const deviceKey = `bzd_${crypto.randomBytes(20).toString('hex')}`;
  const config = { ...DEFAULT_CONFIG, ...(body.config || {}) };

  const { rows } = await query(
    `INSERT INTO cargolink_devices (device_id, key_hash, bezhas_id, type, b_uid, config, label, signer_address)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING id, device_id, type, b_uid, config, label, status, signer_address, created_at`,
    [deviceId, hashKey(deviceKey), identity.bezhasId, type, body.bUid || null, JSON.stringify(config), body.label || `${type} device`, signerAddress]
  );
  return { success: true, device: rows[0], deviceKey };
}

/** Resolve a device from its key (devices authenticate with their own key). */
async function resolveDevice(req) {
  const key = getKey(req);
  if (!key) throw httpError('Missing device key (Authorization: Bearer <device key>)', 401);
  return resolveDeviceByKey(key);
}

/** Key → device row (shared by HTTP and MQTT ingestion). */
async function resolveDeviceByKey(key) {
  const { rows } = await query(
    `SELECT device_id, bezhas_id, type, b_uid, config, status, signer_address FROM cargolink_devices WHERE key_hash = $1`,
    [hashKey(key)]
  );
  if (rows.length === 0) throw httpError('Unknown device key', 401);
  if (rows[0].status !== 'active') throw httpError('Device is not active', 403);
  return rows[0];
}

/** Build a normalized reading list from either `readings[]` or flat sensor fields. */
function normalizeReadings(body = {}) {
  if (Array.isArray(body.readings) && body.readings.length > 0) {
    return body.readings.map((r) => ({
      metric: r.metric,
      value: r.metric === 'seal' ? sealValue(r.state ?? r.value) : num(r.value),
      unit: r.unit || null,
      lat: num(r.lat), lng: num(r.lng),
      tag: r.tag !== undefined ? String(r.tag) : undefined,
      zone: r.zone !== undefined ? String(r.zone) : undefined,
    }));
  }
  const out = [];
  if (body.temperature !== undefined) out.push({ metric: 'temperature', value: num(body.temperature), unit: '°C', lat: null, lng: null });
  if (body.humidity !== undefined) out.push({ metric: 'humidity', value: num(body.humidity), unit: '%', lat: null, lng: null });
  if (body.shock !== undefined) out.push({ metric: 'shock', value: num(body.shock), unit: 'g', lat: null, lng: null });
  if (body.light !== undefined) out.push({ metric: 'light', value: num(body.light), unit: 'lux', lat: null, lng: null });
  if (body.pressure !== undefined) out.push({ metric: 'pressure', value: num(body.pressure), unit: 'hPa', lat: null, lng: null });
  if (body.seal !== undefined) out.push({ metric: 'seal', value: sealValue(body.seal), unit: 'state', lat: null, lng: null });
  if (body.bleZone !== undefined) out.push({ metric: 'ble_zone', value: null, unit: 'zone', lat: null, lng: null, zone: String(body.bleZone) });
  if (body.rfid !== undefined) out.push({ metric: 'rfid', value: null, unit: 'tag', lat: null, lng: null, tag: String(body.rfid) });
  if (body.lat !== undefined && body.lng !== undefined) out.push({ metric: 'gps', value: null, unit: 'deg', lat: num(body.lat), lng: num(body.lng) });
  return out;
}

/** seal state → 1 (open) | 0 (closed). Accepts 'open'/'closed'/true/false/1/0. */
function sealValue(state) {
  if (state === 'open' || state === true || state === 1 || state === '1') return 1;
  if (state === 'closed' || state === false || state === 0 || state === '0') return 0;
  return num(state);
}

/**
 * Apply the rule matrix to a reading. Pure — unit-testable.
 * ctx = { geo, txStatus } where geo = cargoGeofence.evaluatePoint() result (or null).
 * Returns { breach, reason, eventType, tamper }.
 */
function checkRule(reading, config, ctx = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  const geo = ctx.geo || null;

  if (reading.metric === 'temperature' && reading.value !== null) {
    if (reading.value < cfg.tempMin || reading.value > cfg.tempMax) {
      return { breach: true, tamper: false, eventType: 'COLD_CHAIN_BREACH', reason: `temperature ${reading.value}°C outside [${cfg.tempMin},${cfg.tempMax}]` };
    }
  }
  if (reading.metric === 'shock' && reading.value !== null && reading.value > cfg.shockMax) {
    return { breach: true, tamper: false, eventType: 'SHOCK_ALERT', reason: `shock ${reading.value}g exceeds ${cfg.shockMax}g` };
  }
  if (reading.metric === 'humidity' && reading.value !== null && (cfg.humidityMin !== null || cfg.humidityMax !== null)) {
    const min = cfg.humidityMin ?? -Infinity;
    const max = cfg.humidityMax ?? Infinity;
    if (reading.value < min || reading.value > max) {
      return { breach: true, tamper: false, eventType: 'HUMIDITY_BREACH', reason: `humidity ${reading.value}% outside [${cfg.humidityMin ?? '-'},${cfg.humidityMax ?? '-'}]` };
    }
  }
  if (reading.metric === 'light' && reading.value !== null && reading.value > cfg.lightMaxLux) {
    // Light inside a sealed unit: intrusion unless we are inside an authorized inspection zone.
    const authorized = Boolean(geo && geo.authorizedForUnseal);
    return {
      breach: !authorized,
      tamper: !authorized,
      eventType: 'LIGHT_BREACH',
      reason: `light ${reading.value} lux exceeds ${cfg.lightMaxLux} lux${authorized ? ' (inside authorized zone)' : ' outside any authorized zone'}`,
    };
  }
  if (reading.metric === 'pressure' && reading.value !== null && (cfg.pressureMinHpa !== null || cfg.pressureMaxHpa !== null)) {
    const min = cfg.pressureMinHpa ?? -Infinity;
    const max = cfg.pressureMaxHpa ?? Infinity;
    if (reading.value < min || reading.value > max) {
      return { breach: true, tamper: false, eventType: 'PRESSURE_LOSS', reason: `pressure ${reading.value} hPa outside [${cfg.pressureMinHpa ?? '-'},${cfg.pressureMaxHpa ?? '-'}]` };
    }
  }
  if (reading.metric === 'seal' && reading.value === 1) {
    // E-seal opened. Inside a customs/port/warehouse zone → legitimate inspection.
    // Outside every authorized zone (with fences configured) → tampering.
    const fencesConfigured = Boolean(geo && geo.verified !== null);
    const authorized = Boolean(geo && geo.authorizedForUnseal);
    const tamper = fencesConfigured && !authorized;
    return {
      breach: tamper,
      tamper,
      eventType: 'CONTAINER_UNSEALED',
      reason: tamper
        ? 'e-seal opened outside any authorized customs/port/warehouse zone'
        : `e-seal opened${authorized ? ` inside authorized zone (${geo.matched.join(', ')})` : ''}`,
    };
  }
  if (reading.metric === 'gps' && geo && geo.corridorExit) {
    return { breach: true, tamper: false, eventType: 'GEOFENCE_EXIT', reason: 'GPS fix outside all enforced route corridors' };
  }
  return { breach: false, tamper: false, eventType: 'READING', reason: null };
}

/**
 * Verify the optional edge signature of a telemetry batch.
 * Devices with a registered signer_address MUST sign; canonical message is
 *   JSON.stringify({ deviceId, bUid, recordedAt, readings })
 * signed with EIP-191 personal_sign (ethers Wallet.signMessage).
 */
function verifyEdgeSignature(device, body, bUid) {
  if (!device.signer_address) return 'key';
  if (!body.signature) throw httpError('Device has a registered signer: payload signature is required', 401);
  if (!Array.isArray(body.readings)) throw httpError('Signed payloads must use the readings[] form', 400);
  const canonical = JSON.stringify({
    deviceId: device.device_id,
    bUid: bUid || null,
    recordedAt: body.recordedAt || null,
    readings: body.readings,
  });
  let recovered;
  try {
    recovered = ethers.verifyMessage(canonical, body.signature);
  } catch {
    throw httpError('SIGNATURE_INVALID: malformed signature', 401);
  }
  if (recovered.toLowerCase() !== device.signer_address.toLowerCase()) {
    throw httpError('SIGNATURE_INVALID: signature does not match the registered signer', 401);
  }
  return 'signed';
}

/** Load lifecycle context (tx + geofences) for a shipment. Both may be null. */
async function loadShipmentContext(bezhasId, bUid) {
  if (!bUid) return { tx: null, fences: [] };
  const { rows } = await query(
    `SELECT * FROM cargolink_transactions WHERE b_uid = $1 AND owner_bezhas_id = $2`,
    [bUid, bezhasId]
  );
  const fences = await geofence.fencesFor(bezhasId, bUid);
  return { tx: rows[0] || null, fences };
}

/**
 * Shared pipeline: store canonical readings, run rules, grade breaches, hold
 * escrow and fan out webhooks. Used by device HTTP/MQTT ingestion AND by the
 * third-party hub (symmetric entries).
 */
async function runPipeline({ source, bezhasId, bUid, readings, recordedAt, explicitEventType = null }) {
  const { tx, fences } = await loadShipmentContext(bezhasId, bUid);

  // Batch position: first reading that carries coordinates.
  const positioned = readings.find((r) => r.lat !== null && r.lat !== undefined && r.lng !== null && r.lng !== undefined);
  const geo = positioned
    ? geofence.evaluatePoint(Number(positioned.lat), Number(positioned.lng), fences)
    : null;

  const ctx = { geo, txStatus: tx ? tx.status : null };
  const stored = [];
  const breaches = [];

  for (const r of readings) {
    if (!r.metric) continue;
    const verdict = checkRule(r, source.config, ctx);
    const eventType = explicitEventType && verdict.eventType === 'READING' ? explicitEventType : verdict.eventType;
    const reasonText = verdict.reason || (r.tag ? `tag:${r.tag}` : r.zone ? `zone:${r.zone}` : null);
    const { rows } = await query(
      `INSERT INTO cargolink_telemetry
         (device_id, bezhas_id, b_uid, metric, value, unit, lat, lng, breach, reason, recorded_at,
          event_type, provider, system_id, tamper, geofence_verified, trust_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id, metric, value, unit, breach, reason, event_type, tamper, geofence_verified, trust_level`,
      [
        source.systemId, bezhasId, bUid, r.metric, r.value, r.unit, r.lat, r.lng,
        verdict.breach, reasonText, recordedAt,
        eventType, source.provider, source.systemId, verdict.tamper,
        geo ? geo.verified : null, source.trustLevel,
      ]
    );
    stored.push(rows[0]);
    if (verdict.breach) {
      breaches.push({
        metric: r.metric, value: r.value, eventType: verdict.eventType,
        tamper: verdict.tamper, reason: verdict.reason, config: source.config,
      });
    }
  }

  // Grade the batch and act on the verdict (oracle = severity matrix).
  let verdict = null;
  let dispute = null;
  const deliveries = [];
  if (breaches.length > 0) {
    verdict = oracle.evaluate({ breaches, tx: tx || {} });
    if (tx) dispute = await oracle.applyVerdict({ tx, verdict });
    const txLike = tx || {
      owner_bezhas_id: bezhasId, b_uid: bUid, status: 'TELEMETRY_ALERT',
      pos_ref: null, escrow_status: 'NONE',
    };
    const out = await lifecycle.fanoutWebhooks({
      tx: { ...txLike, escrow_status: dispute ? 'DISPUTED' : txLike.escrow_status },
      eventName: verdict.webhookEvent,
    });
    deliveries.push(...out);
  }

  return {
    success: true,
    bUid,
    stored: stored.length,
    readings: stored,
    breaches: breaches.map(({ config, ...b }) => b),
    verdict,
    dispute: dispute ? { id: dispute.id, severity: dispute.severity, action: dispute.action } : null,
    webhookDeliveries: deliveries,
  };
}

/**
 * Ingest a telemetry batch from a registered device (HTTP or MQTT).
 * Stores each reading, flags breaches, grades them and reacts on the escrow.
 */
async function ingestTelemetry(req, body = {}) {
  const device = await resolveDevice(req);
  return ingestForDevice(device, body);
}

/** Device ingestion given an already-resolved device (shared with MQTT). */
async function ingestForDevice(device, body = {}) {
  const bUid = body.bUid || device.b_uid || null;
  const trustLevel = verifyEdgeSignature(device, body, bUid);
  const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();

  const readings = normalizeReadings(body);
  if (readings.length === 0) throw httpError('No readings provided', 400);

  const result = await runPipeline({
    source: {
      provider: 'PROPRIETARY_DEVICE',
      systemId: device.device_id,
      trustLevel,
      config: device.config,
    },
    bezhasId: device.bezhas_id,
    bUid,
    readings,
    recordedAt,
  });

  await query(`UPDATE cargolink_devices SET last_seen_at = NOW() WHERE device_id = $1`, [device.device_id]);
  return { ...result, deviceId: device.device_id, trustLevel };
}

/**
 * Ingest a canonical event from a third-party provider (cargoIngestHub).
 * `event` is already normalized to the unified payload:
 *   { bUid, eventType, recordedAt, telemetry: { lat, lng, temperature, ... }, systemId }
 */
async function ingestCanonical({ provider, event }) {
  const readings = normalizeReadings(event.telemetry || {});
  // An explicit event with no sensor metrics (e.g. a status webhook) still
  // produces one canonical row so the timeline is complete.
  if (event.eventType === 'CONTAINER_UNSEALED' && !readings.some((r) => r.metric === 'seal')) {
    readings.push({ metric: 'seal', value: 1, unit: 'state', lat: num(event.telemetry?.lat), lng: num(event.telemetry?.lng) });
  }
  if (readings.length === 0) {
    readings.push({ metric: 'event', value: null, unit: null, lat: num(event.telemetry?.lat), lng: num(event.telemetry?.lng) });
  }
  return runPipeline({
    source: {
      provider: provider.name,
      systemId: event.systemId || provider.provider_id,
      trustLevel: 'hmac',
      // Thresholds for provider data come from the integration's mapping.config
      // (e.g. { tempMax: 8 } for a reefer feed); platform defaults otherwise.
      config: (provider.mapping && provider.mapping.config) || {},
    },
    bezhasId: provider.bezhas_id,
    bUid: event.bUid || null,
    readings,
    recordedAt: event.recordedAt ? new Date(event.recordedAt) : new Date(),
    explicitEventType: event.eventType || null,
  });
}

/** Read telemetry for a B-UID (the shipment's live hardware feed). */
async function getTelemetry(req, { bUid, limit = 50 } = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!bUid) throw httpError('bUid query param is required', 400);
  const { rows } = await query(
    `SELECT t.id, t.metric, t.value, t.unit, t.lat, t.lng, t.breach, t.reason, t.recorded_at, t.device_id,
            t.event_type, t.provider, t.system_id, t.tamper, t.geofence_verified, t.trust_level
       FROM cargolink_telemetry t
       JOIN cargolink_transactions tx ON tx.b_uid = t.b_uid
      WHERE t.b_uid = $1 AND tx.owner_bezhas_id = $2
      ORDER BY t.recorded_at DESC LIMIT $3`,
    [bUid, identity.bezhasId, Math.min(Number(limit) || 50, 200)]
  );
  return { success: true, bUid, count: rows.length, telemetry: rows };
}

module.exports = {
  registerDevice,
  resolveDevice,
  resolveDeviceByKey,
  ingestTelemetry,
  ingestForDevice,
  ingestCanonical,
  getTelemetry,
  normalizeReadings,
  checkRule,
  verifyEdgeSignature,
  DEFAULT_CONFIG,
  DEVICE_TYPES,
};
