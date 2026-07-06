#!/usr/bin/env node
'use strict';

/**
 * verify-signed-control.js — full Phase 5 SCADA write-path, end to end:
 *
 *   [backend controlSecurity] --sign--> MQTT control --> [edge dispatcher]
 *        verify sig → check limits → Modbus write → ACK ─────────┐
 *                                                                ▼
 *   register actually written on the device (sim) ; ACK returned to backend
 *
 * Proves: a backend-signed command moves a real register on the device; a
 * tampered command and an over-limit command are both rejected by the Edge and
 * never touch hardware. Exit 0 on success, 1 on failure.
 */

const net = require('net');
const path = require('path');
const aedes = require('aedes')();
const mqtt = require('mqtt');
const jsmodbus = require('jsmodbus');

const { generateKeyPair, createSoftwareSigner } = require('../src/security/signer');
const { createDispatcher } = require('../src/control/dispatcher');
const createDriver = require('../src/drivers/modbusSunspec');
const controlSecurity = require(path.resolve(__dirname, '../../api/services/controlSecurity'));

const BROKER_PORT = 18834;
const MODBUS_PORT = 15024;
const NODE = 'n1';
const CTRL_TOPIC = `bezhas/edge/${NODE}/control`;
const ACK_TOPIC = `bezhas/edge/${NODE}/control/ack`;
const log = (...a) => console.log('[ctrl-e2e]', ...a);

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

  // 1) Backend control key — share its public half with the Edge dispatcher.
  const { privateKeyPem } = generateKeyPair();
  controlSecurity.__setKeyForTests(privateKeyPem, 'backend-control-1');
  const backendPub = controlSecurity.getPublicKeyPem();

  // 2) Infra: broker + Modbus simulator.
  const mqttServer = net.createServer(aedes.handle);
  await new Promise((r) => mqttServer.listen(BROKER_PORT, r));
  process.env.MODBUS_SIM_PORT = String(MODBUS_PORT);
  process.env.MODBUS_SIM_HOST = '127.0.0.1';
  process.env.MODBUS_SIM_REFRESH_MS = '2000';
  require('./modbus-sim');
  await new Promise((r) => setTimeout(r, 500));

  // 3) Edge driver + dispatcher (with an ACK signer).
  const driver = createDriver(
    { nodeId: NODE, type: 'SOLAR', modbus: { host: '127.0.0.1', port: MODBUS_PORT, unitId: 1 },
      map: path.resolve(__dirname, '../src/mapping/registers.sunspec.json') },
    path.resolve(__dirname, '..')
  );
  await driver.connect();
  const ackSigner = createSoftwareSigner({ keyId: 'edge-key-1', privateKeyPem: generateKeyPair().privateKeyPem });
  const dispatcher = createDispatcher({ driver, backendPublicKeyPem: backendPub, ackSigner, logger: { info: () => {}, warn: () => {} } });

  // 4) Edge subscribes to control, applies, and publishes the ACK.
  const edge = mqtt.connect(`mqtt://127.0.0.1:${BROKER_PORT}`);
  await new Promise((r) => edge.on('connect', r));
  edge.subscribe(CTRL_TOPIC);
  edge.on('message', async (_t, msg) => {
    const ack = await dispatcher.handle(JSON.parse(msg.toString()));
    edge.publish(ACK_TOPIC, JSON.stringify(ack));
  });

  // 5) Backend side: publish signed commands + await matching ACKs by jobId.
  const backend = mqtt.connect(`mqtt://127.0.0.1:${BROKER_PORT}`);
  await new Promise((r) => backend.on('connect', r));
  backend.subscribe(ACK_TOPIC);
  const waiters = new Map();
  backend.on('message', (_t, msg) => { const ack = JSON.parse(msg.toString()); const w = waiters.get(ack.jobId); if (w) w(ack); });
  const sendAndWait = (payload, jobId) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ACK for ${jobId}`)), 8000);
    waiters.set(jobId, (ack) => { clearTimeout(timer); resolve(ack); });
    backend.publish(CTRL_TOPIC, JSON.stringify(payload));
  });

  // ── Case A: valid signed command → register written, ACK applied ──
  const cmdA = controlSecurity.signCommand({ jobId: 'jobA', command: 'SET_REACTIVE_POWER', params: { kvar: 100 }, ts: new Date().toISOString() });
  const ackA = await sendAndWait(cmdA, 'jobA');
  const regA = await readReg(40);
  log('A valid:', 'applied', ackA.applied, '| reg40', regA, '| ackSig', !!ackA.sig);
  if (!ackA.applied) errs.push('valid command not applied');
  if (regA !== 100) errs.push(`register not written (reg40=${regA}, expected 100)`);
  if (!ackA.sig) errs.push('ACK not signed by edge');

  // ── Case B: tampered command (params changed after signing) → rejected ──
  const cmdB = controlSecurity.signCommand({ jobId: 'jobB', command: 'SET_REACTIVE_POWER', params: { kvar: 150 }, ts: new Date().toISOString() });
  cmdB.params.kvar = 50; // tamper AFTER signing → signature no longer matches
  const ackB = await sendAndWait(cmdB, 'jobB');
  const regB = await readReg(40);
  log('B tampered:', 'applied', ackB.applied, '| error', ackB.error, '| reg40 still', regB);
  if (ackB.applied) errs.push('tampered command was applied');
  if (ackB.error !== 'invalid_signature') errs.push(`expected invalid_signature, got ${ackB.error}`);
  if (regB !== 100) errs.push(`tampered command changed the register (reg40=${regB})`);

  // ── Case C: over-limit command (kvar 999 > 200) → rejected by Edge ──
  const cmdC = controlSecurity.signCommand({ jobId: 'jobC', command: 'SET_REACTIVE_POWER', params: { kvar: 999 }, ts: new Date().toISOString() });
  const ackC = await sendAndWait(cmdC, 'jobC');
  log('C over-limit:', 'applied', ackC.applied, '| error', ackC.error);
  if (ackC.applied) errs.push('over-limit command was applied');
  if (!/^limit:/.test(ackC.error || '')) errs.push(`expected limit error, got ${ackC.error}`);

  // ── Case D: EMERGENCY_STOP fixed-value write ──
  const cmdD = controlSecurity.signCommand({ jobId: 'jobD', command: 'EMERGENCY_STOP', params: {}, ts: new Date().toISOString() });
  const ackD = await sendAndWait(cmdD, 'jobD');
  const regD = await readReg(42);
  log('D e-stop:', 'applied', ackD.applied, '| reg42', regD);
  if (!ackD.applied || regD !== 1) errs.push(`EMERGENCY_STOP not applied (applied=${ackD.applied}, reg42=${regD})`);

  // Cleanup.
  await driver.close(); edge.end(true); backend.end(true); mqttServer.close(); aedes.close();

  if (errs.length) { console.error('\n❌ FAIL:', errs.join('; ')); process.exit(1); }
  console.log('\n✅ PASS — backend-signed SCADA command writes the device; tampered + over-limit commands rejected by the Edge');
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ ERROR:', err); process.exit(1); });
