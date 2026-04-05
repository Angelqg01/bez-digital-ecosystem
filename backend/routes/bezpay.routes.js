/**
 * ============================================================================
 * BEZPAY ROUTES — BeZhas Pay System v2.0
 * ============================================================================
 *
 * Endpoints del sistema de pagos unificado BezPayModal.
 * Montado en: /api/payment (junto a payment.routes.js existente)
 *
 * Nuevos endpoints:
 *   POST /api/payment/create    → Crear orden de pago + dirección Treasury
 *   POST /api/payment/webhook   → Confirmar TX + dispensar BEZ + activar VIP
 *   GET  /api/payment/quote     → Cotización en tiempo real
 *   GET  /api/payment/hot-wallet/status → Estado del hot wallet
 */

'use strict';

const express = require('express');
const router  = express.Router();
const logger  = require('../utils/logger');
const { createPayment, handleWebhook, getQuote, getHotWalletStatus } = require('../services/bezpay.service');

// Rate limiting básico (sin Redis) para endpoints críticos
const _ipCounts = new Map();
function rateLimit(maxReq, windowMs) {
  return (req, res, next) => {
    const ip  = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}:${Math.floor(now / windowMs)}`;
    const cnt = (_ipCounts.get(key) || 0) + 1;
    _ipCounts.set(key, cnt);
    if (_ipCounts.size > 10_000) _ipCounts.clear(); // evitar memory leak
    if (cnt > maxReq) {
      return res.status(429).json({ success: false, message: 'Too many requests — slow down' });
    }
    next();
  };
}

// Validar campos obligatorios
function validate(fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => !req.body[f] && req.body[f] !== 0);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }
    next();
  };
}

// ─── RUTAS ────────────────────────────────────────────────────────────────────

/**
 * POST /api/payment/create
 * Crea orden de pago y devuelve la dirección + monto exacto del token a pagar.
 * El frontend enviará la TX on-chain y luego llamará a /webhook para confirmar.
 */
router.post(
  '/create',
  rateLimit(20, 60_000),  // max 20 por minuto por IP
  validate(['payToken']),
  createPayment
);

/**
 * POST /api/payment/webhook
 * Recibido tras confirmar la TX on-chain desde el frontend (useBezPayTransaction).
 * Dispensa BEZ, activa VIP, registra farming/escrow, etc.
 *
 * También recibe eventos del blockchain listener (backend indexer).
 */
router.post(
  '/webhook',
  rateLimit(60, 60_000),  // más permisivo (puede haber reintentos)
  handleWebhook
);

/**
 * GET /api/payment/quote
 * Cotización en tiempo real para el BezPayModal.
 * Query params: payToken, amountUSD, type, planId
 */
router.get('/quote', getQuote);

/**
 * GET /api/payment/hot-wallet/status
 * Estado del Hot Wallet (sólo admin)
 */
router.get('/hot-wallet/status', async (req, res) => {
  // Protección básica — reemplazar con authMiddleware en producción
  const adminToken = req.headers['x-admin-token'] || req.query.adminToken;
  if (adminToken !== process.env.ADMIN_TOKEN && adminToken !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  return getHotWalletStatus(req, res);
});

/**
 * GET /api/payment/bez-price
 * Precio BEZ en USD (público, cacheado 60s)
 */
router.get('/bez-price', async (req, res) => {
  try {
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bez-coin&vs_currencies=usd,eur',
      { signal: AbortSignal.timeout(5000) }
    );
    const data    = await resp.json();
    const priceUSD = data?.['bez-coin']?.usd || 1.24;
    const priceEUR = data?.['bez-coin']?.eur || 1.14;
    return res.json({ success: true, priceUSD, priceEUR, source: 'coingecko', ts: Date.now() });
  } catch (_) {
    return res.json({ success: true, priceUSD: 1.24, priceEUR: 1.14, source: 'fallback', ts: Date.now() });
  }
});

/**
 * GET /api/payment/plans
 * Planes VIP disponibles (público)
 */
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: {
      basic:      { id: 'basic',      name: 'Basic',      bezAmount: 500,   priceUSD: 49,  durationDays: 30 },
      creator:    { id: 'creator',    name: 'Creator',    bezAmount: 1000,  priceUSD: 99,  durationDays: 30 },
      pro:        { id: 'pro',        name: 'Pro',        bezAmount: 2500,  priceUSD: 199, durationDays: 30 },
      business:   { id: 'business',   name: 'Business',   bezAmount: 5000,  priceUSD: 399, durationDays: 30 },
      enterprise: { id: 'enterprise', name: 'Enterprise', bezAmount: 15000, priceUSD: 999, durationDays: 30 },
    },
    bezContract: process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    treasury:    process.env.TREASURY_WALLET || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
  });
});

/**
 * POST /api/payment/verify-tx
 * Verifica el estado de una TX on-chain (usado por el frontend como fallback)
 */
router.post('/verify-tx', rateLimit(30, 60_000), async (req, res) => {
  const { txHash, chainId = 137 } = req.body;
  if (!txHash || !txHash.startsWith('0x')) {
    return res.status(400).json({ success: false, message: 'txHash required' });
  }

  try {
    const { ethers } = require('ethers');
    const rpcMap = {
      137:   process.env.POLYGON_MAINNET_RPC || 'https://polygon-bor.publicnode.com',
      80002: process.env.POLYGON_AMOY_RPC    || 'https://rpc-amoy.polygon.technology',
      56:    'https://bsc-dataseed.binance.org/',
      1:     'https://eth.llamarpc.com',
    };
    const rpc      = rpcMap[chainId] || rpcMap[137];
    const provider = new ethers.JsonRpcProvider(rpc);
    const receipt  = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return res.json({ success: true, status: 'pending', confirmed: false });
    }

    return res.json({
      success:     true,
      status:      receipt.status === 1 ? 'confirmed' : 'failed',
      confirmed:   receipt.status === 1,
      blockNumber: receipt.blockNumber,
      gasUsed:     receipt.gasUsed.toString(),
      txHash:      receipt.hash,
      explorerUrl: chainId === 137
        ? `https://polygonscan.com/tx/${txHash}`
        : `https://amoy.polygonscan.com/tx/${txHash}`,
    });
  } catch (err) {
    logger.error({ err: err.message, txHash }, '[BezPay] TX verification error');
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/payment/bezpay-health
 * Health check del sistema BezPay
 */
router.get('/bezpay-health', (req, res) => {
  const wallet = process.env.HOT_WALLET_PRIVATE_KEY ? 'configured' : 'NOT_CONFIGURED';
  res.json({
    success: true,
    system:  'BeZhas Pay v2.0',
    hotWallet: wallet,
    endpoints: [
      'POST /api/payment/create',
      'POST /api/payment/webhook',
      'GET  /api/payment/quote',
      'GET  /api/payment/bez-price',
      'GET  /api/payment/plans',
      'POST /api/payment/verify-tx',
      'GET  /api/payment/hot-wallet/status',
    ],
    contracts: {
      bezPolygon: process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
      treasury:   process.env.TREASURY_WALLET || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
      escrow:     process.env.QUALITY_ESCROW_ADDRESS || '0x3088573c025F197A886b97440761990c9A9e83C9',
    },
    ts: new Date().toISOString(),
  });
});

module.exports = router;
