'use strict';

/**
 * Pure unit tests for src/decode.js — runnable offline with plain node:
 *     node __tests__/decode.test.js
 * No broker, no PLC, no jest required. Exits non-zero on first failure.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { i16, u32, acc32, sunssf, applyScale, decodeBlock, decodeRegisters } = require('../src/decode');

const loadMap = (name) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/mapping/${name}`), 'utf8'));
/** Build an address→word Map; write 32-bit values big-endian word order. */
function regMap(entries) { return new Map(Object.entries(entries).map(([k, v]) => [Number(k), v & 0xffff])); }
function set32(m, addr, val) { const u = val >>> 0; m.set(addr, (u >>> 16) & 0xffff); m.set(addr + 1, u & 0xffff); }

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('decode.js');

test('i16 decodes two\'s complement negatives', () => {
  assert.strictEqual(i16([0xffff], 0), -1);
  assert.strictEqual(i16([0x8000], 0), -32768);
  assert.strictEqual(i16([0x0064], 0), 100);
});

test('u32 composes big-endian word order', () => {
  assert.strictEqual(u32([0x0001, 0x0000], 0), 65536);
  assert.strictEqual(u32([0x0012, 0xcfc7], 0), 1232839);
});

test('acc32 returns null for the not-implemented sentinel', () => {
  assert.strictEqual(acc32([0xffff, 0xffff], 0), null);
  assert.strictEqual(acc32([0x0000, 0x0064], 0), 100);
});

test('sunssf treats 0x8000 as 0', () => {
  assert.strictEqual(sunssf([0x8000], 0), 0);
  assert.strictEqual(sunssf([0xffff], 0), -1);
});

test('applyScale applies the decimal exponent', () => {
  assert.strictEqual(applyScale(2314, -1), 231.4);
  assert.strictEqual(applyScale(1842, 1), 18420);
  assert.strictEqual(applyScale(null, -1), null);
});

test('decodeBlock maps the reference SunSpec block to canonical metrics', () => {
  const map = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../src/mapping/registers.sunspec.json'), 'utf8')
  );

  // Build a 40-register block (block.start = 0) matching the simulator.
  const regs = new Array(map.block.count).fill(0);
  regs[0] = 4;            // St → ONLINE
  regs[2] = 80;           // A raw
  regs[4] = 0xffff;       // A_SF = -1
  regs[11] = 2314;        // PhVphA raw → 231.4 V
  regs[13] = 0xffff;      // V_SF = -1
  regs[14] = 1842;        // W raw → ×10 = 18420 W → 18.42 kW
  regs[15] = 1;           // W_SF = 1
  regs[16] = 5001;        // Hz raw → ×0.01 = 50.01 Hz
  regs[17] = 0xfffe;      // Hz_SF = -2
  regs[23] = 0x0012;      // WH high
  regs[24] = 0xcfc7;      // WH low → 1232839 Wh → 1232.839 kWh
  regs[25] = 0;           // WH_SF = 0
  regs[31] = 1900;        // DCW raw → ×10 = 19000 W → 19 kW
  regs[32] = 1;           // DCW_SF = 1
  regs[34] = 331;         // TmpCab raw → 33.1 °C
  regs[35] = 0xffff;      // Tmp_SF = -1

  const { metrics, state } = decodeBlock(regs, map);

  assert.strictEqual(state, 'ONLINE');
  assert.strictEqual(metrics.output_kw, 18.42);
  assert.strictEqual(metrics.voltage_v, 231.4);
  assert.strictEqual(metrics.grid_frequency, 50.01);
  assert.strictEqual(metrics.dc_power_kw, 19);
  assert.strictEqual(metrics.temp_c, 33.1);
  assert.strictEqual(metrics.energy_kwh, 1232.839);
});

test('Huawei SUN2000 gain map → canonical metrics', () => {
  const map = loadMap('registers.huawei-sun2000.json');
  const m = new Map();
  set32(m, 32064, 19000);   // input_power (W)
  m.set(32069, 2314);       // phase_A_voltage /10 → 231.4 V
  set32(m, 32072, 8000);    // phase_A_current /1000 → 8.0 A
  set32(m, 32080, 18420);   // active_power (W) → 18.42 kW
  m.set(32085, 5001);       // grid_frequency /100 → 50.01 Hz
  m.set(32087, 331);        // internal_temperature /10 → 33.1 °C
  m.set(32089, 512);        // device_status 0x0200 → ONLINE
  set32(m, 32106, 123456);  // accumulated_energy /100 → 1234.56 kWh
  set32(m, 32114, 1500);    // daily_energy /100 → 15.0 kWh

  const { metrics, state } = decodeRegisters(m, map);
  assert.strictEqual(state, 'ONLINE');
  assert.strictEqual(metrics.output_kw, 18.42);
  assert.strictEqual(metrics.dc_power_kw, 19);
  assert.strictEqual(metrics.voltage_v, 231.4);
  assert.strictEqual(metrics.current_a, 8);
  assert.strictEqual(metrics.grid_frequency, 50.01);
  assert.strictEqual(metrics.temp_c, 33.1);
  assert.strictEqual(metrics.energy_kwh, 1234.56);
  assert.strictEqual(metrics.energy_today_kwh, 15);
});

test('Huawei device_status fault code maps to OFFLINE', () => {
  const map = loadMap('registers.huawei-sun2000.json');
  const m = new Map([[32089, 768]]); // 0x0300 shutdown: fault
  assert.strictEqual(decodeRegisters(m, map).state, 'OFFLINE');
});

test('Carlo Gavazzi EM24 meter map → canonical metrics', () => {
  const map = loadMap('registers.carlo-gavazzi-em24.json');
  const m = new Map();
  set32(m, 0, 2314);        // V_L1N /10 → 231.4 V
  set32(m, 12, 8000);       // A_L1 /1000 → 8.0 A
  set32(m, 40, 184200);     // W_sys /10 → 18420 W → 18.42 kW
  m.set(50, 980);           // PF_sys /1000 → 0.98
  m.set(51, 500);           // Hz /10 → 50.0
  set32(m, 52, 123456);     // kWh_pos /10 → 12345.6 kWh

  const { metrics, state } = decodeRegisters(m, map);
  assert.strictEqual(state, 'ONLINE'); // meter has no status reg → default
  assert.strictEqual(metrics.voltage_v, 231.4);
  assert.strictEqual(metrics.current_a, 8);
  assert.strictEqual(metrics.output_kw, 18.42);
  assert.strictEqual(metrics.power_factor, 0.98);
  assert.strictEqual(metrics.grid_frequency, 50);
  assert.strictEqual(metrics.energy_kwh, 12345.6);
});

test('EM24 signed export power decodes negative', () => {
  const map = loadMap('registers.carlo-gavazzi-em24.json');
  const m = new Map();
  set32(m, 40, (-50000) >>> 0); // exporting 5 kW
  assert.strictEqual(decodeRegisters(m, map).metrics.output_kw, -5);
});

test('Generic BESS gain map → SoC + pack metrics', () => {
  const map = loadMap('registers.bess-modbus.json');
  const m = new Map();
  m.set(0, 765);            // soc_pct /10 → 76.5 %
  m.set(1, 5123);           // pack_voltage /10 → 512.3 V
  m.set(2, (-150) & 0xffff);// pack_current int16 /10 → -15.0 A (discharging)
  m.set(3, 285);            // pack_temp /10 → 28.5 °C
  set32(m, 4, (-7600) >>> 0); // power_w int32 → -7.6 kW
  m.set(6, 980);            // soh_pct /10 → 98.0 %
  m.set(7, 2);              // bms_status 2 (discharge) → ONLINE
  m.set(8, 342);            // cycle_count

  const { metrics, state } = decodeRegisters(m, map);
  assert.strictEqual(state, 'ONLINE');
  assert.strictEqual(metrics.soc_pct, 76.5);
  assert.strictEqual(metrics.voltage_v, 512.3);
  assert.strictEqual(metrics.current_a, -15);
  assert.strictEqual(metrics.temp_c, 28.5);
  assert.strictEqual(metrics.output_kw, -7.6);
  assert.strictEqual(metrics.soh_pct, 98);
  assert.strictEqual(metrics.cycles, 342);
});

test('BESS fault status maps to OFFLINE', () => {
  const map = loadMap('registers.bess-modbus.json');
  assert.strictEqual(decodeRegisters(new Map([[7, 3]]), map).state, 'OFFLINE');
});

test('Generic genset gain map → power/fuel/rpm metrics', () => {
  const map = loadMap('registers.genset-modbus.json');
  const m = new Map();
  set32(m, 0, 45000);       // gen_power_w → 45 kW
  m.set(2, 64);             // fuel_level_pct → 64 %
  m.set(3, 1500);           // engine_rpm → 1500
  m.set(4, 82);             // coolant_temp_c → 82 °C
  m.set(5, 137);            // battery_voltage /10 → 13.7 V
  m.set(6, 500);            // gen_frequency /10 → 50.0 Hz
  set32(m, 7, 1234);        // run_hours
  m.set(9, 1);              // gen_status 1 (running) → ONLINE

  const { metrics, state } = decodeRegisters(m, map);
  assert.strictEqual(state, 'ONLINE');
  assert.strictEqual(metrics.output_kw, 45);
  assert.strictEqual(metrics.fuel_pct, 64);
  assert.strictEqual(metrics.rpm, 1500);
  assert.strictEqual(metrics.temp_c, 82);
  assert.strictEqual(metrics.grid_frequency, 50);
  assert.strictEqual(metrics.run_hours, 1234);
});

test('SunSpec model-chain walk finds inverter model base', () => {
  const { walkModels } = require('../scripts/sunspec-discover');
  const base = 40000;
  const m = new Map();
  m.set(base, 0x5375);      // 'Su'
  m.set(base + 1, 0x6e53);  // 'nS'
  m.set(base + 2, 1);       // model 1 (Common)
  m.set(base + 3, 66);      // length 66
  m.set(base + 70, 103);    // model 103 (Inverter 3ph) header at base+2+68
  m.set(base + 71, 50);     // length 50
  m.set(base + 122, 0xffff);// end marker at base+70+52

  const models = walkModels((a) => (m.has(a) ? m.get(a) : 0), base);
  assert.strictEqual(models.length, 2);
  assert.strictEqual(models[0].id, 1);
  assert.strictEqual(models[1].id, 103);
  assert.strictEqual(models[1].dataAddr, base + 72); // data starts after header
});

console.log(`\n${passed} passed`);
