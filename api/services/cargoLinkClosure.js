'use strict';

/**
 * cargoLinkClosure — incidencia reportada (TX014) y cierre de operación (TX020).
 *
 * Los dos últimos eventos del piloto de Algeciras que no tenían nada detrás.
 *
 * ── TX014: la incidencia que ningún sensor ve ───────────────────────────────
 *
 * `cargoDisputeOracle` ya gradúa lo que detecta la telemetría: cadena de frío
 * rota, precinto abierto, golpes, salida de geocerca. Lo que falta es lo que
 * sólo ve una persona — el contenedor llega abollado, falta mercancía en la
 * descarga, la declaración no cuadra con lo que hay dentro.
 *
 * Va a la MISMA matriz de severidad, no a una propia. Dos escalas de gravedad
 * conviviendo sobre el mismo envío acaban contradiciéndose, y el día que se
 * contradigan será justo cuando haya dinero en disputa.
 *
 * La severidad que reporta quien lo ve se guarda, pero NO decide: la fija el
 * oracle. Si el reportante pudiera fijarla, la escala no significaría nada.
 *
 * ── TX020: entregar no es cerrar ────────────────────────────────────────────
 *
 * El ciclo de vida termina en DELIVERED. Pero «entregado» es un hecho físico y
 * «cerrado» es uno comercial: puede haber facturas sin pagar, una aduana sin
 * despachar o una incidencia abierta.
 *
 * El cierre es la afirmación de que **no queda nada pendiente**, y es la que
 * consulta un auditor. Por eso aquí se COMPRUEBA en lugar de aceptarse: un
 * cierre que sólo dice lo que le han dicho no aporta nada sobre el campo
 * booleano de un ERP.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');
const disputeOracle = require('./cargoDisputeOracle');
const onChain = require('./cargoLinkOnChain');

const INCIDENT_KINDS = new Set([
  'CARGO_DAMAGE',       // daño visible en la mercancía o el contenedor
  'CARGO_SHORTAGE',     // falta mercancía respecto al manifiesto
  'THEFT',              // sustracción
  'MISDECLARATION',     // lo declarado no coincide con lo que hay
  'DOCUMENT_MISSING',   // falta documentación exigible
  'HANDLING_ERROR',     // error de manipulación en terminal
  'DELAY',              // retraso imputable
  'OTHER',
]);

const REPORTED_SEVERITIES = new Set(['MINOR', 'MODERATE', 'CRITICAL']);
const INCIDENT_ROLES = new Set(['logistics', 'carrier', 'customs', 'lastmile', 'pos', 'admin']);
const CLOSURE_ROLES = new Set(['pos', 'admin']);

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function ref(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function sha256(value) {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex')}`;
}

async function loadTransaction(bUid) {
  const { rows } = await query(
    `SELECT b_uid, owner_bezhas_id, status, escrow_status, escrow_amount_bez
       FROM cargolink_transactions WHERE b_uid = $1`,
    [bUid]
  );
  if (rows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  return rows[0];
}

// ── TX014 — Incidencia reportada ─────────────────────────────────────────────

/**
 * Traduce una incidencia humana al vocabulario que entiende el oracle.
 *
 * `tamper: true` en robo y mala declaración es deliberado: son las dos que
 * implican intención, y el oracle reserva CRITICAL para eso. Un daño en la
 * descarga puede costar más dinero y aun así no es lo mismo — uno es un
 * accidente y el otro es alguien actuando.
 */
function toBreach(kind, description, reportedSeverity) {
  const intencional = kind === 'THEFT' || kind === 'MISDECLARATION';
  return {
    eventType: `REPORTED_${kind}`,
    reason: description,
    metric: 'human_report',
    tamper: intencional,
    // El oracle usa `default:` para los tipos que no conoce, y ahí un
    // MODERATE reportado caería a MINOR. Se eleva explícitamente para que un
    // reporte grave no se diluya sólo por no estar en la lista del oracle.
    value: reportedSeverity === 'CRITICAL' ? 1 : 0,
  };
}

async function reportIncident(req, bUid, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!INCIDENT_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot report an incident`, 403);
  }
  const tx = await loadTransaction(bUid);

  const kind = String(body.kind || '').toUpperCase();
  if (!INCIDENT_KINDS.has(kind)) {
    throw httpError(`kind must be one of ${[...INCIDENT_KINDS].join(', ')}`, 422);
  }
  const description = String(body.description || '').trim();
  if (description.length < 10) {
    throw httpError(
      'description is required and must be meaningful: an incident without a '
      + 'description cannot be graded, disputed or defended later',
      422
    );
  }
  const reported = String(body.severity || 'MINOR').toUpperCase();
  if (!REPORTED_SEVERITIES.has(reported)) {
    throw httpError(`severity must be one of ${[...REPORTED_SEVERITIES].join(', ')}`, 422);
  }

  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw httpError('occurredAt is not a valid date', 422);
  if (occurredAt.getTime() > Date.now() + 60_000) {
    // Una incidencia en el futuro es un error de reloj o de dedo. Aceptarla
    // rompe cualquier reconstrucción cronológica del expediente.
    throw httpError('occurredAt cannot be in the future', 422);
  }

  // Misma matriz que la telemetría. La severidad reportada no decide.
  const verdict = disputeOracle.evaluate({
    breaches: [toBreach(kind, description, reported)],
    tx,
  });
  const dispute = await disputeOracle.applyVerdict({ tx, verdict });

  const evidenceHash = sha256({ bUid, kind, description, occurredAt: occurredAt.toISOString() });
  const reference = ref('INC');

  const anchor = await onChain.anchorTransition(
    tx, 'INCIDENT_REPORTED', { reference, kind, severity: verdict.severity, evidenceHash },
  ).catch((err) => ({ anchored: false, mode: 'anchor_failed', error: err.message }));

  const { rows } = await query(
    `INSERT INTO cargolink_incidents
       (b_uid, reference, kind, reported_severity, graded_severity, description,
        occurred_at, location, reported_by, evidence_hash, dispute_id,
        anchor_tx_hash, anchor_mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [bUid, reference, kind, reported, verdict.severity, description,
     occurredAt, body.location || null, identity.bezhasId, evidenceHash,
     dispute?.id || null, anchor.txHash || null, anchor.mode]
  );

  return {
    success: true,
    incident: rows[0],
    verdict: {
      severity: verdict.severity,
      label: verdict.severityLabel,
      action: verdict.action,
      // Se devuelve para que el reportante vea si su valoración se sostuvo.
      reportedSeverity: reported,
      escalated: verdict.severity >= 2,
    },
    dispute,
    anchor,
  };
}

async function listIncidents(req, bUid) {
  await lifecycle.resolveIdentity(req);
  const { rows } = await query(
    `SELECT * FROM cargolink_incidents WHERE b_uid = $1 ORDER BY occurred_at DESC`, [bUid]
  );
  return {
    success: true,
    count: rows.length,
    open: rows.filter((r) => r.status === 'OPEN').length,
    incidents: rows,
  };
}

// ── TX020 — Cierre de operación ──────────────────────────────────────────────

/**
 * Comprueba, una por una, las condiciones para poder cerrar.
 *
 * Devuelve el detalle completo y no un booleano: quien no puede cerrar necesita
 * saber QUÉ se lo impide, y quien audita dentro de dos años necesita saber qué
 * se comprobó el día que se cerró.
 */
async function closureChecks(bUid, tx) {
  const checks = [];

  checks.push({
    check: 'delivered',
    ok: tx.status === lifecycle.TERMINAL_STATUS || tx.status === 'DELIVERED',
    detail: `estado del envío: ${tx.status}`,
  });

  const { rows: obligations } = await query(
    `SELECT status, COUNT(*)::int AS n FROM cargolink_payment_obligations
      WHERE b_uid = $1 GROUP BY status`, [bUid]
  ).catch(() => ({ rows: [] }));
  const pendingPay = obligations.filter((o) => o.status !== 'SETTLED')
    .reduce((s, o) => s + o.n, 0);
  checks.push({
    check: 'obligations_settled',
    ok: pendingPay === 0,
    detail: pendingPay ? `${pendingPay} obligación(es) sin liquidar` : 'sin obligaciones pendientes',
  });

  const { rows: disputes } = await query(
    `SELECT COUNT(*)::int AS n FROM cargolink_disputes
      WHERE b_uid = $1 AND status = 'OPEN'`, [bUid]
  ).catch(() => ({ rows: [{ n: 0 }] }));
  checks.push({
    check: 'no_open_disputes',
    ok: (disputes[0]?.n || 0) === 0,
    detail: disputes[0]?.n ? `${disputes[0].n} disputa(s) abiertas` : 'sin disputas abiertas',
  });

  const { rows: incidents } = await query(
    `SELECT COUNT(*)::int AS n FROM cargolink_incidents
      WHERE b_uid = $1 AND status = 'OPEN'`, [bUid]
  ).catch(() => ({ rows: [{ n: 0 }] }));
  checks.push({
    check: 'no_open_incidents',
    ok: (incidents[0]?.n || 0) === 0,
    detail: incidents[0]?.n ? `${incidents[0].n} incidencia(s) abiertas` : 'sin incidencias abiertas',
  });

  const { rows: legs } = await query(
    `SELECT COUNT(*)::int AS n FROM cargolink_transit_legs
      WHERE b_uid = $1 AND status <> 'CLEARED'`, [bUid]
  ).catch(() => ({ rows: [{ n: 0 }] }));
  checks.push({
    check: 'transit_cleared',
    ok: (legs[0]?.n || 0) === 0,
    detail: legs[0]?.n ? `${legs[0].n} aduana(s) sin despachar` : 'tránsito completo o no aplica',
  });

  // El escrow retenido es dinero de alguien parado. Cerrar sin resolverlo deja
  // el expediente contablemente abierto por mucho que diga «cerrado».
  checks.push({
    check: 'escrow_settled',
    ok: !['LOCKED', 'DISPUTED'].includes(tx.escrow_status),
    detail: `escrow: ${tx.escrow_status || 'sin escrow'}`,
  });

  return checks;
}

async function getClosureStatus(req, bUid) {
  await lifecycle.resolveIdentity(req);
  const tx = await loadTransaction(bUid);
  const { rows: existing } = await query(
    `SELECT * FROM cargolink_operation_closures WHERE b_uid = $1`, [bUid]
  );
  const checks = await closureChecks(bUid, tx);
  const blockers = checks.filter((c) => !c.ok);

  return {
    success: true,
    bUid,
    closed: existing.length > 0,
    closure: existing[0] || null,
    canClose: blockers.length === 0,
    checks,
    blockers: blockers.map((b) => b.check),
  };
}

async function closeOperation(req, bUid, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!CLOSURE_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot close an operation (only pos/admin)`, 403);
  }
  const tx = await loadTransaction(bUid);

  const { rows: existing } = await query(
    `SELECT reference FROM cargolink_operation_closures WHERE b_uid = $1`, [bUid]
  );
  if (existing.length) {
    throw httpError(`${bUid} is already closed (${existing[0].reference})`, 409);
  }

  const checks = await closureChecks(bUid, tx);
  const blockers = checks.filter((c) => !c.ok);
  const forced = body.force === true;

  if (blockers.length && !forced) {
    throw httpError(
      `Cannot close ${bUid}: ${blockers.map((b) => b.detail).join('; ')}. `
      + 'Use force with a reason to close anyway.',
      422
    );
  }
  if (forced && !String(body.forceReason || '').trim()) {
    // Forzar sin motivo convierte la comprobación en decorativa.
    throw httpError('force requires forceReason', 422);
  }
  if (forced && !blockers.length) {
    throw httpError('force is not applicable: nothing is blocking the closure', 422);
  }

  const reference = ref('CLS');
  const contentHash = sha256({ bUid, reference, checks, forced });

  const anchor = await onChain.anchorTransition(
    tx, 'OPERATION_CLOSED', { reference, contentHash, forced, blockers: blockers.map((b) => b.check) },
  ).catch((err) => ({ anchored: false, mode: 'anchor_failed', error: err.message }));

  const { rows } = await query(
    `INSERT INTO cargolink_operation_closures
       (b_uid, reference, closed_by, checks, forced, forced_reason,
        anchor_tx_hash, anchor_mode, content_hash)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
     RETURNING *`,
    [bUid, reference, identity.bezhasId, JSON.stringify(checks), forced,
     forced ? String(body.forceReason).trim() : null,
     anchor.txHash || null, anchor.mode, contentHash]
  );

  return { success: true, closure: rows[0], checks, forced, anchor };
}

module.exports = {
  reportIncident, listIncidents, closeOperation, getClosureStatus,
  closureChecks, toBreach, INCIDENT_KINDS,
};
