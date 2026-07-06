#!/usr/bin/env node
'use strict';

/**
 * verify-vendor-maps.js — proves a vendor "gain" map over a REAL Modbus-TCP read
 * (not just the offline decode unit test): seeds a jsmodbus server with raw
 * Huawei SUN2000 registers, then connects the actual modbusSunspec driver with
 * the Huawei map and asserts the decoded canonical metrics. Exercises the real
 * paths: multi-block read keyed by absolute address + 32-bit + gain scaling.
 *
 * Exit 0 on success, 1 on failure.
 */

const net = require('net');
const path = require('path');
const jsmodbus = require('jsmodbus');
const createDriver = require('../src/drivers/modbusSunspec');

const PORT = 15021;
const log = (...a) => console.log('[verify-vendor]', ...a);

// Raw Huawei SUN2000 register values (pre-scale), at their absolute addresses.
const holding = Buffer.alloc(0x10000 * 2);
const set16 = (addr, v) => holding.writeUInt16BE(v & 0xffff, addr * 2);
const set32 = (addr, v) => { const u = v >>> 0; set16(addr, (u >>> 16) & 0xffff); set16(addr + 1, u & 0xffff); };

set32(32064, 19000);   // input_power → 19 kW DC
set16(32069, 2314);    // phase_A_voltage /10 → 231.4 V
set32(32072, 8000);    // phase_A_current /1000 → 8.0 A
set32(32080, 18420);   // active_power → 18.42 kW
set16(32085, 5001);    // grid_frequency /100 → 50.01 Hz
set16(32087, 331);     // internal_temperature /10 → 33.1 °C
set16(32089, 512);     // device_status 0x0200 → ONLINE
set32(32106, 123456);  // accumulated_energy /100 → 1234.56 kWh
set32(32114, 1500);    // daily_energy /100 → 15.0 kWh

// A second seeded server for the BESS map (the agent's SoC source).
const bessHolding = Buffer.alloc(0x10000 * 2);
const bset16 = (addr, v) => bessHolding.writeUInt16BE(v & 0xffff, addr * 2);
const bset32 = (addr, v) => { const u = v >>> 0; bset16(addr, (u >>> 16) & 0xffff); bset16(addr + 1, u & 0xffff); };
bset16(0, 765);    // soc_pct /10 → 76.5
bset16(1, 5123);   // pack_voltage /10 → 512.3
bset16(2, (-150) & 0xffff); // current /10 → -15
bset16(3, 285);    // temp /10 → 28.5
bset32(4, (-7600) >>> 0);   // power → -7.6 kW
bset16(6, 980);    // soh /10 → 98
bset16(7, 2);      // status discharge → ONLINE
bset16(8, 342);

async function readMap(holdingBuf, port, mapFile, type, driverName) {
  const server = new net.Server();
  // eslint-disable-next-line no-new
  new jsmodbus.server.TCP(server, { holding: holdingBuf });
  await new Promise((res) => server.listen(port, '127.0.0.1', res));
  const driver = createDriver(
    { nodeId: 'x', type, driver: driverName, modbus: { host: '127.0.0.1', port, unitId: 1 },
      map: path.resolve(__dirname, '../src/mapping/', mapFile) },
    path.resolve(__dirname, '..')
  );
  await driver.connect();
  const reading = await driver.read();
  await driver.close();
  server.close();
  return reading;
}

async function main() {
  const errs = [];

  // 1) Huawei SUN2000 inverter over real Modbus-TCP.
  const inv = await readMap(holding, PORT, 'registers.huawei-sun2000.json', 'SOLAR', 'modbusHuawei');
  log('Huawei decoded:', JSON.stringify(inv.metrics), 'status:', inv.status);
  if (inv.status !== 'ONLINE') errs.push(`huawei status ${inv.status}`);
  if (inv.metrics.output_kw !== 18.42) errs.push(`huawei output_kw ${inv.metrics.output_kw}`);
  if (inv.metrics.dc_power_kw !== 19) errs.push(`huawei dc_power_kw ${inv.metrics.dc_power_kw}`);
  if (inv.metrics.voltage_v !== 231.4) errs.push(`huawei voltage_v ${inv.metrics.voltage_v}`);
  if (inv.metrics.energy_kwh !== 1234.56) errs.push(`huawei energy_kwh ${inv.metrics.energy_kwh}`);

  // 2) Generic BESS over real Modbus-TCP (the arbitrage agent's SoC source).
  const bess = await readMap(bessHolding, PORT + 1, 'registers.bess-modbus.json', 'BATTERY', 'modbusBess');
  log('BESS decoded:', JSON.stringify(bess.metrics), 'status:', bess.status);
  if (bess.status !== 'ONLINE') errs.push(`bess status ${bess.status}`);
  if (bess.metrics.soc_pct !== 76.5) errs.push(`bess soc_pct ${bess.metrics.soc_pct}`);
  if (bess.metrics.voltage_v !== 512.3) errs.push(`bess voltage_v ${bess.metrics.voltage_v}`);
  if (bess.metrics.output_kw !== -7.6) errs.push(`bess output_kw ${bess.metrics.output_kw}`);

  if (errs.length) { console.error('\n❌ FAIL:', errs.join(', ')); process.exit(1); }
  console.log('\n✅ PASS — real Modbus-TCP reads of Huawei SUN2000 + generic BESS maps decode correctly');
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ ERROR:', err); process.exit(1); });
