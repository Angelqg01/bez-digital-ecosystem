'use strict';

/**
 * cargoLinkEvents — eventos logísticos que NO son transiciones del ciclo de
 * vida: inspección aduanera (TX010) y cambio de ETA/ruta (TX011).
 *
 * Ninguno de los dos avanza el estado del envío. Una inspección puede ocurrir
 * y la mercancía seguir donde estaba; una ETA puede revisarse cinco veces
 * durante el mismo tránsito. Modelarlos como etapas habría obligado a
 * inventar un camino lineal que la operación real no tiene — el mismo
 * razonamiento que llevó a sacar el cambio de custodia del ciclo.
 *
 * Sobre el cambio de ruta, el análisis de Algeciras es explícito a raíz del
 * cambio de rotación del servicio EMUSA de MSC en julio de 2025 (sustituyó
 * Algeciras por Málaga):
 *
 *   «la red debe representar cambios de ruta sin perder la integridad
 *    histórica del envío»
 *
 * De ahí que esto escriba un histórico y no sobrescriba un campo: lo que un
 * cliente reclama cuando su carga llega tarde es precisamente el valor
 * anterior y quién lo cambió.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const logger = require('../utils/logger');
const lifecycle = require('./cargoLinkLifecycle');
const batcher = require('./cargoLinkBatcher');

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function sha256(value) {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex')}`;
}

// ── Inspección (TX010) ───────────────────────────────────────────────────────

const INSPECTION_KINDS = new Set(['CUSTOMS', 'SECURITY', 'PHYTO', 'SCAN']);
const INSPECTION_ROLES = new Set(['customs', 'admin']);

/**
 * Riesgo derivado del carril que ya calcula cargoLinkValidators.
 *
 * No se inventa un criterio nuevo: se formaliza el que la plataforma ya venía
 * aplicando al despachar. Los cortes coinciden con los del contrato
 * (preClearanceValidation: <30 pre-validado, >70 escalado).
 */
function riskFromLane(lane) {
  if (lane === 'GREEN_LANE') return 10;
  if (lane === 'ORANGE_LANE') return 50;
  if (lane === 'RED_LANE') return 85;
  return 50; // sin carril declarado, ni se pre-valida ni se escala solo
}

function chainStatusFor(riskScore, outcome) {
  if (outcome === 'REJECTED') return 'REJECTED';
  if (outcome === 'PASSED') return 'APPROVED';
  if (riskScore > 70) return 'ESCALATED';
  if (riskScore < 30) return 'PRE_VALIDATED';
  return 'PENDING';
}

/**
 * Registra una inspección sobre un envío.
 *
 * `HELD` es un resultado de primera clase, no un fallo: una inspección que
 * retiene la mercancía es exactamente lo que debe quedar registrado, y es el
 * caso que el Test 9 del análisis pide poder representar
 * (DECLARED → INSPECTION → HOLD → CLEARED).
 */
async function registerInspection(req, bUid, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!INSPECTION_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot register an inspection; requires 'customs'`, 403);
  }

  const { rows } = await query('SELECT * FROM cargolink_transactions WHERE b_uid = $1', [bUid]);
  if (rows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  const tx = rows[0];

  const kind = String(body.kind || 'CUSTOMS').toUpperCase();
  if (!INSPECTION_KINDS.has(kind)) {
    throw httpError(`kind must be one of: ${[...INSPECTION_KINDS].join(', ')}`, 422);
  }

  const outcome = String(body.outcome || '').toUpperCase();
  if (!['PASSED', 'HELD', 'REJECTED'].includes(outcome)) {
    throw httpError('outcome must be PASSED, HELD or REJECTED', 422);
  }
  if (outcome === 'REJECTED' && !body.findings) {
    // Rechazar sin motivo deja al operador sin nada que corregir y sin nada
    // que recurrir. El contrato también exige un motivo en rejectClearance.
    throw httpError('findings are required to reject a shipment', 422);
  }

  // El carril viene de la transición de aduanas si ya se despachó.
  const { rows: cleared } = await query(
    `SELECT payload FROM cargolink_transitions
      WHERE b_uid = $1 AND to_status = 'CUSTOMS_CLEARED'
      ORDER BY id DESC LIMIT 1`,
    [bUid]
  );
  const lane = body.lane || cleared?.[0]?.payload?.validation?.result?.lane || null;
  const riskScore = Number.isInteger(body.riskScore) ? body.riskScore : riskFromLane(lane);
  if (riskScore < 0 || riskScore > 100) throw httpError('riskScore must be between 0 and 100', 422);

  const chainStatus = chainStatusFor(riskScore, outcome);
  const evidenceHash = sha256({ bUid, kind, outcome, riskScore, findings: body.findings, at: new Date().toISOString() });

  const { rows: ins } = await query(
    `INSERT INTO cargolink_inspections
       (b_uid, kind, lane, risk_score, outcome, officer_id, findings, evidence_hash, chain_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, inspected_at`,
    [bUid, kind, lane, riskScore, outcome, identity.bezhasId,
      body.findings || null, evidenceHash, chainStatus]
  );

  // Una inspección que retiene o rechaza afecta al escrow: la mercancía no
  // está disponible, así que el dinero tampoco debería liberarse solo.
  if (outcome !== 'PASSED' && tx.escrow_status === 'LOCKED') {
    await query(
      `UPDATE cargolink_transactions SET escrow_status = 'DISPUTED', updated_at = now() WHERE b_uid = $1`,
      [bUid]
    );
  }

  const anchor = await anchorInspection(tx, { riskScore, outcome, evidenceHash, chainStatus });
  await query(
    'UPDATE cargolink_inspections SET chain_tx_hash = $1, anchor_mode = $2 WHERE id = $3',
    [anchor.txHash || null, anchor.anchored ? 'anchored' : (anchor.mode || 'failed'), ins[0].id]
  );

  await lifecycle.fanoutWebhooks({ tx, eventName: 'ON_INSPECTION' });

  return {
    inspectionId: ins[0].id, bUid, kind, lane, riskScore, outcome,
    officer: identity.bezhasId, findings: body.findings || null,
    evidenceHash, chainStatus,
    escrowHeld: outcome !== 'PASSED' && tx.escrow_status === 'LOCKED',
    inspectedAt: ins[0].inspected_at, anchor,
  };
}

async function anchorInspection(tx, { riskScore, outcome, evidenceHash, chainStatus }) {
  try {
    const onChain = require('./cargoLinkOnChain');
    if (!onChain.isConfigured()) return { anchored: false, mode: 'not_configured' };
    return await onChain.anchorInspection(tx, { riskScore, outcome, evidenceHash, chainStatus });
  } catch (err) {
    return { anchored: false, mode: 'anchor_failed', error: err.message };
  }
}

// ── Cambio de ETA / ruta (TX011) ─────────────────────────────────────────────

const CHANGE_TYPES = new Set(['ETA_CHANGE', 'ROUTE_CHANGE', 'PORT_CHANGE', 'CARGO_REROUTED']);
const CHANGE_ROLES = new Set(['carrier', 'logistics', 'admin']);

/**
 * Declara un cambio de ETA, ruta o puerto.
 *
 * El SLA se evalúa aquí y no en la entrega porque el incumplimiento se conoce
 * en el momento en que el transportista declara la nueva ETA — esperar a que
 * la mercancía llegue tarde para reconocerlo es perder el único margen que
 * tenía el cliente para reaccionar.
 */
async function registerRouteChange(req, bUid, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!CHANGE_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot declare a route change`, 403);
  }

  const { rows } = await query('SELECT * FROM cargolink_transactions WHERE b_uid = $1', [bUid]);
  if (rows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  const tx = rows[0];
  if (tx.status === 'DELIVERED') throw httpError('Shipment already delivered; ETA is settled', 409);

  const changeType = String(body.changeType || 'ETA_CHANGE').toUpperCase();
  if (!CHANGE_TYPES.has(changeType)) {
    throw httpError(`changeType must be one of: ${[...CHANGE_TYPES].join(', ')}`, 422);
  }
  if (!body.reason) throw httpError('reason is required: an unexplained ETA change is not auditable', 422);

  const prevEta = tx.committed_eta ? new Date(tx.committed_eta) : null;
  const newEta = body.newEta ? new Date(body.newEta) : null;
  if (body.newEta && Number.isNaN(newEta?.getTime())) throw httpError('newEta is not a valid date', 422);

  if (changeType === 'ETA_CHANGE' && !newEta) throw httpError('newEta is required for an ETA_CHANGE', 422);
  if (changeType === 'PORT_CHANGE' && !body.newPort) throw httpError('newPort is required for a PORT_CHANGE', 422);

  const delayMinutes = prevEta && newEta
    ? Math.round((newEta.getTime() - prevEta.getTime()) / 60000)
    : null;

  // Tolerancia de SLA declarada por el cliente en el envío, o 6 h por defecto.
  const toleranceMin = Number(tx.cargo?.slaToleranceMinutes ?? body.slaToleranceMinutes ?? 360);
  const slaBreach = delayMinutes !== null && delayMinutes > toleranceMin;

  const evidenceHash = sha256({
    bUid, changeType, prevEta, newEta, newPort: body.newPort, reason: body.reason,
    by: identity.bezhasId, at: new Date().toISOString(),
  });

  const { rows: ins } = await query(
    `INSERT INTO cargolink_route_changes
       (b_uid, change_type, previous_eta, new_eta, previous_port, new_port,
        previous_route, new_route, reason, declared_by, delay_minutes, sla_breach, evidence_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, occurred_at`,
    [bUid, changeType, prevEta, newEta, tx.current_port || null, body.newPort || null,
      body.previousRoute || null, body.newRoute || null, body.reason, identity.bezhasId,
      delayMinutes, slaBreach, evidenceHash]
  );

  await query(
    `UPDATE cargolink_transactions
        SET committed_eta = COALESCE($1, committed_eta),
            current_port  = COALESCE($2, current_port),
            eta_revisions = eta_revisions + 1,
            updated_at    = now()
      WHERE b_uid = $3`,
    [newEta, body.newPort || null, bUid]
  );

  // Evidencia pura: no mueve dinero ni cambia estado que otro contrato lea,
  // así que va al lote merkle en vez de gastar una transacción propia.
  let anchor = { anchored: false, mode: 'not_batched' };
  if (batcher.isEnabled()) {
    anchor = await batcher.enqueue({
      bUid, toStatus: changeType, actor: identity.bezhasId,
      payloadHash: evidenceHash, occurredAt: new Date(),
    });
  }
  await query(
    'UPDATE cargolink_route_changes SET anchor_mode = $1 WHERE id = $2',
    [anchor.mode || 'not_batched', ins[0].id]
  );

  if (slaBreach) {
    logger.warn(`[CARGOLINK][SLA] ${bUid} incumple SLA: +${delayMinutes} min sobre una tolerancia de ${toleranceMin}`);
  }
  await lifecycle.fanoutWebhooks({
    tx, eventName: slaBreach ? 'ON_SLA_BREACH' : 'ON_ETA_CHANGE',
  });

  return {
    changeId: ins[0].id, bUid, changeType,
    previousEta: prevEta, newEta, previousPort: tx.current_port || null, newPort: body.newPort || null,
    reason: body.reason, declaredBy: identity.bezhasId,
    delayMinutes, slaToleranceMinutes: toleranceMin, slaBreach,
    revision: (tx.eta_revisions || 0) + 1,
    evidenceHash, occurredAt: ins[0].occurred_at, anchor,
  };
}

/** Histórico completo de cambios de un envío, en orden cronológico. */
async function getRouteHistory(req, bUid) {
  await lifecycle.resolveIdentity(req);
  const { rows } = await query(
    `SELECT id, change_type, previous_eta, new_eta, previous_port, new_port,
            reason, declared_by, delay_minutes, sla_breach, evidence_hash,
            anchor_mode, occurred_at
       FROM cargolink_route_changes WHERE b_uid = $1 ORDER BY id ASC`,
    [bUid]
  );
  const { rows: current } = await query(
    'SELECT committed_eta, current_port, eta_revisions FROM cargolink_transactions WHERE b_uid = $1',
    [bUid]
  );
  return {
    bUid,
    committedEta: current?.[0]?.committed_eta || null,
    currentPort: current?.[0]?.current_port || null,
    revisions: current?.[0]?.eta_revisions || 0,
    slaBreaches: rows.filter((r) => r.sla_breach).length,
    // Retraso acumulado: la suma de los tramos, no la diferencia contra la
    // primera ETA, para que un adelanto posterior no borre un retraso previo.
    totalDelayMinutes: rows.reduce((s, r) => s + (r.delay_minutes || 0), 0),
    changes: rows,
  };
}

/** Inspecciones de un envío. */
async function getInspections(req, bUid) {
  await lifecycle.resolveIdentity(req);
  const { rows } = await query(
    `SELECT id, kind, lane, risk_score, outcome, officer_id, findings,
            evidence_hash, chain_status, chain_tx_hash, anchor_mode, inspected_at
       FROM cargolink_inspections WHERE b_uid = $1 ORDER BY id ASC`,
    [bUid]
  );
  return {
    bUid,
    held: rows.some((r) => r.outcome === 'HELD'),
    rejected: rows.some((r) => r.outcome === 'REJECTED'),
    inspections: rows,
  };
}

module.exports = {
  registerInspection, getInspections,
  registerRouteChange, getRouteHistory,
  riskFromLane, chainStatusFor,
  INSPECTION_KINDS, CHANGE_TYPES,
};
