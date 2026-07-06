#!/usr/bin/env node
'use strict';

/**
 * verify-edge-pipeline.js — end-to-end proof of the Edge Gateway, in one process,
 * with NO external broker and NO physical hardware:
 *
 *   [ modbus-sim (jsmodbus server) ]  ← real Modbus-TCP
 *            ▲ readHoldingRegisters
 *   [ modbusSunspec driver ] → decode → canonical metrics
 *            ▼ publish
 *   [ publisher ] → MQTT → [ aedes broker ] → [ subscriber asserts shape ]
 *
 * Exit 0 on success, 1 on failure. This is the F1 "Definition of Done" check.
 */

const net = require('net');
const aedes = require('aedes')();
const mqtt = require('mqtt');

const { startGateway } = require('../src/index');

const BROKER_PORT = 18831;        // non-privileged, unlikely to clash
const MODBUS_PORT = 15020;
const TIMEOUT_MS = 15_000;

const log = (...a) => console.log('[verify]', ...a);

function startBroker() {
  return new Promise((resolve) => {
    const server = net.createServer(aedes.handle);
    server.listen(BROKER_PORT, () => { log(`aedes broker on :${BROKER_PORT}`); resolve(server); });
  });
}

function startModbusSim() {
  return new Promise((resolve, reject) => {
    process.env.MODBUS_SIM_PORT = String(MODBUS_PORT);
    process.env.MODBUS_SIM_HOST = '127.0.0.1';
    process.env.MODBUS_SIM_REFRESH_MS = '500';
    try {
      // require runs the simulator (it listens on import).
      const sim = require('./modbus-sim');
      setTimeout(() => resolve(sim), 500); // give the server a moment to bind
    } catch (err) { reject(err); }
  });
}

async function main() {
  const broker = await startBroker();
  await startModbusSim();

  // Subscriber that asserts the first telemetry message.
  const received = new Promise((resolve, reject) => {
    const sub = mqtt.connect(`mqtt://127.0.0.1:${BROKER_PORT}`);
    const timer = setTimeout(() => reject(new Error('no telemetry within timeout')), TIMEOUT_MS);
    sub.on('connect', () => sub.subscribe('bezhas/edge/+/telemetry'));
    sub.on('message', (topic, msg) => {
      clearTimeout(timer);
      try { resolve({ topic, payload: JSON.parse(msg.toString()), sub }); }
      catch (e) { reject(e); }
    });
    sub.on('error', reject);
  });

  const gw = await startGateway(
    {
      broker: { url: `mqtt://127.0.0.1:${BROKER_PORT}` },
      publishIntervalMs: 1000,
      buffer: { enabled: false },
      nodes: [{
        nodeId: 'n1', name: 'Array Alpha', type: 'SOLAR', protocol: 'SunSpec/Modbus-TCP',
        driver: 'modbusSunspec',
        modbus: { host: '127.0.0.1', port: MODBUS_PORT, unitId: 1 },
        map: require('path').resolve(__dirname, '../src/mapping/registers.sunspec.json'),
      }],
    },
    { baseDir: require('path').resolve(__dirname, '..'), dryRun: false, log: { info: () => {}, warn: log, error: log } }
  );

  const { topic, payload, sub } = await received;
  log('received on', topic);
  log('payload:', JSON.stringify(payload));

  // ── Assertions (F1 DoD) ──
  const errs = [];
  if (topic !== 'bezhas/edge/n1/telemetry') errs.push(`topic ${topic}`);
  if (payload.type !== 'SOLAR') errs.push('type');
  if (payload.protocol !== 'SunSpec/Modbus-TCP') errs.push('protocol');
  if (typeof payload.seq !== 'number' || payload.seq < 1) errs.push('seq');
  if (!payload.metrics || typeof payload.metrics.output_kw !== 'number') errs.push('output_kw');
  // Values must be physically plausible (i.e. really decoded, not zero/garbage).
  if (!(payload.metrics.output_kw > 5 && payload.metrics.output_kw < 30)) errs.push(`output_kw range (${payload.metrics?.output_kw})`);
  if (!(payload.metrics.voltage_v > 200 && payload.metrics.voltage_v < 260)) errs.push(`voltage_v range (${payload.metrics?.voltage_v})`);
  if (!(payload.metrics.grid_frequency > 49 && payload.metrics.grid_frequency < 51)) errs.push(`grid_frequency range (${payload.metrics?.grid_frequency})`);

  // Cleanup.
  await gw.stop();
  sub.end(true);
  broker.close();
  aedes.close();

  if (errs.length) {
    console.error('\n❌ FAIL:', errs.join(', '));
    process.exit(1);
  }
  console.log('\n✅ PASS — real Modbus read → decoded → published → received over MQTT');
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ ERROR:', err); process.exit(1); });
