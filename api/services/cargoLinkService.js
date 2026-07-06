'use strict';

const crypto = require('crypto');
const { query } = require('../db/pool');
const { resolveIdentity } = require('./cargoLinkLifecycle');
const { isConfigured: onChainConfigured, getAddresses } = require('./cargoLinkOnChain');

const ENDPOINTS = {
  '/v1/customs/dispatch': {
    method: 'POST',
    event: 'CustomsCleared',
    costBez: 5,
    result: (payload) => ({
      authorization: `BZ-ASY-${crypto.randomInt(100000, 999999)}`,
      lane: 'GREEN_LANE',
      standard: payload.standard || 'UBL_2_1',
      oracle: 'CHAINLINK_FUNCTIONS',
    }),
  },
  '/v1/shipping/stowage': {
    method: 'POST',
    event: 'StowageValidated',
    costBez: 2,
    result: (payload) => ({
      bUid: payload.bUid,
      cog: payload.cog,
      status: payload.cog?.x > 55 ? 'WARNING' : 'VERIFIED',
      dNftState: 'STOWAGE_SYNCED',
    }),
  },
  '/v1/logistics/route': {
    method: 'GET',
    event: 'RouteTelemetryRead',
    costBez: 0.25,
    result: (payload) => ({
      routeId: payload.routeId || 'TRX-9921-X',
      status: 'IN_TRANSIT',
      progress: 82,
      etaMinutes: 11,
    }),
  },
  '/v1/logistics/active-route': {
    method: 'GET',
    event: 'RouteTelemetryRead',
    costBez: 0.25,
    result: (payload) => ({
      routeId: payload.routeId || 'TRX-9921-X',
      status: 'IN_TRANSIT',
      progress: 82,
      etaMinutes: 11,
    }),
  },
  '/v1/audit/fingerprint': {
    method: 'POST',
    event: 'FingerprintAnchored',
    costBez: 3,
    result: (payload) => ({
      bUid: payload.bUid || 'BZ-LOG-ES-17148',
      fingerprintHash: payload.payloadHash,
      integrity: 'VERIFIED',
      mseDeviation: 4.2,
      escrowState: 'FUNDS_LOCKED',
    }),
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
    mode: configured
      ? (anchor?.mode || 'wallet_signature_required')
      : 'pending_contract_config',
    txHash: null,
    contract: addresses?.supplyTracker || null,
    nextAction: configured
      ? 'connect_wallet_and_submit_transaction'
      : 'configure_supply_chain_contract_addresses',
    anchorError: anchor?.error || null,
  };
}

async function handleOperation({ req, method, endpoint, payload }) {
  const definition = ENDPOINTS[endpoint];
  if (!definition) {
    const error = new Error(`Unsupported CargoLink endpoint: ${endpoint}`);
    error.status = 404;
    throw error;
  }
  if (definition.method !== method) {
    const error = new Error(`Invalid method for ${endpoint}. Expected ${definition.method}`);
    error.status = 405;
    throw error;
  }

  const normalizedPayload = payload || {};
  const payloadHash = normalizedPayload.payloadHash || sha256(normalizedPayload);
  const result = definition.result({ ...normalizedPayload, payloadHash });
  const billing = {
    mode: 'BEZ_CREDIT_LEDGER',
    chargedBez: definition.costBez,
    status: 'recorded',
    currency: 'BEZ',
  };
  const blockchain = buildBlockchainStatus(definition.event, payloadHash);
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
    webhookDeliveries: [],
  };
}

async function registerWebhook(req, { url, events }) {
  if (!url || !/^https?:\/\//i.test(url)) {
    const error = new Error('Webhook URL must start with http:// or https://');
    error.status = 400;
    throw error;
  }
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
