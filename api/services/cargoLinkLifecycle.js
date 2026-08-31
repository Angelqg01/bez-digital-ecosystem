'use strict';

/**
 * cargoLinkLifecycle — the spine of BZ CargoLink.
 *
 * ONE B-UID transaction object + ONE lifecycle. The four actors are ROLES whose
 * BeZhas_ID-scoped keys can only perform their own transition. Every transition
 * fans out a signed webhook to all subscribers of that B-UID (incl. the POS),
 * which is how validated data is reflected back in each user's platform.
 *
 *   POS ─► CREATED ─► CUSTOMS_CLEARED ─► STOWED ─► DEPARTED ─► IN_TRANSIT ─► DELIVERED
 *          (pos)        (customs)       (carrier) (carrier)  (logistics)   (lastmile)
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const { validateTransition } = require('./cargoLinkValidators');
const { anchorTransition } = require('./cargoLinkOnChain');

// BEZ Token V1 (Polygon) — the settlement currency for escrow.
const BEZ_TOKEN_V1 = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

// Lifecycle: from_status -> { to, role } describing who may advance it.
//
// GATE_IN y GATE_OUT se añadieron para cubrir TX004 y TX005 del piloto de
// Algeciras, marcados allí con criticidad máxima. Antes el ciclo saltaba de
// CREATED a CUSTOMS_CLEARED sin registrar en ningún sitio que la mercancía
// había entrado físicamente en un almacén — que es justo el hecho del que
// responde el operador logístico y el que se discute cuando hay una merma.
//
// El cambio de custodia (TX006) NO está aquí a propósito: no es una etapa,
// es un evento que ocurre varias veces a lo largo del envío. Vive en
// registerCustodyTransfer() y en la tabla cargolink_custody.
// Camino principal. `alt` recoge los destinos alternativos legítimos desde ese
// mismo estado, con el rol que puede tomarlos.
//
// Gate-in y gate-out son OPCIONALES por diseño, no por compatibilidad: un
// transbordo directo buque-buque nunca entra en almacén, y obligarle a
// declarar una entrada que no ocurrió sería registrar una mentira. Cuando la
// mercancía sí pasa por almacén, el camino con gates es el que da la
// trazabilidad de custodia que pide el piloto de Algeciras.
const TRANSITIONS = {
  CREATED:         { to: 'GATE_IN',         role: 'logistics',
                     alt: [{ to: 'CUSTOMS_CLEARED', role: 'customs' }] },
  GATE_IN:         { to: 'CUSTOMS_CLEARED', role: 'customs' },
  CUSTOMS_CLEARED: { to: 'STOWED',          role: 'carrier' },
  STOWED:          { to: 'GATE_OUT',        role: 'logistics',
                     alt: [{ to: 'DEPARTED', role: 'carrier' }] },
  GATE_OUT:        { to: 'DEPARTED',        role: 'carrier' },
  DEPARTED:        { to: 'IN_TRANSIT',      role: 'logistics' },
  IN_TRANSIT:      { to: 'DELIVERED',       role: 'lastmile' },
};

/**
 * Elige la transición aplicable desde `status` para el rol que la pide.
 *
 * Con destinos alternativos el rol deja de ser sólo un permiso y pasa a ser
 * también el desambiguador: si desde CREATED llama `logistics` es un gate-in,
 * y si llama `customs` es un despacho directo sin paso por almacén. Un admin
 * sin destino explícito toma el camino principal.
 */
function resolveTransition(status, role, requestedTo) {
  const step = TRANSITIONS[status];
  if (!step) return null;
  const options = [step, ...(step.alt || [])];

  if (requestedTo) {
    const explicit = options.find((o) => o.to === requestedTo);
    if (explicit && (role === explicit.role || role === 'admin')) return explicit;
    return null;
  }
  const byRole = options.find((o) => o.role === role);
  if (byRole) return byRole;
  return role === 'admin' ? step : null;
}

const TERMINAL_STATUS = 'DELIVERED';

// Event emitted on each transition (what webhook subscribers filter on).
const EVENT_FOR_STATUS = {
  GATE_IN:         'ON_GATE_IN',
  CUSTOMS_CLEARED: 'ON_CUSTOMS_CLEARED',
  STOWED:          'ON_STOWAGE_COMPLETE',
  GATE_OUT:        'ON_GATE_OUT',
  DEPARTED:        'ON_VESSEL_DEPARTURE',
  IN_TRANSIT:      'ON_IN_TRANSIT',
  DELIVERED:       'ON_DELIVERY_PROOF',
};

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sha256(value) {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex')}`;
}

function hashApiKey(apiKey = '') {
  return apiKey ? crypto.createHash('sha256').update(apiKey).digest('hex') : null;
}

function getApiKey(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-api-key'] || '';
}

/** Resolve a request's API key to its role-scoped identity (BeZhas_ID + role). */
async function resolveIdentity(req) {
  const apiKey = getApiKey(req);
  if (!apiKey) throw httpError('Missing API key (Authorization: Bearer <key>)', 401);
  const keyHash = hashApiKey(apiKey);
  const { rows } = await query(
    `SELECT bezhas_id, role, status FROM cargolink_api_keys WHERE key_hash = $1`,
    [keyHash]
  );
  if (rows.length === 0) throw httpError('Unknown API key. Issue a role-scoped key first.', 401);
  if (rows[0].status !== 'active') throw httpError('API key is not active', 403);
  return { keyHash, bezhasId: rows[0].bezhas_id, role: rows[0].role };
}

/** Issue a role-scoped key bound to a BeZhas_ID. Returns the plaintext key once. */
async function issueKey({ bezhasId, role = 'pos', label }) {
  if (!bezhasId) throw httpError('bezhasId is required', 400);
  const validRoles = ['pos', 'customs', 'carrier', 'logistics', 'lastmile', 'admin'];
  if (!validRoles.includes(role)) throw httpError(`Invalid role. One of: ${validRoles.join(', ')}`, 400);
  const apiKey = `bzk_live_${crypto.randomBytes(20).toString('hex')}`;
  const keyHash = hashApiKey(apiKey);
  const { rows } = await query(
    `INSERT INTO cargolink_api_keys (key_hash, bezhas_id, role, label)
     VALUES ($1, $2, $3, $4)
     RETURNING id, bezhas_id, role, label, created_at`,
    [keyHash, bezhasId, role, label || `${role} key`]
  );
  return { ...rows[0], apiKey };
}

/** Admin: list issued role-scoped keys (never returns the plaintext key). */
async function listKeys({ bezhasId } = {}) {
  const { rows } = await query(
    `SELECT id, bezhas_id, role, label, status, created_at
       FROM cargolink_api_keys
       WHERE ($1::text IS NULL OR bezhas_id = $1)
       ORDER BY created_at DESC LIMIT 200`,
    [bezhasId || null]
  );
  return { count: rows.length, keys: rows };
}

/** Admin: revoke a role-scoped key (soft-delete → status='revoked'). */
async function revokeKey(id) {
  if (!id) throw httpError('key id is required', 400);
  const { rows } = await query(
    `UPDATE cargolink_api_keys SET status = 'revoked'
       WHERE id = $1 AND status = 'active'
       RETURNING id, bezhas_id, role, status`,
    [id]
  );
  if (!rows.length) throw httpError('Key not found or already revoked', 404);
  return rows[0];
}

/** POS creates a B-UID transaction (the order/sale entering the network). */
async function createTransaction(req, body = {}) {
  const identity = await resolveIdentity(req);
  return createTransactionWith(identity, body);
}

/** Core creation used by both the route (resolved identity) and the POS connector. */
async function createTransactionWith(identity, body = {}) {
  if (!['pos', 'admin'].includes(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot create transactions (only pos/admin)`, 403);
  }

  const bUid = body.bUid || `BZ-LOG-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const escrowAmount = Number(body.escrowAmountBez || 0);
  const escrowStatus = escrowAmount > 0 ? 'LOCKED' : 'NONE';

  const { rows } = await query(
    `INSERT INTO cargolink_transactions
       (b_uid, owner_bezhas_id, pos_ref, pos_provider, status, origin, destination, cargo,
        escrow_status, escrow_amount_bez, escrow_token)
     VALUES ($1, $2, $3, $4, 'CREATED', $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING *`,
    [
      bUid, identity.bezhasId, body.posRef || null, body.posProvider || null,
      body.origin || null, body.destination || null,
      JSON.stringify(body.cargo || {}),
      escrowStatus, escrowAmount, escrowAmount > 0 ? BEZ_TOKEN_V1 : null,
    ]
  );
  const tx = rows[0];

  await recordTransition({
    bUid, fromStatus: null, toStatus: 'CREATED', role: identity.role,
    identity, payload: { posRef: body.posRef, cargo: body.cargo || {} },
  });

  // Notify subscribers that an order entered the network.
  await fanoutWebhooks({ tx, eventName: 'ON_TRANSACTION_CREATED' });

  // Post-commit: anchor the creation on-chain (best-effort).
  const anchor = await anchorTransition(tx, 'CREATED', { posRef: body.posRef, cargo: body.cargo || {} });

  return { success: true, transaction: tx, anchor };
}

/**
 * A role-scoped actor validates and advances the B-UID to its next state.
 * This single function is "validation of the transaction" for all four actors.
 */
async function advanceTransaction(req, bUid, body = {}) {
  const identity = await resolveIdentity(req);

  const { rows } = await query(`SELECT * FROM cargolink_transactions WHERE b_uid = $1`, [bUid]);
  if (rows.length === 0) throw httpError(`Transaction ${bUid} not found`, 404);
  const tx = rows[0];

  if (tx.status === TERMINAL_STATUS) {
    throw httpError(`Transaction ${bUid} is already ${TERMINAL_STATUS}`, 409);
  }
  const base = TRANSITIONS[tx.status];
  if (!base) throw httpError(`No transition defined from ${tx.status}`, 409);

  // El rol elige la rama cuando hay alternativa (gate-in vs despacho directo).
  const step = resolveTransition(tx.status, identity.role, body.to || body.toStatus);
  if (!step) {
    const allowed = [base, ...(base.alt || [])]
      .map((o) => `${o.to} (role '${o.role}')`)
      .join(' or ');
    throw httpError(
      `Role '${identity.role}' cannot advance ${tx.status}. Allowed: ${allowed}.`,
      403
    );
  }

  const toStatus = step.to;
  const inputPayload = body.payload || body || {};

  // Real, sector-specific validation. A failed validation blocks the transition.
  const validation = validateTransition(toStatus, tx, inputPayload);
  if (!validation.valid) {
    throw httpError(`Validation failed for ${toStatus}: ${validation.reasons.join('; ')}`, 422);
  }

  const releaseEscrow = toStatus === TERMINAL_STATUS && tx.escrow_status === 'LOCKED';

  const updated = await query(
    `UPDATE cargolink_transactions
       SET status = $1,
           escrow_status = CASE WHEN $2 THEN 'RELEASED' ELSE escrow_status END,
           updated_at = NOW()
     WHERE b_uid = $3
     RETURNING *`,
    [toStatus, releaseEscrow, bUid]
  );
  const nextTx = updated.rows[0];

  // Persist the validated result (not just the raw input) as the audit record.
  await recordTransition({
    bUid, fromStatus: tx.status, toStatus, role: identity.role,
    identity, payload: { input: inputPayload, validation: validation.result },
  });

  const eventName = EVENT_FOR_STATUS[toStatus] || `ON_${toStatus}`;
  const deliveries = await fanoutWebhooks({ tx: nextTx, eventName });

  // Post-commit: anchor the transition on-chain (best-effort).
  const transitionPayload = { input: inputPayload, validation: validation.result };
  const anchor = await anchorTransition(nextTx, toStatus, transitionPayload);

  return {
    success: true,
    transaction: nextTx,
    transition: { from: tx.status, to: toStatus, role: identity.role },
    validation: { result: validation.result, warnings: validation.reasons },
    escrowReleased: releaseEscrow,
    webhookDeliveries: deliveries,
    anchor,
  };
}

async function recordTransition({ bUid, fromStatus, toStatus, role, identity, payload }) {
  const payloadHash = sha256(payload);
  await query(
    `INSERT INTO cargolink_transitions
       (b_uid, from_status, to_status, role, actor_bezhas_id, api_key_hash, payload_hash, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [bUid, fromStatus, toStatus, role, identity.bezhasId, identity.keyHash, payloadHash, JSON.stringify(payload || {})]
  );
}

/** Read-back: the user's platform queries the canonical state + history. */
async function getTransaction(req, bUid) {
  const identity = await resolveIdentity(req);
  const { rows } = await query(`SELECT * FROM cargolink_transactions WHERE b_uid = $1`, [bUid]);
  if (rows.length === 0) throw httpError(`Transaction ${bUid} not found`, 404);
  const tx = rows[0];
  // Owner sees their own; other roles may read transactions they participated in.
  const history = await query(
    `SELECT from_status, to_status, role, actor_bezhas_id, payload_hash, created_at
       FROM cargolink_transitions WHERE b_uid = $1 ORDER BY created_at ASC`,
    [bUid]
  );
  return { success: true, transaction: tx, history: history.rows, viewerRole: identity.role };
}

/** List the registered user's transactions (their platform dashboard feed). */
async function listTransactions(req, { limit = 25 } = {}) {
  const identity = await resolveIdentity(req);
  const { rows } = await query(
    `SELECT * FROM cargolink_transactions
      WHERE owner_bezhas_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [identity.bezhasId, Math.min(Number(limit) || 25, 100)]
  );
  return { success: true, count: rows.length, transactions: rows };
}

/**
 * Fan out a signed webhook to every subscriber of this transaction's owner.
 * HMAC-SHA256 over the body lets each platform verify authenticity. This is the
 * mechanism that reflects the validated event in the subscriber's platform.
 */
async function fanoutWebhooks({ tx, eventName }) {
  const { rows: hooks } = await query(
    `SELECT id, url, events, secret FROM cargolink_webhooks
      WHERE bezhas_id = $1 AND status = 'active'`,
    [tx.owner_bezhas_id]
  );

  const body = {
    event: eventName,
    bUid: tx.b_uid,
    status: tx.status,
    posRef: tx.pos_ref,
    escrowStatus: tx.escrow_status,
    at: new Date().toISOString(),
  };
  const payload = JSON.stringify(body);
  const deliveries = [];

  for (const hook of hooks) {
    if (Array.isArray(hook.events) && hook.events.length > 0 && !hook.events.includes(eventName)) {
      continue; // subscriber didn't ask for this event
    }
    const signature = hook.secret
      ? crypto.createHmac('sha256', hook.secret).update(payload).digest('hex')
      : null;

    const delivery = await query(
      `INSERT INTO cargolink_webhook_deliveries (webhook_id, b_uid, event_name, target_url, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [hook.id, tx.b_uid, eventName, hook.url]
    );
    const deliveryId = delivery.rows[0].id;

    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BeZhas-Event': eventName,
          ...(signature ? { 'X-BeZhas-Signature': `sha256=${signature}` } : {}),
        },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });
      await query(
        `UPDATE cargolink_webhook_deliveries
           SET status = $1, response_code = $2, attempts = 1 WHERE id = $3`,
        [res.ok ? 'delivered' : 'failed', res.status, deliveryId]
      );
      deliveries.push({ url: hook.url, status: res.ok ? 'delivered' : 'failed', code: res.status });
    } catch (err) {
      await query(
        `UPDATE cargolink_webhook_deliveries
           SET status = 'failed', attempts = 1, error = $1 WHERE id = $2`,
        [err.message, deliveryId]
      );
      deliveries.push({ url: hook.url, status: 'failed', error: err.message });
    }
  }

  return deliveries;
}

// ── Custodia (TX006) ─────────────────────────────────────────────────────────

/** Roles que pueden tener la custodia material de una mercancía. */
const CUSTODY_ROLES = new Set(['pos', 'logistics', 'carrier', 'customs', 'lastmile']);

/**
 * Registra un cambio de custodia sobre un envío.
 *
 * No es una transición del ciclo de vida: la custodia cambia varias veces
 * (almacén → camión → terminal → buque → última milla) mientras el envío
 * avanza por sus estados. Modelarla como etapa habría obligado a inventar un
 * camino lineal que la operación real no tiene.
 *
 * La cadena de custodia se encadena sola: el `from_actor` se toma del último
 * registro, no del cliente. Así nadie puede declarar que recibió algo de un
 * tercero que nunca lo tuvo.
 */
async function registerCustodyTransfer(req, bUid, body = {}) {
  const identity = await resolveIdentity(req);

  const { rows: txRows } = await query(
    'SELECT * FROM cargolink_transactions WHERE b_uid = $1', [bUid]
  );
  if (txRows.length === 0) throw httpError(`Unknown B-UID ${bUid}`, 404);
  const tx = txRows[0];

  if (tx.status === TERMINAL_STATUS) {
    throw httpError('Shipment already delivered; custody chain is closed', 409);
  }

  const toActor = body.toActor || body.to;
  const toRole = String(body.toRole || '').toLowerCase();
  if (!toActor) throw httpError('toActor (BeZhas_ID of the receiving party) is required', 422);
  if (!CUSTODY_ROLES.has(toRole)) {
    throw httpError(`toRole must be one of: ${[...CUSTODY_ROLES].join(', ')}`, 422);
  }

  // El emisor sólo puede ceder lo que tiene: o es el primer traspaso, o el
  // custodio actual es él mismo.
  const { rows: last } = await query(
    'SELECT to_actor, to_role FROM cargolink_custody WHERE b_uid = $1 ORDER BY id DESC LIMIT 1',
    [bUid]
  );
  const current = last.length ? last[0].to_actor : tx.owner_bezhas_id;
  const currentRole = last.length ? last[0].to_role : 'pos';
  if (current !== identity.bezhasId) {
    throw httpError(
      `Custody is held by ${current}; only the current custodian can hand it over`, 403
    );
  }
  if (toActor === current) throw httpError('Cannot hand custody to the current custodian', 422);

  const evidenceHash = sha256({ bUid, from: current, to: toActor, reason: body.reason, at: new Date().toISOString() });

  const { rows: ins } = await query(
    `INSERT INTO cargolink_custody
       (b_uid, from_actor, to_actor, from_role, to_role, reason, location, evidence_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, occurred_at`,
    [bUid, current, toActor, currentRole, toRole,
      body.reason || 'HANDOVER', body.location || null, evidenceHash]
  );

  // Anclaje: si el destino es otro almacén hay contrato que lo representa
  // (transferLot); si es un camión o un buque, no lo hay, y se conserva la
  // evidencia off-chain con su hash.
  let anchor = { anchored: false, mode: 'not_attempted' };
  try {
    const onChain = require('./cargoLinkOnChain');
    if (onChain.isConfigured()) {
      anchor = await onChain.anchorCustodyTransfer(tx, { toWarehouseCode: body.toWarehouseCode }, onChain.getAddresses());
    }
  } catch (err) {
    anchor = { anchored: false, mode: 'anchor_failed', error: err.message };
  }

  await query(
    'UPDATE cargolink_custody SET chain_tx_hash = $1, chain_transfer_id = $2, anchor_mode = $3 WHERE id = $4',
    [anchor.txHash || null, anchor.chainTransferId || null,
      anchor.anchored ? 'anchored' : (anchor.mode || 'failed'), ins[0].id]
  );

  await fanoutWebhooks({ tx, eventName: 'ON_CUSTODY_TRANSFER' });

  return {
    custodyId: ins[0].id, bUid, from: current, fromRole: currentRole,
    to: toActor, toRole, reason: body.reason || 'HANDOVER',
    location: body.location || null, evidenceHash,
    occurredAt: ins[0].occurred_at, anchor,
  };
}

/** Cadena de custodia completa de un envío, en orden cronológico. */
async function getCustodyChain(req, bUid) {
  await resolveIdentity(req);
  const { rows } = await query(
    `SELECT id, from_actor, to_actor, from_role, to_role, reason, location,
            evidence_hash, chain_tx_hash, anchor_mode, occurred_at
       FROM cargolink_custody WHERE b_uid = $1 ORDER BY id ASC`,
    [bUid]
  );
  return {
    bUid,
    holder: rows.length ? rows[rows.length - 1].to_actor : null,
    transfers: rows,
    anchoredOnChain: rows.filter((r) => r.anchor_mode === 'anchored').length,
  };
}

/** Alta de almacén. Se registra on-chain en el primer gate-in que lo use. */
async function registerWarehouse(req, body = {}) {
  const identity = await resolveIdentity(req);
  if (!['logistics', 'admin', 'pos'].includes(identity.role)) {
    throw httpError('Only logistics/pos/admin roles may register a warehouse', 403);
  }
  const { code, name, capacityKg, location } = body;
  if (!code || !name) throw httpError('code and name are required', 422);
  const cap = Number(capacityKg);
  if (!Number.isFinite(cap) || cap <= 0) throw httpError('capacityKg must be a positive number', 422);

  const { rows } = await query(
    `INSERT INTO cargolink_warehouses (code, name, operator_bezhas_id, location, capacity_kg)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, capacity_kg = EXCLUDED.capacity_kg
     RETURNING id, code, name, capacity_kg, chain_warehouse_id`,
    [code, name, identity.bezhasId, location || null, Math.round(cap)]
  );
  return rows[0];
}

module.exports = {
  BEZ_TOKEN_V1,
  TERMINAL_STATUS,
  TRANSITIONS,
  CUSTODY_ROLES,
  registerCustodyTransfer,
  getCustodyChain,
  registerWarehouse,
  resolveIdentity,
  issueKey,
  listKeys,
  revokeKey,
  createTransaction,
  createTransactionWith,
  advanceTransaction,
  getTransaction,
  listTransactions,
  fanoutWebhooks,
};
