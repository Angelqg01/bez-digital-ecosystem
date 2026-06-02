/**
 * BeZhas BEZ-Coin Routes con MoonPay Integration
 * Sistema completo de compra, swap y staking de BEZ-Coin
 * 
 * ============================================================
 * ⚠️ MOONPAY DESHABILITADO - 2026-01-31
 * ============================================================
 * MoonPay ha sido deshabilitado porque:
 * 1. Usa ETH como intermediario (FIAT → ETH → BEZ)
 * 2. Genera doble conversión y pérdidas por slippage
 * 3. BeZhas ahora usa conversión directa FIAT → BEZ via Stripe/SEPA
 * 
 * El oráculo de precios ahora obtiene el precio directamente de
 * la pool QuickSwap BEZ/USDC (0x4edc77de01f2a2c87611c2f8e9249be43df745a9)
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const axios = require('axios');
const crypto = require('crypto');
const BEZCoinTransaction = require('../models/BEZCoinTransaction.model');
const VIPSubscription = require('../models/VIPSubscription.model');
const tokenomics = require('../config/tokenomics.config');

// ============================================================
// MOONPAY DISABLED
// ============================================================
const MOONPAY_ENABLED = tokenomics.moonpay?.enabled || false;

// Configuración de MoonPay (legacy - mantenida por compatibilidad)
const MOONPAY_API_KEY = process.env.MOONPAY_API_KEY;
const MOONPAY_SECRET_KEY = process.env.MOONPAY_SECRET_KEY;
const MOONPAY_API_URL = 'https://api.moonpay.com';

/**
 * @route   POST /api/bezcoin/buy/moonpay
 * @desc    [DESHABILITADO] Comprar BEZ-Coin con fiat usando MoonPay
 * @access  Private
 */
router.post('/buy/moonpay', protect, async (req, res) => {
    // ============================================================
    // MOONPAY DESHABILITADO - Redirigir a Stripe/SEPA
    // ============================================================
    if (!MOONPAY_ENABLED) {
        return res.status(410).json({
            success: false,
            error: 'MoonPay integration disabled',
            message: 'MoonPay ha sido deshabilitado. Por favor, utiliza los siguientes métodos de pago alternativos:',
            alternatives: {
                stripe: {
                    endpoint: '/api/payment/stripe/create-payment-intent',
                    description: 'Pago con tarjeta de crédito/débito (Visa, Mastercard, AMEX)'
                },
                bankTransfer: {
                    endpoint: '/api/payment/bank-transfer/create-order',
                    description: 'Transferencia bancaria SEPA (Europa)'
                },
                crypto: {
                    endpoint: '/api/payment/crypto/vip-subscription',
                    description: 'Pago directo con BEZ-Coin u otras criptomonedas'
                }
            },
            priceSource: {
                oracle: 'QuickSwap LP Pool BEZ/USDC',
                poolAddress: tokenomics.priceOracle.quickswapPool.address,
                network: 'Polygon Mainnet'
            },
            reason: tokenomics.moonpay?.reason || 'Conversión directa FIAT/BEZ implementada'
        });
    }

    // Código legacy (solo ejecuta si MOONPAY_ENABLED = true manualmente)
    try {
        const { amount, currency, paymentMethod, vipBonus, returnUrl } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        // Precio actual de BEZ desde el oráculo QuickSwap
        const priceOracle = require('../services/price-oracle.service');
        const BEZ_PRICE_USD = await priceOracle.getBezUsdPrice();

        // Calcular cantidad de BEZ
        const bezAmount = amount / BEZ_PRICE_USD;
        const bonusAmount = (bezAmount * (vipBonus || 0)) / 100;
        const totalBez = bezAmount + bonusAmount;

        // Crear transacción en MoonPay
        const walletAddress = req.user.walletAddress;

        // Generar firma para MoonPay
        const originalUrl = `${MOONPAY_API_URL}/v3/transactions`;
        const signature = generateMoonPaySignature(originalUrl);

        const moonpayPayload = {
            apiKey: MOONPAY_API_KEY,
            baseCurrencyCode: currency || 'usd',
            baseCurrencyAmount: amount,
            currencyCode: 'eth', // MoonPay no tiene BEZ directamente, usar ETH como intermediario
            walletAddress: walletAddress,
            redirectURL: returnUrl || `${process.env.FRONTEND_URL}/bezcoin/success`,
            externalTransactionId: `BEZHAS-${Date.now()}`,
            lockAmount: true,
            theme: 'dark'
        };

        try {
            const moonpayResponse = await axios.post(`${MOONPAY_API_URL}/v3/transactions`, moonpayPayload, {
                headers: {
                    'Authorization': `Api-Key ${MOONPAY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const transaction = moonpayResponse.data;

            // Guardar transacción en base de datos
            const bezTransaction = {
                userId: req.user._id,
                transactionId: transaction.id,
                type: 'buy_moonpay',
                amount: amount,
                currency: currency || 'USD',
                bezAmount: bezAmount,
                bonusAmount: bonusAmount,
                totalBez: totalBez,
                status: 'pending',
                moonpayUrl: transaction.url,
                walletAddress: walletAddress,
                createdAt: new Date()
            };

            // TODO: Guardar en MongoDB
            // await BezTransaction.create(bezTransaction);

            res.json({
                success: true,
                moonpayUrl: transaction.url || `https://buy.moonpay.com?apiKey=${MOONPAY_API_KEY}&currencyCode=eth&walletAddress=${walletAddress}&baseCurrencyAmount=${amount}`,
                transactionId: transaction.id || `MOONPAY-${Date.now()}`,
                bezAmount: bezAmount,
                bonusAmount: bonusAmount,
                totalBez: totalBez
            });

        } catch (moonpayError) {
            // Fallback: Generar URL directa de MoonPay
            const moonpayUrl = `https://buy.moonpay.com?` +
                `apiKey=${MOONPAY_API_KEY}` +
                `&currencyCode=eth` +
                `&walletAddress=${walletAddress}` +
                `&baseCurrencyAmount=${amount}` +
                `&baseCurrencyCode=${currency || 'usd'}` +
                `&redirectURL=${encodeURIComponent(returnUrl || `${process.env.FRONTEND_URL}/bezcoin/success`)}`;

            res.json({
                success: true,
                moonpayUrl: moonpayUrl,
                transactionId: `MOONPAY-${Date.now()}`,
                bezAmount: bezAmount,
                bonusAmount: bonusAmount,
                totalBez: totalBez
            });
        }

    } catch (error) {
        console.error('MoonPay Buy BEZ Error:', error);
        res.status(500).json({
            message: 'Error buying BEZ with MoonPay',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/bezcoin/buy/stripe
 * @desc    Comprar BEZ-Coin con Stripe
 * @access  Private
 */
router.post('/buy/stripe', protect, async (req, res) => {
    try {
        const { amount, currency, vipBonus } = req.body;

        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        const BEZ_PRICE_USD = 0.50;
        const bezAmount = amount / BEZ_PRICE_USD;
        const bonusAmount = (bezAmount * (vipBonus || 0)) / 100;
        const totalBez = bezAmount + bonusAmount;

        // Crear sesión de pago con Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency?.toLowerCase() || 'usd',
                        product_data: {
                            name: 'BEZ-Coin',
                            description: `Compra de ${totalBez.toFixed(2)} BEZ (incluye ${bonusAmount.toFixed(2)} bonus)`,
                            images: ['https://bez.digital/images/bezcoin-logo.png']
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/bezcoin/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/bezcoin`,
            customer_email: req.user.email,
            metadata: {
                userId: req.user._id.toString(),
                bezAmount: totalBez.toString(),
                type: 'bezcoin_purchase'
            }
        });

        res.json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url,
            bezAmount: bezAmount,
            bonusAmount: bonusAmount,
            totalBez: totalBez
        });

    } catch (error) {
        console.error('Stripe Buy BEZ Error:', error);
        res.status(500).json({
            message: 'Error buying BEZ with Stripe',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/bezcoin/swap
 * @desc    Intercambiar crypto por BEZ-Coin
 * @access  Private
 */
router.post('/swap', protect, async (req, res) => {
    try {
        const { fromToken, amount, slippage, deadline } = req.body;

        // Simular swap (en producción usar Uniswap/QuickSwap)
        const exchangeRates = {
            'USDT': 2.0,  // 1 USDT = 2 BEZ
            'USDC': 2.0,
            'ETH': 4000,  // 1 ETH = 4000 BEZ
            'MATIC': 1.5
        };

        const rate = exchangeRates[fromToken] || 1;
        const amountOut = amount * rate;
        const priceImpact = 0.5; // 0.5%

        const swapTransaction = {
            userId: req.user._id,
            type: 'swap',
            fromToken,
            toToken: 'BEZ',
            amountIn: amount,
            amountOut: amountOut,
            priceImpact,
            slippage: slippage || 0.5,
            status: 'completed',
            txHash: `0x${crypto.randomBytes(32).toString('hex')}`,
            createdAt: new Date()
        };

        // TODO: Guardar en MongoDB
        // await BezTransaction.create(swapTransaction);

        res.json({
            success: true,
            amountOut: amountOut,
            priceImpact: priceImpact,
            route: [fromToken, 'BEZ'],
            transactionHash: swapTransaction.txHash
        });

    } catch (error) {
        console.error('BEZ Swap Error:', error);
        res.status(500).json({
            message: 'Error swapping tokens',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/bezcoin/price
 * @desc    Obtener precio actual de BEZ-Coin
 * @access  Public
 */
router.get('/price', async (req, res) => {
    try {
        // En producción, obtener de Oracle o DEX
        const priceData = {
            priceUSD: 0.50,
            priceEUR: 0.46,
            change24h: 5.2,
            volume24h: 1250000,
            marketCap: 50000000,
            circulatingSupply: 100000000,
            lastUpdated: new Date()
        };

        res.json({
            success: true,
            ...priceData
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error getting BEZ price',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/bezcoin/history/:period
 * @desc    Obtener historial de precios
 * @access  Public
 */
router.get('/history/:period', async (req, res) => {
    try {
        const { period } = req.params;

        // Generar datos simulados
        const dataPoints = period === '1h' ? 60 : period === '24h' ? 24 : 30;
        const prices = [];
        let currentPrice = 0.50;

        for (let i = 0; i < dataPoints; i++) {
            const change = (Math.random() - 0.5) * 0.02;
            currentPrice += change;
            prices.push({
                timestamp: new Date(Date.now() - (dataPoints - i) * 60 * 60 * 1000),
                price: currentPrice
            });
        }

        const high = Math.max(...prices.map(p => p.price));
        const low = Math.min(...prices.map(p => p.price));
        const average = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;

        res.json({
            success: true,
            period,
            prices,
            high,
            low,
            average
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error getting price history',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/bezcoin/stake
 * @desc    Hacer staking de BEZ-Coin
 * @access  Private
 */
router.post('/stake', protect, async (req, res) => {
    try {
        const { amount, duration, autoCompound } = req.body;

        // APY según duración
        const apyRates = {
            30: 5,    // 5% APY para 30 días
            90: 10,   // 10% APY para 90 días
            180: 15,  // 15% APY para 180 días
            365: 25   // 25% APY para 365 días
        };

        const apy = apyRates[duration] || 5;
        const estimatedRewards = (amount * apy * duration) / (365 * 100);

        const stake = {
            userId: req.user._id,
            stakeId: `STAKE-${Date.now()}`,
            amount,
            duration,
            apy,
            startDate: new Date(),
            endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
            estimatedRewards,
            autoCompound: autoCompound !== false,
            status: 'active'
        };

        // TODO: Guardar en MongoDB y llamar contrato de staking
        // await BezStake.create(stake);

        res.json({
            success: true,
            stakeId: stake.stakeId,
            amount: stake.amount,
            apy: stake.apy,
            endDate: stake.endDate,
            estimatedRewards: stake.estimatedRewards
        });

    } catch (error) {
        console.error('BEZ Stake Error:', error);
        res.status(500).json({
            message: 'Error staking BEZ',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/bezcoin/rewards
 * @desc    Obtener recompensas de staking
 * @access  Private
 */
router.get('/rewards', protect, async (req, res) => {
    try {
        // TODO: Obtener desde MongoDB
        const stakingData = {
            totalStaked: 10000,
            totalRewards: 1250,
            claimableRewards: 500,
            stakes: [
                {
                    stakeId: 'STAKE-1',
                    amount: 5000,
                    apy: 25,
                    startDate: new Date('2025-12-01'),
                    endDate: new Date('2026-12-01'),
                    currentRewards: 625
                },
                {
                    stakeId: 'STAKE-2',
                    amount: 5000,
                    apy: 15,
                    startDate: new Date('2025-11-01'),
                    endDate: new Date('2026-05-01'),
                    currentRewards: 625
                }
            ]
        };

        res.json({
            success: true,
            ...stakingData
        });

    } catch (error) {
        console.error('Get Staking Rewards Error:', error);
        res.status(500).json({
            message: 'Error getting staking rewards',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/bezcoin/transfer
 * @desc    Transferir BEZ-Coin
 * @access  Private
 */
router.post('/transfer', protect, async (req, res) => {
    try {
        const { to, amount, memo } = req.body;

        if (!to || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // TODO: Llamar contrato de BEZ-Coin para transferir
        const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;

        const transfer = {
            userId: req.user._id,
            from: req.user.walletAddress,
            to,
            amount,
            memo,
            txHash,
            status: 'completed',
            createdAt: new Date()
        };

        // TODO: Guardar en MongoDB
        // await BezTransaction.create(transfer);

        res.json({
            success: true,
            transactionHash: txHash,
            from: req.user.walletAddress,
            to,
            amount
        });

    } catch (error) {
        console.error('BEZ Transfer Error:', error);
        res.status(500).json({
            message: 'Error transferring BEZ',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/bezcoin/moonpay/webhook
 * @desc    Webhook de MoonPay para confirmar transacciones
 * @access  Public (validado con firma)
 */
router.post('/moonpay/webhook', async (req, res) => {
    try {
        const signature = req.headers['moonpay-signature'];
        const payload = JSON.stringify(req.body);

        // Verificar firma
        const isValid = verifyMoonPaySignature(payload, signature);

        if (!isValid) {
            return res.status(401).json({ message: 'Invalid signature' });
        }

        const { type, data } = req.body;

        if (type === 'transaction_updated') {
            const { status, externalTransactionId, cryptoTransactionId } = data;

            // Actualizar transacción en base de datos
            if (status === 'completed') {
                // TODO: Acreditar BEZ-Coin al usuario
                console.log('MoonPay transaction completed:', externalTransactionId);
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('MoonPay Webhook Error:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
});

/**
 * Generar firma para MoonPay
 */
function generateMoonPaySignature(url) {
    const hmac = crypto.createHmac('sha256', MOONPAY_SECRET_KEY);
    hmac.update(url);
    return hmac.digest('base64');
}

/**
 * Verificar firma de MoonPay
 */
function verifyMoonPaySignature(payload, signature) {
    const hmac = crypto.createHmac('sha256', MOONPAY_SECRET_KEY);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');
    return signature === expectedSignature;
}

module.exports = router;
