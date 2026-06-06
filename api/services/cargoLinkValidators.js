'use strict';

/**
 * cargoLinkValidators — real, deterministic validation per lifecycle transition.
 *
 * Each actor's transition runs genuine logic (not a hardcoded mock) and returns
 * { valid, result, reasons }. If valid === false the transition is blocked (422);
 * the result is stored in the transition history and reflected to subscribers.
 *
 * Keyed by the TARGET status (the state the actor is validating into).
 */

// HS chapters that require physical inspection (weapons, pharma, narcotics precursors).
const RESTRICTED_HS_CHAPTERS = ['93', '30', '29', '36'];
const HIGH_VALUE_THRESHOLD = 50000; // declared value (any currency) over this → escalate
const COG_TOLERANCE = 0.10;         // 10% of half-length deviation allowed before WARNING

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Aduana: CREATED → CUSTOMS_CLEARED ─────────────────────────────────────
function validateCustoms(tx, payload) {
  const reasons = [];
  const manifestId = payload.manifestId || payload.posRef || tx.pos_ref;
  if (!manifestId) reasons.push('manifestId is required to clear customs');

  const declaredValue = num(payload.declaredValue ?? tx.cargo?.value);
  if (declaredValue === null) reasons.push('declaredValue (numeric) is required');

  const hsCode = String(payload.hsCode || '').trim();
  const chapter = hsCode.slice(0, 2);

  let lane = 'GREEN_LANE';
  if (chapter && RESTRICTED_HS_CHAPTERS.includes(chapter)) lane = 'RED_LANE';
  else if (declaredValue !== null && declaredValue > HIGH_VALUE_THRESHOLD) lane = 'ORANGE_LANE';

  // Simple ad-valorem duty estimate by lane risk (deterministic).
  const dutyRate = lane === 'RED_LANE' ? 0.12 : lane === 'ORANGE_LANE' ? 0.08 : 0.04;
  const dutyEstimate = declaredValue !== null ? Math.round(declaredValue * dutyRate * 100) / 100 : null;

  return {
    valid: reasons.length === 0,
    reasons,
    result: {
      lane,
      standard: payload.standard || 'UBL_2_1',
      hsCode: hsCode || null,
      declaredValue,
      dutyEstimate,
      inspectionRequired: lane === 'RED_LANE',
    },
  };
}

// ── Naviera: CUSTOMS_CLEARED → STOWED (compute real Centre of Gravity) ─────
function validateStowage(tx, payload) {
  const reasons = [];
  // Items: [{ x, y, weight }] positions within the container.
  const items = Array.isArray(payload.items) ? payload.items : (tx.cargo?.items || []);
  const container = payload.container || { length: 12, width: 2.4 }; // default 20ft-ish

  const weighted = items
    .map(it => ({ x: num(it.x), y: num(it.y), w: num(it.weight) }))
    .filter(it => it.x !== null && it.y !== null && it.w !== null && it.w > 0);

  if (weighted.length === 0) {
    reasons.push('at least one positioned item with weight is required for stowage');
    return { valid: false, reasons, result: {} };
  }

  const totalWeight = weighted.reduce((s, it) => s + it.w, 0);
  const cogX = weighted.reduce((s, it) => s + it.x * it.w, 0) / totalWeight;
  const cogY = weighted.reduce((s, it) => s + it.y * it.w, 0) / totalWeight;

  const centerX = num(container.length) / 2;
  const centerY = num(container.width) / 2;
  const deviationX = Math.abs(cogX - centerX) / centerX;
  const deviationY = Math.abs(cogY - centerY) / centerY;

  const status = (deviationX <= COG_TOLERANCE && deviationY <= COG_TOLERANCE) ? 'VERIFIED' : 'WARNING';

  return {
    valid: true, // stowage with a WARNING is still recorded, just flagged
    reasons: status === 'WARNING' ? ['COG outside tolerance — load may be unbalanced'] : [],
    result: {
      cog: { x: Math.round(cogX * 1000) / 1000, y: Math.round(cogY * 1000) / 1000 },
      totalWeight,
      deviation: { x: Math.round(deviationX * 1000) / 1000, y: Math.round(deviationY * 1000) / 1000 },
      status,
    },
  };
}

// ── Naviera: STOWED → DEPARTED ────────────────────────────────────────────
function validateDeparture(tx, payload) {
  const reasons = [];
  const vessel = payload.vessel || payload.vesselName;
  const voyage = payload.voyage || payload.voyageNumber;
  if (!vessel) reasons.push('vessel is required for departure');
  if (!voyage) reasons.push('voyage is required for departure');
  return {
    valid: reasons.length === 0,
    reasons,
    result: { vessel: vessel || null, voyage: voyage || null, departurePort: payload.departurePort || null },
  };
}

// ── Logística industrial: DEPARTED → IN_TRANSIT ───────────────────────────
function validateInTransit(tx, payload) {
  const reasons = [];
  const routeId = payload.routeId || payload.trackingRef;
  if (!routeId) reasons.push('routeId or trackingRef is required to start transit');
  return {
    valid: reasons.length === 0,
    reasons,
    result: { routeId: routeId || null, carrier: payload.carrier || null },
  };
}

// ── Última milla: IN_TRANSIT → DELIVERED (proof of delivery) ──────────────
function validateDelivery(tx, payload) {
  const reasons = [];
  const hasSignature = Boolean(payload.signatureHash || payload.podHash);
  const lat = num(payload.lat);
  const lng = num(payload.lng);
  const hasGeo = lat !== null && lng !== null;
  if (!hasSignature && !hasGeo) {
    reasons.push('proof of delivery requires a signatureHash/podHash or geo coordinates (lat,lng)');
  }
  return {
    valid: reasons.length === 0,
    reasons,
    result: {
      proof: hasSignature ? 'SIGNATURE' : hasGeo ? 'GEO' : 'NONE',
      podHash: payload.signatureHash || payload.podHash || null,
      geo: hasGeo ? { lat, lng } : null,
      geoVerified: Boolean(payload.geoVerified && hasGeo),
    },
  };
}

const VALIDATORS = {
  CUSTOMS_CLEARED: validateCustoms,
  STOWED: validateStowage,
  DEPARTED: validateDeparture,
  IN_TRANSIT: validateInTransit,
  DELIVERED: validateDelivery,
};

/** Run the validator for a target status. Unknown targets pass through. */
function validateTransition(toStatus, tx, payload = {}) {
  const validator = VALIDATORS[toStatus];
  if (!validator) return { valid: true, reasons: [], result: {} };
  return validator(tx, payload || {});
}

module.exports = { validateTransition, VALIDATORS };
