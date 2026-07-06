'use strict';

/**
 * decode.js — Modbus register decoding (pure, no I/O). Supports two encodings:
 *
 *   1. SunSpec (Fronius, generic): integer points scaled by a per-block
 *      *scale factor* register (`sunssf`, a signed int16 exponent) → value × 10^sf.
 *   2. Vendor "gain" maps (Huawei SUN2000, Deye, Carlo Gavazzi): a fixed divisor
 *      → value = raw / gain. 32-bit integers with configurable word order.
 *
 * Decoding is driven entirely by a register-map JSON (see src/mapping/*.json), so
 * adding a vendor/model is a data change, not a code change. Dependency-free and
 * deterministic → unit-testable offline (`node __tests__/decode.test.js`).
 *
 * Two layers:
 *   • Low-level array primitives  u16/i16/u32/...  (regs[], index) — used in tests.
 *   • Map-driven  decodeRegisters(regsByAddr, map)  — address-keyed, multi-block,
 *     supports sf | gain | wordSwap. `decodeBlock(regs[], map)` adapts a single
 *     contiguous block onto it.
 */

// ── Low-level array primitives (index-based, big-endian) ──
function u16(regs, i) { return regs[i] & 0xffff; }
function i16(regs, i) { const v = regs[i] & 0xffff; return v >= 0x8000 ? v - 0x10000 : v; }
function u32(regs, i) { return (u16(regs, i) * 0x10000 + u16(regs, i + 1)) >>> 0; }
function i32(regs, i) { const v = u32(regs, i); return v >= 0x80000000 ? v - 0x100000000 : v; }
function acc32(regs, i) { const v = u32(regs, i); return v === 0xffffffff ? null : v; }
function sunssf(regs, i) { const v = i16(regs, i); return v === -32768 ? 0 : v; }

/** Apply a SunSpec scale-factor exponent (e.g. -1 → ×0.1). */
function applyScale(value, sf) { return value == null ? null : value * Math.pow(10, sf || 0); }

// ── Address-keyed typed reads (support 32-bit word order) ──
function rd16(get, addr) { return get(addr) & 0xffff; }
function rdi16(get, addr) { const v = rd16(get, addr); return v >= 0x8000 ? v - 0x10000 : v; }
function rdu32(get, addr, wordSwap) {
  const hi = rd16(get, wordSwap ? addr + 1 : addr);
  const lo = rd16(get, wordSwap ? addr : addr + 1);
  return (hi * 0x10000 + lo) >>> 0;
}
function rdi32(get, addr, wordSwap) { const v = rdu32(get, addr, wordSwap); return v >= 0x80000000 ? v - 0x100000000 : v; }

/** Decode a single point's RAW integer value (no scale/gain yet). */
function decodeRaw(get, point, wordSwap) {
  switch (point.type) {
    case 'uint16': return rd16(get, point.address);
    case 'int16': return rdi16(get, point.address);
    case 'uint32': return rdu32(get, point.address, wordSwap);
    case 'int32': return rdi32(get, point.address, wordSwap);
    case 'acc32': { const v = rdu32(get, point.address, wordSwap); return v === 0xffffffff ? null : v; }
    case 'sunssf': { const v = rdi16(get, point.address); return v === -32768 ? 0 : v; }
    default: throw new Error(`Unknown point type: ${point.type} (${point.name})`);
  }
}

/**
 * Decode a full register map into canonical metrics.
 * @param {Map<number,number>|function} regs — address→uint16 Map, or a get(addr) fn.
 * @param {object} map — parsed register-map JSON.
 * @returns {{ metrics: object, state: string, raw: object }}
 */
function decodeRegisters(regs, map) {
  const get = typeof regs === 'function' ? regs : (a) => (regs.has(a) ? regs.get(a) : 0);
  const wordSwap = !!map.wordSwap;

  // 1) Raw values for every point.
  const raw = {};
  for (const p of map.points) raw[p.name] = decodeRaw(get, p, wordSwap);

  // 2) Apply scaling: SunSpec scale-factor (sf) OR fixed gain divisor.
  const scaled = {};
  for (const p of map.points) {
    if (p.type === 'sunssf') continue;
    let v = raw[p.name];
    if (p.sf != null) v = applyScale(v, raw[p.sf]);
    else if (p.gain != null && v != null) v = v / p.gain;
    scaled[p.name] = v;
  }

  // 3) Map scaled points onto canonical telemetry metrics.
  const metrics = {};
  for (const [metric, spec] of Object.entries(map.metrics || {})) {
    let v = scaled[spec.point];
    if (v == null) continue;
    if (spec.div) v = v / spec.div;
    if (spec.abs) v = Math.abs(v);
    if (spec.round != null) v = +v.toFixed(spec.round);
    metrics[metric] = v;
  }

  // 4) Operating state from a status register, if mapped.
  let state = 'ONLINE';
  if (map.state && map.state.point != null) {
    const code = raw[map.state.point];
    state = (map.state.map && map.state.map[String(code)]) || map.state.default || 'ONLINE';
  }

  return { metrics, state, raw };
}

/**
 * Adapter: decode a single contiguous block read (regs[0] == map.block.start).
 * Kept for SunSpec single-block maps and unit tests.
 */
function decodeBlock(regsArray, map) {
  const start = (map.block && map.block.start) || 0;
  const byAddr = new Map();
  for (let i = 0; i < regsArray.length; i++) byAddr.set(start + i, regsArray[i]);
  return decodeRegisters(byAddr, map);
}

module.exports = {
  u16, i16, u32, i32, acc32, sunssf, applyScale,
  decodeRaw, decodeRegisters, decodeBlock,
};
