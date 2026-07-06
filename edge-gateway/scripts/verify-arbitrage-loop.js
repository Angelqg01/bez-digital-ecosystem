#!/usr/bin/env node
'use strict';

/**
 * verify-arbitrage-loop.js — full Phase 6 closed loop, end to end:
 *
 *   [arbitrage agent decision] --live--> sign (controlSecurity) --> MQTT
 *        --> [edge dispatcher] verify + apply CHARGE_BATTERY on the device (sim)
 *
 * Proves the autonomous agent actuates ONLY through the signed F5 write-path, and
 * that its production safety controls hold: a large-€ decision goes to HITL (not
 * dispatched) and a node with a recent HIGH Aegis anomaly is blocked (kill-switch).
 * Exit 0 on success, 1 on failure.
 */

const net = require('net');
const path = require('path');
const aedes = require('aedes')();
const mqtt = require('mqtt');
const jsmodbus = require('jsmodbus');

const { generateKeyPair, createSoftwareSigner } = require('../src/security/signer');
const { createDispatcher } = require('../src/control/dispatcher');
const createDriver = require('../src/drivers/modbusSunspec');

const api = (m) => require(path.resolve(__dirname, '../../api/services/', m));
const agent = api('energyArbitrageAgent');
const controlSecurity = api('controlSecurity');
const vppBroker = api('vppMqttBroker');
const hitlQueue = api('hitlQueue');
const aegis = api('aegisAnomalyEngine');

const BROKER_PORT = 18835;
const MODBUS_PORT = 15025;
const NODE = 'n1';
const log = (...a) => console.log('[arb-e2e]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readReg(addr) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    const c = new jsmodbus.client.TCP(sock, 1);
    sock.on('error', reject);
    sock.connect({ host: '127.0.0.1', port: MODBUS_PORT }, async () => {
      try { const r = await c.readHoldingRegisters(addr, 1); sock.end(); resolve(r.response.body.valuesAsArray[0]); }
      catch (e) { sock.end(); reject(e); }
    });
  });
}

async function main() {
  const errs = [];

  // 1) Backend control key → Edge gets the public half to verify commands.
  const { privateKeyPem } = generateKeyPair();
  controlSecurity.__setKeyForTests(privateKeyPem, 'backend-control-1');
  const backendPub = controlSecurity.getPublicKeyPem();

  // 2) Infra.
  const mqttServer = net.createServer(aedes.handle);
  await new Promise((r) => mqttServer.listen(BROKER_PORT, r));
  process.env.MODBUS_SIM_PORT = String(MODBUS_PORT);
  process.env.MODBUS_SIM_HOST = '127.0.0.1';
  process.env.MODBUS_SIM_REFRESH_MS = '2000';
  require('./modbus-sim');
  await sleep(500);

  // 3) Edge driver + dispatcher subscribed to control.
  const driver = createDriver(
    { nodeId: NODE, type: 'BATTERY', modbus: { host: '127.0.0.1', port: MODBUS_PORT, unitId: 1 },
      map: path.resolve(__dirname, '../src/mapping/registers.sunspec.json') },
    path.resolve(__dirname, '..')
  );
  await driver.connect();
  const ackSigner = createSoftwareSigner({ keyId: 'edge-key-1', privateKeyPem: generateKeyPair().privateKeyPem });
  const dispatcher = createDispatcher({ driver, backendPublicKeyPem: backendPub, ackSigner, logger: { info: () => {}, warn: () => {} } });
  const edge = mqtt.connect(`mqtt://127.0.0.1:${BROKER_PORT}`);
  await new Promise((r) => edge.on('connect', r));
  edge.subscribe(`bezhas/edge/${NODE}/control`);
  edge.on('message', async (_t, msg) => { const ack = await dispatcher.handle(JSON.parse(msg.toString())); edge.publish(`bezhas/edge/${NODE}/control/ack`, JSON.stringify(ack)); });

  // 4) Backend broker — the agent dispatches through the real
  //    vppBroker.publishSignedControl over MQTT.
  await vppBroker.connect({ brokerUrl: `mqtt://127.0.0.1:${BROKER_PORT}` });

  // ── Case A: live small CHARGE → signed dispatch → edge writes CHARGE_BATTERY reg ──
  agent._resetLog(); hitlQueue._reset(); aegis._reset();
  const dA = await agent.dispatchDecision(
    { strategy: 'CHARGE', powerKw: 100, nodeId: NODE, priceEurMwh: 20, socPct: 50, estimatedEur: 5 },
    { mode: 'live', hitlAboveEur: 500 }
  );
  await sleep(600);
  const reg41 = await readReg(41); // CHARGE_BATTERY → address 41, value = powerKw
  log('A live CHARGE:', 'signed', dA.signed, 'dispatched', dA.dispatched, '| reg41', reg41);
  if (!dA.signed || !dA.dispatched) errs.push('live CHARGE not signed/dispatched');
  if (reg41 !== 100) errs.push(`CHARGE_BATTERY register not written (reg41=${reg41}, expected 100)`);

  // ── Case B: large-€ decision → HITL pending, NOT dispatched ──
  aegis._reset();
  const dB = await agent.dispatchDecision(
    { strategy: 'DISCHARGE_SELL', powerKw: 500, nodeId: NODE, priceEurMwh: 200, socPct: 80, estimatedEur: 750 },
    { mode: 'live', hitlAboveEur: 500 }
  );
  log('B large €:', 'hitlPending', dB.hitlPending, 'dispatched', dB.dispatched, '| queue', hitlQueue.get(dB.jobId)?.status);
  if (!dB.hitlPending || dB.dispatched) errs.push('large-€ command was not gated by HITL');
  if (hitlQueue.get(dB.jobId)?.status !== 'PENDING') errs.push('large-€ command not queued PENDING');

  // ── Case C: kill-switch — HIGH Aegis anomaly on the node blocks trading ──
  aegis.record([{ id: 'k', ts: new Date().toISOString(), node: NODE, type: 'SPOOFING_ATTEMPT', severity: 'HIGH', result: 'FAIL' }]);
  const dC = await agent.dispatchDecision(
    { strategy: 'CHARGE', powerKw: 100, nodeId: NODE, priceEurMwh: 20, socPct: 50, estimatedEur: 5 },
    { mode: 'live', hitlAboveEur: 500 }
  );
  log('C kill-switch:', 'blocked', dC.blocked, 'dispatched', dC.dispatched);
  if (dC.blocked !== 'aegis_high_anomaly' || dC.dispatched) errs.push('kill-switch did not block trading on a flagged node');

  // ── Case D: shadow mode never actuates ──
  aegis._reset();
  const dD = await agent.dispatchDecision(
    { strategy: 'CHARGE', powerKw: 100, nodeId: NODE, priceEurMwh: 20, socPct: 50, estimatedEur: 5 },
    { mode: 'shadow' }
  );
  log('D shadow:', 'shadow', dD.shadow, 'dispatched', dD.dispatched);
  if (!dD.shadow || dD.dispatched) errs.push('shadow mode actuated');

  // Cleanup.
  await driver.close(); edge.end(true); await vppBroker.disconnect(); mqttServer.close(); aedes.close();

  if (errs.length) { console.error('\n❌ FAIL:', errs.join('; ')); process.exit(1); }
  console.log('\n✅ PASS — agent actuates only via signed F5 path; €-gate→HITL, Aegis→kill-switch, shadow→no-op');
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ ERROR:', err); process.exit(1); });
