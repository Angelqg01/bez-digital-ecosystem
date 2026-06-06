'use strict';

const { Router } = require('express');
const cargoLinkService = require('../services/cargoLinkService');
const lifecycle = require('../services/cargoLinkLifecycle');
const posConnector = require('../services/cargoLinkPosConnector');
const iot = require('../services/cargoLinkIot');

const router = Router();

function sendError(res, error) {
  res.status(error.status || 500).json({
    success: false,
    error: error.message,
  });
}

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'cargolink',
    mode: 'api',
    blockchain: {
      rpcUrl: process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL || null,
      chainId: Number(process.env.BEZHAS_CHAIN_ID || process.env.CHAIN_ID || 31337),
      contractsConfigured: Boolean(process.env.SUPPLY_TRACKER_ADDRESS || process.env.CUSTOMS_CLEARANCE_ORACLE_ADDRESS),
    },
    endpoints: Object.keys(cargoLinkService.ENDPOINTS),
  });
});

router.get('/v1/logistics/route', async (req, res) => {
  try {
    const data = await cargoLinkService.handleOperation({
      req,
      method: 'GET',
      endpoint: '/v1/logistics/route',
      payload: req.query,
    });
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/v1/logistics/active-route', async (req, res) => {
  try {
    const data = await cargoLinkService.handleOperation({
      req,
      method: 'GET',
      endpoint: '/v1/logistics/active-route',
      payload: req.query,
    });
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/v1/customs/dispatch', async (req, res) => {
  try {
    const data = await cargoLinkService.handleOperation({
      req,
      method: 'POST',
      endpoint: '/v1/customs/dispatch',
      payload: req.body,
    });
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/v1/shipping/stowage', async (req, res) => {
  try {
    const data = await cargoLinkService.handleOperation({
      req,
      method: 'POST',
      endpoint: '/v1/shipping/stowage',
      payload: req.body,
    });
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/v1/audit/fingerprint', async (req, res) => {
  try {
    const data = await cargoLinkService.handleOperation({
      req,
      method: 'POST',
      endpoint: '/v1/audit/fingerprint',
      payload: req.body,
    });
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/v1/webhooks/register', async (req, res) => {
  try {
    const data = await cargoLinkService.registerWebhook(req, req.body || {});
    res.status(201).json(data);
  } catch (error) {
    sendError(res, error);
  }
});

// ── Transaction lifecycle (B-UID object model) ────────────────────────────

// Issue a role-scoped key bound to a BeZhas_ID (pos | customs | carrier | logistics | lastmile).
router.post('/v1/keys', async (req, res) => {
  try {
    const data = await lifecycle.issueKey(req.body || {});
    res.status(201).json({ success: true, ...data });
  } catch (error) {
    sendError(res, error);
  }
});

// POS creates a B-UID transaction (order/sale enters the network).
router.post('/v1/tx', async (req, res) => {
  try {
    res.status(201).json(await lifecycle.createTransaction(req, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// List the registered user's transactions (their platform feed).
router.get('/v1/tx', async (req, res) => {
  try {
    res.json(await lifecycle.listTransactions(req, req.query || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// Read a single B-UID + its validation history.
router.get('/v1/tx/:bUid', async (req, res) => {
  try {
    res.json(await lifecycle.getTransaction(req, req.params.bUid));
  } catch (error) {
    sendError(res, error);
  }
});

// A role-scoped actor validates and advances the B-UID to its next state.
router.post('/v1/tx/:bUid/advance', async (req, res) => {
  try {
    res.json(await lifecycle.advanceTransaction(req, req.params.bUid, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// ── POS connector (link client POS API ↔ BeZhas_ID) ───────────────────────

router.post('/v1/pos/link', async (req, res) => {
  try {
    res.status(201).json(await posConnector.linkPos(req, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/v1/pos/link', async (req, res) => {
  try {
    res.json(await posConnector.getLink(req));
  } catch (error) {
    sendError(res, error);
  }
});

// Pull orders from the linked POS API -> create B-UID transactions.
router.post('/v1/pos/sync', async (req, res) => {
  try {
    res.json(await posConnector.syncOrders(req));
  } catch (error) {
    sendError(res, error);
  }
});

// ── IoT / hardware ingestion ──────────────────────────────────────────────

// Owner registers a device (returns the device key once).
router.post('/v1/iot/devices', async (req, res) => {
  try {
    res.status(201).json(await iot.registerDevice(req, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// A device pushes a telemetry batch (authenticated with its own device key).
router.post('/v1/iot/telemetry', async (req, res) => {
  try {
    res.json(await iot.ingestTelemetry(req, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// Read a shipment's live hardware feed.
router.get('/v1/iot/telemetry', async (req, res) => {
  try {
    res.json(await iot.getTelemetry(req, req.query || {}));
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
