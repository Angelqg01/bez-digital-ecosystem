/**
 * bezcoin.routes.js
 * 
 * Endpoints para gestionar transacciones y operaciones de BezCoin
 * 
 * Rutas:
 * - POST /api/bezcoin/transactions - Guardar transacción
 * - GET /api/bezcoin/transactions/:address - Obtener historial
 * - GET /api/bezcoin/stats/:address - Obtener estadísticas
 * - POST /api/bezcoin/rewards/check - Verificar elegibilidad para recompensas
 * - POST /api/bezcoin/rewards/claim - Reclamar recompensas
 * - GET /api/bezcoin/price/usd - Obtener precio en USD
 * - POST /api/payment/stripe/create-payment-intent - Crear intención de pago Stripe
 * - POST /api/payment/moonpay/create-transaction - Crear transacción MoonPay
 * 
 * Ubicación: backend/routes/bezcoin.routes.js
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { protect: authMiddleware } = require('../middleware/auth.middleware');

// Base de datos en memoria (reemplazar con MongoDB/PostgreSQL en producción)
const transactionsDB = new Map();
const rewardsDB = new Map();

/**
 * Guardar una transacción
 * POST /api/bezcoin/transactions
 */
router.post(
    '/transactions',
    [
        authMiddleware,
        body('walletAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
        body('type').isIn(['buy', 'transfer', 'donate', 'receive']).withMessage('Invalid transaction type'),
        body('amount').isDecimal().withMessage('Amount must be a number'),
        body('hash').optional().isString(),
        body('status').isIn(['pending', 'confirmed', 'failed']).withMessage('Invalid status'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { walletAddress, type, amount, from, to, hash, status, metadata } = req.body;

            const transaction = {
                id: Date.now().toString(),
                walletAddress,
                type,
                amount,
                from,
                to,
                hash,
                status,
                metadata,
                timestamp: new Date().toISOString()
            };

            // Guardar en DB en memoria
            if (!transactionsDB.has(walletAddress)) {
                transactionsDB.set(walletAddress, []);
            }

            const userTransactions = transactionsDB.get(walletAddress);
            userTransactions.push(transaction);
            transactionsDB.set(walletAddress, userTransactions);

            // Si es una donación, registrar para recompensas
            if (type === 'donate' && parseFloat(amount) > 0) {
                await recordDonationForRewards(walletAddress, amount);
            }

            res.status(201).json({
                success: true,
                transaction
            });
        } catch (error) {
            console.error('Error saving transaction:', error);
            res.status(500).json({
                success: false,
                error: 'Error saving transaction'
            });
        }
    }
);

/**
 * Obtener historial de transacciones
 * GET /api/bezcoin/transactions/:address
 */
router.get(
    '/transactions/:address',
    [
        authMiddleware,
        param('address').isEthereumAddress().withMessage('Invalid Ethereum address')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { address } = req.params;
            const transactions = transactionsDB.get(address) || [];

            // Ordenar por fecha descendente
            transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            res.json({
                success: true,
                transactions,
                count: transactions.length
            });
        } catch (error) {
            console.error('Error fetching transactions:', error);
            res.status(500).json({
                success: false,
                error: 'Error fetching transactions'
            });
        }
    }
);

/**
 * Obtener estadísticas del usuario
 * GET /api/bezcoin/stats/:address
 */
router.get(
    '/stats/:address',
    [
        authMiddleware,
        param('address').isEthereumAddress().withMessage('Invalid Ethereum address')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { address } = req.params;
            const transactions = transactionsDB.get(address) || [];

            const stats = {
                totalPurchased: '0',
                totalDonated: '0',
                totalTransferred: '0',
                totalReceived: '0',
                rewardsEarned: '0',
                transactionCount: transactions.length
            };

            transactions.forEach(tx => {
                const amount = parseFloat(tx.amount);

                switch (tx.type) {
                    case 'buy':
                        stats.totalPurchased = (parseFloat(stats.totalPurchased) + amount).toString();
                        break;
                    case 'donate':
                        stats.totalDonated = (parseFloat(stats.totalDonated) + amount).toString();
                        break;
                    case 'transfer':
                        stats.totalTransferred = (parseFloat(stats.totalTransferred) + amount).toString();
                        break;
                    case 'receive':
                        stats.totalReceived = (parseFloat(stats.totalReceived) + amount).toString();
                        break;
                }
            });

            // Calcular recompensas acumuladas
            const rewards = rewardsDB.get(address) || { earned: '0', claimed: '0' };
            stats.rewardsEarned = rewards.earned;
            stats.rewardsClaimed = rewards.claimed;
            stats.rewardsPending = (parseFloat(rewards.earned) - parseFloat(rewards.claimed)).toString();

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
            res.status(500).json({
                success: false,
                error: 'Error fetching statistics'
            });
        }
    }
);

/**
 * Verificar elegibilidad para recompensas
 * POST /api/bezcoin/rewards/check
 */
router.post(
    '/rewards/check',
    [
        authMiddleware,
        body('walletAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
        body('action').isString().withMessage('Action is required')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { walletAddress, action } = req.body;

            // Reglas de elegibilidad (personalizar según necesidades)
            const eligibilityRules = {
                'post': { minBalance: 10, reward: 5 },
                'comment': { minBalance: 5, reward: 2 },
                'dao_vote': { minBalance: 50, reward: 10 },
                'daily_login': { minBalance: 0, reward: 1 }
            };

            const rule = eligibilityRules[action];

            if (!rule) {
                return res.json({
                    eligible: false,
                    reason: 'Unknown action'
                });
            }

            // TODO: Verificar balance real desde el contrato
            // Por ahora simulamos que el usuario es elegible

            res.json({
                eligible: true,
                reward: rule.reward.toString(),
                message: `You can earn ${rule.reward} BEZ for ${action}`
            });
        } catch (error) {
            console.error('Error checking eligibility:', error);
            res.status(500).json({
                success: false,
                error: 'Error checking eligibility'
            });
        }
    }
);

/**
 * Reclamar recompensas acumuladas
 * POST /api/bezcoin/rewards/claim
 */
router.post(
    '/rewards/claim',
    [
        authMiddleware,
        body('walletAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { walletAddress } = req.body;

            const rewards = rewardsDB.get(walletAddress) || { earned: '0', claimed: '0' };
            const pending = parseFloat(rewards.earned) - parseFloat(rewards.claimed);

            if (pending <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No rewards available to claim'
                });
            }

            // Actualizar rewards claimed
            rewards.claimed = rewards.earned;
            rewardsDB.set(walletAddress, rewards);

            // TODO: Ejecutar transacción on-chain para transferir tokens de recompensa
            // desde el contrato de recompensas al usuario

            res.json({
                success: true,
                amount: pending.toString(),
                message: `Claimed ${pending} BEZ tokens`
            });
        } catch (error) {
            console.error('Error claiming rewards:', error);
            res.status(500).json({
                success: false,
                error: 'Error claiming rewards'
            });
        }
    }
);

/**
 * Obtener precio del token en USD
 * GET /api/bezcoin/price/usd
 */
router.get('/price/usd', async (req, res) => {
    try {
        // TODO: Integrar con API de precios (CoinGecko, CoinMarketCap, etc.)
        // Por ahora retornamos un precio fijo

        const priceUSD = '0.10'; // $0.10 por BEZ

        res.json({
            success: true,
            price: priceUSD,
            currency: 'USD',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching price:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching price'
        });
    }
});

/**
 * Crear intención de pago con Stripe
 * POST /api/payment/stripe/create-payment-intent
 */
router.post(
    '/payment/stripe/create-payment-intent',
    [
        authMiddleware,
        body('amount').isDecimal().withMessage('Amount must be a number'),
        body('currency').isString().withMessage('Currency is required'),
        body('walletAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { amount, currency, walletAddress, metadata } = req.body;

            // TODO: Integrar con Stripe SDK
            // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            // const paymentIntent = await stripe.paymentIntents.create({
            //   amount: Math.round(parseFloat(amount) * 100), // Convertir a centavos
            //   currency: currency.toLowerCase(),
            //   metadata: {
            //     walletAddress,
            //     ...metadata
            //   }
            // });

            // Por ahora simulamos la respuesta
            res.json({
                success: true,
                clientSecret: 'pi_mock_secret_' + Date.now(),
                paymentIntentId: 'pi_mock_' + Date.now(),
                amount,
                currency
            });
        } catch (error) {
            console.error('Error creating payment intent:', error);
            res.status(500).json({
                success: false,
                error: 'Error creating payment intent'
            });
        }
    }
);

/**
 * Crear transacción con MoonPay
 * POST /api/payment/moonpay/create-transaction
 */
router.post(
    '/payment/moonpay/create-transaction',
    [
        authMiddleware,
        body('baseCurrencyAmount').isDecimal().withMessage('Amount must be a number'),
        body('baseCurrencyCode').isString().withMessage('Currency code is required'),
        body('walletAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { baseCurrencyAmount, baseCurrencyCode, walletAddress } = req.body;

            // TODO: Integrar con MoonPay API
            // Generar URL de widget de MoonPay

            const mockUrl = `https://buy.moonpay.com?apiKey=MOCK_KEY&currencyCode=bez&walletAddress=${walletAddress}&baseCurrencyAmount=${baseCurrencyAmount}&baseCurrencyCode=${baseCurrencyCode}`;

            res.json({
                success: true,
                url: mockUrl,
                transactionId: 'moonpay_mock_' + Date.now()
            });
        } catch (error) {
            console.error('Error creating MoonPay transaction:', error);
            res.status(500).json({
                success: false,
                error: 'Error creating transaction'
            });
        }
    }
);

/**
 * Helper: Registrar donación para sistema de recompensas
 */
async function recordDonationForRewards(walletAddress, amount) {
    const rewards = rewardsDB.get(walletAddress) || { earned: '0', claimed: '0' };

    // 1% de la donación como recompensa
    const rewardAmount = parseFloat(amount) * 0.01;

    rewards.earned = (parseFloat(rewards.earned) + rewardAmount).toString();
    rewardsDB.set(walletAddress, rewards);
}

// ==================== NUEVAS RUTAS DE COMPRA/VENTA ====================

// Tasas de cambio (mock - en producción usar API de precios)
const exchangeRates = {
    ETH: 0.00015,
    BTC: 0.000012,
    USDT: 0.50,
    USD: 0.50,
    EUR: 0.46,
    GBP: 0.40
};

/**
 * GET /api/bezcoin/balance/:address
 * Obtener balance de BEZ de un usuario
 */
router.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;

        // Aquí se consultaría el balance real del smart contract
        // Por ahora usamos la base de datos en memoria
        const balance = transactionsDB.get(address) || { balance: 0 };

        res.json({
            success: true,
            address,
            balance: balance.balance || 0,
            currency: 'BEZ'
        });
    } catch (error) {
        console.error('Error obteniendo balance:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener balance'
        });
    }
});

/**
 * POST /api/bezcoin/buy-crypto
 * Comprar BEZ con criptomonedas
 */
router.post('/buy-crypto', async (req, res) => {
    try {
        const { userAddress, amount, paymentCurrency, paymentAmount } = req.body;

        if (!userAddress || !amount || !paymentCurrency || !paymentAmount) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros requeridos'
            });
        }

        // Agregar BEZ al balance
        const userBalance = transactionsDB.get(userAddress) || { balance: 0 };
        userBalance.balance = (userBalance.balance || 0) + parseFloat(amount);
        transactionsDB.set(userAddress, userBalance);

        res.json({
            success: true,
            message: `Compraste ${amount} BEZ con ${paymentAmount} ${paymentCurrency}`,
            newBalance: userBalance.balance
        });
    } catch (error) {
        console.error('Error en compra cripto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la compra'
        });
    }
});

/**
 * POST /api/bezcoin/buy-fiat
 * Comprar BEZ con dinero fiat
 */
router.post('/buy-fiat', async (req, res) => {
    try {
        const { userAddress, amount, paymentCurrency, paymentAmount } = req.body;

        // Generar URL de pago (Stripe/PayPal en producción)
        const paymentUrl = `https://payment-gateway.bezhas.com/pay?amount=${paymentAmount}&currency=${paymentCurrency}`;

        res.json({
            success: true,
            message: 'Redirigiendo al procesador de pagos',
            paymentUrl
        });
    } catch (error) {
        console.error('Error en compra fiat:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la compra'
        });
    }
});

/**
 * POST /api/bezcoin/sell
 * Vender BEZ
 */
router.post('/sell', async (req, res) => {
    try {
        const { userAddress, bezAmount, receiveCurrency, receiveAmount } = req.body;

        const userBalance = transactionsDB.get(userAddress) || { balance: 0 };
        if ((userBalance.balance || 0) < parseFloat(bezAmount)) {
            return res.status(400).json({
                success: false,
                message: 'Balance insuficiente'
            });
        }

        userBalance.balance = (userBalance.balance || 0) - parseFloat(bezAmount);
        transactionsDB.set(userAddress, userBalance);

        res.json({
            success: true,
            message: `Vendiste ${bezAmount} BEZ por ${receiveAmount} ${receiveCurrency}`,
            newBalance: userBalance.balance
        });
    } catch (error) {
        console.error('Error en venta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la venta'
        });
    }
});

/**
 * POST /api/bezcoin/transfer
 * Transferir BEZ entre usuarios
 */
router.post('/transfer', async (req, res) => {
    try {
        const { from, to, amount } = req.body;

        if (!from || !to || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros requeridos'
            });
        }

        const fromBalance = transactionsDB.get(from) || { balance: 0 };
        if ((fromBalance.balance || 0) < parseFloat(amount)) {
            return res.status(400).json({
                success: false,
                message: 'Balance insuficiente'
            });
        }

        const toBalance = transactionsDB.get(to) || { balance: 0 };

        fromBalance.balance = (fromBalance.balance || 0) - parseFloat(amount);
        toBalance.balance = (toBalance.balance || 0) + parseFloat(amount);

        transactionsDB.set(from, fromBalance);
        transactionsDB.set(to, toBalance);

        res.json({
            success: true,
            message: `Transferiste ${amount} BEZ exitosamente`,
            newBalance: fromBalance.balance
        });
    } catch (error) {
        console.error('Error en transferencia:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la transferencia'
        });
    }
});

/**
 * POST /api/bezcoin/donate
 * Donar BEZ
 */
router.post('/donate', async (req, res) => {
    try {
        const { from, to, amount } = req.body;

        if (!from || !to || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros requeridos'
            });
        }

        const fromBalance = transactionsDB.get(from) || { balance: 0 };
        if ((fromBalance.balance || 0) < parseFloat(amount)) {
            return res.status(400).json({
                success: false,
                message: 'Balance insuficiente'
            });
        }

        const toBalance = transactionsDB.get(to) || { balance: 0 };

        fromBalance.balance = (fromBalance.balance || 0) - parseFloat(amount);
        toBalance.balance = (toBalance.balance || 0) + parseFloat(amount);

        transactionsDB.set(from, fromBalance);
        transactionsDB.set(to, toBalance);

        await recordDonationForRewards(from, amount);

        res.json({
            success: true,
            message: `¡Donaste ${amount} BEZ!`,
            newBalance: fromBalance.balance
        });
    } catch (error) {
        console.error('Error en donación:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la donación'
        });
    }
});

/**
 * GET /api/bezcoin/rates
 * Obtener tasas de cambio
 */
router.get('/rates', (req, res) => {
    res.json({
        success: true,
        rates: exchangeRates,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
