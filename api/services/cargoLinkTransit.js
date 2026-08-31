'use strict';

/**
 * cargoLinkTransit — tránsito aduanero multipaís.
 *
 * ── Por qué hacía falta ─────────────────────────────────────────────────────
 *
 * Hasta ahora la plataforma modelaba UN despacho por envío. Ése es el caso
 * fácil, y no es el del piloto: Algeciras es frontera exterior de la UE, y un
 * contenedor Tánger→Frankfurt pasa por tres jurisdicciones que resuelven por
 * separado y a ritmos distintos. Con un solo despacho, el estado real —«libre
 * en España, pendiente en Alemania»— no se podía ni representar.
 *
 * `TrackingToCustomsGateway` ya existía en contratos, con sus pruebas, y no lo
 * llamaba nadie. Esto lo conecta.
 *
 * ── Qué aporta frente a llevarlo en la base de datos y ya ───────────────────
 *
 * Dos cosas concretas:
 *
 *   1. `createIntegratedShipment` arranca el tracking Y pide el despacho en una
 *      sola transacción. O quedan ligados los dos, o no queda ninguno. Hacerlo
 *      en dos llamadas deja la puerta a un envío que se rastrea pero que nadie
 *      ha declarado, que es exactamente el expediente que luego se atasca.
 *   2. La condición «todos los países han despachado» la evalúa el contrato al
 *      cerrar cada país. No es un campo que alguien marque: es el resultado de
 *      recorrer la lista. La diferencia importa cuando la mercancía se libera
 *      en función de ese booleano.
 */

const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');
const onChain = require('./cargoLinkOnChain');

const TRANSIT_ROLES = new Set(['customs', 'logistics', 'carrier', 'admin']);
const ISO2 = /^[A-Z]{2}$/;

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function requireRole(req, action) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!TRANSIT_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot ${action}`, 403);
  }
  return identity;
}

async function loadTransaction(bUid) {
  const { rows } = await query(
    `SELECT b_uid, owner_bezhas_id, status FROM cargolink_transactions WHERE b_uid = $1`,
    [bUid]
  );
  if (rows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  return rows[0];
}

/**
 * Da de alta un envío integrado y su ruta de despacho país a país.
 *
 * La ruta se exige completa desde el principio, y no se deja añadir países
 * sobre la marcha: si el itinerario puede crecer, «todos despachados» no
 * significa nada — siempre cabría uno más.
 */
async function createIntegratedShipment(req, body = {}) {
  const identity = await requireRole(req, 'create an integrated shipment');
  const bUid = body.bUid;
  if (!bUid) throw httpError('bUid is required', 400);
  await loadTransaction(bUid);

  const countries = Array.isArray(body.countries) ? body.countries : [];
  if (countries.length < 2) {
    throw httpError(
      'countries requires at least 2 entries: a single-country clearance is a plain '
      + 'clearance, not a transit — use the customs endpoint for that',
      422
    );
  }
  const seen = new Set();
  for (const [i, raw] of countries.entries()) {
    const code = String(raw || '').toUpperCase();
    if (!ISO2.test(code)) {
      throw httpError(`countries[${i}] must be an ISO 3166-1 alpha-2 code (e.g. ES, MA, DE)`, 422);
    }
    if (seen.has(code)) throw httpError(`countries[${i}]: ${code} is repeated`, 422);
    seen.add(code);
  }

  const cargoValueCents = Math.round(Number(body.cargoValue ?? 0) * 100);
  if (!Number.isFinite(cargoValueCents) || cargoValueCents < 0) {
    throw httpError('cargoValue must be a non-negative number', 422);
  }
  if (!body.hsCode) {
    throw httpError('hsCode is required: a transit declaration without a tariff code cannot be filed', 422);
  }

  const { rows: existing } = await query(
    `SELECT id FROM cargolink_integrated_shipments WHERE b_uid = $1`, [bUid]
  );
  if (existing.length) throw httpError(`${bUid} is already an integrated shipment`, 409);

  const chainShipmentId = await onChain.getChainShipmentId(bUid).catch(() => null);
  const anchor = await onChain.anchorIntegratedShipment(chainShipmentId, {
    trackingProvider: body.trackingProvider || 'BEZHAS',
    trackingRef: body.trackingRef || bUid,
    customsPlatform: body.customsPlatform || 'AEAT',
    hsCode: body.hsCode,
    cargoValueCents,
    duaHash: body.duaHash,
    countries: [...seen],
  });

  const { rows } = await query(
    `INSERT INTO cargolink_integrated_shipments
       (b_uid, chain_shipment_id, tracking_provider, tracking_ref, customs_platform,
        hs_code, cargo_value_cents, currency, dua_hash, anchor_tx_hash, anchor_mode, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [bUid, chainShipmentId, body.trackingProvider || 'BEZHAS', body.trackingRef || bUid,
     body.customsPlatform || 'AEAT', String(body.hsCode), cargoValueCents,
     (body.currency || 'EUR').toUpperCase(), body.duaHash || null,
     anchor.txHash || null, anchor.mode, identity.bezhasId]
  );

  const legs = [];
  for (const [i, code] of [...seen].entries()) {
    const { rows: legRows } = await query(
      `INSERT INTO cargolink_transit_legs
         (b_uid, chain_shipment_id, leg_index, country_code, customs_platform)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [bUid, chainShipmentId, i, code, body.customsPlatform || null]
    );
    legs.push(legRows[0]);
  }

  return { success: true, shipment: rows[0], legs, anchor };
}

/**
 * Cierra el despacho de un país.
 *
 * Se exige el orden del itinerario. Un contenedor no puede estar despachado en
 * Alemania mientras sigue retenido en España: aceptarlo sería registrar una
 * secuencia de hechos imposible, y toda la utilidad de esto es que la
 * secuencia sea creíble.
 */
async function clearCountry(req, bUid, body = {}) {
  const identity = await requireRole(req, 'clear a transit country');
  await loadTransaction(bUid);

  const code = String(body.country || '').toUpperCase();
  if (!ISO2.test(code)) throw httpError('country must be an ISO 3166-1 alpha-2 code', 422);

  const { rows: legs } = await query(
    `SELECT * FROM cargolink_transit_legs WHERE b_uid = $1 ORDER BY leg_index`, [bUid]
  );
  if (legs.length === 0) throw httpError(`${bUid} has no transit route`, 404);

  const leg = legs.find((l) => l.country_code === code);
  if (!leg) throw httpError(`${code} is not part of the transit route for ${bUid}`, 422);
  if (leg.status === 'CLEARED') throw httpError(`${code} is already cleared`, 409);

  const pendingBefore = legs.filter((l) => l.leg_index < leg.leg_index && l.status === 'PENDING');
  if (pendingBefore.length) {
    throw httpError(
      `Cannot clear ${code}: ${pendingBefore.map((l) => l.country_code).join(', ')} `
      + 'still pending earlier in the route',
      422
    );
  }

  const rejected = String(body.outcome || 'CLEARED').toUpperCase() === 'REJECTED';
  const anchor = rejected
    ? { anchored: false, mode: 'rejected_not_anchored' }
    : await onChain.anchorCountryClearance(leg.chain_shipment_id, code);

  const { rows } = await query(
    `UPDATE cargolink_transit_legs
        SET status = $1, cleared_at = NOW(), cleared_by = $2,
            reference = $3, notes = $4, anchor_tx_hash = $5
      WHERE id = $6 RETURNING *`,
    [rejected ? 'REJECTED' : 'CLEARED', identity.bezhasId,
     body.reference || null, body.notes || null, anchor.txHash || null, leg.id]
  );

  // «Todos despachados» se recalcula, nunca se recibe. Un booleano que el
  // cliente pudiera enviar no sería una garantía de nada.
  const { rows: after } = await query(
    `SELECT status FROM cargolink_transit_legs WHERE b_uid = $1`, [bUid]
  );
  const allCleared = after.every((l) => l.status === 'CLEARED');
  await query(
    `UPDATE cargolink_integrated_shipments
        SET all_countries_cleared = $1, updated_at = NOW() WHERE b_uid = $2`,
    [allCleared, bUid]
  );

  return {
    success: true,
    leg: rows[0],
    anchor,
    allCountriesCleared: allCleared,
    pendingCountries: after.filter((l) => l.status === 'PENDING').length,
  };
}

/** Estado del tránsito: dónde está despachado y dónde no. */
async function getTransitStatus(req, bUid) {
  await lifecycle.resolveIdentity(req);
  const { rows: header } = await query(
    `SELECT * FROM cargolink_integrated_shipments WHERE b_uid = $1`, [bUid]
  );
  if (header.length === 0) throw httpError(`${bUid} is not an integrated shipment`, 404);

  const { rows: legs } = await query(
    `SELECT leg_index, country_code, status, cleared_at, cleared_by, reference, anchor_tx_hash
       FROM cargolink_transit_legs WHERE b_uid = $1 ORDER BY leg_index`, [bUid]
  );

  const pending = legs.filter((l) => l.status === 'PENDING');
  const rejected = legs.filter((l) => l.status === 'REJECTED');

  return {
    success: true,
    shipment: header[0],
    legs,
    readyForRelease: legs.length > 0 && pending.length === 0 && rejected.length === 0,
    // Cuál es la aduana que está frenando el envío. Es la pregunta que se hace
    // de verdad un operador, y responderla exige el orden del itinerario.
    blockedAt: pending.length ? pending[0].country_code : null,
    rejectedAt: rejected.map((l) => l.country_code),
  };
}

module.exports = { createIntegratedShipment, clearCountry, getTransitStatus };
