'use strict';

const express = require('express');
const { Router } = require('express');
const cargoLinkService = require('../services/cargoLinkService');
const lifecycle = require('../services/cargoLinkLifecycle');
const posConnector = require('../services/cargoLinkPosConnector');
const iot = require('../services/cargoLinkIot');
const geofence = require('../services/cargoGeofence');
const ingestHub = require('../services/cargoIngestHub');
const disputeOracle = require('../services/cargoDisputeOracle');
const telemetryAnchor = require('../services/cargoTelemetryAnchor');
const { authenticateToken } = require('../middleware/security');
const { requireRole } = require('../middleware/rbac');

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
// Admin-gated: issuing actor keys is a privileged operation (same guard as /admin/keys).
router.post('/v1/keys', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const data = await lifecycle.issueKey(req.body || {});
    res.status(201).json({ success: true, ...data });
  } catch (error) {
    sendError(res, error);
  }
});

// ── Admin operator (key) management — JWT admin-gated, mirrors energy ──────
// The platform admin provisions the role-scoped actors (pos | customs | carrier
// | logistics | lastmile) that operate on B-UIDs. Distinct from /v1/keys, which
// is the programmatic issue path; these use the admin's JWT (requireRole admin).

router.get('/admin/keys', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    res.json(await lifecycle.listKeys({ bezhasId: req.query.bezhasId }));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/keys', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    res.status(201).json({ success: true, ...(await lifecycle.issueKey(req.body || {})) });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/admin/keys/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    res.json({ success: true, ...(await lifecycle.revokeKey(req.params.id)) });
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

// ── Geofences (authorized zones + route corridors) ────────────────────────

router.post('/v1/geofences', async (req, res) => {
  try {
    res.status(201).json(await geofence.createGeofence(req, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/v1/geofences', async (req, res) => {
  try {
    res.json(await geofence.listGeofences(req, req.query || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/v1/geofences/:id', async (req, res) => {
  try {
    res.json(await geofence.deleteGeofence(req, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

// ── Third-party ingestion hub (API-First) ─────────────────────────────────

// Owner registers an external provider (returns the HMAC secret once).
router.post('/v1/providers', async (req, res) => {
  try {
    res.status(201).json(await ingestHub.registerProvider(req, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/v1/providers', async (req, res) => {
  try {
    res.json(await ingestHub.listProviders(req));
  } catch (error) {
    sendError(res, error);
  }
});

// Inbound provider webhook. The HMAC covers the EXACT bytes sent: req.rawBody
// is captured by the app-level express.json verify hook; express.raw covers
// standalone mounts where no json parser ran before this router.
router.post('/v1/ingest/:providerId', express.raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
  try {
    const rawBody = req.rawBody
      ? req.rawBody.toString('utf8')
      : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    res.json(await ingestHub.ingestFromProvider({
      providerId: req.params.providerId,
      rawBody,
      headers: req.headers,
    }));
  } catch (error) {
    sendError(res, error);
  }
});

// ── Disputes (severity-matrix verdicts on the escrow) ─────────────────────

router.get('/v1/disputes', async (req, res) => {
  try {
    res.json(await disputeOracle.listDisputes(req, req.query || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/v1/disputes/:id/resolve', async (req, res) => {
  try {
    res.json(await disputeOracle.resolveDispute(req, req.params.id, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// ── Telemetry merkle anchors (cryptographic proof of an unaltered route) ──

router.post('/v1/iot/anchor/:bUid', async (req, res) => {
  try {
    res.status(201).json(await telemetryAnchor.anchorBatch(req, req.params.bUid));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/v1/iot/anchors', async (req, res) => {
  try {
    res.json(await telemetryAnchor.listAnchors(req, req.query || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/v1/iot/proof', async (req, res) => {
  try {
    res.json(await telemetryAnchor.getProof(req, req.query || {}));
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
