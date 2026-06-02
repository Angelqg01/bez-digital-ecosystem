/**
 * ============================================================================
 * CRYPTO PAYMENT ROUTES
 * ============================================================================
 * 
 * Endpoints para procesar pagos con criptomonedas
 */

const express = require('express');
const router = express.Router();
const cryptoPaymentService = require('../services/crypto-payment.service');
const { authenticateJWT } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/crypto/quote
 * Obtener cotización para compra de BEZ con crypto
 */
router.post('/quote', async (req, res) => {
    try {
        const { amount, currency } = req.body;

        if (!amount || !currency) {
            return res.status(400).json({
                success: false,
                error: 'Amount and currency are required'
            });
        }

        if (!['USDT', 'USDC', 'MATIC'].includes(currency)) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported currency. Use USDT, USDC, or MATIC'
            });
        }

        const quote = await cryptoPaymentService.getQuote(amount, currency);
        res.json(quote);
    } catch (error) {
        logger.error('Error getting crypto quote:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * POST /api/crypto/initiate
 * Iniciar pago con criptomonedas
 */
router.post('/initiate', authenticateJWT, async (req, res) => {
    try {
        const { walletAddress, amount, currency } = req.body;

        if (!walletAddress || !amount || !currency) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address, amount, and currency are required'
            });
        }

        // Validar dirección de wallet
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address'
            });
        }

        let result;

        if (currency === 'USDT' || currency === 'USDC') {
            result = await cryptoPaymentService.processStablecoinPayment(
                walletAddress,
                amount,
                currency
            );
        } else if (currency === 'MATIC') {
            result = await cryptoPaymentService.processMaticPayment(
                walletAddress,
                amount
            );
        } else {
            return res.status(400).json({
                success: false,
                error: 'Unsupported currency'
            });
        }

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        logger.error('Error initiating crypto payment:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/crypto/status/:txHash
 * Verificar estado de transacción
 */
router.get('/status/:txHash', async (req, res) => {
    try {
        const { txHash } = req.params;

        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid transaction hash'
            });
        }

        const status = await cryptoPaymentService.checkTransactionStatus(txHash);
        res.json(status);
    } catch (error) {
        logger.error('Error checking transaction status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/crypto/balance/:walletAddress
 * Obtener balance de BEZ de una wallet
 */
router.get('/balance/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;

        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address'
            });
        }

        const balance = await cryptoPaymentService.getBezBalance(walletAddress);
        res.json(balance);
    } catch (error) {
        logger.error('Error getting wallet balance:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/crypto/balance/:walletAddress/:currency
 * Obtener balance de stablecoin
 */
router.get('/balance/:walletAddress/:currency', async (req, res) => {
    try {
        const { walletAddress, currency } = req.params;

        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address'
            });
        }

        if (!['USDT', 'USDC'].includes(currency.toUpperCase())) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported currency. Use USDT or USDC'
            });
        }

        const balance = await cryptoPaymentService.getStablecoinBalance(
            walletAddress,
            currency.toUpperCase()
        );
        res.json(balance);
    } catch (error) {
        logger.error('Error getting stablecoin balance:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
