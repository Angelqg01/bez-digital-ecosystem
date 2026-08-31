const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const AdBalance = require('../models/adBalance.model');
const BillingTransaction = require('../models/billingTransaction.model');
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

/**
 * POST /api/billing/add-fiat-funds
 * Iniciar sesión de pago Stripe para recargar saldo
 */
router.post('/add-fiat-funds',
    authMiddleware,
    [
        body('amount').isFloat({ min: 10, max: 10000 }).withMessage('Monto debe estar entre 10 y 10,000 EUR')
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

            const { amount } = req.body;

            // Crear transacción pendiente
            const transaction = new BillingTransaction({
                userId: req.user._id,
                walletAddress: req.user.walletAddress,
                type: 'deposit_fiat',
                amount,
                currency: 'EUR',
                status: 'pending',
                paymentMethod: 'stripe',
                description: `Recarga de saldo publicitario - €${amount}`
            });

            await transaction.save();

            // Crear Payment Intent de Stripe
            const stripe = await getStripeClient();
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Stripe usa centavos
                currency: 'eur',
                metadata: {
                    userId: req.user._id.toString(),
                    walletAddress: req.user.walletAddress,
                    transactionId: transaction._id.toString(),
                    purpose: 'ad_balance_topup'
                }
            });

            transaction.stripePaymentIntentId = paymentIntent.id;
            await transaction.save();

            res.json({
                success: true,
                clientSecret: paymentIntent.client_secret,
                transactionId: transaction._id,
                amount,
                message: 'Payment Intent creado exitosamente'
            });

        } catch (error) {
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
 * Acreditar saldo pagado con BEZ-Coin
 */
router.post('/add-bez-funds',
    authMiddleware,
    [
        body('amount').isFloat({ min: 100 }).withMessage('Monto mínimo: 100 BEZ'),
        body('txHash').trim().notEmpty().withMessage('Hash de transacción requerido')
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

            const { amount, txHash } = req.body;

            // TODO: Verificar la transacción en blockchain
            // const web3Service = require('../services/web3.service');
            // const isValid = await web3Service.verifyTransaction(txHash, req.user.walletAddress, amount);
            // if (!isValid) {
            //   return res.status(400).json({ error: 'Transacción inválida' });
            // }

            // Convertir BEZ a EUR usando el oráculo
            const bezEurPrice = await priceOracleService.getBezEurPrice();
            const eurEquivalent = amount * bezEurPrice;

            // Crear transacción
            const transaction = new BillingTransaction({
                userId: req.user._id,
                walletAddress: req.user.walletAddress,
                type: 'deposit_bez',
                amount,
                currency: 'BEZ',
                status: 'completed',
                paymentMethod: 'bez-coin',
                blockchainTxHash: txHash,
                description: `Recarga con BEZ-Coin - ${amount} BEZ (≈€${eurEquivalent.toFixed(2)})`,
                metadata: {
                    eurEquivalent,
                    bezEurPrice
                },
                processedAt: new Date()
            });

            await transaction.save();

            // Actualizar balance
            let balance = await AdBalance.findOne({
                $or: [
                    { userId: req.user._id },
                    { walletAddress: req.user.walletAddress }
                ]
            });

            if (!balance) {
                balance = new AdBalance({
                    userId: req.user._id,
                    walletAddress: req.user.walletAddress
                });
            }

            balance.bezBalance += amount;
            balance.totalDeposited += eurEquivalent;
            balance.lastDepositAt = new Date();
            balance.updatedAt = new Date();
            await balance.save();

            res.json({
                success: true,
                message: 'Saldo acreditado exitosamente',
                transaction: {
                    id: transaction._id,
                    amount,
                    eurEquivalent: eurEquivalent.toFixed(2),
                    txHash
                },
                newBalance: {
                    bez: balance.bezBalance,
                    fiat: balance.fiatBalance,
                    totalInEur: (balance.fiatBalance + (balance.bezBalance * bezEurPrice)).toFixed(2)
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
            let balance = await AdBalance.findOne({
                $or: [
                    { userId: req.user._id },
                    { walletAddress: req.user.walletAddress }
                ]
            });

            if (!balance) {
                balance = new AdBalance({
                    userId: req.user._id,
                    walletAddress: req.user.walletAddress
                });
                await balance.save();
            }

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
                    totalInEur: (balance.fiatBalance + (balance.bezBalance * bezEurPrice)).toFixed(2),
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

            // Fallback: devolver balance vacío si MongoDB no está disponible
            if (error.message && (error.message.includes('buffering timed out') || error.message.includes('connect'))) {
                return res.json({
                    success: true,
                    data: {
                        fiat: { amount: 0, currency: 'EUR' },
                        bez: { amount: 0, eurEquivalent: '0.00' },
                        totalInEur: '0.00',
                        totalDeposited: 0,
                        totalSpent: 0,
                        totalRefunded: 0,
                        pendingCharges: 0,
                        priceInfo: { bezEurPrice: 0.10, lastUpdated: new Date() }
                    },
                    warning: 'Base de datos no disponible - mostrando balance vacío'
                });
            }

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

            const filter = {
                $or: [
                    { userId: req.user._id },
                    { walletAddress: req.user.walletAddress }
                ]
            };
            if (type) filter.type = type;

            const transactions = await BillingTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('campaignId', 'name')
                .lean();

            const total = await BillingTransaction.countDocuments(filter);

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
