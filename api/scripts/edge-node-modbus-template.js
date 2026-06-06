#!/usr/bin/env node
'use strict';

/**
 * Edge Node — Modbus/SunSpec → MQTT bridge  (TEMPLATE / reference skeleton)
 * ─────────────────────────────────────────────────────────────────────────
 * Production Edge Node firmware that reads a real solar inverter or smart meter
 * over Modbus TCP (SunSpec model) and republishes normalized telemetry to the
 * BeZhas VPP broker on  bezhas/edge/<nodeId>/telemetry  (the same contract the
 * API ingests in services/vppMqttBroker.js).
 *
 * This file is a TEMPLATE — it is NOT imported or run by the API. Deploy it on
 * the gateway (e.g. Raspberry Pi / industrial PC next to the inverter):
 *
 *     npm i modbus-serial mqtt
 *     NODE_ID=n1 INVERTER_IP=192.168.1.50 MQTT_BROKER_URL=mqtt://hub.bez.digital:1883 \
 *       node edge-node-modbus-template.js
 *
 * Anti-spoofing (Aegis): sign each reading in a secure element (ATECC608A / TPM)
 * before publishing, and verify the signature server-side. A placeholder hook is
 * included below — replace signReading() with a real HSM/secure-element call.
 */

const NODE_ID = process.env.NODE_ID || 'n1';
const INVERTER_IP = process.env.INVERTER_IP || '192.168.1.50';
const INVERTER_PORT = parseInt(process.env.INVERTER_PORT || '502', 10);
const UNIT_ID = parseInt(process.env.MODBUS_UNIT_ID || '1', 10);
const BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const INTERVAL = parseInt(process.env.READ_INTERVAL_MS || '5000', 10);

// SunSpec common Model 103 (three-phase inverter) holding-register offsets.
// Adjust the base offset to your device's SunSpec map (discover via model 1 header).
const SUNSPEC = {
  BASE: 40069,   // start of model 103 block (device-specific)
  AC_POWER: 40083,      // W  (int16, with SF)
  AC_VOLTAGE_AN: 40079, // V  (uint16, with SF)
  AC_FREQUENCY: 40085,  // Hz (uint16, with SF)
  DC_POWER: 40100,      // W
  TEMP_CABINET: 40103,  // °C
};

let ModbusRTU;
let mqtt;
try {
  ModbusRTU = require('modbus-serial');
  mqtt = require('mqtt');
} catch (err) {
  console.error('[edge] missing deps — run: npm i modbus-serial mqtt');
  process.exit(1);
}

const modbus = new ModbusRTU();
const client = mqtt.connect(BROKER, { clientId: `edge-${NODE_ID}-${Date.now()}` });

/**
 * Placeholder for hardware-backed signing (ATECC608A / TPM 2.0).
 * Replace with a real secure-element call so the server can verify provenance.
 */
function signReading(payloadBytes) {
  // e.g. return atecc608.sign(sha256(payloadBytes)).toHex();
  return null;
}

async function readOnce() {
  await modbus.connectTCP(INVERTER_IP, { port: INVERTER_PORT });
  modbus.setID(UNIT_ID);

  // Read a contiguous block then decode; here we read individual values for clarity.
  const acPower = (await modbus.readHoldingRegisters(SUNSPEC.AC_POWER, 1)).data[0];
  const acVoltage = (await modbus.readHoldingRegisters(SUNSPEC.AC_VOLTAGE_AN, 1)).data[0];
  const acFreq = (await modbus.readHoldingRegisters(SUNSPEC.AC_FREQUENCY, 1)).data[0];
  const tempC = (await modbus.readHoldingRegisters(SUNSPEC.TEMP_CABINET, 1)).data[0];

  // NOTE: apply the SunSpec scale factors (SF registers) for real units.
  const metrics = {
    output_kw: acPower / 1000,
    voltage_v: acVoltage / 10,
    grid_frequency: acFreq / 100,
    temp_c: tempC / 10,
  };

  const body = { type: 'SOLAR', name: `Inverter ${NODE_ID}`, status: 'ONLINE', protocol: 'Modbus/SunSpec', metrics, ts: new Date().toISOString() };
  const payload = JSON.stringify(body);
  const sig = signReading(Buffer.from(payload));

  client.publish(`bezhas/edge/${NODE_ID}/telemetry`, JSON.stringify({ ...body, sig }));
  console.log(`[edge ${NODE_ID}] published`, metrics);
}

// Optional: react to control commands from the API (bezhas/edge/<id>/control).
client.on('connect', () => {
  client.subscribe(`bezhas/edge/${NODE_ID}/control`);
  console.log(`[edge ${NODE_ID}] connected to ${BROKER}, reading ${INVERTER_IP}:${INVERTER_PORT}`);
  setInterval(() => readOnce().catch((e) => console.error('[edge] read error:', e.message)), INTERVAL);
});

client.on('message', (topic, msg) => {
  try {
    const { command, params } = JSON.parse(msg.toString());
    console.log(`[edge ${NODE_ID}] control command:`, command, params);
    // TODO: translate command (CHARGE_BATTERY, SHED_LOAD, SET_REACTIVE_POWER, ...)
    //       into Modbus writeRegister() calls on the inverter/BMS.
  } catch (err) {
    console.error('[edge] bad control payload:', err.message);
  }
});
