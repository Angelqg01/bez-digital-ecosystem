'use strict';

const crypto = require('crypto');
const { query } = require('../db/pool');
const { validarDestinoPublico } = require('../utils/safeFetch');
const lifecycle = require('./cargoLinkLifecycle');
const events = require('./cargoLinkEvents');
const transit = require('./cargoLinkTransit');

const { resolveIdentity } = lifecycle;
const { isConfigured: onChainConfigured, getAddresses } = require('./cargoLinkOnChain');

// ── Endpoints «de producto» (los que anuncia el DevHub de CargoLink) ───────
//
// Hasta 2026-11-06 estos cinco endpoints devolvían resultados inventados: un
// número de autorización aduanera aleatorio (`BZ-ASY-xxxxxx`), un oráculo
// `CHAINLINK_FUNCTIONS` que BeZhas no usa, una ruta fija `TRX-9921-X` al 82 %
// e `integrity: 'VERIFIED'` sin verificar nada. Ahora son fachadas del ciclo
// de vida B-UID (cargoLinkLifecycle): autentican con la api-key del actor,
// pasan por los validadores reales y anclan on-chain como /v1/tx/:bUid/advance.
// Lo que BeZhas no sabe se devuelve como null, nunca como un valor plausible.

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireBuid(payload) {
  const bUid = String(payload.bUid || '').trim();
  if (!bUid) throw httpError('bUid is required (create it first with POST /v1/tx)', 400);
  return bUid;
}

/** Quita los campos de control para pasar al validador sólo los datos de negocio. */
function businessPayload(payload) {
  const { bUid, payloadHash, ...rest } = payload;
  return rest;
}

async function customsDispatch(req, payload) {
  const bUid = requireBuid(payload);
  const r = await lifecycle.advanceTransaction(req, bUid, {
    to: 'CUSTOMS_CLEARED',
    payload: businessPayload(payload),
  });
  const v = r.validation?.result || {};
  return {
    anchor: r.anchor,
    deliveries: r.webhookDeliveries || [],
    result: {
      bUid,
      status: r.transaction.status,
      // Canal calculado por las reglas de riesgo de BeZhas (capítulo HS y
      // valor declarado). Es una preclasificación, NO el levante de la aduana.
      lane: v.lane || null,
      laneSource: 'BEZHAS_RISK_RULES',
      standard: v.standard || null,
      hsCode: v.hsCode || null,
      dutyEstimate: v.dutyEstimate ?? null,
      inspectionRequired: Boolean(v.inspectionRequired),
      // Sin conexión con la ventanilla única no hay número de levante que dar.
      customsAuthorization: null,
      oracle: null,
      warnings: r.validation?.warnings || [],
    },
  };
}

async function shippingStowage(req, payload) {
  const bUid = requireBuid(payload);
  const r = await lifecycle.advanceTransaction(req, bUid, {
    to: 'STOWED',
    payload: businessPayload(payload),
  });
  const v = r.validation?.result || {};
  return {
    anchor: r.anchor,
    deliveries: r.webhookDeliveries || [],
    result: {
      bUid,
      status: r.transaction.status,
      // Centro de gravedad calculado a partir de items[{x,y,weight}], no
      // aceptado tal cual del cliente.
      cog: v.cog || null,
      totalWeight: v.totalWeight ?? null,
      deviation: v.deviation || null,
      stowageStatus: v.status || null,
      warnings: r.validation?.warnings || [],
    },
  };
}

async function logisticsRoute(req, payload) {
  const bUid = requireBuid(payload);
  const { transaction: tx, history } = await lifecycle.getTransaction(req, bUid);
  const route = await events.getRouteHistory(req, bUid);

  let transitStatus = null;
  try {
    const t = await transit.getTransitStatus(req, bUid);
    transitStatus = { readyForRelease: t.readyForRelease, blockedAt: t.blockedAt, rejectedAt: t.rejectedAt };
  } catch (error) {
    if (error.status !== 404) throw error; // 404 = no es un envío multipaís
  }

  const last = history.length ? history[history.length - 1] : null;
  return {
    anchor: null,
    result: {
      bUid,
      status: tx.status,
      lastTransition: last ? { to: last.to_status, role: last.role, at: last.created_at } : null,
      committedEta: route.committedEta,
      currentPort: route.currentPort,
      etaRevisions: route.revisions,
      totalDelayMinutes: route.totalDelayMinutes,
      slaBreaches: route.slaBreaches,
      transit: transitStatus,
      escrowState: tx.escrow_status || null,
    },
  };
}

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

async function auditFingerprint(req, payload) {
  const bUid = requireBuid(payload);
  if (payload.payloadHash && !HASH_RE.test(payload.payloadHash)) {
    throw httpError('payloadHash must be a 0x-prefixed 32-byte hex string', 400);
  }
  // Autentica y comprueba que el B-UID existe antes de aceptar la huella.
  const { transaction: tx } = await lifecycle.getTransaction(req, bUid);
  return {
    anchor: null,
    result: {
      bUid,
      fingerprintHash: payload.payloadHash || sha256(businessPayload(payload)),
      // Se guarda la huella; BeZhas no la compara con nada, así que no puede
      // afirmar que la carga esté íntegra.
      integrity: 'RECORDED_OFF_CHAIN',
      escrowState: tx.escrow_status || null,
    },
  };
}

const ENDPOINTS = {
  '/v1/customs/dispatch': {
    method: 'POST', event: 'CustomsCleared', listPriceBez: 5, run: customsDispatch,
  },
  '/v1/shipping/stowage': {
    method: 'POST', event: 'StowageValidated', listPriceBez: 2, run: shippingStowage,
  },
  '/v1/logistics/route': {
    method: 'GET', event: 'RouteTelemetryRead', listPriceBez: 0.25, run: logisticsRoute,
  },
  '/v1/logistics/active-route': {
    method: 'GET', event: 'RouteTelemetryRead', listPriceBez: 0.25, run: logisticsRoute,
  },
  '/v1/audit/fingerprint': {
    method: 'POST', event: 'FingerprintAnchored', listPriceBez: 3, run: auditFingerprint,
  },
};

function sha256(value) {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex')}`;
}

function hashApiKey(apiKey = '') {
  if (!apiKey) return null;
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function getApiKey(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-api-key'] || '';
}

function buildBlockchainStatus(eventName, payloadHash, anchor) {
  const chainId = Number(process.env.BEZHAS_CHAIN_ID || process.env.CHAIN_ID || 31337);
  const rpcUrl = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL || null;
  const configured = onChainConfigured();
  const addresses = configured ? getAddresses() : null;

  if (anchor?.anchored) {
    return {
      event: eventName,
      payloadHash,
      chainId,
      rpcUrl,
      mode: 'anchored',
      txHash: anchor.txHash,
      contract: anchor.contract,
      chainShipmentId: anchor.chainShipmentId || null,
    };
  }

  return {
    event: eventName,
    payloadHash,
    chainId,
    rpcUrl,
    mode: anchor?.mode || (configured ? 'not_anchored' : 'pending_contract_config'),
    txHash: null,
    contract: addresses?.supplyTracker || null,
    nextAction: configured ? null : 'configure_supply_chain_contract_addresses',
    anchorError: anchor?.error || null,
  };
}

async function handleOperation({ req, method, endpoint, payload }) {
  const definition = ENDPOINTS[endpoint];
  if (!definition) throw httpError(`Unsupported CargoLink endpoint: ${endpoint}`, 404);
  if (definition.method !== method) {
    throw httpError(`Invalid method for ${endpoint}. Expected ${definition.method}`, 405);
  }

  const normalizedPayload = payload || {};
  const payloadHash = normalizedPayload.payloadHash || sha256(normalizedPayload);
  const { result, anchor, deliveries = [] } = await definition.run(req, normalizedPayload);

  // No hay cobro real detrás: la tabla cargolink_events no la lee ningún
  // proceso de facturación. Se mide el uso y se informa del precio de lista,
  // sin afirmar que se haya descontado nada.
  const billing = {
    mode: 'METERED',
    listPriceBez: definition.listPriceBez,
    chargedBez: 0,
    status: 'not_charged',
    currency: 'BEZ',
  };
  const blockchain = buildBlockchainStatus(definition.event, payloadHash, anchor);
  const apiKeyHash = hashApiKey(getApiKey(req));

  const saved = await query(
    `INSERT INTO cargolink_events
      (api_key_hash, endpoint, method, event_name, payload_hash, payload, result, billing, blockchain, source)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, 'api')
     RETURNING id, created_at`,
    [
      apiKeyHash,
      endpoint,
      method,
      definition.event,
      payloadHash,
      JSON.stringify(normalizedPayload),
      JSON.stringify(result),
      JSON.stringify(billing),
      JSON.stringify(blockchain),
    ]
  );

  return {
    ok: true,
    success: true,
    status: 200,
    source: 'api',
    eventId: saved.rows[0].id,
    createdAt: saved.rows[0].created_at,
    endpoint,
    result,
    billing,
    blockchain,
    // Los dispara advanceTransaction (ON_CUSTOMS_CLEARED, ON_STOWAGE_COMPLETE).
    webhookDeliveries: deliveries,
  };
}

async function registerWebhook(req, { url, events }) {
  if (!url) {
    const error = new Error('Webhook URL is required');
    error.status = 400;
    throw error;
  }
  // https y sólo IPs públicas: sin esto la API haría POST a la red interna
  // (metadatos de GCP, Redis, Cloud SQL) en nombre del cliente. Lanza 400.
  await validarDestinoPublico(url);
  if (!Array.isArray(events) || events.length === 0) {
    const error = new Error('At least one webhook event is required');
    error.status = 400;
    throw error;
  }

  // Bind the webhook to the caller's BeZhas_ID. fanoutWebhooks() selects hooks
  // `WHERE bezhas_id = tx.owner_bezhas_id` and HMAC-signs with the plaintext
  // `secret`, so both must be persisted here — and `secret` must equal the value
  // we hand back as signingSecret (both sides HMAC with the same bytes).
  const identity = await resolveIdentity(req);
  const secret = crypto.randomBytes(24).toString('hex');

  const saved = await query(
    `INSERT INTO cargolink_webhooks (bezhas_id, api_key_hash, url, events, secret)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, url, events, status, created_at`,
    [identity.bezhasId, identity.keyHash, url, events, secret]
  );

  return {
    success: true,
    webhook: saved.rows[0],
    signingSecret: secret,
  };
}

module.exports = {
  ENDPOINTS,
  handleOperation,
  registerWebhook,
};
