'use strict';

/**
 * modbusSunspec — SunSpec / Modbus-TCP inverter driver.
 *
 * Reads a contiguous holding-register block from a SunSpec-compliant inverter
 * and decodes it (via src/decode.js) into canonical telemetry metrics.
 *
 * Transport: jsmodbus over a raw TCP socket (pure JS — no native serialport
 * build needed; RTU/serial inverters get a separate driver later in the plan).
 *
 * The register map is vendor-specific and injected via `nodeConfig.map`
 * (path to a JSON map). The default reference map is
 * src/mapping/registers.sunspec.json.
 */

const net = require('net');
const path = require('path');
const fs = require('fs');
const { decodeRegisters } = require('../decode');

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_READ_TIMEOUT_MS = 5_000;

function loadMap(mapPathOrObj, baseDir) {
  if (mapPathOrObj && typeof mapPathOrObj === 'object') return mapPathOrObj;
  const resolved = path.isAbsolute(mapPathOrObj) ? mapPathOrObj : path.resolve(baseDir, mapPathOrObj);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

/**
 * @param {object} nodeConfig
 * @param {string} nodeConfig.nodeId
 * @param {string} nodeConfig.type      — SOLAR | WIND | HYDRO | BATTERY | LOAD | GENSET
 * @param {object} nodeConfig.modbus    — { host, port, unitId, connectTimeoutMs?, readTimeoutMs? }
 * @param {string|object} nodeConfig.map — register-map path or object
 * @param {string} [baseDir]            — base dir to resolve a relative map path
 */
function createSunspecDriver(nodeConfig, baseDir = process.cwd()) {
  const { modbus = {} } = nodeConfig;
  const host = modbus.host || '127.0.0.1';
  const port = modbus.port || 502;
  const unitId = modbus.unitId != null ? modbus.unitId : 1;
  const connectTimeoutMs = modbus.connectTimeoutMs || DEFAULT_CONNECT_TIMEOUT_MS;
  const readTimeoutMs = modbus.readTimeoutMs || DEFAULT_READ_TIMEOUT_MS;
  const map = loadMap(nodeConfig.map || './src/mapping/registers.sunspec.json', baseDir);

  let socket = null;
  let modbusClient = null;
  let connected = false;

  async function connect() {
    // Lazy require → a missing dep degrades this one driver, not the whole gateway.
    let jsmodbus;
    try {
      jsmodbus = require('jsmodbus');
    } catch (err) {
      throw new Error(`jsmodbus not installed (run pnpm install in edge-gateway/): ${err.message}`);
    }

    await new Promise((resolve, reject) => {
      socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Modbus connect timeout ${host}:${port} after ${connectTimeoutMs}ms`));
      }, connectTimeoutMs);

      socket.once('connect', () => {
        clearTimeout(timer);
        connected = true;
        resolve();
      });
      socket.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      socket.on('close', () => { connected = false; });

      modbusClient = new jsmodbus.client.TCP(socket, unitId);
      socket.connect({ host, port });
    });

    return modbusClient;
  }

  // A map declares either a single `block` or several `blocks` (Huawei-style,
  // for non-contiguous register regions). Normalize to an array.
  const blocks = map.blocks || (map.block ? [map.block] : []);
  const fnCode = (map.function || 'holding').toLowerCase(); // 'holding' (0x03) | 'input' (0x04)

  async function readBlock(block) {
    const reader = fnCode === 'input'
      ? modbusClient.readInputRegisters.bind(modbusClient)
      : modbusClient.readHoldingRegisters.bind(modbusClient);
    const resp = await Promise.race([
      reader(block.start, block.count),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`Modbus read timeout @${block.start}`)), readTimeoutMs)),
    ]);
    return resp.response.body.valuesAsArray;
  }

  async function read() {
    if (!connected || !modbusClient) throw new Error('Modbus not connected');

    // Read every declared block and key the words by absolute address so the
    // decoder can resolve points wherever they live.
    const byAddr = new Map();
    for (const block of blocks) {
      const regs = await readBlock(block);
      for (let i = 0; i < regs.length; i++) byAddr.set(block.start + i, regs[i]);
    }

    const { metrics, state, raw } = decodeRegisters(byAddr, map);
    return { metrics, status: state, raw };
  }

  /**
   * Write a single holding register (SCADA set-point). Phase 5 write-path.
   * @param {number} addr  Modbus address
   * @param {number} value 16-bit value (signed values are masked to 16 bits)
   */
  async function writeRegister(addr, value) {
    if (!connected || !modbusClient) throw new Error('Modbus not connected');
    await Promise.race([
      modbusClient.writeSingleRegister(addr, value & 0xffff),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`Modbus write timeout @${addr}`)), readTimeoutMs)),
    ]);
    return { addr, value: value & 0xffff };
  }

  async function close() {
    if (socket) {
      await new Promise((res) => socket.end(res));
      socket.destroy();
      socket = null;
      modbusClient = null;
      connected = false;
    }
  }

  return {
    nodeId: nodeConfig.nodeId,
    type: nodeConfig.type,
    map,
    connect,
    read,
    writeRegister,
    close,
    isConnected: () => connected,
  };
}

module.exports = createSunspecDriver;
