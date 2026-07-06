'use strict';

/**
 * Driver interface contract for the Edge Gateway.
 *
 * A driver knows how to talk to ONE physical device family (inverter, meter,
 * BMS, genset) over some field protocol and return canonical telemetry metrics.
 * Every driver factory returns an object with this shape:
 *
 *   {
 *     async connect()         — open the transport (throws on failure)
 *     async read()            — return { metrics, status, raw } for one poll
 *     async close()           — release the transport
 *     isConnected()           — boolean
 *   }
 *
 * `read()` returns canonical metrics (output_kw, voltage_v, grid_frequency,
 * soc_pct, …) so the publisher can build the payload defined in
 * docs/ARQUITECTURA_REAL_Y_PLAN.md §3.1 regardless of vendor.
 */

/** @typedef {Object} DriverReading
 *  @property {Object} metrics  Canonical numeric metrics.
 *  @property {string} status   ONLINE | DEGRADED | OFFLINE.
 *  @property {Object} [raw]    Decoded raw points (diagnostics / debugging).
 */

const DRIVER_REGISTRY = {
  // Lazy require so a missing optional dependency never breaks gateway boot.
  // The Modbus-TCP driver is fully map-driven: SunSpec (Fronius) and vendor
  // "gain" maps (Huawei SUN2000, Deye, Carlo Gavazzi) all use the same engine,
  // selected only by the register-map JSON. Aliases document intent in config.
  modbusSunspec: () => require('./modbusSunspec'),
  modbusHuawei: () => require('./modbusSunspec'),
  modbusDeye: () => require('./modbusSunspec'),
  modbusMeter: () => require('./modbusSunspec'),
  modbusBess: () => require('./modbusSunspec'),
  modbusGenset: () => require('./modbusSunspec'),
  modbusTcp: () => require('./modbusSunspec'),
};

/**
 * Instantiate a driver from a node config entry.
 * @param {{driver:string}} nodeConfig
 * @param {string} [baseDir] — base dir to resolve a relative register-map path.
 * @returns {object} driver instance
 */
function createDriver(nodeConfig, baseDir = process.cwd()) {
  const make = DRIVER_REGISTRY[nodeConfig.driver];
  if (!make) {
    throw new Error(`Unknown driver "${nodeConfig.driver}". Known: ${Object.keys(DRIVER_REGISTRY).join(', ')}`);
  }
  return make()(nodeConfig, baseDir);
}

module.exports = { createDriver, DRIVER_REGISTRY };
