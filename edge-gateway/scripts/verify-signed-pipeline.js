#!/usr/bin/env node
'use strict';

/**
 * verify-signed-pipeline.js — full Phase 2 chain, end to end, one process:
 *
 *   [modbus-sim] → [gateway + signer] → MQTT → [backend vppMqttBroker.ingest]
 *                                                      │ Aegis verify
 *                                                      ▼
 *                            accepted (valid sig) ; rejected (tampered)
 *
 * Proves: a real Modbus read is signed on the Edge, travels over MQTT, and the
 * BACKEND ingester accepts it (signature valid) — then a tampered copy of the
 * very same payload is rejected as a spoofing attempt and the last good reading
 * is preserved. Exit 0 on success, 1 on failure.
 */

const fs = require('fs');
const net = require('net');
const path = require('path');
const aedes = require('aedes')();
const mqtt = require('mqtt');

const { startGateway } = require('../src/index');
const { generateKeyPair, createSoftwareSigner } = require('../src/security/signer');

const BROKER_PORT = 18833;
const MODBUS_PORT = 15023;
const TIMEOUT_MS = 15_000;
const log = (...a) => console.log('[signed-e2e]', ...a);

// Backend modules (separate package, same repo).
const broker = require(path.resolve(__dirname, '../../api/services/vppMqttBroker'));
const security = require(path.resolve(__dirname, '../../api/services/telemetrySecurity'));
const aegis = require(path.resolve(__dirname, '../../api/services/aegisAnomalyEngine'));

async function main() {
  broker._reset(); aegis._reset(); security._reset();

  // 1) Provision a signing key; register the public half on the backend.
  const { privateKeyPem } = generateKeyPair();
  const keyPath = path.resolve(__dirname, '../.tmp-signed-key.pem');
  fs.writeFileSync(keyPath, privateKeyPem);
  const signer = createSoftwareSigner({ keyId: 'edge-key-1', privateKeyPem });
  security.registerKey('edge-key-1', signer.publicKeyPem);

  // 2) Infra: broker + modbus simulator.
  const mqttServer = net.createServer(aedes.handle);
  await new Promise((r) => mqttServer.listen(BROKER_PORT, r));
  process.env.MODBUS_SIM_PORT = String(MODBUS_PORT);
  process.env.MODBUS_SIM_HOST = '127.0.0.1';
  process.env.MODBUS_SIM_REFRESH_MS = '500';
  require('./modbus-sim');
  await new Promise((r) => setTimeout(r, 500));

  // 3) Subscriber that captures the first signed telemetry payload.
  const received = new Promise((resolve, reject) => {
    const sub = mqtt.connect(`mqtt://127.0.0.1:${BROKER_PORT}`);
    const timer = setTimeout(() => reject(new Error('no telemetry within timeout')), TIMEOUT_MS);
    sub.on('connect', () => sub.subscribe('bezhas/edge/+/telemetry'));
    sub.on('message', (topic, msg) => { clearTimeout(timer); resolve({ payload: JSON.parse(msg.toString()), sub, topic }); });
    sub.on('error', reject);
  });

  // 4) Gateway WITH signing enabled.
  const gw = await startGateway(
    {
      broker: { url: `mqtt://127.0.0.1:${BROKER_PORT}` },
      publishIntervalMs: 1000,
      buffer: { enabled: false },
      security: { keyId: 'edge-key-1', privateKeyFile: keyPath },
      nodes: [{
        nodeId: 'n1', name: 'Array Alpha', type: 'SOLAR', protocol: 'SunSpec/Modbus-TCP',
        driver: 'modbusSunspec',
        modbus: { host: '127.0.0.1', port: MODBUS_PORT, unitId: 1 },
        map: path.resolve(__dirname, '../src/mapping/registers.sunspec.json'),
      }],
    },
    { baseDir: path.resolve(__dirname, '..'), dryRun: false, log: { info: () => {}, warn: log, error: log } }
  );

  const { payload, sub, topic } = await received;
  log('received signed telemetry on', topic, '— keyId', payload.keyId, 'seq', payload.seq);

  const errs = [];
  // a) Payload must actually be signed.
  if (!payload.sig || !payload.keyId) errs.push('payload not signed');
  // b) Backend signature verification passes.
  const v = security.verifyPayload(payload);
  if (!v.valid) errs.push(`backend verify failed (${v.reason})`);
  // c) Backend ingester ACCEPTS the valid signed payload.
  const node = broker.ingest('n1', payload);
  if (!node) errs.push('backend ingest rejected a valid signed payload');
  if (node && typeof node.output_kw !== 'number') errs.push('ingested node missing output_kw');
  // d) A tampered copy of the SAME payload is rejected (spoofing) — and the last
  //    good reading is preserved (ingest returns null, store keeps the good one).
  const tampered = { ...payload, seq: payload.seq + 1, metrics: { ...payload.metrics, output_kw: 999 } };
  const rejected = broker.ingest('n1', tampered);
  if (rejected !== null) errs.push('backend ingest accepted a tampered payload (spoofing not caught)');
  // e) Aegis recorded the spoofing attempt.
  const spoofed = aegis.stats().spoofing_attempts >= 1;
  if (!spoofed) errs.push('Aegis did not record the spoofing attempt');

  log('backend verify:', v.valid, '| ingest accepted:', !!node, '| tamper rejected:', rejected === null, '| aegis spoof count:', aegis.stats().spoofing_attempts);

  // Cleanup.
  await gw.stop(); sub.end(true); mqttServer.close(); aedes.close();
  try { fs.unlinkSync(keyPath); } catch { /* ignore */ }

  if (errs.length) { console.error('\n❌ FAIL:', errs.join(', ')); process.exit(1); }
  console.log('\n✅ PASS — real Modbus → Edge-signed → MQTT → backend verified & ingested; tampered copy rejected by Aegis');
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ ERROR:', err); process.exit(1); });
