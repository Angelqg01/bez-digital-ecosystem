'use strict';

/**
 * routes/chat-checkout.js — POST /api/checkout/bez: compra de BEZ con tarjeta desde el chat.
 * Sólo crea la Checkout Session (ver services/chatCheckout.js); el cobro, la retención y la entrega los
 * hace el webhook. Límite propio y bajo: cada llamada crea un objeto en Stripe.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/security');
const chatCheckout = require('../services/chatCheckout');

const router = express.Router();
const porUsuario = (req) => String(req.user?.userId || req.user?.id || 'anon');

router.use(express.json({ limit: '2kb' }), authenticateToken, rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.CHAT_CHECKOUT_RATE_LIMIT || 6),
    keyGenerator: porUsuario,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de pago, espera un minuto.', code: 'CHECKOUT_RATE_LIMIT' },
}));

router.post('/bez', async (req, res) => {
    try {
        const out = await chatCheckout.createBezCheckout({ userId: String(req.user.userId || ''), amountEur: req.body?.amountEur });
        res.json({ url: out.url });
    } catch (err) {
        if (err instanceof chatCheckout.CheckoutError) return res.status(err.status).json({ error: err.message, code: err.code });
        console.error('chat checkout falló:', err.type || err.name, err.message);
        res.status(502).json({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo en un momento.', code: 'CHECKOUT_FAILED' });
    }
});

module.exports = router;
