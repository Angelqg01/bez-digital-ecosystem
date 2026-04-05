const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const Payment = require('../models/Payment.model');
const { getBezPriceInEur } = require('../services/fiat-gateway.service');
const { distributeTokens, calculateDistribution, getDistributionStats } = require('../services/token-distribution.service');
const tokenomics = require('../config/tokenomics.config');

// ============================================================
// BULLMQ RETRY QUEUE FOR TOKEN DISTRIBUTION
// ============================================================
// NOTE: BullMQ is OPTIONAL. If Redis is unavailable (e.g. Upstash limit exceeded),
// the server still starts and payments fallback to direct processing without retries.
let tokenDistributionQueue = null;
let paymentDLQ = null;
let tokenDistributionWorker = null;

const REDIS_URL = process.env.REDIS_URL;
const BULLMQ_FORCE_DISABLED = ['true', '1'].includes((process.env.DISABLE_BULLMQ || '').toLowerCase());
const BULLMQ_ENABLED = !!REDIS_URL && !BULLMQ_FORCE_DISABLED;

if (BULLMQ_ENABLED) {
    try {
        const { Queue, Worker } = require('bullmq');

        // Redis connection config (usa la misma conexión que el resto del backend)
        const redisConnection = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            retryStrategy: (times) => times > 3 ? null : Math.min(times * 500, 3000),
        };

        // Cola de distribución de tokens con reintentos
        tokenDistributionQueue = new Queue('token-distribution', {
            connection: redisConnection,
            defaultJobOptions: {
                attempts: tokenomics.paymentRetry.maxAttempts,
                backoff: {
                    type: tokenomics.paymentRetry.backoffType,
                    delay: tokenomics.paymentRetry.initialDelayMs
                },
                removeOnComplete: 100,
                removeOnFail: 50
            }
        });

        // Dead Letter Queue para pagos fallidos (sin reintentos)
        paymentDLQ = new Queue(tokenomics.paymentRetry.deadLetterQueue, {
            connection: redisConnection
        });

        /**
         * Worker para procesar distribución de tokens con BURN + TREASURY
         */
        tokenDistributionWorker = new Worker('token-distribution', async (job) => {
            const { walletAddress, bezAmount, paymentId, sessionId } = job.data;

            const distribution = calculateDistribution(bezAmount);

            logger.info({
                jobId: job.id,
                attempt: job.attemptsMade + 1,
                walletAddress,
                bezAmount,
                distribution: {
                    user: distribution.user.toFixed(4),
                    burn: distribution.burn.toFixed(4),
                    treasury: distribution.treasury.toFixed(4)
                },
                paymentId
            }, '🔄 Processing token distribution job with burn + treasury');

            try {
                const txResult = await distributeTokens(walletAddress, bezAmount);

                const payment = await Payment.findOne({
                    $or: [
                        { _id: paymentId },
                        { sessionId: sessionId }
                    ]
                });

                if (payment) {
                    payment.distribution = {
                        userAmount: txResult.distribution.user,
                        burnAmount: txResult.distribution.burn,
                        treasuryAmount: txResult.distribution.treasury,
                        userTxHash: txResult.transactions.user?.txHash,
                        burnTxHash: txResult.transactions.burn?.txHash,
                        treasuryTxHash: txResult.transactions.treasury?.txHash
                    };
                    payment.status = 'completed';
                    payment.completedAt = new Date();
                    await payment.save();
                }

                logger.info({
                    jobId: job.id,
                    walletAddress,
                    userReceived: txResult.distribution.user,
                    burned: txResult.distribution.burn,
                    treasury: txResult.distribution.treasury,
                }, '🎉 Token distribution completed with burn + treasury');

                return txResult;

            } catch (error) {
                logger.error({
                    jobId: job.id,
                    attempt: job.attemptsMade + 1,
                    maxAttempts: tokenomics.paymentRetry.maxAttempts,
                    error: error.message,
                    walletAddress,
                    bezAmount
                }, '❌ Token distribution failed');

                throw error; // BullMQ reintentará automáticamente
            }
        }, { connection: redisConnection });

        // Event handlers para el worker
        tokenDistributionWorker.on('completed', (job, result) => {
            logger.info({ jobId: job.id, txHash: result?.txHash }, 'Token distribution job completed');
        });

        tokenDistributionWorker.on('failed', async (job, error) => {
            if (job.attemptsMade >= tokenomics.paymentRetry.maxAttempts) {
                logger.error({
                    jobId: job.id,
                    attempts: job.attemptsMade,
                    error: error.message
                }, 'Token distribution permanently failed - moving to DLQ');

                await paymentDLQ.add('failed-distribution', {
                    ...job.data,
                    error: error.message,
                    failedAt: new Date().toISOString(),
                    attempts: job.attemptsMade
                });

                try {
                    const payment = await Payment.findOne({
                        $or: [
                            { _id: job.data.paymentId },
                            { sessionId: job.data.sessionId }
                        ]
                    });

                    if (payment) {
                        await payment.markFailed(`Distribution failed after ${job.attemptsMade} attempts: ${error.message}`);
                    }
                } catch (dbError) {
                    logger.error({ dbError: dbError.message }, 'Failed to update payment record');
                }
            }
        });

        logger.info('✅ BullMQ token distribution queue initialized');
    } catch (bullmqError) {
        logger.warn({ error: bullmqError.message }, '⚠️ BullMQ disabled — running without retry queues');
    }
} else {
    logger.info('ℹ️ REDIS_URL not set — BullMQ disabled, token distribution runs without retry queue');
}

/**
 * NOTA: Sistema de pagos híbrido actualizado
 * 
 * BeZhas ahora soporta:
 * 1. Stripe (Tarjetas de crédito/débito) - ACTIVADO
 * 2. Transferencia bancaria directa (SEPA) - Ver /api/fiat/*
 * 3. Pagos con criptomonedas (USDC, MATIC, BTC, BEZ-Coin)
 * 
 * Stripe está completamente integrado para compras de tokens BEZ, suscripciones VIP, staking, DAO, etc.
 */

// Rutas legacy - Retornan error indicando migración al nuevo sistema
router.post('/create-validation-session', async (req, res) => {
    logger.warn('Attempted to use legacy Stripe payment route');
    return res.status(501).json({
        success: false,
        error: 'Payment system migrated',
        message: 'BeZhas ahora usa transferencia bancaria directa y pagos con crypto. Por favor usa /api/fiat/bank-details para obtener información de pago.'
    });
});

// NOTE: Webhook endpoint has been moved to stripe-webhook.routes.js
// which is mounted BEFORE express.json() in server.js for correct raw body handling.

/**
 * Handle successful checkout session completion
 * Utiliza BullMQ para reintentos automáticos de distribución de tokens
 */
async function handleCheckoutCompleted(session, stripe) {
    try {
        logger.info('Checkout completed:', {
            sessionId: session.id,
            paymentStatus: session.payment_status,
            metadata: session.metadata
        });

        // Only process if payment was successful
        if (session.payment_status !== 'paid') {
            logger.warn('Checkout completed but payment not confirmed:', session.id);
            return;
        }

        const { walletAddress, type = 'token_purchase', userId } = session.metadata || {};

        if (!walletAddress) {
            logger.error('No wallet address in session metadata:', session.id);
            return;
        }

        // Get payment intent details
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);

        // Create payment record with 'processing' status
        const payment = new Payment({
            paymentIntentId: paymentIntent.id,
            sessionId: session.id,
            stripeCustomerId: session.customer,
            userId: userId || null,
            walletAddress,
            email: session.customer_details?.email,
            type,
            status: 'processing',
            fiatAmount: session.amount_total / 100, // Convert from cents
            fiatCurrency: session.currency,
            metadata: session.metadata,
            paidAt: new Date()
        });

        // Calculate BEZ amount based on fiat amount using QuickSwap Oracle
        const bezPrice = await getBezPriceInEur();
        const exchangeRate = bezPrice;

        // Convert to EUR equivalent if needed
        const fiatInEur = payment.fiatCurrency === 'eur'
            ? payment.fiatAmount
            : payment.fiatAmount / tokenomics.fiat.eurUsdRate;

        const bezAmount = fiatInEur / bezPrice;

        payment.bezAmount = bezAmount;
        payment.exchangeRate = exchangeRate;

        await payment.save();

        // ============================================================
        // AGREGAR A COLA DE DISTRIBUCIÓN CON REINTENTOS
        // ============================================================
        logger.info(`Queueing token distribution: ${bezAmount} BEZ to ${walletAddress}`);

        await tokenDistributionQueue.add('distribute-tokens', {
            walletAddress,
            bezAmount,
            paymentId: payment._id.toString(),
            sessionId: session.id,
            paymentIntentId: paymentIntent.id,
            fiatAmount: payment.fiatAmount,
            fiatCurrency: payment.fiatCurrency,
            exchangeRate,
            queuedAt: new Date().toISOString()
        }, {
            jobId: `dist-${session.id}`, // Evita duplicados
            priority: 1 // Alta prioridad
        });

        logger.info('Token distribution queued successfully:', {
            paymentId: payment._id,
            sessionId: session.id,
            bezAmount,
            walletAddress
        });

    } catch (error) {
        logger.error('Error handling checkout completion:', error);

        // Try to update payment record if it exists
        try {
            const payment = await Payment.findOne({ sessionId: session.id });
            if (payment) {
                await payment.markFailed(error.message);
            }
        } catch (dbError) {
            logger.error('Error updating payment record:', dbError);
        }
    }
}

/**
 * Handle successful payment intent (for direct payment intents without checkout)
 * Utiliza BullMQ para reintentos automáticos
 */
async function handlePaymentSucceeded(paymentIntent) {
    try {
        logger.info('Payment intent succeeded:', {
            id: paymentIntent.id,
            amount: paymentIntent.amount,
            metadata: paymentIntent.metadata
        });

        // Check if already processed (via checkout session)
        const existingPayment = await Payment.findOne({ paymentIntentId: paymentIntent.id });
        if (existingPayment) {
            logger.info('Payment already processed via checkout session');
            return;
        }

        const { walletAddress, type = 'token_purchase', userId } = paymentIntent.metadata || {};

        if (!walletAddress) {
            logger.error('No wallet address in payment intent metadata:', paymentIntent.id);
            return;
        }

        // Create payment record
        const payment = new Payment({
            paymentIntentId: paymentIntent.id,
            userId: userId || null,
            walletAddress,
            type,
            status: 'processing',
            fiatAmount: paymentIntent.amount / 100,
            fiatCurrency: paymentIntent.currency,
            metadata: paymentIntent.metadata,
            paidAt: new Date()
        });

        // Calculate BEZ amount using QuickSwap Oracle
        const bezPrice = await getBezPriceInEur();
        const fiatInEur = payment.fiatCurrency === 'eur'
            ? payment.fiatAmount
            : payment.fiatAmount / tokenomics.fiat.eurUsdRate;

        const bezAmount = fiatInEur / bezPrice;

        payment.bezAmount = bezAmount;
        payment.exchangeRate = bezPrice;

        await payment.save();

        // Agregar a cola de distribución con reintentos
        await tokenDistributionQueue.add('distribute-tokens', {
            walletAddress,
            bezAmount,
            paymentId: payment._id.toString(),
            paymentIntentId: paymentIntent.id,
            fiatAmount: payment.fiatAmount,
            fiatCurrency: payment.fiatCurrency,
            exchangeRate: bezPrice,
            queuedAt: new Date().toISOString()
        }, {
            jobId: `dist-pi-${paymentIntent.id}`,
            priority: 1
        });

        logger.info('Payment queued for token distribution:', {
            paymentId: payment._id,
            paymentIntentId: paymentIntent.id,
            bezAmount
        });

    } catch (error) {
        logger.error('Error handling payment success:', error);

        try {
            const payment = await Payment.findOne({ paymentIntentId: paymentIntent.id });
            if (payment) {
                await payment.markFailed(error.message);
            }
        } catch (dbError) {
            logger.error('Error updating payment record:', dbError);
        }
    }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent) {
    try {
        logger.warn('Payment failed:', {
            id: paymentIntent.id,
            lastError: paymentIntent.last_payment_error
        });

        const payment = await Payment.findOne({ paymentIntentId: paymentIntent.id });

        if (payment) {
            const errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
            await payment.markFailed(errorMessage);
        }
    } catch (error) {
        logger.error('Error handling payment failure:', error);
    }
}

router.get('/session-status/:sessionId', async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);

        return res.json({
            success: true,
            status: session.payment_status,
            customer_email: session.customer_email,
            amount_total: session.amount_total / 100,
            metadata: session.metadata
        });
    } catch (error) {
        logger.error('Error retrieving session:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve session',
            message: error.message
        });
    }
});

router.post('/fiat-donate', async (req, res) => {
    logger.warn('Attempted to use legacy Stripe donation');
    return res.status(501).json({
        success: false,
        error: 'Donation system migrated',
        message: 'Las donaciones ahora se procesan con crypto directamente. Usa /api/posts/donate con crypto.'
    });
});

router.post('/stripe/create-payment-intent', async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const { amount, currency = 'usd', metadata } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency,
            metadata,
            automatic_payment_methods: { enabled: true }
        });

        logger.info('Stripe payment intent created', { paymentIntentId: paymentIntent.id });

        return res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        logger.error('Error creating Stripe payment intent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create payment intent',
            message: error.message
        });
    }
});

// --- Crear orden de Transferencia Bancaria para compra de BEZ Tokens ---
router.post('/bank-transfer/create-order', async (req, res) => {
    try {
        const { amountBez, userEmail, userWallet } = req.body;
        const PRICE_PER_TOKEN_USD = 0.10;

        if (!amountBez || amountBez <= 0) {
            return res.status(400).json({
                success: false,
                error: "Cantidad de tokens inválida"
            });
        }

        if (!userWallet) {
            return res.status(400).json({
                success: false,
                error: "Wallet del usuario requerida"
            });
        }

        // Calcular total a pagar
        const totalToPay = (amountBez * PRICE_PER_TOKEN_USD).toFixed(2);
        const referenceCode = `BEZ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

        // TODO: Guardar orden en base de datos
        // await Payment.create({
        //     walletAddress: userWallet,
        //     email: userEmail,
        //     type: 'BANK_TRANSFER',
        //     status: 'pending',
        //     bezAmount: amountBez,
        //     fiatAmount: totalToPay,
        //     fiatCurrency: 'USD',
        //     reference: referenceCode,
        //     metadata: { paymentMethod: 'bank_transfer' }
        // });

        // Devolver datos bancarios
        const bankDetails = {
            bankName: process.env.BANK_NAME || "Banco Nacional de Panamá",
            accountHolder: process.env.BANK_ACCOUNT_HOLDER || "BeZhas Technologies S.A.",
            accountNumber: process.env.BANK_ACCOUNT_NUMBER || "Contactar soporte",
            swift: process.env.BANK_SWIFT || "BGNPPAPA",
            bankAddress: process.env.BANK_ADDRESS || "Panamá, Ciudad de Panamá",
            concept: referenceCode,
            amount: totalToPay,
            currency: "USD"
        };

        logger.info('Bank transfer order created:', {
            reference: referenceCode,
            wallet: userWallet,
            amount: totalToPay
        });

        return res.json({
            success: true,
            message: "Orden de transferencia creada exitosamente",
            orderReference: referenceCode,
            bankDetails: bankDetails,
            bezTokens: amountBez,
            totalAmount: totalToPay,
            instructions: [
                "1. Realice la transferencia usando los datos bancarios proporcionados",
                "2. IMPORTANTE: Incluya el código de referencia en el concepto",
                "3. Envíe el comprobante a: pagos@bezhas.com",
                "4. Los tokens serán acreditados en 24-48 horas tras verificación"
            ]
        });

    } catch (error) {
        logger.error('Error creating bank transfer order:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/payment/crypto/vip-subscription
 * @desc Procesar pago crypto para suscripción VIP
 * @access Private
 */
router.post('/crypto/vip-subscription', async (req, res) => {
    try {
        const { bezAmount, walletAddress, tier } = req.body;

        if (!bezAmount || !walletAddress || !tier) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: bezAmount, walletAddress, tier'
            });
        }

        // Validar tier
        const validTiers = ['creator', 'business', 'enterprise'];
        if (!validTiers.includes(tier.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Tier inválido. Opciones: creator, business, enterprise'
            });
        }

        // Crear registro de pago pendiente
        const payment = new Payment({
            walletAddress,
            type: 'VIP_SUBSCRIPTION_CRYPTO',
            status: 'pending',
            bezAmount,
            fiatAmount: 0,
            fiatCurrency: 'BEZ',
            metadata: {
                tier,
                paymentMethod: 'crypto_bez',
                subscriptionType: 'vip_monthly'
            }
        });

        await payment.save();

        logger.info('Crypto VIP subscription payment created:', {
            paymentId: payment._id,
            tier,
            bezAmount,
            walletAddress
        });

        // Devolver instrucciones para el pago on-chain
        return res.status(201).json({
            success: true,
            payment: {
                paymentId: payment._id,
                tier,
                bezAmount,
                walletAddress,
                status: 'pending',
                bezContract: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'
            },
            instructions: {
                contractAddress: process.env.BEZCOIN_CONTRACT_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
                recipientAddress: process.env.VIP_TREASURY_WALLET || '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
                amount: bezAmount,
                memo: `VIP-${tier.toUpperCase()}-${payment._id}`
            },
            message: `Transfiere ${bezAmount} BEZ a la dirección indicada para activar tu suscripción ${tier.toUpperCase()}`
        });

    } catch (error) {
        logger.error('Error creating crypto VIP payment:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al crear pago crypto',
            message: error.message
        });
    }
});

/**
 * @route POST /api/payment/crypto/confirm
 * @desc Confirmar pago crypto después de verificar la transacción on-chain
 * @access Private
 */
router.post('/crypto/confirm', async (req, res) => {
    try {
        const { paymentId, txHash, blockNumber } = req.body;

        if (!paymentId || !txHash) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos: paymentId, txHash'
            });
        }

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pago no encontrado'
            });
        }

        // Marcar como completado
        payment.status = 'completed';
        payment.txHash = txHash;
        payment.blockNumber = blockNumber || 0;
        payment.completedAt = new Date();
        await payment.save();

        // Si es suscripción VIP, activar el tier
        let vipActivated = false;
        if (payment.type === 'VIP_SUBSCRIPTION_CRYPTO' && payment.metadata?.tier) {
            const User = require('../models/user.model');
            const user = await User.findOne({ walletAddress: payment.walletAddress });

            if (user) {
                user.vipTier = payment.metadata.tier.toUpperCase();
                user.vipStatus = 'active';
                user.vipStartDate = new Date();
                user.vipEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
                await user.save();
                vipActivated = true;

                logger.info('VIP subscription activated via crypto:', {
                    userId: user._id,
                    tier: payment.metadata.tier,
                    txHash
                });
            }
        }

        return res.json({
            success: true,
            message: 'Pago confirmado exitosamente',
            vipActivated,
            payment: {
                paymentId: payment._id,
                status: 'confirmed',
                txHash,
                tier: payment.metadata?.tier
            }
        });

    } catch (error) {
        logger.error('Error confirming crypto payment:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al confirmar pago',
            message: error.message
        });
    }
});

router.get('/health', async (req, res) => {
    res.json({
        success: true,
        service: 'Payment Gateway',
        message: 'Payment system active - Stripe, Bank Transfer, Crypto',
        endpoints: {
            stripe: [
                'POST /stripe/create-payment-intent',
                'POST /create-checkout-session'
            ],
            crypto: [
                'POST /crypto/vip-subscription',
                'POST /crypto/confirm'
            ],
            bankTransfer: [
                'POST /bank-transfer/create-order',
                'GET /fiat/bank-details'
            ]
        },
        bezContract: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        network: 'Polygon Mainnet',
        timestamp: new Date().toISOString()
    });
});

// Bank details endpoint (SEPA)
router.get('/bank-details', (req, res) => {
    res.json({
        success: true,
        bankDetails: {
            accountHolder: 'BeZhas Technology SL',
            iban: 'ES77 1465 0100 91 1766376210',
            bic: 'INGDESMMXXX',
            bank: 'ING Direct',
            concept: 'VIP-{walletAddress}'
        }
    });
});

// Get payment history for a wallet
router.get('/history/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { limit = 50, skip = 0, status } = req.query;

        const query = { walletAddress };
        if (status) {
            query.status = status;
        }

        const payments = await Payment.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        const total = await Payment.countDocuments(query);

        return res.json({
            success: true,
            payments,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
                hasMore: total > (parseInt(skip) + parseInt(limit))
            }
        });
    } catch (error) {
        logger.error('Error fetching payment history:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch payment history',
            message: error.message
        });
    }
});

// Get payment by ID or transaction hash
router.get('/payment/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;

        // Try to find by MongoDB ID, payment intent ID, or txHash
        const payment = await Payment.findOne({
            $or: [
                { _id: identifier },
                { paymentIntentId: identifier },
                { txHash: identifier }
            ]
        }).lean();

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }

        // Add explorer URL
        const chainExplorers = {
            80002: 'https://amoy.polygonscan.com/tx/',
            137: 'https://polygonscan.com/tx/'
        };

        if (payment.txHash) {
            const baseUrl = chainExplorers[payment.networkChainId] || chainExplorers[80002];
            payment.explorerUrl = `${baseUrl}${payment.txHash}`;
        }

        return res.json({
            success: true,
            payment
        });
    } catch (error) {
        logger.error('Error fetching payment:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch payment',
            message: error.message
        });
    }
});

// Get payment statistics
router.get('/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const stats = await Payment.getStats(start, end);

        // Get total counts
        const totalPayments = await Payment.countDocuments({
            createdAt: { $gte: start, $lte: end }
        });

        return res.json({
            success: true,
            period: {
                start,
                end
            },
            totalPayments,
            byStatus: stats
        });
    } catch (error) {
        logger.error('Error fetching payment stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
});

// ============================================================================
// TOKEN PURCHASE ROUTES - Stripe Integration
// ============================================================================

const { createTokenPurchaseSession } = require('../services/stripe.service');
const { verifyTokenMiddleware } = require('../middleware/refreshTokenSystem');

/**
 * POST /api/payments/token-purchase
 * Create Stripe checkout session for token purchase
 */
router.post('/token-purchase', verifyTokenMiddleware, async (req, res) => {
    try {
        const { packageId, walletAddress, paymentMethod } = req.body;
        const userId = req.user?.userId;

        if (!packageId || !walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                required: ['packageId', 'walletAddress']
            });
        }

        // Token packages configuration
        const tokenPackages = {
            starter: { tokens: 100, bonus: 0, price: 10 },
            pro: { tokens: 500, bonus: 50, price: 50 },
            business: { tokens: 1000, bonus: 150, price: 100 },
            enterprise: { tokens: 5000, bonus: 1000, price: 500 },
            whale: { tokens: 25000, bonus: 7500, price: 2500 },
            institution: { tokens: 100000, bonus: 40000, price: 10000 }
        };

        const pkg = tokenPackages[packageId];
        if (!pkg) {
            return res.status(400).json({
                success: false,
                error: 'Invalid package ID',
                validPackages: Object.keys(tokenPackages)
            });
        }

        const totalTokens = pkg.tokens + pkg.bonus;

        logger.info({
            userId,
            packageId,
            tokens: totalTokens,
            price: pkg.price,
            walletAddress
        }, 'Creating token purchase session');

        const result = await createTokenPurchaseSession(totalTokens, {
            userId,
            email: req.user?.email || `${userId}@bezhas.com`,
            walletAddress
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        return res.json({
            success: true,
            sessionId: result.sessionId,
            checkoutUrl: result.url,
            package: {
                id: packageId,
                tokens: pkg.tokens,
                bonus: pkg.bonus,
                total: totalTokens,
                price: pkg.price
            }
        });

    } catch (error) {
        logger.error('Token purchase error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create checkout session',
            message: error.message
        });
    }
});

/**
 * POST /api/payments/crypto-purchase
 * Initiate crypto payment for token purchase
 */
router.post('/crypto-purchase', verifyTokenMiddleware, async (req, res) => {
    try {
        const { packageId, walletAddress } = req.body;
        const userId = req.user?.userId;

        if (!packageId || !walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                required: ['packageId', 'walletAddress']
            });
        }

        // Token packages configuration (same as above)
        const tokenPackages = {
            starter: { tokens: 100, bonus: 0, priceUSDC: 10 },
            pro: { tokens: 500, bonus: 50, priceUSDC: 50 },
            business: { tokens: 1000, bonus: 150, priceUSDC: 100 },
            enterprise: { tokens: 5000, bonus: 1000, priceUSDC: 500 },
            whale: { tokens: 25000, bonus: 7500, priceUSDC: 2500 },
            institution: { tokens: 100000, bonus: 40000, priceUSDC: 10000 }
        };

        const pkg = tokenPackages[packageId];
        if (!pkg) {
            return res.status(400).json({
                success: false,
                error: 'Invalid package ID'
            });
        }

        // Treasury wallet for crypto payments
        const TREASURY_WALLET = process.env.TREASURY_WALLET || '0x89c23890c742d710265dD61be789C71dC8999b12';
        const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // USDC on Polygon

        return res.json({
            success: true,
            paymentDetails: {
                method: 'crypto',
                package: packageId,
                tokens: pkg.tokens + pkg.bonus,
                amountUSDC: pkg.priceUSDC,
                recipientAddress: TREASURY_WALLET,
                usdcContractAddress: USDC_ADDRESS,
                chainId: 137, // Polygon Mainnet
                message: `BEZ Purchase: ${packageId}`
            },
            instructions: [
                `1. Approve USDC spend of ${pkg.priceUSDC} USDC`,
                `2. Send ${pkg.priceUSDC} USDC to ${TREASURY_WALLET}`,
                '3. Include your wallet address in the transaction memo',
                '4. Tokens will be distributed within 24 hours'
            ]
        });

    } catch (error) {
        logger.error('Crypto purchase error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create crypto payment',
            message: error.message
        });
    }
});

module.exports = router;
