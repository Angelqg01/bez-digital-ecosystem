'use strict';

/**
 * publisher.js — builds the canonical telemetry payload and ships it to MQTT.
 *
 * Payload shape and topics match docs/ARQUITECTURA_REAL_Y_PLAN.md §3.1 and the
 * backend ingester api/services/vppMqttBroker.js, so a real Edge Gateway feeds
 * the existing pipeline with ZERO frontend/backend changes:
 *
 *     topic:   bezhas/edge/<nodeId>/telemetry
 *     payload: { type, name, status, protocol, metrics, ts, seq[, sig] }
 *
 * `seq` is a per-node monotonic counter (anti-replay groundwork for Phase 2).
 * `sig` (hardware signature) is intentionally NOT added here — that is Phase 2,
 * and the field is additive so emitting it later changes nothing downstream.
 *
 * When the broker is unreachable, payloads go to the store-and-forward buffer
 * and are flushed on reconnect.
 */

const TELEMETRY_TOPIC = (nodeId) => `bezhas/edge/${nodeId}/telemetry`;

function createPublisher(opts = {}) {
  const {
    brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username,
    password,
    buffer,
    logger = console,
    dryRun = false,
    signer = null, // Phase 2: optional Signer ({ keyId, sign(payload) }) per gateway
    controlHandler = null, // Phase 5: async (nodeId, command) → ack ; subscribed on connect
  } = opts;

  let client = null;
  let connected = false;
  const seqByNode = new Map();

  const CONTROL_SUB = 'bezhas/edge/+/control';
  const ackTopic = (nodeId) => `bezhas/edge/${nodeId}/control/ack`;
  const controlNodeId = (topic) => { const p = String(topic).split('/'); return p.length >= 4 ? p[2] : null; };

  function nextSeq(nodeId) {
    const next = (seqByNode.get(nodeId) || 0) + 1;
    seqByNode.set(nodeId, next);
    return next;
  }

  /** Build the canonical telemetry payload from a driver reading. */
  function buildPayload(node, reading) {
    const payload = {
      type: node.type,
      name: node.name,
      status: reading.status || 'ONLINE',
      protocol: node.protocol || 'Modbus-TCP',
      metrics: reading.metrics,
      ts: new Date().toISOString(),
      seq: nextSeq(node.nodeId),
    };
    // Phase 2 — sign over canonical(payload + keyId); `keyId`+`sig` are additive,
    // so a backend that doesn't yet verify still ingests these unchanged.
    if (signer) {
      payload.keyId = signer.keyId;
      payload.sig = signer.sign(payload);
    }
    return payload;
  }

  async function connect() {
    if (dryRun) { connected = false; return; }
    const mqtt = require('mqtt');
    client = mqtt.connect(brokerUrl, {
      username, password,
      clientId: `bezhas-edge-pub-${Date.now()}`,
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
    });

    client.on('connect', () => {
      connected = true;
      logger.info?.(`[edge-pub] connected to ${brokerUrl}`);
      flushBuffer();
      if (controlHandler) {
        client.subscribe(CONTROL_SUB, (err) => {
          if (err) logger.warn?.(`[edge-pub] control subscribe failed: ${err.message}`);
          else logger.info?.('[edge-pub] subscribed to SCADA control');
        });
      }
    });
    client.on('reconnect', () => logger.info?.('[edge-pub] reconnecting...'));
    client.on('close', () => { connected = false; });
    client.on('error', (err) => logger.warn?.(`[edge-pub] mqtt error: ${err.message}`));

    // Phase 5 — apply backend-signed control commands and ACK the result.
    if (controlHandler) {
      client.on('message', async (topic, message) => {
        const nodeId = controlNodeId(topic);
        if (!nodeId) return;
        try {
          const ack = await controlHandler(nodeId, JSON.parse(message.toString()));
          if (ack) client.publish(ackTopic(nodeId), JSON.stringify(ack), { qos: 1 });
        } catch (err) {
          logger.warn?.(`[edge-pub] control handler error on ${topic}: ${err.message}`);
        }
      });
    }

    return client;
  }

  function _send(topic, payload) {
    return new Promise((resolve) => {
      if (!client || !connected) { if (buffer) buffer.push(topic, payload); return resolve(false); }
      client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) { if (buffer) buffer.push(topic, payload); return resolve(false); }
        resolve(true);
      });
    });
  }

  /** Publish one node reading. Returns true if sent live, false if buffered. */
  async function publish(node, reading) {
    const payload = buildPayload(node, reading);
    const topic = TELEMETRY_TOPIC(node.nodeId);
    if (dryRun) { logger.info?.(`[edge-pub][dry-run] ${topic} ${JSON.stringify(payload)}`); return true; }
    return _send(topic, payload);
  }

  /** Drain the store-and-forward buffer to the broker (best-effort). */
  async function flushBuffer() {
    if (!buffer || !connected) return;
    const records = buffer.drain();
    if (!records.length) return;
    logger.info?.(`[edge-pub] flushing ${records.length} buffered records`);
    for (const r of records) {
      const ok = await _send(r.topic, r.payload);
      if (!ok) break; // link dropped again → remaining stay buffered via _send
    }
  }

  async function close() {
    if (client) {
      await new Promise((res) => client.end(false, {}, res));
      client = null;
      connected = false;
    }
  }

  return { connect, publish, buildPayload, flushBuffer, close, isConnected: () => connected };
}

module.exports = { createPublisher, TELEMETRY_TOPIC };
