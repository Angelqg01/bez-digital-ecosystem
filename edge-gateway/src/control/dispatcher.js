'use strict';

/**
 * dispatcher.js — applies signed SCADA control commands to the device (Phase 5).
 *
 * Flow per command received on bezhas/edge/<nodeId>/control:
 *   1. Verify the backend's signature (authenticity)        → reject if invalid
 *   2. Validate command + params against hard safety limits  → reject if exceeded
 *      (defense in depth: the backend checks too, but the Edge is the last line)
 *   3. Apply the set-point via Modbus write (map.control)    → real hardware effect
 *   4. Return a signed ACK { jobId, accepted, applied, error?, ts }
 *
 * The backend's public key is provided so the Edge only obeys commands it can
 * prove came from the authorized controller — a spoofed command is dropped.
 */

const { verify } = require('../security/signer');

/** Hard safety limits — mirror api/routes/energy.js SCADA_COMMANDS. */
const SAFETY_LIMITS = {
  CHARGE_BATTERY:     { maxPowerKw: 500 },
  DISCHARGE_BATTERY:  { maxPowerKw: 500 },
  SET_REACTIVE_POWER: { maxKvar: 200 },
  SHED_LOAD:          { maxDurationMin: 120 },
  ISLANDING_MODE:     { maxDurationMin: 60 },
  EMERGENCY_STOP:     {},
};

function checkLimits(command, params = {}) {
  const lim = SAFETY_LIMITS[command];
  if (!lim) return `unsupported command ${command}`;
  if (lim.maxPowerKw != null && params.powerKw != null && Math.abs(params.powerKw) > lim.maxPowerKw) {
    return `powerKw ${params.powerKw} exceeds ${lim.maxPowerKw}`;
  }
  if (lim.maxKvar != null && params.kvar != null && Math.abs(params.kvar) > lim.maxKvar) {
    return `kvar ${params.kvar} exceeds ${lim.maxKvar}`;
  }
  if (lim.maxDurationMin != null && params.durationMin != null && params.durationMin > lim.maxDurationMin) {
    return `durationMin ${params.durationMin} exceeds ${lim.maxDurationMin}`;
  }
  return null;
}

/** Resolve a command + params into a concrete register write from map.control. */
function resolveWrite(map, command, params = {}) {
  const ctrl = map && map.control && map.control[command];
  if (!ctrl) return { error: `no control mapping for ${command}` };
  let value;
  if (ctrl.value != null) {
    value = ctrl.value;
  } else if (ctrl.param != null) {
    const raw = params[ctrl.param];
    if (typeof raw !== 'number') return { error: `missing numeric param ${ctrl.param}` };
    value = Math.round(raw * (ctrl.scale != null ? ctrl.scale : 1));
  } else {
    return { error: `control mapping for ${command} has neither value nor param` };
  }
  return { address: ctrl.address, value };
}

/**
 * Create a control dispatcher bound to a driver.
 * @param {object} opts
 * @param {object} opts.driver           — must expose writeRegister(addr,value) + map
 * @param {string} opts.backendPublicKeyPem — to verify command authenticity
 * @param {object} [opts.ackSigner]       — Signer to sign the ACK (optional)
 * @param {object} [opts.logger]
 */
function createDispatcher({ driver, backendPublicKeyPem, ackSigner = null, logger = console }) {
  /**
   * Handle one control command. Returns the ACK object (also suitable to publish
   * on bezhas/edge/<nodeId>/control/ack).
   */
  async function handle(command) {
    const ack = { jobId: command && command.jobId, accepted: false, applied: false, ts: new Date().toISOString() };

    // 1) Authenticity.
    if (backendPublicKeyPem) {
      if (!verify(command, backendPublicKeyPem)) {
        ack.error = 'invalid_signature';
        logger.warn?.(`[edge-ctrl] rejected ${command && command.command}: invalid signature`);
        return sign(ack);
      }
    }

    // 2) Safety limits (defense in depth).
    const limitErr = checkLimits(command.command, command.params);
    if (limitErr) { ack.error = `limit:${limitErr}`; logger.warn?.(`[edge-ctrl] rejected: ${limitErr}`); return sign(ack); }
    ack.accepted = true;

    // 3) Apply via Modbus.
    const w = resolveWrite(driver.map, command.command, command.params);
    if (w.error) { ack.error = w.error; return sign(ack); }
    try {
      await driver.writeRegister(w.address, w.value);
      ack.applied = true;
      ack.write = w;
      logger.info?.(`[edge-ctrl] applied ${command.command} → reg ${w.address}=${w.value} (job ${ack.jobId})`);
    } catch (err) {
      ack.error = `write_failed:${err.message}`;
    }
    return sign(ack);
  }

  function sign(ack) {
    if (ackSigner) { ack.keyId = ackSigner.keyId; ack.sig = ackSigner.sign(ack); }
    return ack;
  }

  return { handle, checkLimits, resolveWrite };
}

module.exports = { createDispatcher, checkLimits, resolveWrite, SAFETY_LIMITS };
