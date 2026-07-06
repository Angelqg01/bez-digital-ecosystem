#!/usr/bin/env node
'use strict';

/**
 * modbus-sim.js — minimal SunSpec-style inverter simulator (Modbus-TCP server).
 *
 * Serves a holding-register block consistent with
 * src/mapping/registers.sunspec.json, with light per-poll jitter so the gateway
 * (and the whole VPP pipeline) can be exercised end-to-end WITHOUT real hardware.
 *
 * Usage:
 *   node scripts/modbus-sim.js                 # listens on 0.0.0.0:1502
 *   MODBUS_SIM_PORT=1502 node scripts/modbus-sim.js
 *
 * Then point a gateway node at { host:'127.0.0.1', port:1502, unitId:1 }.
 */

const net = require('net');
const jsmodbus = require('jsmodbus');

const HOST = process.env.MODBUS_SIM_HOST || '0.0.0.0';
const PORT = parseInt(process.env.MODBUS_SIM_PORT || '1502', 10);
const REFRESH_MS = parseInt(process.env.MODBUS_SIM_REFRESH_MS || '2000', 10);

// 65536 holding registers × 2 bytes, big-endian.
const holding = Buffer.alloc(0x10000 * 2);
const rnd = (min, max) => Math.random() * (max - min) + min;

/** Write a signed/unsigned 16-bit value at a holding-register address. */
function setReg(addr, value) {
  holding.writeUInt16BE(value & 0xffff, addr * 2);
}
/** Write an unsigned 32-bit value across two registers (big-endian word order). */
function setReg32(addr, value) {
  setReg(addr, Math.floor(value / 0x10000));
  setReg(addr + 1, value % 0x10000);
}

let energyWh = 1_234_567; // accumulating lifetime energy (acc32)

/** Refresh the register block with live-looking values (matches the JSON map). */
function refresh() {
  // Operating state: 4 = MPPT/Producing (→ "ONLINE").
  setReg(0, 4);

  // AC current: ~8.0 A with jitter (raw ×0.1 via A_SF=-1).
  setReg(2, Math.round(rnd(75, 90)));
  setReg(4, -1); // A_SF

  // AC voltage phase A: ~231.4 V (raw ×0.1 via V_SF=-1).
  setReg(11, Math.round(rnd(2290, 2335)));
  setReg(13, -1); // V_SF

  // AC power: ~18.4 kW (raw ×10 via W_SF=1 → watts).
  setReg(14, Math.round(rnd(1700, 1950)));
  setReg(15, 1); // W_SF

  // Grid frequency: ~50.0 Hz (raw ×0.01 via Hz_SF=-2).
  setReg(16, Math.round(rnd(4995, 5005)));
  setReg(17, -2); // Hz_SF

  // Lifetime energy (acc32, Wh) — monotonically increasing.
  energyWh += Math.round(rnd(2, 8));
  setReg32(23, energyWh);
  setReg(25, 0); // WH_SF

  // DC power: ~19 kW (raw ×10 via DCW_SF=1 → watts).
  setReg(31, Math.round(rnd(1850, 1980)));
  setReg(32, 1); // DCW_SF

  // Cabinet temperature: ~33 °C (raw ×0.1 via Tmp_SF=-1).
  setReg(34, Math.round(rnd(300, 360)));
  setReg(35, -1); // Tmp_SF
}

refresh();
const timer = setInterval(refresh, REFRESH_MS);

const server = new net.Server();
// eslint-disable-next-line no-new
new jsmodbus.server.TCP(server, { holding });

server.listen(PORT, HOST, () => {
  console.log(`[modbus-sim] SunSpec inverter simulator listening on ${HOST}:${PORT} (unit 1), refresh ${REFRESH_MS}ms`);
});
server.on('error', (err) => { console.error('[modbus-sim] error:', err.message); process.exit(1); });

process.on('SIGINT', () => { clearInterval(timer); server.close(() => process.exit(0)); });

module.exports = { holding, refresh };
