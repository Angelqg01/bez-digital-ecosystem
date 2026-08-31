'use strict';

/**
 * cargoLinkBooking — reserva de capacidad (TX002) y contenedores (TX003).
 *
 * Dos entidades que faltaban y que no son campos de un envío:
 *
 *   BOOKING     precede al envío. El cargador reserva espacio en un buque y
 *               sólo después entrega la carga. Sin esto no había forma de
 *               representar el compromiso de capacidad, que es exactamente lo
 *               que se discute cuando hay sobreventa o un no-show.
 *
 *   CONTENEDOR  es un ACTIVO reutilizable, no un atributo del envío. El mismo
 *               equipo hace decenas de viajes para dueños distintos, y su
 *               historial pertenece al contenedor.
 *
 * El número de contenedor se valida contra la norma ISO 6346, que lleva
 * dígito de control. Comprobarlo permite rechazar una errata de teclado antes
 * de que llegue a la cadena, donde ya no se corrige.
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

// ── ISO 6346 ─────────────────────────────────────────────────────────────────

/**
 * Valor numérico de una letra en ISO 6346.
 *
 * La norma salta los múltiplos de 11 (11, 22, 33...) porque el módulo final
 * es 11 y esos valores serían indistinguibles del 0. De ahí que la serie no
 * sea simplemente A=10, B=11, C=12.
 */
// Tabla de la norma. Se construye una sola vez recorriendo desde 10 y
// omitiendo los múltiplos de 11 — restarlos con una fórmula de un solo paso
// da valores incorrectos a partir de la L (sale 22, que es precisamente uno
// de los valores prohibidos; el correcto es 23).
const LETTER_VALUES = (() => {
  const table = {};
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let value = 10;
  for (const letter of letters) {
    while (value % 11 === 0) value++;
    table[letter] = value;
    value++;
  }
  return table;
})();

function letterValue(ch) {
  const v = LETTER_VALUES[ch];
  return v === undefined ? null : v;
}

/**
 * Dígito de control ISO 6346.
 *
 * Cada uno de los 10 primeros caracteres se multiplica por 2^posición, se suma
 * todo y se toma módulo 11. Un resto de 10 se representa como 0 — es el único
 * caso especial de la norma y el que más implementaciones se dejan.
 */
function checkDigit(first10) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = first10[i];
    const val = i < 4 ? letterValue(ch) : Number(ch);
    if (val === null || Number.isNaN(val)) return null;
    sum += val * (2 ** i);
  }
  return (sum % 11) % 10;
}

/**
 * Valida un número de contenedor completo.
 * @returns {{valid: boolean, reason?: string, expected?: number}}
 */
function validateContainerNo(no) {
  const s = String(no || '').toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{4}\d{7}$/.test(s)) {
    return { valid: false, reason: 'format must be 4 letters + 7 digits (ISO 6346)' };
  }
  // La cuarta letra es la categoría del equipo: U (contenedor de carga),
  // J (equipo desmontable) o Z (chasis/remolque). Otra cosa no es un
  // contenedor de transporte.
  if (!'UJZ'.includes(s[3])) {
    return { valid: false, reason: `category letter must be U, J or Z (got '${s[3]}')` };
  }
  const expected = checkDigit(s.slice(0, 10));
  if (expected === null) return { valid: false, reason: 'could not compute check digit' };
  if (expected !== Number(s[10])) {
    return { valid: false, reason: 'check digit does not match', expected };
  }
  return { valid: true, normalized: s };
}

// ── Booking (TX002) ──────────────────────────────────────────────────────────

const BOOKING_ROLES = new Set(['carrier', 'admin']);

/**
 * Crea un booking: el transportista compromete capacidad.
 *
 * Los cut-offs son obligatorios porque sin ellos el booking no compromete
 * nada: cualquier retraso sería aceptable y la penalización por no-show que
 * describe el análisis no tendría sobre qué calcularse.
 */
async function createBooking(req, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!BOOKING_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot create a booking; requires 'carrier'`, 403);
  }

  const { bookingRef, shipperBezhasId, vessel, voyage, pol, pod } = body;
  if (!bookingRef) throw httpError('bookingRef is required', 422);
  if (!shipperBezhasId) throw httpError('shipperBezhasId is required', 422);
  if (!pol || !pod) throw httpError('pol and pod (load/discharge ports) are required', 422);

  const teu = Number(body.teuBooked);
  if (!Number.isFinite(teu) || teu <= 0) throw httpError('teuBooked must be a positive number', 422);

  const docCutoff = body.docCutoff ? new Date(body.docCutoff) : null;
  const cargoCutoff = body.cargoCutoff ? new Date(body.cargoCutoff) : null;
  if (docCutoff && cargoCutoff && docCutoff > cargoCutoff) {
    // El cut-off documental es anterior al físico: los papeles se cierran
    // antes de que la mercancía deje de admitirse, nunca al revés.
    throw httpError('docCutoff must be earlier than cargoCutoff', 422);
  }

  const evidenceHash = sha256({ bookingRef, shipperBezhasId, pol, pod, teu, vessel, voyage });

  try {
    const { rows } = await query(
      `INSERT INTO cargolink_bookings
         (booking_ref, carrier_bezhas_id, shipper_bezhas_id, vessel, voyage,
          pol, pod, teu_booked, doc_cutoff, cargo_cutoff, freight_rate_eur, evidence_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, booking_ref, status, teu_booked, teu_used, created_at`,
      [bookingRef, identity.bezhasId, shipperBezhasId, vessel || null, voyage || null,
        pol, pod, teu, docCutoff, cargoCutoff, body.freightRateEur || null, evidenceHash]
    );
    return { ...rows[0], carrier: identity.bezhasId, shipper: shipperBezhasId, pol, pod, evidenceHash };
  } catch (err) {
    if (err.code === '23505') throw httpError(`Booking ${bookingRef} already exists`, 409);
    throw err;
  }
}

/**
 * Asigna un envío a un booking, consumiendo capacidad.
 *
 * Aquí es donde el booking deja de ser un papel: si la capacidad no llega, la
 * asignación se rechaza. Y si el cut-off físico ya pasó, también — aceptar
 * carga después del cierre es precisamente lo que provoca que un contenedor se
 * quede en tierra.
 */
async function assignShipmentToBooking(req, bookingRef, bUid, opts = {}) {
  const identity = await lifecycle.resolveIdentity(req);

  const { rows: bRows } = await query(
    'SELECT * FROM cargolink_bookings WHERE booking_ref = $1', [bookingRef]);
  if (bRows.length === 0) throw httpError(`Unknown booking ${bookingRef}`, 404);
  const booking = bRows[0];

  if (booking.status === 'CANCELLED') throw httpError('Booking is cancelled', 409);
  if (booking.status === 'CLOSED') throw httpError('Booking is closed', 409);

  const { rows: tRows } = await query(
    'SELECT b_uid, booking_id FROM cargolink_transactions WHERE b_uid = $1', [bUid]);
  if (tRows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  if (tRows[0].booking_id) throw httpError('Shipment is already assigned to a booking', 409);

  if (booking.cargo_cutoff && new Date(booking.cargo_cutoff) < new Date()) {
    throw httpError('Cargo cut-off has passed; this booking no longer admits cargo', 409);
  }

  const teu = Number(opts.teu ?? 1);
  if (!Number.isFinite(teu) || teu <= 0) throw httpError('teu must be a positive number', 422);

  const remaining = Number(booking.teu_booked) - Number(booking.teu_used);
  if (teu > remaining) {
    throw httpError(
      `Booking ${bookingRef} has ${remaining} TEU left; ${teu} requested`, 409);
  }

  await query('UPDATE cargolink_bookings SET teu_used = teu_used + $1, updated_at = now() WHERE id = $2',
    [teu, booking.id]);
  await query('UPDATE cargolink_transactions SET booking_id = $1, updated_at = now() WHERE b_uid = $2',
    [booking.id, bUid]);

  return {
    bookingRef, bUid, teuAssigned: teu,
    teuRemaining: remaining - teu,
    assignedBy: identity.bezhasId,
  };
}

/** Marca un booking como no-show: se reservó capacidad y no se entregó carga. */
async function markNoShow(req, bookingRef, reason) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!BOOKING_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot mark a no-show`, 403);
  }

  const { rows } = await query('SELECT * FROM cargolink_bookings WHERE booking_ref = $1', [bookingRef]);
  if (rows.length === 0) throw httpError(`Unknown booking ${bookingRef}`, 404);
  const b = rows[0];

  if (Number(b.teu_used) > 0) {
    // Con carga asignada no es un no-show: si acaso es un envío incompleto,
    // que es una disputa distinta y con otra consecuencia económica.
    throw httpError(
      `Booking has ${b.teu_used} TEU assigned; a no-show requires zero cargo`, 409);
  }
  if (b.cargo_cutoff && new Date(b.cargo_cutoff) > new Date()) {
    throw httpError('Cargo cut-off has not passed yet; cannot declare a no-show', 409);
  }

  await query(
    `UPDATE cargolink_bookings SET no_show = TRUE, status = 'CLOSED', updated_at = now() WHERE id = $1`,
    [b.id]);
  return { bookingRef, noShow: true, teuForfeited: Number(b.teu_booked), reason: reason || null };
}

async function getBooking(req, bookingRef) {
  await lifecycle.resolveIdentity(req);
  const { rows } = await query('SELECT * FROM cargolink_bookings WHERE booking_ref = $1', [bookingRef]);
  if (rows.length === 0) throw httpError(`Unknown booking ${bookingRef}`, 404);
  const { rows: shipments } = await query(
    'SELECT b_uid, status FROM cargolink_transactions WHERE booking_id = $1 ORDER BY id',
    [rows[0].id]);
  return {
    ...rows[0],
    teu_remaining: Number(rows[0].teu_booked) - Number(rows[0].teu_used),
    shipments,
  };
}

// ── Contenedor (TX003) ───────────────────────────────────────────────────────

const CONTAINER_ROLES = new Set(['carrier', 'logistics', 'admin']);
const CATEGORIES = new Set(['DRY', 'REEFER', 'TANK', 'OPEN_TOP', 'FLAT_RACK']);

async function registerContainer(req, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!CONTAINER_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot register a container`, 403);
  }

  const check = validateContainerNo(body.containerNo);
  if (!check.valid) {
    throw httpError(
      `Invalid container number: ${check.reason}`
      + (check.expected !== undefined ? ` (expected check digit ${check.expected})` : ''),
      422);
  }

  const category = String(body.category || 'DRY').toUpperCase();
  if (!CATEGORIES.has(category)) {
    throw httpError(`category must be one of: ${[...CATEGORIES].join(', ')}`, 422);
  }

  try {
    const { rows } = await query(
      `INSERT INTO cargolink_containers
         (container_no, iso_type, category, tare_kg, max_payload_kg, owner_bezhas_id, last_seen_location)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [check.normalized, body.isoType || null, category,
        body.tareKg || null, body.maxPayloadKg || null,
        body.ownerBezhasId || identity.bezhasId, body.location || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw httpError(`Container ${check.normalized} already registered`, 409);
    throw err;
  }
}

/**
 * Asigna un contenedor a un envío.
 *
 * El índice parcial de la base de datos ya impide que un contenedor esté en
 * dos envíos a la vez; aquí se comprueba antes para poder dar un error con
 * sentido en vez de una violación de restricción.
 */
async function assignContainer(req, bUid, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!CONTAINER_ROLES.has(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot assign a container`, 403);
  }

  const check = validateContainerNo(body.containerNo);
  if (!check.valid) throw httpError(`Invalid container number: ${check.reason}`, 422);

  const { rows: cRows } = await query(
    'SELECT * FROM cargolink_containers WHERE container_no = $1', [check.normalized]);
  if (cRows.length === 0) throw httpError(`Container ${check.normalized} is not registered`, 404);
  const container = cRows[0];

  if (container.status === 'DAMAGED' || container.status === 'RETIRED') {
    throw httpError(`Container ${check.normalized} is ${container.status} and cannot be assigned`, 409);
  }

  const { rows: tRows } = await query(
    'SELECT b_uid, cargo, booking_id FROM cargolink_transactions WHERE b_uid = $1', [bUid]);
  if (tRows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  const tx = tRows[0];

  const { rows: active } = await query(
    'SELECT b_uid FROM cargolink_container_assignments WHERE container_id = $1 AND released_at IS NULL',
    [container.id]);
  if (active.length > 0) {
    throw httpError(`Container ${check.normalized} is still assigned to ${active[0].b_uid}`, 409);
  }

  // Peso: la carga más la tara no puede pasar del máximo del equipo. Es una
  // comprobación barata que evita una sanción cara en báscula de puerto.
  const gross = Number(body.grossWeightKg ?? tx.cargo?.weight ?? 0);
  if (container.max_payload_kg && gross > Number(container.max_payload_kg)) {
    throw httpError(
      `Gross weight ${gross} kg exceeds container max payload ${container.max_payload_kg} kg`, 422);
  }

  const { rows } = await query(
    `INSERT INTO cargolink_container_assignments
       (container_id, b_uid, booking_id, seal_no, gross_weight_kg)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, assigned_at`,
    [container.id, bUid, tx.booking_id || null, body.sealNo || null, gross || null]
  );
  await query(`UPDATE cargolink_containers SET status = 'IN_USE', last_seen_location = COALESCE($1, last_seen_location) WHERE id = $2`,
    [body.location || null, container.id]);

  return {
    assignmentId: rows[0].id, containerNo: check.normalized,
    isoType: container.iso_type, category: container.category,
    bUid, sealNo: body.sealNo || null, grossWeightKg: gross || null,
    assignedBy: identity.bezhasId, assignedAt: rows[0].assigned_at,
  };
}

/** Libera un contenedor al terminar el envío: vuelve a estar disponible. */
async function releaseContainer(req, bUid, containerNo) {
  await lifecycle.resolveIdentity(req);
  const check = validateContainerNo(containerNo);
  if (!check.valid) throw httpError(`Invalid container number: ${check.reason}`, 422);

  const { rows } = await query(
    `UPDATE cargolink_container_assignments a
        SET released_at = now()
       FROM cargolink_containers c
      WHERE a.container_id = c.id AND c.container_no = $1
        AND a.b_uid = $2 AND a.released_at IS NULL
      RETURNING a.id, c.id AS container_id`,
    [check.normalized, bUid]);
  if (rows.length === 0) throw httpError('No active assignment for that container and shipment', 404);

  await query(`UPDATE cargolink_containers SET status = 'AVAILABLE' WHERE id = $1`, [rows[0].container_id]);
  return { containerNo: check.normalized, bUid, released: true };
}

/** Historial de un contenedor: por dónde ha pasado y en qué envíos. */
async function getContainerHistory(req, containerNo) {
  await lifecycle.resolveIdentity(req);
  const check = validateContainerNo(containerNo);
  if (!check.valid) throw httpError(`Invalid container number: ${check.reason}`, 422);

  const { rows: c } = await query(
    'SELECT * FROM cargolink_containers WHERE container_no = $1', [check.normalized]);
  if (c.length === 0) throw httpError(`Container ${check.normalized} is not registered`, 404);

  const { rows: history } = await query(
    `SELECT a.id, a.b_uid, a.seal_no, a.gross_weight_kg, a.assigned_at, a.released_at,
            t.origin, t.destination, t.status
       FROM cargolink_container_assignments a
       LEFT JOIN cargolink_transactions t ON t.b_uid = a.b_uid
      WHERE a.container_id = $1 ORDER BY a.id ASC`,
    [c[0].id]);

  return {
    container: c[0],
    trips: history.length,
    currentlyAssignedTo: history.find((h) => !h.released_at)?.b_uid || null,
    history,
  };
}

module.exports = {
  validateContainerNo, checkDigit, letterValue,
  createBooking, assignShipmentToBooking, markNoShow, getBooking,
  registerContainer, assignContainer, releaseContainer, getContainerHistory,
  CATEGORIES,
};
