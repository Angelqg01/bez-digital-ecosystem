#!/usr/bin/env node
'use strict';

/**
 * sunspec-discover.js — walk a SunSpec device's model chain and print the real
 * base address of every model. SunSpec absolute addresses are firmware/model
 * dependent (Fronius Primo vs Symo GEN24, Int+SF vs Float models), so instead of
 * hardcoding them this tool reads the actual device and tells you exactly where
 * each model lives — then you set `block.start` + point addresses in the map.
 *
 * SunSpec layout: a 'SunS' marker (0x5375 0x6E53) at the base, then a chain of
 * [modelId, length, ...data] blocks, terminated by modelId 0xFFFF.
 *
 * Usage:
 *   node scripts/sunspec-discover.js --host 192.168.1.50 --port 502 --unit 1
 */

const net = require('net');

const MARKER_HI = 0x5375; // 'Su'
const MARKER_LO = 0x6e53; // 'nS'
// Common SunSpec base addresses (0-based protocol). 40000 = '4x' holding 40001.
const BASE_CANDIDATES = [40000, 50000, 0, 40001, 50001];
const END_MODEL = 0xffff;

/**
 * Pure model-chain walk. `readWord(addr)` returns the uint16 at `addr`.
 * @returns {Array<{id:number,length:number,headerAddr:number,dataAddr:number}>}
 */
function walkModels(readWord, base) {
  if (readWord(base) !== MARKER_HI || readWord(base + 1) !== MARKER_LO) {
    throw new Error(`No SunSpec 'SunS' marker at base ${base}`);
  }
  const models = [];
  let addr = base + 2; // first model header
  for (let guard = 0; guard < 256; guard++) {
    const id = readWord(addr);
    if (id === END_MODEL) break;
    const length = readWord(addr + 1);
    models.push({ id, length, headerAddr: addr, dataAddr: addr + 2 });
    addr += 2 + length;
  }
  return models;
}

/** Friendly names for the SunSpec models we care about. */
const MODEL_NAMES = {
  1: 'Common (mfg/model/serial)',
  101: 'Inverter 1ph (Int+SF)', 102: 'Inverter split (Int+SF)', 103: 'Inverter 3ph (Int+SF)',
  111: 'Inverter 1ph (Float)', 112: 'Inverter split (Float)', 113: 'Inverter 3ph (Float)',
  201: 'Meter 1ph (Int+SF)', 202: 'Meter split (Int+SF)', 203: 'Meter 3ph (Int+SF)',
  211: 'Meter 1ph (Float)', 213: 'Meter 3ph (Float)',
  120: 'Nameplate', 121: 'Basic settings', 124: 'Storage', 160: 'Multiple MPPT',
};

async function discover({ host, port, unit }) {
  const jsmodbus = require('jsmodbus');
  const socket = new net.Socket();
  const client = new jsmodbus.client.TCP(socket, unit);

  await new Promise((res, rej) => {
    socket.once('connect', res); socket.once('error', rej);
    socket.connect({ host, port });
  });

  const cache = new Map();
  async function readWord(addr) {
    if (cache.has(addr)) return cache.get(addr);
    const resp = await client.readHoldingRegisters(addr, 2);
    const [a, b] = resp.response.body.valuesAsArray;
    cache.set(addr, a); cache.set(addr + 1, b);
    return a;
  }
  // Synchronous-looking walk needs values pre-read; do a chunked prefetch instead.
  async function prefetch(base, count) {
    for (let off = 0; off < count; off += 100) {
      const len = Math.min(100, count - off);
      const resp = await client.readHoldingRegisters(base + off, len);
      const vals = resp.response.body.valuesAsArray;
      for (let i = 0; i < vals.length; i++) cache.set(base + off + i, vals[i]);
    }
  }

  let base = null;
  for (const cand of BASE_CANDIDATES) {
    try {
      const a = await readWord(cand);
      const b = cache.get(cand + 1);
      if (a === MARKER_HI && b === MARKER_LO) { base = cand; break; }
    } catch { /* try next */ }
  }
  if (base == null) { socket.destroy(); throw new Error('No SunSpec marker at any known base'); }

  await prefetch(base, 300); // enough to span the model chain
  const models = walkModels((a) => cache.get(a) ?? 0, base);

  console.log(`\nSunSpec base: ${base}  (device ${host}:${port} unit ${unit})\n`);
  console.log('  modelId  name                              header   data     length');
  console.log('  -------  --------------------------------  -------  -------  ------');
  for (const m of models) {
    console.log(
      `  ${String(m.id).padStart(7)}  ${(MODEL_NAMES[m.id] || '—').padEnd(32)}  ${String(m.headerAddr).padStart(7)}  ${String(m.dataAddr).padStart(7)}  ${String(m.length).padStart(6)}`
    );
  }
  console.log('\nSet your map block.start to the inverter/meter model "data" address above.\n');
  socket.destroy();
  return { base, models };
}

function parseArgs(argv) {
  const a = { host: '127.0.0.1', port: 502, unit: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--host') a.host = argv[++i];
    else if (argv[i] === '--port') a.port = parseInt(argv[++i], 10);
    else if (argv[i] === '--unit') a.unit = parseInt(argv[++i], 10);
  }
  return a;
}

if (require.main === module) {
  discover(parseArgs(process.argv.slice(2)))
    .then(() => process.exit(0))
    .catch((err) => { console.error('discover failed:', err.message); process.exit(1); });
}

module.exports = { walkModels, MODEL_NAMES };
