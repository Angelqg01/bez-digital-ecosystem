'use strict';

/**
 * services/bezPayOrders.js — órdenes de cobro de BEZ-Pay.
 *
 * Una orden es un intento de pago PENDIENTE: dice cuánto, por qué carril
 * (tarjeta, transferencia SEPA o BEZ on-chain) y a qué wallet van los BEZ, y
 * devuelve el enlace de checkout donde paga el cliente. Crearla no cobra ni
 * mueve nada: el dinero entra cuando el cliente paga y la liquidación
 * (`paymentSettlement`) lo casa.
 *
 * Vive aquí, y no dentro de la ruta, porque la usan dos superficies:
 * POST /api/gateway/v1/payments/buy y la herramienta MCP
 * `bezhas_checkout_prepare`. Con dos copias, una acabaría saltándose el
 * límite KYC o la idempotencia que tiene la otra.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const { precioUsd } = require('../config/bez-price');
const { getStripePaymentLink } = require('../config/stripe-payment-links');
const { BANK_TRANSFER_DETAILS, buildBankTransferInstructions } = require('../config/bank-transfer-details');
const { TOKENOMICS_FEE, calculateFeeBreakdown } = require('../config/tokenomics');
const complianceGate = require('./complianceGate');
const { TREASURY: SETTLEMENT_TREASURY } = require('./bezSettlementWatcher');

const PLATFORM_FEE_BPS = TOKENOMICS_FEE.platformFeeBps;
const METODOS = Object.freeze(['card', 'crypto', 'qr', 'bank']);
const IDEMPOTENCIA_RE = /^[A-Za-z0-9_-]{8,80}$/;

class BezPayError extends Error {
    constructor(message, code, status = 400, detalles) {
        super(message);
        this.name = 'BezPayError';
        this.code = code;
        this.status = status;
        this.detalles = detalles;
    }
}

function siguienteAccion({ stripeLink, bankTransfer, onchain }) {
    if (stripeLink) return 'redirect_to_checkout';
    if (bankTransfer) return 'display_bank_transfer_instructions';
    if (onchain) return 'transfer_bez_to_treasury';
    return 'await_payment_confirmation';
}

/**
 * Rehace la respuesta desde la fila guardada: un reintento con la misma
 * clave de idempotencia devuelve LA MISMA orden, nunca un duplicado.
 */
function respuestaRepeticion(row) {
    let meta = {};
    try { meta = JSON.parse(row.note) || {}; } catch (_) { /* note puede ser null */ }
    const stripeLink = meta.provider === 'stripe_payment_link'
        ? getStripePaymentLink(meta.stripeUseCase || 'token_purchase')
        : null;
    const bankTransfer = meta.provider === 'bank_transfer';
    return {
        success: true,
        idempotent: true,
        paymentId: row.id,
        status: row.status,
        provider: meta.provider || row.payment_method,
        checkoutUrl: stripeLink?.url,
        bankTransfer: bankTransfer ? buildBankTransferInstructions(`BEZ-${row.id}`) : undefined,
        walletAddress: row.wallet_address,
        amountUSD: parseFloat(row.amount_usd),
        platformFeeUSD: parseFloat(row.platform_fee_usd),
        platformFeeBps: PLATFORM_FEE_BPS,
        stripeUseCase: stripeLink?.id,
        stripeLabel: stripeLink?.label,
        nextAction: stripeLink
            ? 'redirect_to_checkout'
            : bankTransfer
                ? 'display_bank_transfer_instructions'
                : 'await_payment_confirmation',
    };
}

async function buscarPorIdempotencia(idempotencyKey) {
    const { rows } = await query(
        `SELECT id, status, wallet_address, amount_usd, platform_fee_usd, payment_method, note, created_at
         FROM payment_transactions WHERE idempotency_key = $1 AND type = 'buy'`,
        [idempotencyKey]
    );
    return rows[0] || null;
}

/**
 * Crea la orden. Devuelve el cuerpo de respuesta de /payments/buy.
 *
 * @throws {BezPayError} KYC_REQUIRED (403), IDEMPOTENCY_KEY_REUSED (409),
 *         INVALID_IDEMPOTENCY_KEY o INVALID_METHOD (400).
 */
async function crearOrden({ appId = null, walletAddress, amountUSD, paymentMethod, stripeUseCase, email, idempotencyKey = null }) {
    if (!METODOS.includes(paymentMethod)) {
        throw new BezPayError(`Método de pago no admitido. Admitidos: ${METODOS.join(', ')}.`, 'INVALID_METHOD');
    }
    if (idempotencyKey && !IDEMPOTENCIA_RE.test(idempotencyKey)) {
        throw new BezPayError('Idempotency-Key must be 8-80 chars [A-Za-z0-9_-]', 'INVALID_IDEMPOTENCY_KEY');
    }

    if (idempotencyKey) {
        const existente = await buscarPorIdempotencia(idempotencyKey);
        if (existente) {
            if (existente.wallet_address?.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new BezPayError('Idempotency-Key already used for a different wallet', 'IDEMPOTENCY_KEY_REUSED', 409);
            }
            return respuestaRepeticion(existente);
        }
    }

    // Gate KYC/MiCA: el volumen acumulado 12m de la wallet limita la compra.
    const kyc = await complianceGate.checkBuyAllowed(walletAddress, parseFloat(amountUSD));
    if (!kyc.allowed) {
        throw new BezPayError(
            `Cumulative purchase limit reached for KYC level ${kyc.level} (${kyc.limitUSD} USD / 12 months)`,
            'KYC_REQUIRED', 403,
            { kycLevel: kyc.level, requiredLevel: kyc.requiredLevel, limitUSD: kyc.limitUSD, usedUSD: kyc.usedUSD },
        );
    }

    const feeBreakdown = calculateFeeBreakdown(amountUSD);
    const platformFeeUSD = feeBreakdown.platformFeeUSD;
    const grossAmountUSD = feeBreakdown.grossAmountUSD;

    const stripeLink = paymentMethod === 'card'
        ? getStripePaymentLink(stripeUseCase || 'token_purchase')
        : null;
    const bankTransfer = paymentMethod === 'bank';
    const onchain = paymentMethod === 'crypto' || paymentMethod === 'qr';

    // Carril on-chain: se cotiza el BEZ esperado para que el cliente sepa qué
    // transferir y el vigilante de liquidación lo case después.
    let onchainInstructions = null;
    if (onchain) {
        const price = await query(
            "SELECT price_usd FROM token_price_cache WHERE symbol = 'BEZ' LIMIT 1"
        ).catch(() => ({ rows: [] }));
        const priceUSD = parseFloat(price.rows[0]?.price_usd || String(precioUsd()));
        onchainInstructions = {
            provider: 'onchain',
            token: 'BEZ',
            treasury: SETTLEMENT_TREASURY,
            priceUSD,
            expectedBez: priceUSD > 0 ? Math.round((parseFloat(amountUSD) / priceUSD) * 1e6) / 1e6 : null,
            sendFrom: walletAddress,
            note: 'Transfer the BEZ from your order wallet — the watcher matches sender + amount.',
        };
    }

    const comunes = { platformFeeBps: PLATFORM_FEE_BPS, platformFeeUSD, grossAmountUSD, tokenomics: feeBreakdown.allocations };
    let note = null;
    if (stripeLink) {
        note = JSON.stringify({
            provider: 'stripe_payment_link', stripeUseCase: stripeLink.id, stripeLabel: stripeLink.label,
            email: email || null, ...comunes,
        });
    } else if (bankTransfer) {
        note = JSON.stringify({
            provider: 'bank_transfer', paymentRail: BANK_TRANSFER_DETAILS.paymentRail,
            beneficiaryAlias: BANK_TRANSFER_DETAILS.beneficiaryAlias, iban: BANK_TRANSFER_DETAILS.iban,
            bic: BANK_TRANSFER_DETAILS.bic, ...comunes,
        });
    } else if (onchain) {
        note = JSON.stringify({ ...onchainInstructions, ...comunes });
    }

    // TTL del intent: on-chain corto (el vigilante deja de casar órdenes
    // rancias contra transferencias nuevas); tarjeta/banco más holgado.
    const ttlHours = onchain
        ? parseInt(process.env.ONCHAIN_ORDER_TTL_HOURS || '24', 10)
        : parseInt(process.env.FIAT_ORDER_TTL_HOURS || '168', 10);

    // Token portador del checkout alojado: quien tenga la URL ve el estado de
    // ESTA orden (y sólo esta) sin api-key.
    const checkoutToken = crypto.randomBytes(16).toString('hex');

    const result = await query(
        `INSERT INTO payment_transactions (wallet_address, primary_wallet_address, amount_usd,
                                           platform_fee_usd, payment_method, type, status, note, idempotency_key, app_id, expires_at, checkout_token)
         VALUES ($1, $1, $2, $3, $4, 'buy', 'pending', $5, $6, $7, NOW() + ($8 || ' hours')::interval, $9)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING id, status, created_at, expires_at, checkout_token`,
        [walletAddress, grossAmountUSD, platformFeeUSD, paymentMethod, note, idempotencyKey, appId, String(ttlHours), checkoutToken]
    );

    // Carrera perdida: otra petición con la misma clave insertó primero → repetición.
    if (result.rows.length === 0 && idempotencyKey) {
        const ganadora = await buscarPorIdempotencia(idempotencyKey);
        if (ganadora) return respuestaRepeticion(ganadora);
        throw new BezPayError('Payment processing failed', 'RACE_LOST', 500);
    }

    const fila = result.rows[0];
    return {
        success: true,
        paymentId: fila.id,
        status: 'pending',
        provider: stripeLink ? 'stripe_payment_link' : bankTransfer ? 'bank_transfer' : paymentMethod,
        checkoutUrl: stripeLink?.url,
        bankTransfer: bankTransfer ? buildBankTransferInstructions(`BEZ-${fila.id}`) : undefined,
        onchain: onchainInstructions || undefined,
        walletAddress,
        amountUSD: grossAmountUSD,
        netAmountUSD: parseFloat(amountUSD),
        platformFeeUSD,
        platformFeeBps: PLATFORM_FEE_BPS,
        tokenomics: feeBreakdown.allocations,
        stripeUseCase: stripeLink?.id,
        stripeLabel: stripeLink?.label,
        expiresAt: fila.expires_at,
        hostedCheckoutUrl: `${process.env.PUBLIC_PAY_BASE_URL || ''}/c/${fila.checkout_token}`,
        nextAction: siguienteAccion({ stripeLink, bankTransfer, onchain }),
    };
}

/**
 * Una orden, sólo si la ve quien pregunta: la app que la creó, la wallet
 * dueña (sesión JWT) o una clave admin. Para cualquier otro es indistinguible
 * de una que no existe.
 */
async function obtenerOrden({ id, appId = null, esAdmin = false, walletUsuario = null }) {
    const { rows } = await query(
        `SELECT id, wallet_address, amount_usd, amount_bez, platform_fee_usd, payment_method,
                type, status, note, tx_hash, app_id, expires_at, created_at, updated_at
         FROM payment_transactions WHERE id = $1 AND type = 'buy' LIMIT 1`,
        [parseInt(id, 10)]
    );
    if (rows.length === 0) return null;
    const order = rows[0];
    const esSuyaComoApp = appId && order.app_id === appId;
    const wallet = walletUsuario?.toLowerCase();
    const esSuyaComoWallet = wallet && order.wallet_address?.toLowerCase() === wallet;
    if (!esAdmin && !esSuyaComoApp && !esSuyaComoWallet) return null;

    let meta = {};
    try { meta = order.note ? JSON.parse(order.note) : {}; } catch { meta = {}; }
    return {
        paymentId: order.id,
        status: order.status,
        walletAddress: order.wallet_address,
        amountUSD: parseFloat(order.amount_usd || '0'),
        amountBEZ: order.amount_bez,
        platformFeeUSD: parseFloat(order.platform_fee_usd || '0'),
        paymentMethod: order.payment_method,
        provider: meta.provider || order.payment_method,
        txHash: order.tx_hash,
        settlement: meta.settlement || null,
        onchain: meta.provider === 'onchain'
            ? { treasury: meta.treasury, expectedBez: meta.expectedBez, token: meta.token }
            : undefined,
        expiresAt: order.expires_at,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
    };
}

module.exports = { crearOrden, obtenerOrden, respuestaRepeticion, BezPayError, METODOS, PLATFORM_FEE_BPS };
