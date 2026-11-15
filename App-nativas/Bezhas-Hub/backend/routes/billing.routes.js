const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const AdBalance = require('../models/pg/AdBalance');
const BillingTransaction = require('../models/pg/BillingTransaction');
const { verifyBezDeposit } = require('../services/bezDepositVerifier');
const { creditBezDeposit } = require('../services/adTopup.service');
const priceOracleService = require('../services/price-oracle.service');
const { protect: authMiddleware } = require('../middleware/auth.middleware');

// Obtener o crear Stripe client
async function getStripeClient() {
    const stripeKey = process.env.STRIPE_SECRET_KEY || require('../config.json').payments?.stripe?.secretKey;
    if (!stripeKey) {
        throw new Error('Stripe not configured');
    }
    return require('stripe')(stripeKey);
}

/** El saldo publicitario va ligado a una wallet (ad_balances.wallet_address NOT NULL). */
const walletDe = (req) => req.user.walletAddress || req.user.wallet_address || null;
const sinWallet = (res) => res.status(409).json({ success: false, error: 'Vincula una wallet para usar el saldo publicitario', code: 'WALLET_REQUIRED' });

/**
 * POST /api/billing/add-fiat-funds
 * Iniciar sesión de pago Stripe para recargar saldo. El saldo NO se acredita aquí: lo hace el webhook de Stripe
 * (payment_intent.succeeded), una sola vez por PaymentIntent.
 */
router.post('/add-fiat-funds',
    authMiddleware,
    [
        body('amount').isFloat({ min: 10, max: 10000 }).withMessage('Monto debe estar entre 10 y 10,000 EUR')
    ],
    async (req, res) => {
        let transaction = null;
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }
            const walletAddress = walletDe(req);
            if (!walletAddress) return sinWallet(res);

            const amount = Math.round(Number(req.body.amount) * 100) / 100;

            // Crear transacción pendiente
            const fila = await BillingTransaction.create({
                userId: req.user._id,
                walletAddress,
                type: 'deposit_fiat',
                amount,
                currency: 'EUR',
                status: 'pending',
                paymentMethod: 'stripe',
                description: `Recarga de saldo publicitario - €${amount}`
            });
            transaction = BillingTransaction.hydrate(fila);

            // Crear Payment Intent de Stripe
            const stripe = await getStripeClient();
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Stripe usa centavos
                currency: 'eur',
                metadata: {
                    userId: String(req.user._id),
                    walletAddress,
                    transactionId: String(transaction.id),
                    purpose: 'ad_balance_topup'
                }
            });

            await BillingTransaction.attachStripeIntent(transaction.id, paymentIntent.id);

            res.json({
                success: true,
                clientSecret: paymentIntent.client_secret,
                transactionId: transaction.id,
                amount,
                message: 'Payment Intent creado exitosamente'
            });

        } catch (error) {
            // Si Stripe falló, la recarga pendiente no puede completarse nunca: se cierra en vez de dejarla huérfana.
            if (transaction) await BillingTransaction.markFailed(transaction.id, error.message).catch(() => {});
            console.error('Error creating payment intent:', error);
            res.status(500).json({
                success: false,
                error: 'Error al procesar el pago',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/billing/add-bez-funds
 * Acreditar saldo pagado con BEZ-Coin. SÓLO se acredita lo que la cadena demuestra (ver services/bezDepositVerifier.js):
 * el importe que envíe el cliente no cuenta. Un mismo hash no se puede acreditar dos veces.
 */
router.post('/add-bez-funds',
    authMiddleware,
    [
        body('txHash').trim().matches(/^0x[0-9a-fA-F]{64}$/).withMessage('Hash de transacción inválido')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }
            const walletAddress = walletDe(req);
            if (!walletAddress) return sinWallet(res);

            const { txHash } = req.body;

            const verificacion = await verifyBezDeposit({ txHash, fromWallet: walletAddress });
            if (!verificacion.ok) {
                const estado = verificacion.code === 'NOT_CONFIGURED' ? 503 : verificacion.code === 'RPC_ERROR' ? 502 : 400;
                return res.status(estado).json({ success: false, error: verificacion.error, code: verificacion.code });
            }
            if (verificacion.amountBez < 100) {
                return res.status(400).json({ success: false, error: 'Monto mínimo: 100 BEZ', code: 'BELOW_MINIMUM' });
            }

            // Convertir BEZ a EUR usando el oráculo
            const bezEurPrice = await priceOracleService.getBezEurPrice();

            const abono = await creditBezDeposit({
                userId: req.user._id, walletAddress, txHash, amountBez: verificacion.amountBez, bezEurPrice
            });
            if (!abono.credited) {
                return res.status(409).json({ success: false, error: 'Esa transacción ya fue acreditada', code: abono.reason });
            }
            const { transaction, balance, eurEquivalent } = abono;

            res.json({
                success: true,
                message: 'Saldo acreditado exitosamente',
                transaction: {
                    id: transaction.id,
                    amount: verificacion.amountBez,
                    eurEquivalent: eurEquivalent.toFixed(2),
                    txHash
                },
                newBalance: {
                    bez: balance.bezBalance,
                    fiat: balance.fiatBalance,
                    totalInEur: AdBalance.availableEur(balance, bezEurPrice).toFixed(2)
                }
            });

        } catch (error) {
            console.error('Error adding BEZ funds:', error);
            res.status(500).json({
                success: false,
                error: 'Error al acreditar fondos',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/billing/balance
 * Obtener saldo actual del usuario
 */
router.get('/balance',
    authMiddleware,
    async (req, res) => {
        try {
            const walletAddress = walletDe(req);
            if (!walletAddress) return sinWallet(res);
            const balance = await AdBalance.ensure(req.user._id, walletAddress);

            // Obtener precio BEZ/EUR para conversiones
            const bezEurPrice = await priceOracleService.getBezEurPrice();

            res.json({
                success: true,
                data: {
                    fiat: {
                        amount: balance.fiatBalance,
                        currency: 'EUR'
                    },
                    bez: {
                        amount: balance.bezBalance,
                        eurEquivalent: (balance.bezBalance * bezEurPrice).toFixed(2)
                    },
                    totalInEur: AdBalance.availableEur(balance, bezEurPrice).toFixed(2),
                    totalDeposited: balance.totalDeposited,
                    totalSpent: balance.totalSpent,
                    totalRefunded: balance.totalRefunded,
                    pendingCharges: balance.pendingCharges,
                    priceInfo: {
                        bezEurPrice,
                        lastUpdated: new Date()
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching balance:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener saldo',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/billing/history
 * Obtener historial de transacciones
 */
router.get('/history',
    authMiddleware,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('type').optional().isIn(['deposit_fiat', 'deposit_bez', 'campaign_charge', 'daily_charge', 'refund', 'adjustment'])
    ],
    async (req, res) => {
        try {
            const { page = 1, limit = 20, type } = req.query;

            const { transactions, total } = await BillingTransaction.history(
                { userId: req.user._id, walletAddress: walletDe(req) }, { type, page, limit });

            res.json({
                success: true,
                data: transactions,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching transaction history:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener historial',
                details: error.message
            });
        }
    }
);

// NOTE: Webhook endpoint has been moved to stripe-webhook.routes.js
// which is mounted BEFORE express.json() in server.js for correct raw body handling.

module.exports = router;
