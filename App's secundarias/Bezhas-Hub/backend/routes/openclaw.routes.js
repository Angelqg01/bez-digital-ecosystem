/**
 * ============================================================================
 * OPENCLAW ROUTES — BeZhas OpenCLaw Agent API
 * ============================================================================
 *
 * Endpoints para el agente IA OpenCLaw integrado con AEGIS.
 * Gestiona credenciales de clientes para plataformas de terceros.
 *
 * Base: /api/openclaw
 */

'use strict';

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const OpenClawClient = require('../models/OpenClawClient.model');
const {
  OpenClawAgent,
  AegisValidator,
  onPaymentCompleted,
  checkExpiredCredentials,
  deliverWebhook
} = require('../services/payment-openclaw-bridge');

// ─── MIDDLEWARE: API Key validation ──────────────────────────────────────────
function requireOpenClawKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['x-openclaw-key'];
  const validKey = process.env.OPENCLAW_API_KEY;

  if (process.env.NODE_ENV !== 'production') return next();

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ success: false, error: 'Invalid or missing OpenCLaw API key' });
  }
  next();
}

// ─── POST /api/openclaw/provision — Provisionar credenciales ─────────────────
router.post('/provision', requireOpenClawKey, async (req, res) => {
  try {
    const { clientWallet, plan, platforms, txHash } = req.body;

    if (!clientWallet) {
      return res.status(400).json({ success: false, error: 'clientWallet required' });
    }

    const info = await OpenClawAgent.getAvailablePlatforms(plan || 'starter');
    let selectedPlatforms = platforms || info.platforms.slice(0, info.maxAllowed);

    const provision = await OpenClawAgent.provisionClient({
      walletAddress: clientWallet,
      plan: plan || 'starter',
      platforms: selectedPlatforms,
      txHash: txHash || null,
    });

    return res.status(201).json({
      success: true,
      provision: {
        clientId: provision.clientId,
        plan: provision.plan,
        platforms: provision.platforms,
        expiresAt: provision.expiresAt,
        status: provision.status,
      },
    });

  } catch (err) {
    logger.error({ err: err.message }, '[OpenCLaw] Provision error');
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/openclaw/revoke — Revocar acceso ─────────────────────────────
router.post('/revoke', requireOpenClawKey, async (req, res) => {
  try {
    const { clientWallet, reason } = req.body;
    if (!clientWallet) return res.status(400).json({ success: false, error: 'clientWallet required' });

    const result = await OpenClawAgent.revokeClient(clientWallet, reason || 'api_revoke');
    if (!result) return res.status(404).json({ success: false, error: 'Client not found' });

    return res.json({ success: true, status: result.status, revokedAt: result.revokedAt });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/openclaw/rotate — Rotar credenciales ─────────────────────────
router.post('/rotate', requireOpenClawKey, async (req, res) => {
  try {
    const { clientWallet } = req.body;
    if (!clientWallet) return res.status(400).json({ success: false, error: 'clientWallet required' });

    const result = await OpenClawAgent.rotateCredentials(clientWallet);
    if (!result) return res.status(404).json({ success: false, error: 'Active client not found' });

    return res.json({
      success: true,
      message: 'Credentials rotated successfully',
      platforms: Array.from(result.credentials.keys()),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/openclaw/client/:address — Credenciales activas ────────────────
router.get('/client/:address', requireOpenClawKey, async (req, res) => {
  try {
    const client = await OpenClawAgent.getClientCredentials(req.params.address);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

    return res.json({
      success: true,
      client: {
        clientId: client.clientId,
        walletAddress: client.walletAddress,
        plan: client.plan,
        platforms: client.platforms,
        status: client.status,
        expiresAt: client.expiresAt,
        usage: client.usage,
        credentials: process.env.NODE_ENV !== 'production' ? client.credentials : '[REDACTED]',
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/openclaw/chat — Chat con el agente IA ─────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { walletAddress, message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message required' });

    const result = await OpenClawAgent.chat({
      walletAddress: walletAddress || 'anonymous',
      message,
    });

    return res.json({
      success: true,
      response: result.response,
      source: result.source,
      agent: 'OpenCLaw',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/openclaw/platforms — Plataformas disponibles ───────────────────
router.get('/platforms', async (req, res) => {
  const { plan } = req.query;
  const info = await OpenClawAgent.getAvailablePlatforms(plan || 'starter');
  return res.json({ success: true, ...info });
});

// ─── POST /api/openclaw/payment-hook — Recibir eventos de pago ──────────────
router.post('/payment-hook', requireOpenClawKey, async (req, res) => {
  try {
    const result = await onPaymentCompleted(req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/openclaw/stats — Estadísticas ─────────────────────────────────
router.get('/stats', requireOpenClawKey, async (req, res) => {
  try {
    const totalClients = await OpenClawClient.countDocuments();
    const activeClients = await OpenClawClient.countDocuments({ status: 'active' });
    const revokedClients = await OpenClawClient.countDocuments({ status: 'revoked' });

    const plans = ['starter', 'pro', 'enterprise', 'vip'];
    const planBreakdown = {};
    for (const p of plans) {
        planBreakdown[p] = await OpenClawClient.countDocuments({ plan: p, status: 'active' });
    }

    return res.json({
        success: true,
        stats: {
            totalClients,
            activeClients,
            revokedClients,
            planBreakdown,
            timestamp: new Date()
        },
    });
  } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/openclaw/health ────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'OpenCLaw Agent + AEGIS Bridge + MongoDB Persisted',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
