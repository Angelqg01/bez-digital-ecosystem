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

// BEZ Token V1 (Polygon) — the settlement currency for escrow.
const BEZ_TOKEN_V1 = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

// Lifecycle: from_status -> { to, role } describing who may advance it.
const TRANSITIONS = {
  CREATED:         { to: 'CUSTOMS_CLEARED', role: 'customs' },
  CUSTOMS_CLEARED: { to: 'STOWED',          role: 'carrier' },
  STOWED:          { to: 'DEPARTED',        role: 'carrier' },
  DEPARTED:        { to: 'IN_TRANSIT',      role: 'logistics' },
  IN_TRANSIT:      { to: 'DELIVERED',       role: 'lastmile' },
};

const TERMINAL_STATUS = 'DELIVERED';

// Event emitted on each transition (what webhook subscribers filter on).
const EVENT_FOR_STATUS = {
  CUSTOMS_CLEARED: 'ON_CUSTOMS_CLEARED',
  STOWED:          'ON_STOWAGE_COMPLETE',
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

  return { success: true, transaction: tx };
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
  const step = TRANSITIONS[tx.status];
  if (!step) throw httpError(`No transition defined from ${tx.status}`, 409);

  // Role gate: only the role that owns this transition may advance it.
  if (identity.role !== step.role && identity.role !== 'admin') {
    throw httpError(
      `Role '${identity.role}' cannot advance ${tx.status}. Requires role '${step.role}'.`,
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

  return {
    success: true,
    transaction: nextTx,
    transition: { from: tx.status, to: toStatus, role: identity.role },
    validation: { result: validation.result, warnings: validation.reasons },
    escrowReleased: releaseEscrow,
    webhookDeliveries: deliveries,
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

module.exports = {
  BEZ_TOKEN_V1,
  TRANSITIONS,
  resolveIdentity,
  issueKey,
  createTransaction,
  createTransactionWith,
  advanceTransaction,
  getTransaction,
  listTransactions,
  fanoutWebhooks,
};
