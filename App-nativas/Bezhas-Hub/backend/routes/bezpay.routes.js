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
const crypto  = require('crypto');
const router  = express.Router();
const logger  = require('../utils/logger');
const { createPayment, handleWebhook, handleActivityEvent, confirmBankTransfer, confirmBankTransferBatch, getQuote, getHotWalletStatus, VIP_PLANS,
  setFeeOverride, removeFeeOverride, listFeeOverrides } = require('../services/bezpay.service');

/** Comparación en tiempo constante para secretos compartidos. */
function timingSafeMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Exige `x-admin-token` (o `?adminToken=`) igual a ADMIN_TOKEN/ADMIN_SECRET.
 * Sin esa variable definida, la ruta queda cerrada — no abierta: la versión
 * original de hot-wallet/status comparaba con `undefined` a secas, y
 * `undefined !== undefined` es `false`, así que sin configurar nada quedaba
 * pública. Aquí `!expected` corta ese caso antes de comparar.
 */
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN || process.env.ADMIN_SECRET;
  const provided = req.headers['x-admin-token'] || req.query.adminToken;
  if (!expected || !provided || !timingSafeMatch(String(provided), expected)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

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
 * Confirma una orden creada en /create indicando la TX que la paga.
 *
 * Público a propósito: lo llama el navegador del pagador
 * (useBezPayTransaction), que no puede guardar un secreto compartido. La
 * seguridad NO está en autenticar al llamante, sino en que el handler ignora
 * el body salvo { paymentId, txHash } y deriva importe, token, destinatario y
 * BEZ a entregar de la orden en BD + la propia cadena. Ver la cabecera de
 * services/bezpay.service.js → handleWebhook.
 *
 * Respuestas: 200 liquidado (o ya liquidado) · 202 reintenta (TX aún sin
 * confirmar / RPC caído) · 4xx rechazo definitivo.
 */
router.post(
  '/webhook',
  rateLimit(60, 60_000),  // más permisivo (el 202 provoca reintentos legítimos)
  validate(['paymentId', 'txHash']),
  handleWebhook
);

/**
 * POST /api/payment/events
 * Registro de actividad on-chain que no mueve fondos nuestros (farming,
 * escrow). Separado de /webhook para que la ruta de liquidación no crezca.
 */
router.post(
  '/events',
  rateLimit(60, 60_000),
  validate(['type', 'txHash', 'walletAddress']),
  handleActivityEvent
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
router.get('/hot-wallet/status', requireAdmin, getHotWalletStatus);

/**
 * Tarifas negociadas por wallet — para dar una cuenta grande una comisión
 * preferente sin cambiar el 1,5% de todos los demás clientes.
 */
router.get('/fee-override', requireAdmin, listFeeOverrides);
router.put('/fee-override/:wallet', requireAdmin, rateLimit(20, 60_000), setFeeOverride);
router.delete('/fee-override/:wallet', requireAdmin, removeFeeOverride);

/**
 * POST /api/payment/bank-transfer/confirm
 * Un humano confirma que una transferencia llegó (transferencia bancaria no
 * tiene webhook: nadie más avisa). Requiere admin — ver services/bezpay.service.js
 * → confirmBankTransfer para el porqué y el candado de unicidad.
 */
router.post(
  '/bank-transfer/confirm',
  requireAdmin,
  rateLimit(30, 60_000),
  validate(['paymentId', 'bankReference']),
  confirmBankTransfer
);

/**
 * POST /api/payment/bank-transfer/confirm-batch
 * Un wire cubre varias facturas — ver services/bezpay.service.js →
 * confirmBankTransferBatch para la salvaguarda de suma contra lo recibido.
 */
router.post(
  '/bank-transfer/confirm-batch',
  requireAdmin,
  rateLimit(15, 60_000),
  validate(['bankReference', 'totalAmountReceived', 'paymentIds']),
  confirmBankTransferBatch
);

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
  // Antes: una tercera copia literal de los mismos 5 planes, ya desincronizada
  // de bezpay.service.js antes de este cambio. Ahora expone el VIP_PLANS real
  // del servicio — cambiar el precio en un sitio lo cambia en los dos.
  const plans = Object.fromEntries(
    Object.entries(VIP_PLANS).map(([id, plan]) => [id, { id, name: id[0].toUpperCase() + id.slice(1), ...plan }])
  );
  res.json({
    success: true,
    plans,
    bezContract: process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    treasury:    process.env.TREASURY_WALLET || '0x89c23890c742d710265dD61be789C71dC8999b12',
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
      'POST /api/payment/bank-transfer/confirm',
      'GET  /api/payment/quote',
      'GET  /api/payment/bez-price',
      'GET  /api/payment/plans',
      'POST /api/payment/verify-tx',
      'GET  /api/payment/hot-wallet/status',
    ],
    contracts: {
      bezPolygon: process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
      treasury:   process.env.TREASURY_WALLET || '0x89c23890c742d710265dD61be789C71dC8999b12',
      escrow:     process.env.QUALITY_ESCROW_ADDRESS || '0x3088573c025F197A886b97440761990c9A9e83C9',
    },
    ts: new Date().toISOString(),
  });
});

module.exports = router;
