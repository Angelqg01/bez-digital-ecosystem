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
const PaymentPG = require('../models/pg/Payment');
const FeeOverride = require('../models/pg/FeeOverride');
const bridge = require('../bridge'); // For ecosystem sync
const { verifyIncomingPayment, VerificationError, isTxHash } = require('./bezpayVerifier');
const { getBezPurchaseLink, STRIPE_PUBLISHABLE_KEY } = require('../config/stripe-payment-links');
const { holdHoursFor } = require('./bezpayFiatSettlement');

// ─── OPENCLAW BRIDGE (auto-provision al completar pagos) ─────────────────────
let openclawBridge = null;
try {
  openclawBridge = require('./payment-openclaw-bridge');
  logger.info('✅ [BezPay] OpenCLaw bridge connected');
} catch (err) {
  logger.warn('[BezPay] OpenCLaw bridge not available — payments will work without auto-provisioning');
}

// ─── CONTRATOS ────────────────────────────────────────────────────────────────
const ADDRS = {
  BEZ_POLYGON:  process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  BEZ_BNB:      '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
  USDT_POLYGON: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  USDC_POLYGON: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  STAKING_POOL: process.env.VITE_STAKING_POOL_ADDRESS || '0x5c9bd3136fBAA3861DeAE71e689AD8792202c7Df',
  ESCROW:       process.env.QUALITY_ESCROW_ADDRESS || '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
  TREASURY:     process.env.TREASURY_WALLET || '0x89c23890c742d710265dD61be789C71dC8999b12',
};

// Dirección de relleno que el código arrastraba como fallback de
// TREASURY_WALLET antes de fijar la Treasury DAO. No es del proyecto, no tiene
// checksum EIP-55 válido y nadie la controla. Se sigue vigilando por si alguien
// la reintroduce vía env: cobrar contra ella sería tirar el dinero de los
// clientes a un pozo.
const PLACEHOLDER_TREASURY = '0x742d35cc6634c0532925a3b844bc9e7595f0beb4';

function _treasuryIsUnsafe() {
  return String(ADDRS.TREASURY).toLowerCase() === PLACEHOLDER_TREASURY;
}

// ─── DECIMALES POR TOKEN ──────────────────────────────────────────────────────
const TOKEN_DECIMALS = { BEZ: 18, USDT: 6, USDC: 6, MATIC: 18, ETH: 18, BNB: 18 };

// ─── PLANES VIP (en BEZ) ──────────────────────────────────────────────────────
// Actualizado contra config/plans.js — "FUENTE ÚNICA Y DEFINITIVA de planes de
// suscripción", basada en los PDFs de precios aprobados. Los precios de aquí
// (creator/business/enterprise) llevaban meses desincronizados de esa fuente
// (€99/€499/€2499 reales vs $99/$399/$999 aquí) — canjeado 1:1 donde hay
// equivalente: creator→creator_pro, business→business, enterprise→enterprise_vip.
// bezAmount ahora es el bezPerMonth fijo del plan (plans.js), no una cifra
// suelta. EUR→USD con la misma tasa de bezpay.service.js (0.92, ver abajo).
//
// 'basic' y 'pro' NO existen en el sistema canónico de 4 tiers (starter/
// creator_pro/business/enterprise_vip) — se dejan sin tocar, sin equivalente
// al que canjearlos, porque BezPayModal.jsx usa 'pro' como plan por defecto
// y renombrar/quitar claves aquí rompería ese selector sin poder probarlo en
// un entorno real. Requieren una decisión de producto: ¿se retiran, o se dan
// de alta en config/plans.js como tiers reales?
const VIP_PLANS = {
  basic:      { bezAmount: 500,   priceUSD: 49,  durationDays: 30 }, // huérfano, sin equivalente canónico
  creator:    { bezAmount: 200,   priceUSD: 107.61, durationDays: 30 }, // creator_pro: €99 / 0.92
  pro:        { bezAmount: 2500,  priceUSD: 199, durationDays: 30 }, // huérfano, sin equivalente canónico
  business:   { bezAmount: 1000,  priceUSD: 542.39, durationDays: 30 }, // business: €499 / 0.92
  enterprise: { bezAmount: 5000,  priceUSD: 2716.30, durationDays: 30 }, // enterprise_vip: €2499 / 0.92
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
    // Preferencia: firma en GCP KMS (la clave nunca sale del HSM). Fallback:
    // clave en env (legacy). Ver services/kmsSigner.js.
    const kmsKeyPath = process.env.HOT_WALLET_KMS_KEY;
    if (kmsKeyPath) {
      try {
        const { GcpKmsSigner } = require('./kmsSigner');
        _hotWallet = new GcpKmsSigner(kmsKeyPath, getProvider());
        logger.info('[BezPay] Hot wallet signing via GCP KMS');
        return _hotWallet;
      } catch (err) {
        logger.warn({ err: err.message }, '[BezPay] KMS signer unavailable — falling back to env key');
      }
    }
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

// ─── PRECIO BEZ (cache simple 60s, USD + EUR en una llamada) ─────────────────
// Fallback FX si el feed no trae EUR (aprox. conservadora, override por env).
const EUR_PER_USD_FALLBACK = parseFloat(process.env.EUR_PER_USD_FALLBACK || '0.92');
let _bezPriceCache = { price: 1.24, eur: null, ts: 0 };

async function refreshBezPrices() {
  const now = Date.now();
  if (now - _bezPriceCache.ts < 60_000) return _bezPriceCache;
  try {
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bez-coin&vs_currencies=usd,eur',
      { signal: AbortSignal.timeout(4000) }
    );
    const data = await resp.json();
    const usd = data?.['bez-coin']?.usd;
    const eur = data?.['bez-coin']?.eur;
    if (usd && usd > 0) {
      _bezPriceCache = { price: usd, eur: eur && eur > 0 ? eur : null, ts: now };
    }
  } catch (_) { /* fallback: cache anterior */ }
  return _bezPriceCache;
}

async function getBezPriceUSD() {
  // Fallback: usar el precio configurado en TokenSale
  return (await refreshBezPrices()).price;
}

/** Precio BEZ en EUR — feed real; si el feed no trae EUR, deriva del USD. */
async function getBezPriceEUR() {
  const cache = await refreshBezPrices();
  return cache.eur || cache.price * EUR_PER_USD_FALLBACK;
}

// Token price fallbacks (para cuando no hay oracle)
const TOKEN_PRICE_FALLBACK = {
  USDT: 1.0, USDC: 1.0, MATIC: 0.85, ETH: 3400, BNB: 430,
};

// ─── CALCULAR MONTOS DE PAGO ─────────────────────────────────────────────────
// walletAddress es opcional: sin él (o sin acuerdo para esa wallet), se usa
// la tarifa de siempre — esto no cambia el comportamiento de nadie que no
// tenga una fila en bezpay_fee_overrides.
async function calculatePaymentAmounts({ payToken, amountUSD, type, planId, walletAddress }) {
  const bezPriceUSD = await getBezPriceUSD();
  const defaultFeeRate = payToken === 'BEZ' ? 0.005 : 0.015;

  let feeRate = defaultFeeRate;
  if (walletAddress) {
    try {
      const override = await FeeOverride.getFeeRate(walletAddress);
      if (override !== null) feeRate = override;
    } catch (err) {
      // Sin BD, o la tabla aún no existe en este entorno — se degrada a la
      // tarifa por defecto en vez de romper la cotización.
      logger.warn({ err: err.message, walletAddress }, '[BezPay] No se pudo consultar la tarifa negociada — usando la de defecto');
    }
  }

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

// Costura de test: permite sustituir el dispensado real por un doble. Sólo la
// usa tests/bezpay-webhook-security.test.js, que necesita afirmar "aquí NO ha
// salido dinero" sin levantar un nodo ni una hot wallet.
let _dispenseFn = null;
function __setDispenser(fn) { _dispenseFn = fn; }

// Un único hot wallet no puede firmar dos TX a la vez sin arriesgar una
// colisión de nonce: dos `bez.transfer()` concurrentes pueden leer el mismo
// nonce "pending" y una de las dos entregas se pierde o falla. El webhook
// cripto (handleWebhook) y el liberador de retenciones fiat (releaseDueSettlements,
// vía bezpayFiatSettlement) llaman ambos a esta misma función, así que la cola
// serializa TODA salida del hot wallet, venga de donde venga.
let _dispenseChain = Promise.resolve();
function _dispense(to, amount) {
  const run = () => (_dispenseFn || dispenseBEZ)(to, amount);
  const result = _dispenseChain.then(run, run);
  // Un fallo no debe colgar la cola para las entregas siguientes.
  _dispenseChain = result.then(() => {}, () => {});
  return result;
}

// ─── ACTIVAR VIP EN BD ───────────────────────────────────────────────────────
async function activateVIPPlan(walletAddress, planId, txHash) {
  try {
    const User = require('../models/pg/User');
    const plan = VIP_PLANS[planId];
    if (!plan) return false;

    const user = await User.findByWallet(walletAddress.toLowerCase())
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
  // El modelo FarmingDeposit es opcional: si no existe, degradamos a solo-log.
  let FarmingDeposit = null;
  try {
    FarmingDeposit = require('../models/FarmingDeposit.model');
  } catch (_) {
    FarmingDeposit = null;
  }
  try {
    if (FarmingDeposit && typeof FarmingDeposit.create === 'function') {
      await FarmingDeposit.create({ walletAddress, poolId, amountBEZ, lockDays, txHash, createdAt: new Date() });
      logger.info({ walletAddress, poolId, amountBEZ, txHash }, '🌾 [BezPay] Farming deposit recorded');
    } else {
      logger.info({ walletAddress, poolId, amountBEZ, txHash }, '🌾 [BezPay] Farming deposit (no DB model)');
    }
  } catch (err) {
    logger.warn({ err: err.message, walletAddress, poolId, txHash }, '🌾 [BezPay] Farming deposit DB write failed');
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
    const amounts = await calculatePaymentAmounts({ payToken, amountUSD, type, planId, walletAddress });

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

    const isFiat = ['USD', 'EUR'].includes(payToken);

    if (!isFiat && _treasuryIsUnsafe() && process.env.NODE_ENV === 'production') {
      logger.error('[BezPay] TREASURY_WALLET sin configurar — no se cobra contra la dirección de relleno');
      return res.status(503).json({
        success: false,
        message: 'Pagos cripto no disponibles temporalmente',
      });
    }

    const chainId = _chainIdFor(payToken);
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    // Términos de liquidación: lo que el webhook exigirá ver en la cadena.
    // Se congelan aquí, al precio de este instante, y no se recalculan nunca
    // más — si se recalculasen en el webhook, un movimiento de precio entre el
    // pago y la confirmación cambiaría lo que el cliente debe.
    const settlement = {
      chainId,
      payToken,
      tokenAddress: _getTokenAddress(payToken),  // null → pago nativo
      expectedAmountWei: isFiat ? null : amounts.tokenAmountWei.toString(),
      recipient: ADDRS.TREASURY,
      bezAmount: amounts.bezAmount,
      expiresAt: expiresAt.toISOString(),
    };

    // Crear registro en BD. Sin registro no hay orden contra la que verificar
    // el pago, así que un fallo aquí es fatal: mejor que el cliente reintente
    // a que pague algo que luego no podremos liquidar.
    let paymentRecord = null;
    try {
      paymentRecord = await PaymentPG.create({
        walletAddress,
        type: _dbTypeFor(type),
        status: 'pending',
        paymentIntentId: paymentId,
        payToken,
        fiatAmount: amounts.amountUSD,
        fiatCurrency: 'USD',
        bezAmount: amounts.bezAmount,
        exchangeRate: amounts.bezPriceUSD,
        metadata: { planId, poolId, lockDays, source, type, settlement, ...metadata },
      });
    } catch (dbErr) {
      logger.error({ err: dbErr.message }, '[BezPay] No se pudo registrar la orden — pago rechazado');
      return res.status(503).json({
        success: false,
        message: 'Servicio de pagos no disponible — inténtalo de nuevo en unos segundos',
      });
    }

    // Para FIAT: tarjeta (Stripe) y/o transferencia bancaria.
    if (['USD', 'EUR'].includes(payToken)) {
      const refCode = paymentId;
      const ibanMap = {
        EUR: { iban: process.env.BANK_ACCOUNT_NUMBER || 'ES77 1465 0100 91 1766376210', swift: process.env.BANK_SWIFT || 'INGDESMMXXX', bank: process.env.BANK_NAME || 'ING Direct' },
        // Sin cuenta en USD configurada. Los valores que había aquí ('US12 3456
        // 7890 1234 5678 9012' / Chase) eran de relleno: publicarlos manda al
        // cliente a hacer una transferencia a ninguna parte. Hasta que existan
        // BANK_ACCOUNT_NUMBER_USD y BANK_SWIFT_USD reales, en USD sólo se
        // ofrece tarjeta.
        USD: process.env.BANK_ACCOUNT_NUMBER_USD
          ? { iban: process.env.BANK_ACCOUNT_NUMBER_USD, swift: process.env.BANK_SWIFT_USD, bank: process.env.BANK_NAME_USD || 'Bank' }
          : null,
      };
      const bankInfo = ibanMap[payToken];
      const stripeUrl = getBezPurchaseLink(payToken);

      if (!bankInfo && !stripeUrl) {
        return res.status(503).json({
          success: false,
          message: `Pagos en ${payToken} no disponibles ahora mismo`,
        });
      }
      const symbol = payToken === 'EUR' ? '€' : '$';

      // Sesión de Checkout ligada a esta orden: es lo que permite entregar el
      // BEZ después, porque lleva el paymentId y la wallet en la metadata.
      // Si Stripe no está configurado, se degrada al enlace estático — que
      // cobra igual, pero obliga a acreditar a mano (no lleva metadata).
      let card = null;
      if (stripeUrl && walletAddress) {
        try {
          const stripeService = require('./stripe.service');
          const session = await stripeService.createBezPayCheckoutSession({
            paymentId,
            walletAddress,
            bezAmount: amounts.bezAmount,
            amountFiat: amounts.amountUSD,
            currency: payToken,
          });
          const surchargeAmount = Number((
            amounts.amountUSD * stripeService.CARD_SURCHARGE_PCT + stripeService.CARD_SURCHARGE_FIXED
          ).toFixed(2));
          card = {
            provider: 'stripe',
            url: session.url,
            sessionId: session.sessionId,
            publishableKey: STRIPE_PUBLISHABLE_KEY,
            reference: refCode,
            deliversAutomatically: true,
            // Declarado aquí, antes de que el cliente llegue a Stripe — no
            // sólo como línea suelta en el checkout. El BEZ entregado no
            // cambia: el recargo cubre el coste real de procesar la tarjeta,
            // no se descuenta de amounts.bezAmount.
            surcharge: { amountFiat: surchargeAmount, pct: stripeService.CARD_SURCHARGE_PCT },
            note: `El BEZ se entrega tras ${holdHoursFor('card')} h de retención, si no hay disputa. `
              + `Recargo de tarjeta: ${surchargeAmount} ${payToken} (cubre el coste del procesador; no reduce el BEZ recibido)`,
          };
        } catch (err) {
          logger.warn({ err: err.message, paymentId },
            '[BezPay] No se pudo crear la sesión de Stripe — se ofrece el enlace estático');
        }
      }
      if (!card && stripeUrl) {
        card = {
          provider: 'stripe',
          url: stripeUrl,
          publishableKey: STRIPE_PUBLISHABLE_KEY,
          reference: refCode,
          deliversAutomatically: false,
          note: 'Enlace genérico sin referencia de orden: el BEZ se acredita manualmente',
        };
      }

      return res.json({
        success: true,
        fiat: true,
        paymentId,
        refCode,
        currency: payToken,
        amount: amounts.amountUSD.toFixed(2),
        bezAmount: amounts.bezAmount,

        card,

        // Transferencia: sólo si hay cuenta real configurada para esa moneda.
        bankDetails: bankInfo ? {
          iban:        bankInfo.iban,
          swift:       bankInfo.swift,
          bank:        bankInfo.bank,
          beneficiary: process.env.BANK_ACCOUNT_HOLDER || 'BeZhas Network S.L.',
          concept:     refCode,
        } : null,

        message: bankInfo
          ? `Paga ${symbol}${amounts.amountUSD.toFixed(2)} con tarjeta, o por transferencia indicando el código ${refCode} en el concepto`
          : `Paga ${symbol}${amounts.amountUSD.toFixed(2)} con tarjeta (referencia ${refCode})`,
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
      amountToSendWei: amounts.tokenAmountWei.toString(),
      decimals:       amounts.tokenDecimals,
      bezAmount:      amounts.bezAmount,
      bezPriceUSD:    amounts.bezPriceUSD,
      tokenPriceUSD:  amounts.tokenPriceUSD,
      feeUSD:         amounts.feeUSD,
      network:        _networkNameFor(payToken),
      chainId,
      contractAddress: _getTokenAddress(payToken),
      expiresAt:      expiresAt.toISOString(), // 15 min
    });

  } catch (err) {
    logger.error({ err: err.message }, '[BezPay] createPayment error');
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// API HANDLER: POST /api/payment/webhook
// ─────────────────────────────────────────────────────────────────────────────
// Lo llama el navegador del pagador tras firmar la TX, así que el body es
// una PISTA, no una fuente de verdad. Sólo se usa de él:
//
//   paymentId → qué orden se está confirmando
//   txHash    → qué TX la paga
//
// Todo lo demás (importe, token, destinatario, BEZ a entregar, wallet a la que
// entregarlo) sale de la orden guardada en /create y de la propia cadena. El
// body NO puede alterar cuánto se paga ni a quién.
//
// Garantías:
//   1. Sin orden en BD → no se liquida (503, reintentable).
//   2. Orden expirada  → se rechaza.
//   3. TX verificada contra la cadena: minada, no revertida, con
//      confirmaciones, enviada por el titular, al Treasury, por el importe
//      correcto. Un RPC caído NO da el pago por bueno: reintenta.
//   4. Claim atómico: la misma orden (o la misma TX) sólo entrega valor una
//      vez, aunque lleguen mil peticiones a la vez.
// ═════════════════════════════════════════════════════════════════════════════
async function handleWebhook(req, res) {
  const { paymentId, txHash } = req.body || {};

  if (!paymentId || typeof paymentId !== 'string') {
    return res.status(400).json({ success: false, code: 'NO_PAYMENT_ID', message: 'paymentId requerido' });
  }
  if (!isTxHash(txHash)) {
    return res.status(400).json({ success: false, code: 'BAD_TXHASH', message: 'txHash inválido' });
  }

  logger.info({ paymentId, txHash: txHash.slice(0, 12) }, '📩 [BezPay] Webhook recibido');

  // ── 1. La orden manda ───────────────────────────────────────────────────
  let order;
  try {
    order = await PaymentPG.findByPaymentIntent(paymentId);
  } catch (dbErr) {
    logger.error({ err: dbErr.message, paymentId }, '[BezPay] BD no disponible en webhook');
    return res.status(503).json({ success: false, code: 'DB_UNAVAILABLE', retryable: true,
      message: 'No se puede verificar el pago ahora mismo' });
  }
  if (!order) {
    return res.status(404).json({ success: false, code: 'ORDER_NOT_FOUND', message: 'Orden no encontrada' });
  }

  // Ya liquidada: responde idempotente sin volver a entregar nada.
  if (order.settled_at || order.status === 'completed') {
    return res.json({
      success: true, paymentId, alreadySettled: true,
      status: order.status, txHash: order.tx_hash,
      bezAmount: order.bez_amount != null ? Number(order.bez_amount) : null,
    });
  }

  const meta = _parseMetadata(order.metadata);
  const terms = meta.settlement;
  if (!terms || !terms.expectedAmountWei) {
    // Órdenes anteriores a la migración 017 no llevan términos: no hay contra
    // qué verificar, así que se liquidan a mano.
    logger.error({ paymentId }, '[BezPay] Orden sin términos de liquidación — requiere revisión manual');
    return res.status(409).json({ success: false, code: 'NO_SETTLEMENT_TERMS',
      message: 'Orden sin términos de liquidación — contacta con soporte' });
  }

  // La expiración protege del arbitraje de precio: los términos se congelaron
  // hace 15 minutos y liquidarlos hoy sería regalar la diferencia.
  if (terms.expiresAt && Date.now() > new Date(terms.expiresAt).getTime()) {
    await _updatePaymentStatus(paymentId, 'failed', txHash,
      'ORDER_EXPIRED: llegó fuera de plazo; comprobar si los fondos entraron igualmente');
    return res.status(410).json({ success: false, code: 'ORDER_EXPIRED',
      message: 'La orden expiró — crea una nueva. Si ya enviaste el pago, contacta con soporte' });
  }

  // ── 2. La cadena decide ─────────────────────────────────────────────────
  let proof;
  try {
    proof = await verifyIncomingPayment({
      txHash,
      chainId:      terms.chainId,
      payer:        order.wallet_address,
      recipient:    terms.recipient,
      tokenAddress: terms.tokenAddress,
      minAmountWei: BigInt(terms.expectedAmountWei),
    });
  } catch (err) {
    if (err instanceof VerificationError) {
      if (err.retryable) {
        logger.warn({ paymentId, code: err.code }, '[BezPay] Verificación aplazada');
        return res.status(202).json({ success: false, code: err.code, retryable: true,
          message: err.message, retryAfterMs: 5000 });
      }
      // La orden NO se marca como fallida: este endpoint es público y el
      // paymentId viaja en el body, así que un tercero podría enviar el hash
      // de una TX cualquiera contra la orden de otro y dejársela inservible.
      // Se rechaza la petición y la orden sigue viva hasta que expire sola.
      logger.warn({ paymentId, txHash: txHash.slice(0, 12), code: err.code }, '🚫 [BezPay] Pago rechazado');
      return res.status(400).json({ success: false, code: err.code, message: err.message });
    }
    logger.error({ err: err.message, paymentId }, '[BezPay] Error verificando pago');
    return res.status(503).json({ success: false, code: 'VERIFY_ERROR', retryable: true,
      message: 'No se pudo verificar el pago' });
  }

  // ── 3. Claim atómico: sólo un ganador entrega valor ─────────────────────
  let claimed;
  try {
    claimed = await PaymentPG.claimForSettlement(paymentId, txHash, proof.payer, proof.blockNumber);
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      // Esa TX ya liquidó otra orden. Intento de reutilizar un pago.
      logger.warn({ paymentId, txHash: txHash.slice(0, 12) }, '🚫 [BezPay] TX ya usada en otra orden');
      return res.status(409).json({ success: false, code: 'TX_ALREADY_USED',
        message: 'Esa transacción ya liquidó otro pago' });
    }
    logger.error({ err: dbErr.message, paymentId }, '[BezPay] Claim falló');
    return res.status(503).json({ success: false, code: 'CLAIM_FAILED', retryable: true,
      message: 'No se pudo reservar la orden' });
  }

  if (!claimed) {
    // Otra petición ganó la carrera mientras verificábamos.
    return res.json({ success: true, paymentId, alreadySettled: true, txHash });
  }

  // ── 4. Entregar lo que la orden prometió ────────────────────────────────
  try {
    const result = await _deliverOrder(claimed, meta, txHash);

    // Notificación al ecosistema: es un efecto secundario, no parte de la
    // entrega. Aislada en su propio try porque un fallo aquí NO puede marcar
    // como fallido un pago que ya se entregó bien (Promise.resolve envuelve
    // implementaciones que no devuelven promesa).
    if (openclawBridge && claimed.wallet_address) {
      try {
        Promise.resolve(openclawBridge.onPaymentCompleted({
          walletAddress: claimed.wallet_address,
          type: meta.type || claimed.type,
          txHash,
          bezAmount: Number(claimed.bez_amount || 0),
          planId: meta.planId,
          metadata: { source: meta.source, paymentId },
        })).catch(e => logger.warn({ err: e.message }, '[BezPay] OpenCLaw bridge notification failed'));
      } catch (e) {
        logger.warn({ err: e.message }, '[BezPay] OpenCLaw bridge notification threw');
      }
    }

    return res.json({ success: true, paymentId, status: 'completed', txHash, ...result });

  } catch (err) {
    // El cliente YA pagó: no se revierte el claim, se marca para revisión.
    logger.error({ err: err.message, paymentId, txHash }, '🔥 [BezPay] Cobrado pero no entregado');
    await PaymentPG.markSettlementFailed(paymentId, `DELIVERY_FAILED: ${err.message}`).catch(() => {});
    return res.status(500).json({ success: false, code: 'DELIVERY_FAILED', paid: true,
      message: 'Pago recibido pero la entrega falló — soporte lo resolverá', paymentId });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// API HANDLER: POST /api/payment/events
// ─────────────────────────────────────────────────────────────────────────────
// Registro de actividad on-chain que NO mueve dinero nuestro: depósitos de
// farming y aperturas de escrow, donde el usuario interactúa directamente con
// el StakingPool / QualityEscrow y nosotros sólo indexamos.
//
// Va aparte del webhook a propósito: la ruta de liquidación debe hacer una
// sola cosa. Aquí lo peor que puede pasar es una fila de más en el índice, no
// una salida del hot wallet — pero aun así se comprueba que la TX existe y que
// la firmó quien dice haberla firmado.
// ═════════════════════════════════════════════════════════════════════════════
async function handleActivityEvent(req, res) {
  const { type, txHash, walletAddress, poolId, pid, amountBEZ, lockDays,
          clientWallet, collateral, collateralBEZ, quality } = req.body || {};

  if (!isTxHash(txHash)) {
    return res.status(400).json({ success: false, code: 'BAD_TXHASH', message: 'txHash inválido' });
  }
  if (!walletAddress) {
    return res.status(400).json({ success: false, code: 'NO_WALLET', message: 'walletAddress requerido' });
  }

  // Comprobación mínima: la TX existe, no revirtió y la envió esa wallet.
  // minAmountWei/recipient no aplican (no nos pagan a nosotros), así que se
  // usa el provider directamente en vez del verificador de cobros.
  try {
    const provider = getProvider();
    const [receipt, tx] = await Promise.all([
      provider.getTransactionReceipt(txHash),
      provider.getTransaction(txHash),
    ]);
    if (!receipt || !tx) {
      return res.status(202).json({ success: false, code: 'TX_NOT_FOUND', retryable: true,
        message: 'TX aún no visible' });
    }
    if (receipt.status !== 1) {
      return res.status(400).json({ success: false, code: 'TX_REVERTED', message: 'La TX revirtió' });
    }
    if (tx.from.toLowerCase() !== String(walletAddress).toLowerCase()) {
      return res.status(400).json({ success: false, code: 'WRONG_SENDER',
        message: 'La TX no la envió esa wallet' });
    }
  } catch (err) {
    logger.warn({ err: err.message, txHash }, '[BezPay] No se pudo comprobar el evento');
    return res.status(503).json({ success: false, code: 'RPC_UNAVAILABLE', retryable: true,
      message: 'No se pudo comprobar la TX' });
  }

  switch (type) {
    case 'farming_deposit':
    case 'farming':
      await recordFarmingDeposit({
        walletAddress, poolId: poolId ?? pid, amountBEZ, lockDays, txHash,
      });
      return res.json({ success: true, recorded: 'farming', txHash });

    case 'escrow_created':
    case 'escrow':
      await recordEscrow({
        walletAddress, clientWallet,
        collateral: collateral ?? collateralBEZ, quality, txHash,
      });
      return res.json({ success: true, recorded: 'escrow', txHash });

    default:
      return res.status(400).json({ success: false, code: 'UNKNOWN_EVENT',
        message: `Tipo de evento no soportado: ${type}` });
  }
}

/**
 * Entrega lo que corresponda a una orden ya cobrada y verificada.
 * Los importes salen de la fila reclamada, nunca del body de la petición.
 */
async function _deliverOrder(order, meta, txHash) {
  const type = meta.type || order.type;
  const wallet = order.wallet_address;
  const bezAmount = Number(order.bez_amount || 0);

  switch (type) {
    // ── COMPRA DE BEZ / SERVICIO / NFT → dispensar BEZ ────────────────────
    case 'buy_bez':
    case 'token_purchase':
    case 'service':
    case 'nft_purchase': {
      if (!(bezAmount > 0)) throw new Error('Orden sin bezAmount que dispensar');
      const disp = await _dispense(wallet, bezAmount);
      await _updatePaymentStatus(order.payment_intent_id, 'completed', txHash);
      logger.info({ wallet, bezAmount, dispTx: disp.txHash }, '✅ [BezPay] BEZ dispensado');
      return { bezAmount, dispenseTxHash: disp.txHash };
    }

    // ── SUSCRIPCIÓN VIP ───────────────────────────────────────────────────
    case 'subscription':
    case 'vip_subscription': {
      const activated = await activateVIPPlan(wallet, meta.planId, txHash);
      if (!activated) throw new Error(`No se pudo activar el plan ${meta.planId}`);
      await _updatePaymentStatus(order.payment_intent_id, 'completed', txHash);
      return { planId: meta.planId, vip: true };
    }

    // ── FARMING ───────────────────────────────────────────────────────────
    case 'farming':
    case 'farming_deposit': {
      await recordFarmingDeposit({
        walletAddress: wallet, poolId: meta.poolId,
        amountBEZ: bezAmount, lockDays: meta.lockDays, txHash,
      });
      await _updatePaymentStatus(order.payment_intent_id, 'completed', txHash);
      return { poolId: meta.poolId, lockDays: meta.lockDays };
    }

    // ── ESCROW ────────────────────────────────────────────────────────────
    case 'escrow':
    case 'escrow_created': {
      await recordEscrow({
        walletAddress: wallet, clientWallet: meta.clientWallet,
        collateral: meta.collateral, quality: meta.quality, txHash,
      });
      await _updatePaymentStatus(order.payment_intent_id, 'completed', txHash);
      return { escrow: true };
    }

    default:
      throw new Error(`Tipo de orden no entregable: ${type}`);
  }
}

/** metadata puede venir como JSONB ya parseado o como texto. */
function _parseMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

// ─── HELPERS INTERNOS ─────────────────────────────────────────────────────────
function _getTokenAddress(token) {
  const MAP = { USDT: ADDRS.USDT_POLYGON, USDC: ADDRS.USDC_POLYGON, BEZ: ADDRS.BEZ_POLYGON };
  return MAP[token] || null;
}

/**
 * Traduce el tipo de flujo al enum `payment_type` de la BD.
 *
 * El enum sólo admite token_purchase | vip_subscription | nft_purchase |
 * donation | ad_credit (migración 002), mientras que BezPay maneja además
 * service, farming y escrow. Antes se insertaba `type.toLowerCase()` a pelo:
 * el INSERT fallaba con esos tres y con 'subscription', y el error se tragaba
 * en un catch. El tipo real se conserva en metadata.type, que es lo que lee
 * _deliverOrder para decidir qué entregar.
 */
const DB_PAYMENT_TYPE = {
  buy_bez:      'token_purchase',
  subscription: 'vip_subscription',
  nft_purchase: 'nft_purchase',
  service:      'token_purchase',
  farming:      'token_purchase',
  escrow:       'token_purchase',
};

function _dbTypeFor(type) {
  return DB_PAYMENT_TYPE[type] || 'token_purchase';
}

/** Red en la que se espera el cobro de cada token. */
function _chainIdFor(payToken) {
  if (payToken === 'ETH') return 1;
  if (payToken === 'BNB') return 56;
  return parseInt(process.env.BEZPAY_CHAIN_ID || '137', 10); // Polygon por defecto
}

function _networkNameFor(payToken) {
  if (payToken === 'ETH') return 'ethereum';
  if (payToken === 'BNB') return 'bsc';
  return 'polygon';
}

async function _updatePaymentStatus(paymentId, status, txHash, errorMsg, extra = {}) {
  if (!paymentId) return;
  try {
    const update = { status, txHash, updatedAt: new Date(), ...extra };
    if (status === 'completed') {
      update.completedAt = new Date();
      // Notify Ecosystem Bridge
      try {
        const ecosystem = bridge.bridgeCore.getAdapter('ecosystem');
        if (ecosystem) {
          const payment = await PaymentPG.findByPaymentIntent(paymentId);
          if (payment) ecosystem.notifyPayment({ ...payment, ...update });
        }
      } catch (_) { }
    }
    if (errorMsg) update.errorMessage = errorMsg;
    await PaymentPG.updateByPaymentIntent(paymentId, update).catch(() => {});
  } catch (_) { /* BD no disponible — ignorar */ }
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/payment/quote — Precio live para el frontend
// ═════════════════════════════════════════════════════════════════════════════
async function getQuote(req, res) {
  try {
    const { payToken = 'USDT', amountUSD = 100, type = 'buy_bez', planId, walletAddress } = req.query;
    const amounts = await calculatePaymentAmounts({
      payToken, amountUSD: parseFloat(amountUSD), type, planId, walletAddress,
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

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/payment/bank-transfer/confirm — Admin confirma una transferencia
// ─────────────────────────────────────────────────────────────────────────────
// La transferencia bancaria no tiene webhook: nadie nos avisa cuando el dinero
// entra. Este endpoint es la única puerta por la que un pago de este tipo pasa
// de 'pending' a liquidable — un humano mira el extracto, coteja el importe y
// el `refCode` (concepto de la transferencia) contra esta orden, y confirma.
//
// Reutiliza bezpayFiatSettlement.recordFiatPayment: la orden queda RETENIDA,
// no se entrega BEZ aquí. Con bank_transfer el plazo es 0h (holdHoursFor), así
// que el próximo barrido del liberador la entrega — ver server.js.
//
// `bankReference` es el dato que demuestra que alguien miró el extracto de
// verdad (no un booleano "confirmar"): se guarda como provider_reference, y su
// índice único impide acreditar el mismo movimiento bancario dos veces aunque
// se pulse "confirmar" repetidamente.
// ═════════════════════════════════════════════════════════════════════════════
async function confirmBankTransfer(req, res) {
  try {
    const { paymentId, bankReference } = req.body || {};
    if (!paymentId || !bankReference) {
      return res.status(400).json({
        success: false,
        message: 'paymentId y bankReference son obligatorios',
      });
    }

    const order = await PaymentPG.findByPaymentIntent(paymentId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    const meta = _parseMetadata(order.metadata);
    const payToken = meta?.settlement?.payToken;
    if (!['USD', 'EUR'].includes(payToken)) {
      // Esta orden no es de transferencia fiat (es cripto, o no lleva
      // términos de liquidación) — confirmarla aquí no significa nada.
      return res.status(409).json({
        success: false,
        message: `Orden no es de transferencia bancaria (payToken=${payToken || 'desconocido'})`,
      });
    }

    const fiatSettlement = require('./bezpayFiatSettlement');
    const result = await fiatSettlement.recordFiatPayment({
      paymentId, providerReference: bankReference, methodKind: 'bank_transfer',
    });

    if (result.duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Esa referencia bancaria ya acreditó otra orden',
      });
    }

    logger.info({ paymentId, bankReference, admin: req.headers?.['x-admin-user'] || 'unknown' },
      '🏦 [BezPay] Transferencia confirmada manualmente');

    return res.json({
      success: true,
      paymentId,
      held: result.held,
      alreadyHeld: result.alreadyHeld || false,
      // bank_transfer tiene 0h de retención: queda lista para el próximo
      // barrido del liberador, no para "ahora mismo" (ver SWEEP_INTERVAL_MS).
      message: result.held
        ? 'Transferencia registrada — se liquidará en el próximo barrido'
        : 'La orden ya estaba retenida o liquidada',
    });
  } catch (err) {
    logger.error({ err: err.message }, '[BezPay] confirmBankTransfer error');
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/payment/bank-transfer/confirm-batch — Un wire, varias facturas
// ─────────────────────────────────────────────────────────────────────────────
// confirmBankTransfer exige una transferencia por factura. Una tesorería que
// paga varios contenedores en un solo wire no encajaba en ese modelo. Aquí:
// un admin da la referencia del wire, cuánto llegó realmente, y la lista de
// paymentId que ese wire cubre.
//
// Salvaguarda real, no decorativa: si la suma de lo que esas órdenes esperan
// cobrar supera lo que de verdad llegó, se rechaza el lote entero — sin eso,
// este endpoint permitiría reclamar como pagadas más facturas de las que un
// solo wire cubre.
//
// provider_reference tiene un índice único por ORDEN (migración 018), así
// que un mismo wire no puede reutilizarse tal cual en varias filas — se
// deriva `${bankReference}#${paymentId}` por orden: único por fila, pero
// trazable al mismo movimiento bancario real en auditoría.
// ═════════════════════════════════════════════════════════════════════════════
async function confirmBankTransferBatch(req, res) {
  try {
    const { bankReference, totalAmountReceived, paymentIds } = req.body || {};
    if (!bankReference || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'bankReference y paymentIds (array no vacío) son obligatorios',
      });
    }
    if (typeof totalAmountReceived !== 'number' || !(totalAmountReceived > 0)) {
      return res.status(400).json({ success: false, message: 'totalAmountReceived debe ser un número positivo' });
    }

    // 1. Cargar y validar cada orden ANTES de tocar nada — todo o nada.
    const orders = [];
    for (const paymentId of paymentIds) {
      const order = await PaymentPG.findByPaymentIntent(paymentId);
      if (!order) {
        return res.status(404).json({ success: false, message: `Orden no encontrada: ${paymentId}` });
      }
      const meta = _parseMetadata(order.metadata);
      const payToken = meta?.settlement?.payToken;
      if (!['USD', 'EUR'].includes(payToken)) {
        return res.status(409).json({
          success: false,
          message: `${paymentId} no es una orden de transferencia bancaria (payToken=${payToken || 'desconocido'})`,
        });
      }
      orders.push({ paymentId, expectedAmount: Number(order.fiat_amount) });
    }

    // 2. La suma no puede superar lo recibido. Tolerancia mínima (1 céntimo)
    // sólo para redondeos de coma flotante, no para "casi cuadra".
    const totalExpected = orders.reduce((sum, o) => sum + o.expectedAmount, 0);
    if (totalExpected > totalAmountReceived + 0.01) {
      return res.status(409).json({
        success: false,
        message: `La suma de las órdenes (${totalExpected.toFixed(2)}) supera lo recibido (${totalAmountReceived.toFixed(2)}) — lote rechazado`,
        totalExpected, totalAmountReceived,
      });
    }

    // 3. Ahora sí, confirmar cada orden — cada una con su propia referencia
    // derivada, trazable al mismo wire.
    const fiatSettlement = require('./bezpayFiatSettlement');
    const results = [];
    for (const { paymentId, expectedAmount } of orders) {
      try {
        const r = await fiatSettlement.recordFiatPayment({
          paymentId, providerReference: `${bankReference}#${paymentId}`, methodKind: 'bank_transfer',
        });
        results.push({ paymentId, expectedAmount, ...r });
      } catch (err) {
        results.push({ paymentId, expectedAmount, held: false, error: err.message });
      }
    }

    logger.info({ bankReference, totalAmountReceived, totalExpected, count: orders.length },
      '🏦 [BezPay] Transferencia por lote confirmada');

    return res.json({
      success: true,
      bankReference,
      totalAmountReceived,
      totalExpected,
      remainder: Number((totalAmountReceived - totalExpected).toFixed(2)),
      results,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[BezPay] confirmBankTransferBatch error');
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN: gestión de tarifas negociadas por wallet
// ─────────────────────────────────────────────────────────────────────────────
// PUT    /api/payment/fee-override/:wallet   { feeRate, note }
// DELETE /api/payment/fee-override/:wallet
// GET    /api/payment/fee-override
// Autenticación: la aplica la ruta (mismo patrón requireAdmin que hot-wallet/status).
// ═════════════════════════════════════════════════════════════════════════════
async function setFeeOverride(req, res) {
  try {
    const wallet = req.params.wallet;
    const { feeRate, note } = req.body || {};
    if (!wallet) return res.status(400).json({ success: false, message: 'wallet requerida' });
    if (typeof feeRate !== 'number' || !(feeRate >= 0) || feeRate > 0.05) {
      return res.status(400).json({ success: false, message: 'feeRate debe ser un número entre 0 y 0.05' });
    }
    const row = await FeeOverride.setFeeRate(wallet, feeRate, {
      note, createdBy: req.headers?.['x-admin-user'] || 'unknown',
    });
    logger.info({ wallet, feeRate }, '[BezPay] Tarifa negociada actualizada');
    return res.json({ success: true, override: row });
  } catch (err) {
    logger.error({ err: err.message }, '[BezPay] setFeeOverride error');
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function removeFeeOverride(req, res) {
  try {
    const wallet = req.params.wallet;
    const removed = await FeeOverride.removeFeeRate(wallet);
    return res.json({ success: true, removed });
  } catch (err) {
    logger.error({ err: err.message }, '[BezPay] removeFeeOverride error');
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listFeeOverrides(req, res) {
  try {
    const overrides = await FeeOverride.listAll();
    return res.json({ success: true, overrides });
  } catch (err) {
    logger.error({ err: err.message }, '[BezPay] listFeeOverrides error');
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  createPayment,
  handleWebhook,
  handleActivityEvent,
  confirmBankTransfer,
  confirmBankTransferBatch,
  getQuote,
  getHotWalletStatus,
  getBezPriceUSD,
  getBezPriceEUR,
  setFeeOverride,
  removeFeeOverride,
  listFeeOverrides,
  calculatePaymentAmounts,
  // Dispensador compartido: la vía fiat (bezpayFiatSettlement) entrega por
  // aquí para que exista un único punto de salida del hot wallet.
  dispense: _dispense,
  __setDispenser,
  VIP_PLANS,
  BEZ_ADDR: ADDRS.BEZ_POLYGON,
  TREASURY_ADDR: ADDRS.TREASURY,
};
