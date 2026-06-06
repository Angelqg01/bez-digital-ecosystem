'use strict';

/**
 * cargoLinkIot — IoT / hardware ingestion for BZ CargoLink.
 *
 * Devices (GPS, temp/humidity, shock, RFID) register under a BeZhas_ID and
 * optionally bind to a B-UID. They push telemetry which is stored, rule-checked
 * (cold-chain / shock), and on a breach fans out a signed webhook to the B-UID's
 * subscribers — same mechanism as the lifecycle. Hardware is just another
 * validated data source on the shared B-UID object.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');

const DEFAULT_CONFIG = { tempMin: 2, tempMax: 8, shockMax: 5 }; // cold-chain defaults

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
  const validTypes = ['gps', 'temp', 'shock', 'rfid', 'multi'];
  const type = body.type || 'multi';
  if (!validTypes.includes(type)) throw httpError(`Invalid device type. One of: ${validTypes.join(', ')}`, 400);

  const deviceId = body.deviceId || `dev_${crypto.randomBytes(6).toString('hex')}`;
  const deviceKey = `bzd_${crypto.randomBytes(20).toString('hex')}`;
  const config = { ...DEFAULT_CONFIG, ...(body.config || {}) };

  const { rows } = await query(
    `INSERT INTO cargolink_devices (device_id, key_hash, bezhas_id, type, b_uid, config, label)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id, device_id, type, b_uid, config, label, status, created_at`,
    [deviceId, hashKey(deviceKey), identity.bezhasId, type, body.bUid || null, JSON.stringify(config), body.label || `${type} device`]
  );
  return { success: true, device: rows[0], deviceKey };
}

/** Resolve a device from its key (devices authenticate with their own key). */
async function resolveDevice(req) {
  const key = getKey(req);
  if (!key) throw httpError('Missing device key (Authorization: Bearer <device key>)', 401);
  const { rows } = await query(
    `SELECT device_id, bezhas_id, type, b_uid, config, status FROM cargolink_devices WHERE key_hash = $1`,
    [hashKey(key)]
  );
  if (rows.length === 0) throw httpError('Unknown device key', 401);
  if (rows[0].status !== 'active') throw httpError('Device is not active', 403);
  return rows[0];
}

/** Build a normalized reading list from either `readings[]` or flat sensor fields. */
function normalizeReadings(body = {}) {
  if (Array.isArray(body.readings) && body.readings.length > 0) {
    return body.readings.map(r => ({
      metric: r.metric, value: num(r.value), unit: r.unit || null,
      lat: num(r.lat), lng: num(r.lng),
    }));
  }
  const out = [];
  if (body.temperature !== undefined) out.push({ metric: 'temperature', value: num(body.temperature), unit: '°C', lat: null, lng: null });
  if (body.humidity !== undefined) out.push({ metric: 'humidity', value: num(body.humidity), unit: '%', lat: null, lng: null });
  if (body.shock !== undefined) out.push({ metric: 'shock', value: num(body.shock), unit: 'g', lat: null, lng: null });
  if (body.rfid !== undefined) out.push({ metric: 'rfid', value: null, unit: 'tag', lat: null, lng: null, tag: String(body.rfid) });
  if (body.lat !== undefined && body.lng !== undefined) out.push({ metric: 'gps', value: null, unit: 'deg', lat: num(body.lat), lng: num(body.lng) });
  return out;
}

/** Apply cold-chain / shock rules to a reading. Returns { breach, reason }. */
function checkRule(reading, config) {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  if (reading.metric === 'temperature' && reading.value !== null) {
    if (reading.value < cfg.tempMin || reading.value > cfg.tempMax) {
      return { breach: true, reason: `temperature ${reading.value}°C outside [${cfg.tempMin},${cfg.tempMax}]` };
    }
  }
  if (reading.metric === 'shock' && reading.value !== null && reading.value > cfg.shockMax) {
    return { breach: true, reason: `shock ${reading.value}g exceeds ${cfg.shockMax}g` };
  }
  return { breach: false, reason: null };
}

/**
 * Ingest a telemetry batch from a device. Stores each reading, flags breaches,
 * updates last_seen, and emits a signed webhook to the B-UID subscribers on any
 * cold-chain / shock breach.
 */
async function ingestTelemetry(req, body = {}) {
  const device = await resolveDevice(req);
  const bUid = body.bUid || device.b_uid || null;
  const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();

  const readings = normalizeReadings(body);
  if (readings.length === 0) throw httpError('No readings provided', 400);

  const stored = [];
  const breaches = [];

  for (const r of readings) {
    if (!r.metric) continue;
    const { breach, reason } = checkRule(r, device.config);
    const reasonText = reason || (r.tag ? `tag:${r.tag}` : null);
    const { rows } = await query(
      `INSERT INTO cargolink_telemetry
         (device_id, bezhas_id, b_uid, metric, value, unit, lat, lng, breach, reason, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, metric, value, unit, breach, reason`,
      [device.device_id, device.bezhas_id, bUid, r.metric, r.value, r.unit, r.lat, r.lng, breach, reasonText, recordedAt]
    );
    stored.push(rows[0]);
    if (breach) breaches.push({ metric: r.metric, reason });
  }

  await query(`UPDATE cargolink_devices SET last_seen_at = NOW() WHERE device_id = $1`, [device.device_id]);

  // On a breach, reflect it to the B-UID's subscribers (incl. POS).
  const deliveries = [];
  if (breaches.length > 0) {
    const hasTemp = breaches.some(b => b.metric === 'temperature');
    const eventName = hasTemp ? 'ON_COLD_CHAIN_BREACH' : 'ON_SHOCK_ALERT';
    const txLike = {
      owner_bezhas_id: device.bezhas_id,
      b_uid: bUid,
      status: 'TELEMETRY_ALERT',
      pos_ref: null,
      escrow_status: 'NONE',
    };
    const out = await lifecycle.fanoutWebhooks({ tx: txLike, eventName });
    deliveries.push(...out);
  }

  return {
    success: true,
    deviceId: device.device_id,
    bUid,
    stored: stored.length,
    readings: stored,
    breaches,
    webhookDeliveries: deliveries,
  };
}

/** Read telemetry for a B-UID (the shipment's live hardware feed). */
async function getTelemetry(req, { bUid, limit = 50 } = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!bUid) throw httpError('bUid query param is required', 400);
  const { rows } = await query(
    `SELECT t.metric, t.value, t.unit, t.lat, t.lng, t.breach, t.reason, t.recorded_at, t.device_id
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
  ingestTelemetry,
  getTelemetry,
  normalizeReadings,
  checkRule,
  DEFAULT_CONFIG,
};
