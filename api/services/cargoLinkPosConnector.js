'use strict';

/**
 * cargoLinkPosConnector — links a client's external POS platform to BeZhas_ID.
 *
 * Pull:  CargoLink fetches orders from the POS API -> creates B-UID transactions.
 * Push:  the POS receives status back via the signed webhook fan-out (it just
 *        registers its callback URL as a subscriber of its own B-UIDs).
 *
 * One adapter row per BeZhas_ID. The order shape is normalized so any POS
 * (Square, Toast, SAP, Shopify, custom) plugs into the same single interface.
 */

const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function maskKey(key) {
  if (!key) return null;
  return key.length <= 8 ? '****' : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function publicLink(row) {
  if (!row) return null;
  const { api_key, ...rest } = row;
  return { ...rest, apiKeyMasked: maskKey(api_key) };
}

/** Link (or update) the POS adapter for the authenticated BeZhas_ID. */
async function linkPos(req, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!['pos', 'admin'].includes(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot link a POS (only pos/admin)`, 403);
  }
  const { baseUrl, provider = 'generic', ordersPath = '/orders', apiKey } = body;
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    throw httpError('baseUrl must start with http:// or https://', 400);
  }

  const { rows } = await query(
    `INSERT INTO cargolink_pos_links (bezhas_id, provider, base_url, orders_path, api_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (bezhas_id) DO UPDATE
       SET provider = EXCLUDED.provider,
           base_url = EXCLUDED.base_url,
           orders_path = EXCLUDED.orders_path,
           api_key = COALESCE(EXCLUDED.api_key, cargolink_pos_links.api_key),
           status = 'active',
           updated_at = NOW()
     RETURNING *`,
    [identity.bezhasId, provider, baseUrl, ordersPath, apiKey || null]
  );
  return { success: true, posLink: publicLink(rows[0]) };
}

/** Read the current POS link for the authenticated BeZhas_ID. */
async function getLink(req) {
  const identity = await lifecycle.resolveIdentity(req);
  const { rows } = await query(
    `SELECT * FROM cargolink_pos_links WHERE bezhas_id = $1`,
    [identity.bezhasId]
  );
  return { success: true, posLink: publicLink(rows[0]) };
}

// Normalize one external POS order into our transaction shape. Tolerant of
// common field names across POS providers.
function normalizeOrder(order = {}) {
  const posRef = String(order.id ?? order.orderId ?? order.reference ?? order.number ?? '').trim();
  if (!posRef) return null;
  return {
    posRef,
    origin: order.origin || order.from || order.warehouse || null,
    destination: order.destination || order.shipTo || order.address || null,
    cargo: {
      weight: order.weight ?? order.totalWeight ?? null,
      value: order.total ?? order.amount ?? null,
      currency: order.currency || null,
      items: order.items ?? order.lineItems ?? null,
    },
    escrowAmountBez: Number(order.escrowBez || 0),
  };
}

/**
 * Pull orders from the linked POS API and create a B-UID per new order.
 * Idempotent: orders whose pos_ref already exists are skipped (unique index).
 */
async function syncOrders(req) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!['pos', 'admin'].includes(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot sync a POS (only pos/admin)`, 403);
  }

  const { rows } = await query(
    `SELECT * FROM cargolink_pos_links WHERE bezhas_id = $1 AND status = 'active'`,
    [identity.bezhasId]
  );
  if (rows.length === 0) throw httpError('No active POS link. Call /v1/pos/link first.', 400);
  const link = rows[0];

  const url = `${link.base_url.replace(/\/$/, '')}${link.orders_path}`;
  let orders;
  try {
    const res = await fetch(url, {
      headers: { ...(link.api_key ? { Authorization: `Bearer ${link.api_key}` } : {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw httpError(`POS API ${res.status} at ${url}`, 502);
    const data = await res.json();
    orders = Array.isArray(data) ? data : (data.orders || data.data || []);
  } catch (err) {
    if (err.status) throw err;
    throw httpError(`POS API unreachable: ${err.message}`, 502);
  }

  const posIdentity = { bezhasId: identity.bezhasId, role: 'pos', keyHash: identity.keyHash };
  const created = [];
  const skipped = [];

  for (const raw of orders) {
    const order = normalizeOrder(raw);
    if (!order) continue;
    try {
      const result = await lifecycle.createTransactionWith(posIdentity, {
        ...order, posProvider: link.provider,
      });
      created.push({ bUid: result.transaction.b_uid, posRef: order.posRef });
    } catch (err) {
      // Duplicate pos_ref (already imported) -> idempotent skip.
      if (/duplicate key|unique/i.test(err.message)) skipped.push(order.posRef);
      else throw err;
    }
  }

  await query(
    `UPDATE cargolink_pos_links SET last_sync_at = NOW(), last_sync_count = $2, updated_at = NOW()
     WHERE bezhas_id = $1`,
    [identity.bezhasId, created.length]
  );

  return { success: true, pulled: orders.length, created, skipped };
}

module.exports = { linkPos, getLink, syncOrders, normalizeOrder };
