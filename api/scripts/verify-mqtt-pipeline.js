'use strict';

/**
 * Standalone end-to-end verifier for the VPP MQTT pipeline:
 *   Edge Node (mqtt publisher) → in-process broker (aedes) → vppMqttBroker.
 *
 * Run:  node scripts/verify-mqtt-pipeline.js   (exit 0 = success, 1 = failure)
 *
 * Implemented as a script rather than a jest test because mqtt v5 ships ESM that
 * jest's CJS resolver cannot load; under plain Node the exact production
 * require() path in services/vppMqttBroker.js is exercised.
 */

const assert = require('assert');
const net = require('net');
const mqtt = require('mqtt');
const { Aedes } = require('aedes');
const broker = require('../services/vppMqttBroker');

const PORT = 18883;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let aedes = Aedes.createBroker();
  if (aedes && typeof aedes.then === 'function') aedes = await aedes;

  const server = net.createServer((c) => aedes.handle(c));
  await new Promise((res) => server.listen(PORT, res));

  await broker.connect({ brokerUrl: `mqtt://localhost:${PORT}`, connectTimeoutMs: 5000, reconnectPeriod: 0 });
  assert.strictEqual(broker.isConnected(), true, 'broker should be connected');

  const pub = mqtt.connect(`mqtt://localhost:${PORT}`, { clientId: 'verify-pub', reconnectPeriod: 0 });
  await new Promise((res) => pub.on('connect', res));
  await sleep(150);

  // 1) Telemetry ingestion: Edge Node publishes → vppMqttBroker stores it.
  pub.publish('bezhas/edge/n1/telemetry', JSON.stringify({
    type: 'SOLAR', name: 'Array Alpha', status: 'ONLINE', protocol: 'MQTT/Modbus',
    metrics: { output_kw: 14.2, voltage_v: 228 },
  }));
  await sleep(300);

  const t = broker.getLatestTelemetry();
  assert.ok(t, 'telemetry should not be null after publish');
  const n1 = t.nodes.find((n) => n.id === 'n1');
  assert.ok(n1, 'n1 should be ingested');
  assert.strictEqual(n1.output_kw, 14.2, 'output_kw should match published value');
  console.log('✓ telemetry ingested:', { node: n1.id, output_kw: n1.output_kw, total_output_kw: t.global.total_output_kw });

  // 2) Control dispatch: publishControl → command lands on the node control topic.
  const received = new Promise((res, rej) => {
    const sub = mqtt.connect(`mqtt://localhost:${PORT}`, { clientId: 'verify-sub', reconnectPeriod: 0 });
    sub.on('connect', () => sub.subscribe('bezhas/edge/n4/control'));
    sub.on('message', (topic, msg) => { res({ topic, payload: JSON.parse(msg.toString()) }); sub.end(true); });
    setTimeout(() => rej(new Error('control message timeout')), 5000);
  });
  await sleep(200);

  assert.strictEqual(broker.publishControl('n4', 'CHARGE_BATTERY', { powerKw: 50 }), true, 'publishControl should succeed');
  const ctrl = await received;
  assert.strictEqual(ctrl.topic, 'bezhas/edge/n4/control');
  assert.strictEqual(ctrl.payload.command, 'CHARGE_BATTERY');
  assert.strictEqual(ctrl.payload.params.powerKw, 50);
  console.log('✓ control delivered:', ctrl.payload.command, ctrl.payload.params);

  // Cleanup
  await new Promise((res) => pub.end(true, {}, res));
  await broker.disconnect();
  await new Promise((res) => server.close(res));
  await new Promise((res) => aedes.close(res));

  console.log('\n✅ MQTT pipeline verified end-to-end');
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ pipeline verification failed:', err.message);
  process.exit(1);
});
