'use strict';

/**
 * cargoDisputeOracle — severity matrix for logistics breaches (Smart Settlement).
 *
 * Ports the BZ PureScan dispute-oracle pattern to CargoLink: instead of a breach
 * only firing a webhook, the oracle grades it, proposes a settlement in BEZ and
 * — for moderate/critical verdicts — puts the escrow in DISPUTED so the terminal
 * lifecycle transition can no longer auto-release it.
 *
 *   Level 0 OK       → nothing
 *   Level 1 MINOR    → ALERT_ONLY   (webhook, escrow untouched)
 *   Level 2 MODERATE → HOLD_ESCROW  (escrow LOCKED → DISPUTED, partial-refund proposal)
 *   Level 3 CRITICAL → AUTO_CLAIM   (escrow DISPUTED, full-refund proposal)
 *
 * Resolution is explicit (owner/admin): release | refund | partial.
 */

const { query } = require('../db/pool');

const SEVERITY = {
  OK:       { level: 0, label: 'Conforme' },
  MINOR:    { level: 1, label: 'Leve' },
  MODERATE: { level: 2, label: 'Moderado' },
  CRITICAL: { level: 3, label: 'Crítico' },
};

const ACTION_FOR_LEVEL = { 0: 'NONE', 1: 'ALERT_ONLY', 2: 'HOLD_ESCROW', 3: 'AUTO_CLAIM' };

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const round2 = (v) => Math.round(Number(v) * 100) / 100;
const clampPct = (v) => Math.max(0, Math.min(100, v));

/**
 * Grade one canonical breach event. Pure — unit-testable.
 * breach = { eventType, metric, value, tamper, reason, config }
 * ctx    = { txStatus }
 */
function gradeBreach(breach, ctx = {}) {
  const cfg = breach.config || {};
  switch (breach.eventType) {
    case 'CONTAINER_UNSEALED':
      // Seal opened outside an authorized customs/port/warehouse zone = tampering.
      return breach.tamper ? SEVERITY.CRITICAL : SEVERITY.OK;
    case 'LIGHT_BREACH':
      // Light inside a sealed unit before customs clearance = security breach.
      return ctx.txStatus === 'CREATED' ? SEVERITY.CRITICAL : SEVERITY.MODERATE;
    case 'COLD_CHAIN_BREACH': {
      const max = Number(cfg.tempMax ?? 8);
      const min = Number(cfg.tempMin ?? 2);
      const v = Number(breach.value);
      const deviation = v > max ? v - max : min - v;
      return deviation > 5 ? SEVERITY.MODERATE : SEVERITY.MINOR;
    }
    case 'SHOCK_ALERT': {
      const limit = Number(cfg.shockMax ?? 5);
      return Number(breach.value) > 2 * limit ? SEVERITY.MODERATE : SEVERITY.MINOR;
    }
    case 'PRESSURE_LOSS':
      return SEVERITY.MODERATE;
    case 'HUMIDITY_BREACH':
      return SEVERITY.MINOR;
    case 'GEOFENCE_EXIT':
      return SEVERITY.MODERATE;
    case 'SIGNATURE_INVALID':
      return SEVERITY.CRITICAL;
    default:
      return breach.tamper ? SEVERITY.CRITICAL : SEVERITY.MINOR;
  }
}

/** Damage estimate (%) used to size the partial-refund proposal. */
function damageFor(severity, breaches) {
  if (severity.level >= 3) return 100;
  if (severity.level === 2) return clampPct(30 + (breaches.length - 1) * 10);
  if (severity.level === 1) return clampPct(10 + (breaches.length - 1) * 3);
  return 0;
}

/** Translate a verdict into concrete BEZ escrow movements. */
function buildSettlement({ severity, damagePct, escrowAmountBez }) {
  const total = round2(escrowAmountBez || 0);
  switch (severity.level) {
    case 3:
      return {
        action: 'AUTO_CLAIM',
        refundToBuyerBEZ: total,
        payToSellerBEZ: 0,
        discountPct: 100,
        escrowStatus: 'DISPUTED',
      };
    case 2: {
      const discountPct = Math.min(damagePct, 50);
      const refund = round2((total * discountPct) / 100);
      return {
        action: 'HOLD_ESCROW',
        refundToBuyerBEZ: refund,
        payToSellerBEZ: round2(total - refund),
        discountPct,
        escrowStatus: 'DISPUTED',
      };
    }
    case 1:
      return {
        action: 'ALERT_ONLY',
        refundToBuyerBEZ: 0,
        payToSellerBEZ: total,
        discountPct: 0,
        escrowStatus: null, // untouched
      };
    default:
      return { action: 'NONE', refundToBuyerBEZ: 0, payToSellerBEZ: total, discountPct: 0, escrowStatus: null };
  }
}

/**
 * Evaluate a batch of breaches for a transaction. Pure — unit-testable.
 * Returns { severity, severityLabel, action, damagePct, reasons, settlement, webhookEvent }.
 */
function evaluate({ breaches = [], tx = {} }) {
  if (!breaches.length) {
    return { severity: 0, severityLabel: 'Conforme', action: 'NONE', damagePct: 0, reasons: [], settlement: null, webhookEvent: null };
  }
  const ctx = { txStatus: tx.status };
  let worst = SEVERITY.OK;
  const reasons = [];
  for (const b of breaches) {
    const grade = gradeBreach(b, ctx);
    if (grade.level > worst.level) worst = grade;
    reasons.push(`[${grade.label}] ${b.eventType}: ${b.reason || b.metric}`);
  }
  const damagePct = damageFor(worst, breaches);
  const settlement = buildSettlement({
    severity: worst,
    damagePct,
    escrowAmountBez: Number(tx.escrow_amount_bez || 0),
  });
  const webhookEvent =
    worst.level >= 3 ? 'ON_DISPUTE_OPENED'
    : worst.level === 2 ? 'ON_DISPUTE_OPENED'
    : breaches.some((b) => b.eventType === 'COLD_CHAIN_BREACH') ? 'ON_COLD_CHAIN_BREACH'
    : breaches.some((b) => b.eventType === 'SHOCK_ALERT') ? 'ON_SHOCK_ALERT'
    : 'ON_TELEMETRY_ALERT';

  return {
    severity: worst.level,
    severityLabel: worst.label,
    action: ACTION_FOR_LEVEL[worst.level],
    damagePct,
    reasons,
    settlement,
    webhookEvent,
  };
}

/**
 * Apply a verdict: open a dispute row and hold the escrow when the matrix says so.
 * Only escrows currently LOCKED can move to DISPUTED. Returns the dispute row (or null).
 */
async function applyVerdict({ tx, verdict }) {
  if (!tx || verdict.severity < 2) return null;

  if (tx.escrow_status === 'LOCKED') {
    await query(
      `UPDATE cargolink_transactions SET escrow_status = 'DISPUTED', updated_at = NOW()
        WHERE b_uid = $1 AND escrow_status = 'LOCKED'`,
      [tx.b_uid]
    );
  }
  const { rows } = await query(
    `INSERT INTO cargolink_disputes (b_uid, severity, action, reasons, settlement)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
     RETURNING id, b_uid, severity, action, reasons, settlement, status, created_at`,
    [tx.b_uid, verdict.severity, verdict.action, JSON.stringify(verdict.reasons), JSON.stringify(verdict.settlement)]
  );
  return rows[0];
}

/** List disputes for the caller's shipments. */
async function listDisputes(req, { bUid, status } = {}) {
  const lifecycle = require('./cargoLinkLifecycle');
  const identity = await lifecycle.resolveIdentity(req);
  const { rows } = await query(
    `SELECT d.* FROM cargolink_disputes d
       JOIN cargolink_transactions tx ON tx.b_uid = d.b_uid
      WHERE tx.owner_bezhas_id = $1
        AND ($2::text IS NULL OR d.b_uid = $2)
        AND ($3::text IS NULL OR d.status = $3)
      ORDER BY d.created_at DESC LIMIT 100`,
    [identity.bezhasId, bUid || null, status || null]
  );
  return { success: true, count: rows.length, disputes: rows };
}

/**
 * Resolve an open dispute (owner/admin decision):
 *   release → escrow back to seller (RELEASED)
 *   refund  → full refund to buyer  (REFUNDED)
 *   partial → split per settlement  (REFUNDED, partial amounts recorded)
 */
async function resolveDispute(req, disputeId, body = {}) {
  const lifecycle = require('./cargoLinkLifecycle');
  const identity = await lifecycle.resolveIdentity(req);
  if (!['pos', 'admin'].includes(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot resolve disputes (only pos/admin)`, 403);
  }
  const resolution = body.resolution;
  if (!['release', 'refund', 'partial'].includes(resolution)) {
    throw httpError("resolution must be one of: release | refund | partial", 400);
  }

  const { rows } = await query(
    `SELECT d.*, tx.owner_bezhas_id, tx.escrow_status
       FROM cargolink_disputes d
       JOIN cargolink_transactions tx ON tx.b_uid = d.b_uid
      WHERE d.id = $1`,
    [disputeId]
  );
  if (!rows.length) throw httpError('Dispute not found', 404);
  const dispute = rows[0];
  if (dispute.status !== 'open') throw httpError('Dispute already resolved', 409);
  if (dispute.owner_bezhas_id !== identity.bezhasId && identity.role !== 'admin') {
    throw httpError('Not your dispute', 403);
  }

  const escrowStatus = resolution === 'release' ? 'RELEASED' : 'REFUNDED';
  await query(
    `UPDATE cargolink_transactions SET escrow_status = $1, updated_at = NOW()
      WHERE b_uid = $2 AND escrow_status = 'DISPUTED'`,
    [escrowStatus, dispute.b_uid]
  );
  const updated = await query(
    `UPDATE cargolink_disputes SET status = 'resolved', resolution = $1, resolved_at = NOW()
      WHERE id = $2 RETURNING id, b_uid, severity, action, status, resolution, resolved_at`,
    [resolution, disputeId]
  );

  const tx = await query(`SELECT * FROM cargolink_transactions WHERE b_uid = $1`, [dispute.b_uid]);
  if (tx.rows.length) {
    await lifecycle.fanoutWebhooks({ tx: tx.rows[0], eventName: 'ON_DISPUTE_RESOLVED' });
  }
  return { success: true, dispute: updated.rows[0], escrowStatus };
}

module.exports = {
  SEVERITY,
  gradeBreach,
  evaluate,
  buildSettlement,
  applyVerdict,
  listDisputes,
  resolveDispute,
};
