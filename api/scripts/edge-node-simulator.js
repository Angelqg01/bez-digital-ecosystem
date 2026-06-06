#!/usr/bin/env node
'use strict';

/**
 * Edge Node Simulator — publishes realistic VPP telemetry over MQTT so the full
 * ingestion pipeline (broker → vppMqttBroker → /api/energy/telemetry) can be
 * exercised end-to-end without physical hardware.
 *
 * Usage:
 *   # 1. Run a broker (e.g. docker run -p 1883:1883 eclipse-mosquitto)
 *   # 2. Start the API (it subscribes via services/vppMqttBroker on boot)
 *   # 3. Run this simulator:
 *   MQTT_BROKER_URL=mqtt://localhost:1883 node scripts/edge-node-simulator.js
 *
 * Each node publishes to: bezhas/edge/<nodeId>/telemetry
 */

const mqtt = require('mqtt');

const BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const INTERVAL = parseInt(process.env.SIM_INTERVAL_MS || '5000', 10);

const rnd = (min, max, d = 2) => +(Math.random() * (max - min) + min).toFixed(d);

const NODES = [
  { id: 'n1', type: 'SOLAR',   name: 'Array Alpha',     protocol: 'MQTT/Modbus', gen: () => ({ output_kw: rnd(5, 25),  voltage_v: rnd(220, 230, 1), irradiance: rnd(600, 1000, 0), efficiency: rnd(94, 99, 1) }) },
  { id: 'n2', type: 'WIND',    name: 'Turbine V1',      protocol: 'MQTT',        gen: () => ({ output_kw: rnd(2, 17),  wind_speed: rnd(4, 16, 1), rpm: rnd(800, 1200, 0) }) },
  { id: 'n3', type: 'HYDRO',   name: 'Pumped Hydro',    protocol: 'Modbus',      gen: () => ({ output_kw: rnd(5, 35),  flow_m3h: rnd(100, 150, 1), head_m: rnd(20, 30, 1) }) },
  { id: 'n4', type: 'BATTERY', name: 'BESS Unit 1',     protocol: 'CAN/MQTT',    gen: () => ({ output_kw: rnd(-5, 5),  soc_pct: rnd(40, 90, 1), temp_c: rnd(25, 40, 1) }) },
  { id: 'n5', type: 'LOAD',    name: 'Industrial HVAC', protocol: 'Modbus',      gen: () => ({ consumption_kw: rnd(10, 30), grid_frequency: rnd(49.95, 50.05, 3) }) },
];

const client = mqtt.connect(BROKER, { clientId: `edge-sim-${Date.now()}` });

client.on('connect', () => {
  console.log(`[edge-sim] connected to ${BROKER}; publishing every ${INTERVAL}ms`);
  publishAll();
  setInterval(publishAll, INTERVAL);
});

client.on('error', (err) => console.error('[edge-sim] error:', err.message));

function publishAll() {
  for (const node of NODES) {
    const payload = {
      type: node.type,
      name: node.name,
      status: 'ONLINE',
      protocol: node.protocol,
      metrics: node.gen(),
      ts: new Date().toISOString(),
      // sig: <ATECC608/TPM signature> — see edge-node-modbus-template.js
    };
    client.publish(`bezhas/edge/${node.id}/telemetry`, JSON.stringify(payload));
  }
  console.log(`[edge-sim] published telemetry for ${NODES.length} nodes`);
}

process.on('SIGINT', () => {
  console.log('\n[edge-sim] shutting down');
  client.end(true, {}, () => process.exit(0));
});
