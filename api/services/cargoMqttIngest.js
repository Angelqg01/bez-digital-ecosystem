'use strict';

/**
 * cargoMqttIngest — MQTT telemetry ingestion for BZ CargoLink devices (Fase 4).
 *
 * Trackers / e-seals / reefer loggers with intermittent connectivity publish to
 *     bezhas/cargo/<deviceId>/telemetry
 * with the SAME JSON body as POST /v1/iot/telemetry plus the device key:
 *     { "deviceKey": "bzd_…", "bUid": "BZ-LOG-…", "readings": [...], "signature": "0x…" }
 *
 * The handler authenticates the device by its key, then runs the exact same
 * pipeline as HTTP ingestion (rules → geofence → dispute oracle → webhooks).
 * Mirrors vppMqttBroker's design: `mqtt` is required lazily so the API boots
 * without the dependency/broker; connect() failures degrade gracefully.
 *
 * Enable with CARGO_MQTT_URL (e.g. mqtt://localhost:1883). Optional:
 * CARGO_MQTT_USERNAME / CARGO_MQTT_PASSWORD.
 */

const logger = require('../utils/logger');
const iot = require('./cargoLinkIot');

const TELEMETRY_TOPIC = 'bezhas/cargo/+/telemetry';

let client = null;
let connected = false;
const stats = { received: 0, accepted: 0, rejected: 0, lastError: null };

function topicDeviceId(topic) {
  const parts = String(topic).split('/');
  return parts.length >= 4 ? parts[2] : null;
}

/**
 * Handle one MQTT message. Exported for unit tests (no broker needed).
 * Returns the pipeline result, or null when rejected.
 */
async function handleMessage(topic, messageBuf) {
  stats.received += 1;
  const deviceIdFromTopic = topicDeviceId(topic);
  let body;
  try {
    body = JSON.parse(messageBuf.toString('utf8'));
  } catch {
    stats.rejected += 1;
    logger.warn('[CARGO-MQTT] non-JSON payload on %s', topic);
    return null;
  }
  try {
    if (!body.deviceKey) throw new Error('deviceKey missing in MQTT payload');
    const device = await iot.resolveDeviceByKey(body.deviceKey);
    if (deviceIdFromTopic && device.device_id !== deviceIdFromTopic) {
      throw new Error(`topic device ${deviceIdFromTopic} does not match key owner ${device.device_id}`);
    }
    const { deviceKey, ...telemetryBody } = body;
    const result = await iot.ingestForDevice(device, telemetryBody);
    stats.accepted += 1;
    return result;
  } catch (err) {
    stats.rejected += 1;
    stats.lastError = err.message;
    logger.warn('[CARGO-MQTT] rejected message on %s: %s', topic, err.message);
    return null;
  }
}

/** Connect to the broker and subscribe. Resolves false when disabled/unavailable. */
async function connect() {
  const url = process.env.CARGO_MQTT_URL;
  if (!url) return false;

  let mqtt;
  try {
    mqtt = require('mqtt'); // lazy: keep the API bootable without the dependency
  } catch {
    logger.warn('[CARGO-MQTT] mqtt package not installed — MQTT ingestion disabled');
    return false;
  }

  return new Promise((resolve) => {
    client = mqtt.connect(url, {
      username: process.env.CARGO_MQTT_USERNAME || undefined,
      password: process.env.CARGO_MQTT_PASSWORD || undefined,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });
    client.on('connect', () => {
      connected = true;
      client.subscribe(TELEMETRY_TOPIC, (err) => {
        if (err) logger.error('[CARGO-MQTT] subscribe failed: %s', err.message);
        else logger.info('[CARGO-MQTT] subscribed to %s', TELEMETRY_TOPIC);
      });
      resolve(true);
    });
    client.on('message', (topic, message) => { handleMessage(topic, message); });
    client.on('error', (err) => {
      stats.lastError = err.message;
      if (!connected) { logger.warn('[CARGO-MQTT] connection failed: %s', err.message); resolve(false); }
    });
    client.on('close', () => { connected = false; });
  });
}

function disconnect() {
  if (client) { client.end(true); client = null; connected = false; }
}

function getStatus() {
  return { enabled: Boolean(process.env.CARGO_MQTT_URL), connected, topic: TELEMETRY_TOPIC, ...stats };
}

module.exports = { connect, disconnect, handleMessage, getStatus, TELEMETRY_TOPIC };
