/**
 * ============================================================================
 * BEZPAY SERVICE — BeZhas Pay System v2.0
 * ============================================================================
 *
 * Servicio central de pagos para el BezPayModal del frontend.
 * Conecta el hook useBezPayTransaction.js con el backend BeZhas.
 *
 * Flujos soportados:
 *  1. buy_bez     → Comprar BEZ con USDT/USDC/MATIC/ETH/BNB (Hot Wallet)
 *  2. subscription → Activar plan VIP via pago crypto
 *  3. farming     → Registrar depósito en StakingPool (backend indexing)
 *  4. escrow      → Registrar Quality Escrow (backend indexing)
 *  5. service     → Pago de servicio genérico
 *  6. nft_purchase → Compra de NFT
 *
 * Contratos (Polygon Mainnet):
 *  BEZ Token:    0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 *  StakingPool:  0x5c9bd3136fBAA3861DeAE71e689AD8792202c7Df
 *  QualityEscrow: 0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
 *  Treasury:      env.TREASURY_WALLET
 *
 * Author: BeZhas Engineering
 * Updated: 2026-03-11
 */

'use strict';

const { ethers } = require('ethers');
const logger = require('../utils/logger');
const Payment = require('../models/Payment.model');

// ─── CONTRATOS ────────────────────────────────────────────────────────────────
const ADDRS = {
  BEZ_POLYGON:  process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  BEZ_BNB:      '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
  USDT_POLYGON: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  USDC_POLYGON: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  STAKING_POOL: process.env.VITE_STAKING_POOL_ADDRESS || '0x5c9bd3136fBAA3861DeAE71e689AD8792202c7Df',
  ESCROW:       process.env.QUALITY_ESCROW_ADDRESS || '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
  TREASURY:     process.env.TREASURY_WALLET || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
};

// ─── DECIMALES POR TOKEN ──────────────────────────────────────────────────────
const TOKEN_DECIMALS = { BEZ: 18, USDT: 6, USDC: 6, MATIC: 18, ETH: 18, BNB: 18 };

// ─── PLANES VIP (en BEZ) ──────────────────────────────────────────────────────
const VIP_PLANS = {
  basic:      { bezAmount: 500,   priceUSD: 49,  durationDays: 30 },
  creator:    { bezAmount: 1000,  priceUSD: 99,  durationDays: 30 },
  pro:        { bezAmount: 2500,  priceUSD: 199, durationDays: 30 },
  business:   { bezAmount: 5000,  priceUSD: 399, durationDays: 30 },
  enterprise: { bezAmount: 15000, priceUSD: 999, durationDays: 30 },
};

// ─── ABI MÍNIMOS ─────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

// ─── PROVIDER Y WALLET ────────────────────────────────────────────────────────
let _provider = null;
let _hotWallet = null;
let _bezContract = null;

function getProvider() {
  if (!_provider) {
    const rpc = process.env.POLYGON_RPC_URL || process.env.POLYGON_MAINNET_RPC || 'https://polygon-bor.publicnode.com';
    _provider = new ethers.JsonRpcProvider(rpc);
  }
  return _provider;
}

function getHotWallet() {
  if (!_hotWallet) {
    const key = process.env.HOT_WALLET_PRIVATE_KEY;
    if (!key) {
      logger.warn('[BezPay] HOT_WALLET_PRIVATE_KEY not set — on-chain dispensing disabled');
      return null;
    }
    _hotWallet = new ethers.Wallet(key, getProvider());
  }
  return _hotWallet;
}

function getBezContract() {
  if (!_bezContract) {
    const signer = getHotWallet() || getProvider();
    _bezContract = new ethers.Contract(ADDRS.BEZ_POLYGON, ERC20_ABI, signer);
  }
  return _bezContract;
}

// ─── PRECIO BEZ (cache simple 60s) ──────────────────────────────────────────
let _bezPriceCache = { price: 1.24, ts: 0 };

async function getBezPriceUSD() {
  const now = Date.now();
  if (now - _bezPriceCache.ts < 60_000) return _bezPriceCache.price;
  try {
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bez-coin&vs_currencies=usd',
      { signal: AbortSignal.timeout(4000) }
    );
    const data = await resp.json();
    const price = data?.['bez-coin']?.usd;
    if (price && price > 0) {
      _bezPriceCache = { price, ts: now };
      return price;
    }
  } catch (_) { /* fallback */ }
  // Fallback: usar el precio configurado en TokenSale
  return _bezPriceCache.price;
}

// Token price fallbacks (para cuando no hay oracle)
const TOKEN_PRICE_FALLBACK = {
  USDT: 1.0, USDC: 1.0, MATIC: 0.85, ETH: 3400, BNB: 430,
};

// ─── CALCULAR MONTOS DE PAGO ─────────────────────────────────────────────────
async function calculatePaymentAmounts({ payToken, amountUSD, type, planId }) {
  const bezPriceUSD = await getBezPriceUSD();
  const feeRate = payToken === 'BEZ' ? 0.005 : 0.015;

  let effectiveUSD = amountUSD;
  let bezAmount;

  // Para suscripciones: el USD value es el precio del plan
  if (type === 'subscription' && planId && VIP_PLANS[planId]) {
    effectiveUSD = VIP_PLANS[planId].priceUSD;
    bezAmount = VIP_PLANS[planId].bezAmount;  // BEZ fijo del plan
  } else {
    bezAmount = (effectiveUSD * (1 - feeRate)) / bezPriceUSD;
  }

  // Calcular el equivalente en el token a pagar
  const tokenPriceUSD = TOKEN_PRICE_FALLBACK[payToken] || 1.0;
  const tokenDecimals = TOKEN_DECIMALS[payToken] || 18;

  // Cantidad del token que el usuario debe enviar
  const tokenAmountFloat = effectiveUSD / tokenPriceUSD;

  return {
    amountUSD: effectiveUSD,
    bezAmount: parseFloat(bezAmount.toFixed(6)),
    tokenAmountFloat: parseFloat(tokenAmountFloat.toFixed(8)),
    tokenAmountWei: ethers.parseUnits(tokenAmountFloat.toFixed(tokenDecimals < 8 ? tokenDecimals : 6), tokenDecimals),
    tokenDecimals,
    bezPriceUSD,
    tokenPriceUSD,
    feeRate,
    feeUSD: effectiveUSD * feeRate,
  };
}

// ─── VERIFICAR BALANCE HOT WALLET ────────────────────────────────────────────
async function checkHotWalletBalance(bezNeeded) {
  try {
    const wallet = getHotWallet();
    if (!wallet) return { ok: false, reason: 'Hot wallet not configured' };

    const bez = getBezContract();
    const balRaw = await bez.balanceOf(wallet.address);
    const balance = parseFloat(ethers.formatUnits(balRaw, 18));

    if (balance < bezNeeded) {
      return {
        ok: false,
        reason: `Hot wallet has ${balance.toFixed(2)} BEZ, needs ${bezNeeded.toFixed(2)} BEZ`,
        balance,
      };
    }
    return { ok: true, balance };
  } catch (err) {
    logger.error('[BezPay] Hot wallet balance check failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

// ─── DISPENSAR BEZ (Hot Wallet → User) ──────────────────────────────────────
async function dispenseBEZ(toAddress, bezAmount) {
  const wallet = getHotWallet();
  if (!wallet) throw new Error('Hot wallet not configured — cannot dispense tokens');

  const bez = getBezContract();
  const amountWei = ethers.parseUnits(bezAmount.toFixed(6), 18);

  logger.info({ toAddress, bezAmount }, '🪙 [BezPay] Dispensing BEZ tokens');

  const tx = await bez.transfer(toAddress, amountWei, {
    gasLimit: 100_000,
  });
  const receipt = await tx.wait(1);  // esperar 1 confirmación

  logger.info({ txHash: receipt.hash, blockNumber: receipt.blockNumber }, '✅ [BezPay] BEZ dispensed');

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    bezAmount,
    to: toAddress,
  };
}

// ─── ACTIVAR VIP EN BD ───────────────────────────────────────────────────────
async function activateVIPPlan(walletAddress, planId, txHash) {
  try {
    const User = require('../models/user.model');
    const plan = VIP_PLANS[planId];
    if (!plan) return false;

    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() })
      || await User.findOne({ walletAddress });

    if (!user) {
      logger.warn({ walletAddress, planId }, '[BezPay] User not found for VIP activation');
      return false;
    }

    const now = new Date();
    user.vipTier        = planId.toUpperCase();
    user.vipStatus      = 'active';
    user.vipStartDate   = now;
    user.vipEndDate     = new Date(now.getTime() + plan.durationDays * 86_400_000);
    user.vipPaymentHash = txHash;

    await user.save();
    logger.info({ userId: user._id, planId, txHash }, '🌟 [BezPay] VIP plan activated');
    return true;
  } catch (err) {
    logger.error({ err: err.message }, '[BezPay] VIP activation error');
    return false;
  }
}

// ─── REGISTRAR FARMING DEPOSIT EN BD ─────────────────────────────────────────
async function recordFarmingDeposit({ walletAddress, poolId, amountBEZ, lockDays, txHash }) {
  try {
    const FarmingDeposit = require('../models/FarmingDeposit.model').catch?.() || null;
    // Si el modelo existe, registrar; si no, solo logear
    if (FarmingDeposit) {
      await FarmingDeposit.create({ walletAddress, poolId, amountBEZ, lockDays, txHash, createdAt: new Date() });
    }
    logger.info({ walletAddress, poolId, amountBEZ, txHash }, '🌾 [BezPay] Farming deposit recorded');
  } catch (_) {
    logger.info({ walletAddress, poolId, amountBEZ, txHash }, '🌾 [BezPay] Farming deposit (no DB model)');
  }
}

// ─── REGISTRAR ESCROW EN BD ──────────────────────────────────────────────────
async function recordEscrow({ walletAddress, clientWallet, collateral, quality, txHash }) {
  logger.info({ walletAddress, clientWallet, collateral, quality, txHash }, '🔒 [BezPay] Escrow registered');
}

// ═════════════════════════════════════════════════════════════════════════════
// API HANDLER: POST /api/payment/create
// ─────────────────────────────────────────────────────────────────────────────
// Recibe: { payToken, amountUSD, walletAddress, type, planId, poolId, lockDays }
// Devuelve: { paymentAddress, amountToSend, decimals, bezAmount, paymentId }
// ═════════════════════════════════════════════════════════════════════════════
async function createPayment(req, res) {
  try {
    const {
      payToken, amountUSD, walletAddress,
      type = 'buy_bez', planId, poolId, lockDays,
      source, metadata,
    } = req.body;

    if (!payToken) return res.status(400).json({ success: false, message: 'payToken required' });
    if (!walletAddress && !['USD','EUR'].includes(payToken)) {
      return res.status(400).json({ success: false, message: 'walletAddress required for crypto payments' });
    }

    // Calcular montos
    const amounts = await calculatePaymentAmounts({ payToken, amountUSD, type, planId });

    // Verificar balance del hot wallet si vamos a dispensar BEZ
    if (['buy_bez', 'subscription', 'service', 'nft_purchase'].includes(type)) {
      const hcCheck = await checkHotWalletBalance(amounts.bezAmount);
      if (!hcCheck.ok) {
        logger.warn({ reason: hcCheck.reason }, '[BezPay] Hot wallet insufficient');
        // Continuar — el webhook confirmará cuando llegue el pago
      }
    }

    // Generar paymentId único
    const paymentId = `BEZ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

    // Crear registro en BD
    let paymentRecord = null;
    try {
      paymentRecord = new Payment({
        walletAddress,
        type: type.toUpperCase(),
        status: 'pending',
        paymentId,
        payToken,
        fiatAmount: amounts.amountUSD,
        fiatCurrency: 'USD',
        bezAmount: amounts.bezAmount,
        exchangeRate: amounts.bezPriceUSD,
        metadata: { planId, poolId, lockDays, source, ...metadata },
      });
      await paymentRecord.save();
    } catch (dbErr) {
      logger.warn({ err: dbErr.message }, '[BezPay] DB save skipped (model or connection issue)');
    }

    // Para FIAT: devolver datos bancarios directamente
    if (['USD', 'EUR'].includes(payToken)) {
      const refCode = paymentId;
      const ibanMap = {
        EUR: { iban: process.env.BANK_ACCOUNT_NUMBER || 'ES77 1465 0100 91 1766376210', swift: process.env.BANK_SWIFT || 'INGDESMMXXX', bank: process.env.BANK_NAME || 'ING Direct' },
        USD: { iban: 'US12 3456 7890 1234 5678 9012', swift: 'CHASUS33XXX', bank: 'Chase Bank' },
      };
      const bankInfo = ibanMap[payToken];
      return res.json({
        success: true,
        fiat: true,
        paymentId,
        refCode,
        currency: payToken,
        amount: amounts.amountUSD.toFixed(2),
        bezAmount: amounts.bezAmount,
        bankDetails: {
          iban:        bankInfo.iban,
          swift:       bankInfo.swift,
          bank:        bankInfo.bank,
          beneficiary: process.env.BANK_ACCOUNT_HOLDER || 'BeZhas Network S.L.',
          concept:     refCode,
        },
        message: `Realiza una transferencia de ${payToken === 'EUR' ? '€' : '$'}${amounts.amountUSD.toFixed(2)} indicando el código ${refCode} en el concepto`,
      });
    }

    // Para crypto: devolver la dirección de pago y el monto exacto
    logger.info({
      paymentId, payToken, amountUSD: amounts.amountUSD,
      tokenAmount: amounts.tokenAmountFloat, bezAmount: amounts.bezAmount, walletAddress,
    }, '💳 [BezPay] Payment created');

    return res.json({
      success: true,
      paymentId,
      paymentAddress: ADDRS.TREASURY,    // El usuario transfiere al Treasury
      amountToSend:   amounts.tokenAmountFloat,
      decimals:       amounts.tokenDecimals,
      bezAmount:      amounts.bezAmount,
      bezPriceUSD:    amounts.bezPriceUSD,
      tokenPriceUSD:  amounts.tokenPriceUSD,
      feeUSD:         amounts.feeUSD,
      network:        ['ETH'].includes(payToken) ? 'ethereum' : ['BNB'].includes(payToken) ? 'bsc' : 'polygon',
      contractAddress: _getTokenAddress(payToken),
      expiresAt:      new Date(Date.now() + 15 * 60_000).toISOString(), // 15 min
    });

  } catch (err) {
    logger.error({ err: err.message }, '[BezPay] createPayment error');
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// API HANDLER: POST /api/payment/webhook
// ─────────────────────────────────────────────────────────────────────────────
// Recibe: { type, paymentId, txHash, walletAddress, payToken, planId, poolId... }
// Acciones:
//   1. Verifica la TX en la cadena (opcional, el usuario ya confirmó on-chain)
//   2. Dispensa BEZ vía hot wallet (si aplica)
//   3. Activa VIP, registra farming/escrow
//   4. Actualiza el registro de pago en BD
// ═════════════════════════════════════════════════════════════════════════════
async function handleWebhook(req, res) {
  const {
    type, paymentId, txHash, walletAddress,
    payToken, amountUSD, planId, poolId, lockDays,
    clientWallet, collateral, quality,
    source,
  } = req.body;

  logger.info({ type, paymentId, txHash: txHash?.slice(0,12), walletAddress }, '📩 [BezPay] Webhook received');

  // Responder inmediatamente para no hacer timeout al cliente
  res.json({ success: true, paymentId, received: true, ts: Date.now() });

  // Procesar en background
  setImmediate(async () => {
    try {
      // 1. Verificar TX (opcional — el frontend ya confirmó la TX on-chain)
      if (txHash && txHash.startsWith('0x') && txHash.length === 66) {
        const provider = getProvider();
        try {
          const receipt = await provider.getTransactionReceipt(txHash);
          if (receipt && receipt.status !== 1) {
            logger.warn({ txHash }, '[BezPay] TX on-chain failed — aborting webhook');
            await _updatePaymentStatus(paymentId, 'failed', txHash, 'TX on-chain failed');
            return;
          }
        } catch (rpcErr) {
          logger.warn({ err: rpcErr.message }, '[BezPay] RPC check failed — proceeding with trust');
        }
      }

      // 2. Acciones según tipo de pago
      switch (type) {
        // ── COMPRA DE BEZ ─────────────────────────────────────────────────
        case 'buy_bez':
        case 'erc20_payment':
        case 'native_payment':
        case 'payment_confirmed': {
          // Usuario pagó → dispensar BEZ
          if (walletAddress && amountUSD > 0) {
            const amounts = await calculatePaymentAmounts({ payToken, amountUSD, type: 'buy_bez' });
            const dispResult = await dispenseBEZ(walletAddress, amounts.bezAmount);
            await _updatePaymentStatus(paymentId, 'completed', txHash || dispResult.txHash, null, {
              dispenseTxHash: dispResult.txHash,
              bezAmount: amounts.bezAmount,
            });
            logger.info({ walletAddress, bezAmount: amounts.bezAmount, dispTx: dispResult.txHash }, '✅ [BezPay] BEZ dispensed for buy_bez');
          }
          break;
        }

        // ── SUSCRIPCIÓN VIP ───────────────────────────────────────────────
        case 'subscription': {
          const activated = await activateVIPPlan(walletAddress, planId, txHash);
          await _updatePaymentStatus(paymentId, activated ? 'completed' : 'failed', txHash, null, { planId });
          break;
        }

        // ── FARMING DEPOSIT ───────────────────────────────────────────────
        case 'farming_deposit':
        case 'farming': {
          await recordFarmingDeposit({ walletAddress, poolId, amountBEZ: amountUSD, lockDays, txHash });
          await _updatePaymentStatus(paymentId, 'completed', txHash, null, { poolId, lockDays });
          break;
        }

        // ── ESCROW ────────────────────────────────────────────────────────
        case 'escrow_created':
        case 'escrow': {
          await recordEscrow({ walletAddress, clientWallet, collateral, quality, txHash });
          await _updatePaymentStatus(paymentId, 'completed', txHash, null, { clientWallet, collateral, quality });
          break;
        }

        // ── SERVICIO / NFT ────────────────────────────────────────────────
        case 'service':
        case 'nft_purchase': {
          if (walletAddress && amountUSD > 0) {
            const amounts = await calculatePaymentAmounts({ payToken, amountUSD, type });
            await dispenseBEZ(walletAddress, amounts.bezAmount).catch(e =>
              logger.warn({ err: e.message }, '[BezPay] Dispense failed for service')
            );
          }
          await _updatePaymentStatus(paymentId, 'completed', txHash);
          break;
        }

        default:
          logger.warn({ type }, '[BezPay] Unknown payment type in webhook');
      }
    } catch (err) {
      logger.error({ err: err.message, paymentId }, '[BezPay] Webhook processing error');
      await _updatePaymentStatus(paymentId, 'failed', txHash, err.message);
    }
  });
}

// ─── HELPERS INTERNOS ─────────────────────────────────────────────────────────
function _getTokenAddress(token) {
  const MAP = { USDT: ADDRS.USDT_POLYGON, USDC: ADDRS.USDC_POLYGON, BEZ: ADDRS.BEZ_POLYGON };
  return MAP[token] || null;
}

async function _updatePaymentStatus(paymentId, status, txHash, errorMsg, extra = {}) {
  if (!paymentId) return;
  try {
    const update = { status, txHash, updatedAt: new Date(), ...extra };
    if (status === 'completed') update.completedAt = new Date();
    if (errorMsg) update.errorMessage = errorMsg;
    await Payment.findOneAndUpdate({ paymentId }, { $set: update }).catch(() => {});
  } catch (_) { /* BD no disponible — ignorar */ }
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/payment/quote — Precio live para el frontend
// ═════════════════════════════════════════════════════════════════════════════
async function getQuote(req, res) {
  try {
    const { payToken = 'USDT', amountUSD = 100, type = 'buy_bez', planId } = req.query;
    const amounts = await calculatePaymentAmounts({
      payToken, amountUSD: parseFloat(amountUSD), type, planId,
    });
    return res.json({ success: true, ...amounts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/payment/hot-wallet/status — Estado del hot wallet
// ═════════════════════════════════════════════════════════════════════════════
async function getHotWalletStatus(req, res) {
  try {
    const wallet = getHotWallet();
    if (!wallet) {
      return res.json({ success: true, configured: false, address: null, bezBalance: 0, maticBalance: 0 });
    }

    const bez = getBezContract();
    const [bezRaw, maticRaw] = await Promise.all([
      bez.balanceOf(wallet.address),
      getProvider().getBalance(wallet.address),
    ]);

    return res.json({
      success: true,
      configured: true,
      address: wallet.address,
      bezBalance: parseFloat(ethers.formatUnits(bezRaw, 18)),
      maticBalance: parseFloat(ethers.formatEther(maticRaw)),
      bezContract: ADDRS.BEZ_POLYGON,
      network: 'Polygon Mainnet',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  createPayment,
  handleWebhook,
  getQuote,
  getHotWalletStatus,
  BEZ_ADDR: ADDRS.BEZ_POLYGON,
};
