'use strict';

const { Router } = require('express');
const cargoLinkService = require('../services/cargoLinkService');

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

module.exports = router;
