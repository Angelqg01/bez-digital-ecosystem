'use strict';

/**
 * cargoLinkSettlement — huella de carbono (TX019), factura (TX016) y
 * obligación de pago (TX017) del dominio logístico.
 *
 * Los tres van juntos porque en la práctica lo están: la huella de un envío es
 * cada vez más una línea de su factura, y la factura genera la obligación que
 * el escrow liquida.
 *
 * ── Sobre la huella ─────────────────────────────────────────────────────────
 * Se calcula por tramos, en gramos de CO2e por tonelada-kilómetro, que es la
 * unidad del sector (GLEC Framework / ISO 14083). Permite sumar un tramo
 * marítimo con uno de carretera y comparar envíos de distinto tamaño.
 *
 * El certificado guarda los tramos completos y el factor aplicado a cada uno,
 * no sólo el total: un auditor tiene que poder recomputar la cifra sin
 * confiar en quien la emitió. Y los factores cambian —las normas se revisan—
 * así que un certificado de 2026 debe seguir explicándose en 2028.
 *
 * ── Sobre la obligación de pago ─────────────────────────────────────────────
 * Nace de un hecho verificable (entrega confirmada, SLA roto, avería), no de
 * una decisión. Eso es lo que permite automatizarla sin que nadie tenga que
 * fiarse: el hecho está registrado y la obligación se deriva de él.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function sha256(value) {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex')}`;
}

function ref(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

// ── Huella de carbono (TX019) ────────────────────────────────────────────────

const MODES = new Set(['SEA_CONTAINER', 'ROAD_TRUCK', 'RAIL', 'AIR', 'INLAND_WATERWAY']);
const ESG_ROLES = new Set(['carrier', 'logistics', 'admin']);

/**
 * Factor de emisión vigente para un modo (y subtipo si se indica).
 *
 * Se elige el más reciente que ya esté en vigor. Sin subtipo se toma el más
 * conservador —el de mayor emisión— porque declarar de menos en una huella es
 * el error que un auditor penaliza; declarar de más, no.
 */
async function resolveFactor(mode, subtype) {
  const { rows } = await query(
    `SELECT id, mode, subtype, gco2e_per_tkm, source
       FROM cargolink_emission_factors
      WHERE mode = $1
        AND ($2::text IS NULL OR subtype = $2)
        AND valid_from <= CURRENT_DATE
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
      ORDER BY (subtype = $2) DESC NULLS LAST, gco2e_per_tkm DESC
      LIMIT 1`,
    [mode, subtype || null]
  );
  return rows[0] || null;
}

/**
 * Emite el certificado de huella de un envío.
 *
 * @param legs [{ mode, subtype?, distanceKm, weightKg? }]
 */
async function issueCarbonCertificate(req, bUid, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!ESG_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot issue a carbon certificate`, 403);
  }

  const { rows: tRows } = await query(
    'SELECT b_uid, cargo, origin, destination FROM cargolink_transactions WHERE b_uid = $1', [bUid]);
  if (tRows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  const tx = tRows[0];

  const legs = Array.isArray(body.legs) ? body.legs : [];
  if (legs.length === 0) {
    throw httpError('legs are required: a footprint without route segments cannot be computed', 422);
  }

  const cargoKg = Number(body.cargoWeightKg ?? tx.cargo?.weight ?? 0);
  if (!Number.isFinite(cargoKg) || cargoKg <= 0) {
    throw httpError('cargoWeightKg must be a positive number', 422);
  }
  const tonnes = cargoKg / 1000;

  const computed = [];
  let totalKg = 0;
  let totalKm = 0;

  for (const [i, leg] of legs.entries()) {
    const mode = String(leg.mode || '').toUpperCase();
    if (!MODES.has(mode)) {
      throw httpError(`leg ${i}: mode must be one of ${[...MODES].join(', ')}`, 422);
    }
    const km = Number(leg.distanceKm);
    if (!Number.isFinite(km) || km <= 0) {
      throw httpError(`leg ${i}: distanceKm must be a positive number`, 422);
    }

    const factor = await resolveFactor(mode, leg.subtype);
    if (!factor) throw httpError(`leg ${i}: no emission factor available for ${mode}`, 422);

    // g/t-km × t × km = gramos; se pasa a kg.
    const grams = Number(factor.gco2e_per_tkm) * tonnes * km;
    const kg = Number((grams / 1000).toFixed(3));

    computed.push({
      index: i, mode, subtype: factor.subtype, distanceKm: km,
      factorGco2ePerTkm: Number(factor.gco2e_per_tkm),
      source: factor.source, kgco2e: kg,
    });
    totalKg += kg;
    totalKm += km;
  }

  totalKg = Number(totalKg.toFixed(3));
  const intensity = Number((totalKg / tonnes).toFixed(4));
  const certificateNo = ref('CO2');
  const evidenceHash = sha256({ bUid, legs: computed, totalKg, cargoKg, method: 'GLEC_v3' });

  const { rows } = await query(
    `INSERT INTO cargolink_carbon_certificates
       (certificate_no, b_uid, total_kgco2e, intensity_kgco2e_per_t, total_distance_km,
        cargo_weight_kg, legs, methodology, issuer_bezhas_id, evidence_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'GLEC_v3',$8,$9)
     RETURNING id, certificate_no, issued_at`,
    [certificateNo, bUid, totalKg, intensity, totalKm, Math.round(cargoKg),
      JSON.stringify(computed), identity.bezhasId, evidenceHash]
  );

  return {
    certificateId: rows[0].id, certificateNo, bUid,
    totalKgCO2e: totalKg,
    intensityKgCO2ePerTonne: intensity,
    totalDistanceKm: totalKm, cargoWeightKg: Math.round(cargoKg),
    methodology: 'GLEC_v3', legs: computed,
    issuedBy: identity.bezhasId, evidenceHash, issuedAt: rows[0].issued_at,
  };
}

async function getCarbonCertificates(req, bUid) {
  await lifecycle.resolveIdentity(req);
  const { rows } = await query(
    `SELECT certificate_no, total_kgco2e, intensity_kgco2e_per_t, total_distance_km,
            cargo_weight_kg, legs, methodology, issuer_bezhas_id, evidence_hash,
            anchor_mode, issued_at
       FROM cargolink_carbon_certificates WHERE b_uid = $1 ORDER BY id DESC`,
    [bUid]);
  return { bUid, certificates: rows };
}

// ── Factura (TX016) ──────────────────────────────────────────────────────────

const INVOICE_ROLES = new Set(['carrier', 'logistics', 'admin']);

/**
 * Emite una factura de flete.
 *
 * Las líneas se guardan enteras porque lo que se discute en una factura de
 * flete casi nunca es el total: es un recargo concreto (BAF, THC, demora).
 * Guardar sólo el importe agregado obliga a reconstruirlo por correo.
 */
async function issueInvoice(req, bUid, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!INVOICE_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot issue an invoice`, 403);
  }

  const { rows: tRows } = await query(
    'SELECT b_uid, owner_bezhas_id, booking_id FROM cargolink_transactions WHERE b_uid = $1', [bUid]);
  if (tRows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  const tx = tRows[0];

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) throw httpError('lines are required', 422);

  let subtotal = 0;
  const clean = lines.map((l, i) => {
    const amount = Number(l.amountEur);
    if (!Number.isFinite(amount)) throw httpError(`line ${i}: amountEur must be a number`, 422);
    if (!l.concept) throw httpError(`line ${i}: concept is required`, 422);
    subtotal += amount;
    return {
      concept: String(l.concept),
      code: l.code || null,          // BAF, THC, ISPS, FREIGHT...
      amountEur: Number(amount.toFixed(2)),
      note: l.note || null,
    };
  });

  subtotal = Number(subtotal.toFixed(2));
  const taxRate = Number(body.taxRate ?? 0);
  if (taxRate < 0 || taxRate > 1) throw httpError('taxRate must be between 0 and 1', 422);
  const tax = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  const invoiceNo = body.invoiceNo || ref('INV');
  const payer = body.payerBezhasId || tx.owner_bezhas_id;
  const evidenceHash = sha256({ bUid, invoiceNo, lines: clean, total });

  try {
    const { rows } = await query(
      `INSERT INTO cargolink_invoices
         (invoice_no, b_uid, booking_id, issuer_bezhas_id, payer_bezhas_id,
          lines, subtotal_eur, tax_eur, total_eur, due_date, evidence_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, invoice_no, status, issued_at`,
      [invoiceNo, bUid, tx.booking_id || null, identity.bezhasId, payer,
        JSON.stringify(clean), subtotal, tax, total, body.dueDate || null, evidenceHash]
    );
    return {
      invoiceId: rows[0].id, invoiceNo, bUid,
      issuer: identity.bezhasId, payer,
      lines: clean, subtotalEur: subtotal, taxEur: tax, totalEur: total,
      status: rows[0].status, evidenceHash, issuedAt: rows[0].issued_at,
    };
  } catch (err) {
    if (err.code === '23505') throw httpError(`Invoice ${invoiceNo} already exists`, 409);
    throw err;
  }
}

// ── Obligación de pago (TX017) ───────────────────────────────────────────────

const OBLIGATION_KINDS = new Set([
  'FREIGHT', 'SLA_PENALTY', 'DAMAGE_CLAIM', 'DEMURRAGE', 'CARBON_SURCHARGE',
]);

/**
 * Crea una obligación de pago a partir de un hecho registrado.
 *
 * Se exige `triggerEvent` porque una obligación sin hecho que la origine no es
 * automatizable ni defendible: es una factura más. Lo que hace útil este
 * objeto es poder responder «¿por qué debo esto?» señalando un registro.
 */
async function createObligation(req, bUid, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);

  const { rows: tRows } = await query(
    'SELECT b_uid, owner_bezhas_id FROM cargolink_transactions WHERE b_uid = $1', [bUid]);
  if (tRows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  const tx = tRows[0];

  const kind = String(body.kind || '').toUpperCase();
  if (!OBLIGATION_KINDS.has(kind)) {
    throw httpError(`kind must be one of: ${[...OBLIGATION_KINDS].join(', ')}`, 422);
  }
  if (!body.triggerEvent) {
    throw httpError('triggerEvent is required: an obligation without a cause is not auditable', 422);
  }

  const amount = Number(body.amountEur);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw httpError('amountEur must be a positive number', 422);
  }

  const debtor = body.debtorBezhasId || tx.owner_bezhas_id;
  const creditor = body.creditorBezhasId || identity.bezhasId;
  if (debtor === creditor) throw httpError('debtor and creditor cannot be the same party', 422);

  const obligationRef = ref('OBL');
  const evidenceHash = sha256({ bUid, kind, amount, debtor, creditor, trigger: body.triggerEvent });

  const { rows } = await query(
    `INSERT INTO cargolink_payment_obligations
       (obligation_ref, b_uid, invoice_id, debtor_bezhas_id, creditor_bezhas_id,
        amount_eur, kind, trigger_event, trigger_ref, due_date, evidence_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, obligation_ref, status, created_at`,
    [obligationRef, bUid, body.invoiceId || null, debtor, creditor,
      Number(amount.toFixed(2)), kind, body.triggerEvent, body.triggerRef || null,
      body.dueDate || null, evidenceHash]
  );

  return {
    obligationId: rows[0].id, obligationRef, bUid, kind,
    amountEur: Number(amount.toFixed(2)), debtor, creditor,
    triggerEvent: body.triggerEvent, triggerRef: body.triggerRef || null,
    status: rows[0].status, evidenceHash, createdAt: rows[0].created_at,
  };
}

/**
 * Liquida una obligación contra un pago confirmado en cadena.
 *
 * Mismo criterio que en la compra de energía P2P: el hash se verifica contra
 * la cadena antes de dar nada por pagado. Aceptar la palabra del deudor es
 * exactamente el fallo que se corrigió allí.
 */
async function settleObligation(req, obligationRef, body = {}) {
  await lifecycle.resolveIdentity(req);

  const { rows } = await query(
    'SELECT * FROM cargolink_payment_obligations WHERE obligation_ref = $1', [obligationRef]);
  if (rows.length === 0) throw httpError(`Unknown obligation ${obligationRef}`, 404);
  const o = rows[0];
  if (o.status === 'SETTLED') throw httpError('Obligation already settled', 409);

  const txHash = body.txHash;
  if (!txHash) throw httpError('txHash is required to settle an obligation', 422);

  const dup = await query(
    'SELECT id FROM cargolink_payment_obligations WHERE settled_tx_hash = $1 AND obligation_ref <> $2',
    [txHash, obligationRef]);
  if (dup.rows?.[0]?.id) throw httpError('This transaction already settled another obligation', 409);

  // Mismo criterio que en la compra de energía P2P: sin cadena no hay forma de
  // comprobar el pago, y marcar SETTLED sobre la palabra del deudor es
  // exactamente el agujero que allí se cerró. Se rechaza en vez de degradar.
  let provider = null;
  try {
    provider = require('./cargoLinkOnChain').getSigner()?.provider || null;
  } catch { /* módulo no disponible */ }
  if (!provider) {
    throw httpError('Chain provider not configured — cannot verify payment for a settlement', 503);
  }

  let verification;
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) throw httpError('Payment transaction not found on-chain', 400);
    if (receipt.status === 0) throw httpError('Payment transaction reverted on-chain', 400);
    verification = { verified: true, mode: 'receipt_confirmed', blockNumber: receipt.blockNumber };
  } catch (err) {
    if (err.status) throw err;
    throw httpError(`Could not verify payment on-chain: ${err.message}`, 502);
  }

  await query(
    `UPDATE cargolink_payment_obligations
        SET status = 'SETTLED', settled_tx_hash = $1, settled_at = now()
      WHERE obligation_ref = $2`,
    [txHash, obligationRef]);

  if (o.invoice_id) {
    // La factura pasa a liquidada sólo cuando no le quedan obligaciones vivas.
    const { rows: pend } = await query(
      `SELECT COUNT(*)::int AS n FROM cargolink_payment_obligations
        WHERE invoice_id = $1 AND status = 'PENDING'`, [o.invoice_id]);
    if (pend[0].n === 0) {
      await query(`UPDATE cargolink_invoices SET status = 'SETTLED' WHERE id = $1`, [o.invoice_id]);
    }
  }

  return { obligationRef, status: 'SETTLED', txHash, verification };
}

async function listObligations(req, bUid) {
  await lifecycle.resolveIdentity(req);
  const { rows } = await query(
    `SELECT obligation_ref, kind, amount_eur, debtor_bezhas_id, creditor_bezhas_id,
            trigger_event, trigger_ref, status, settled_tx_hash, due_date, created_at
       FROM cargolink_payment_obligations WHERE b_uid = $1 ORDER BY id ASC`, [bUid]);
  const pending = rows.filter((r) => r.status === 'PENDING');
  return {
    bUid,
    outstandingEur: Number(pending.reduce((s, r) => s + Number(r.amount_eur), 0).toFixed(2)),
    obligations: rows,
  };
}

module.exports = {
  issueCarbonCertificate, getCarbonCertificates, resolveFactor,
  issueInvoice,
  createObligation, settleObligation, listObligations,
  MODES, OBLIGATION_KINDS,
};
