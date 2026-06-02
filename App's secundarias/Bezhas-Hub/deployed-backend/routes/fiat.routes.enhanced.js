/**
 * Enhanced Fiat Routes with Database Integration
 * This is an OPTIONAL enhancement to fiat.routes.js
 * It adds MongoDB persistence for tracking orders
 * 
 * To use this, uncomment the FiatOrder imports and logic
 * in the main fiat.routes.js file
 */

const express = require('express');
const router = express.Router();
const FiatOrder = require('../models/fiatOrder.model');
const { processFiatPayment, getBezPriceInEur, calculateBezOutput } = require('../services/fiat-gateway.service');

/**
 * POST /api/fiat/orders/create
 * User creates a new order (before making the bank transfer)
 * Body: { userWallet, amountEur, userEmail? }
 */
router.post('/orders/create', async (req, res) => {
    const { userWallet, amountEur, userEmail } = req.body;

    if (!userWallet || !amountEur) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: userWallet and amountEur"
        });
    }

    try {
        // Calculate BEZ amount
        const bezAmount = await calculateBezOutput(parseFloat(amountEur));
        const exchangeRate = await getBezPriceInEur();
        const referenceCode = FiatOrder.generateReferenceCode(userWallet);

        // Check if order already exists
        const existing = await FiatOrder.findOne({
            userWallet: userWallet.toLowerCase(),
            status: 'PENDING'
        });

        if (existing) {
            return res.json({
                success: true,
                message: "You already have a pending order",
                data: existing
            });
        }

        // Create order
        const order = new FiatOrder({
            userWallet: userWallet.toLowerCase(),
            userEmail,
            fiatAmount: parseFloat(amountEur),
            bezAmount,
            exchangeRate,
            referenceCode,
            status: 'PENDING'
        });

        await order.save();

        res.json({
            success: true,
            message: "Order created successfully",
            data: {
                orderId: order._id,
                referenceCode: order.referenceCode,
                bezAmount: order.bezAmount,
                fiatAmount: order.fiatAmount,
                bankDetails: {
                    iban: "ES77 1465 0100 91 1766376210",
                    bic: "INGDESMMXXX",
                    beneficiary: "BeZhas Platform",
                    reference: order.referenceCode
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/fiat/orders/my-orders
 * User checks their order history
 * Query: ?wallet=0x...
 */
router.get('/orders/my-orders', async (req, res) => {
    const { wallet } = req.query;

    if (!wallet) {
        return res.status(400).json({
            success: false,
            error: "Missing wallet parameter"
        });
    }

    try {
        const orders = await FiatOrder.getOrdersByWallet(wallet);

        res.json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/fiat/orders/pending (Admin Only)
 * Get all pending orders
 */
router.get('/orders/pending', requireAdmin, async (req, res) => {
    try {
        const orders = await FiatOrder.getPendingOrders();

        res.json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/fiat/orders/approve (Admin Only)
 * Approve an order and execute blockchain transaction
 * Body: { orderId or referenceCode }
 */
router.post('/orders/approve', requireAdmin, async (req, res) => {
    const { orderId, referenceCode } = req.body;

    if (!orderId && !referenceCode) {
        return res.status(400).json({
            success: false,
            error: "Provide either orderId or referenceCode"
        });
    }

    try {
        // Find order
        let order;
        if (orderId) {
            order = await FiatOrder.findById(orderId);
        } else {
            order = await FiatOrder.getOrderByReference(referenceCode);
        }

        if (!order) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        if (order.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Order already ${order.status.toLowerCase()}`
            });
        }

        // Approve in DB first
        await order.approve('admin'); // TODO: Get actual admin ID from auth

        // Execute blockchain transaction
        const result = await processFiatPayment(order.userWallet, order.fiatAmount);

        // Mark as completed
        await order.complete(result.txHash, result.blockNumber);

        res.json({
            success: true,
            message: "Order approved and tokens dispersed",
            data: {
                order: order,
                transaction: result
            }
        });
    } catch (error) {
        console.error('Order approval failed:', error);

        // If blockchain failed, mark order as rejected
        if (order && order.status === 'APPROVED') {
            await order.reject(`Blockchain error: ${error.message}`, 'system');
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/fiat/orders/reject (Admin Only)
 * Reject an order
 * Body: { orderId, reason }
 */
router.post('/orders/reject', requireAdmin, async (req, res) => {
    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
        return res.status(400).json({
            success: false,
            error: "Missing orderId or reason"
        });
    }

    try {
        const order = await FiatOrder.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        await order.reject(reason, 'admin'); // TODO: Get actual admin ID

        res.json({
            success: true,
            message: "Order rejected",
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Middleware placeholder (should be imported from actual auth middleware)
function requireAdmin(req, res, next) {
    const adminSecret = req.headers['x-admin-secret'];

    if (adminSecret && adminSecret === process.env.ADMIN_SECRET) {
        return next();
    }

    res.status(403).json({
        error: "Unauthorized: Admin access required"
    });
}

module.exports = router;
