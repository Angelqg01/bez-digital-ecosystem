'use strict';

/**
 * routes/api-credits.js — saldo prepago de la API desde el panel (sesión de usuario).
 *
 *   GET  /api/credits            saldo, paquetes, modelos disponibles y movimientos
 *   POST /api/credits/checkout   crea la sesión de Stripe Checkout de una recarga
 *
 * El saldo es de la app de la organización del usuario. La app se resuelve
 * SIEMPRE de la sesión, nunca del cuerpo: nadie recarga ni consulta la de otro.
 * Aquí sólo se crea la sesión de pago; el saldo lo abona el webhook de Stripe
 * cuando el cobro está confirmado (services/apiCredits acreditarSesion).
 *
 * La misma operación con api-key está en /api/gateway/v1/subscription/credits.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/security');
const apiCredits = require('../services/apiCredits');
const { query } = require('../db/pool');

const router = express.Router();
const porUsuario = (req) => String(req.user?.userId || req.user?.id || 'anon');

router.use(express.json({ limit: '2kb' }), authenticateToken);

const limiteDePago = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.API_CREDITS_CHECKOUT_RATE_LIMIT || 6),
    keyGenerator: porUsuario,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de pago, espera un minuto.', code: 'CHECKOUT_RATE_LIMIT' },
});

router.get('/', async (req, res) => {
    try {
        const appId = await apiCredits.appDeUsuario(porUsuario(req));
        if (!appId) {
            return res.json({
                success: true, hasApp: false, prepaid: false, balanceCredits: 0, balanceEUR: 0,
                ...apiCredits.catalogo(), activity: [],
            });
        }
        res.json({ success: true, hasApp: true, ...(await apiCredits.resumen(appId)) });
    } catch (err) {
        console.error('saldo API: lectura fallida:', err.message);
        res.status(500).json({ error: 'No se pudo leer el saldo.', code: 'CREDITS_UNAVAILABLE' });
    }
});

router.post('/checkout', limiteDePago, async (req, res) => {
    try {
        const userId = porUsuario(req);
        const appId = await apiCredits.appDeUsuario(userId);
        const { rows } = await query('SELECT email FROM users WHERE id::text = $1 LIMIT 1', [userId]).catch(() => ({ rows: [] }));
        const out = await apiCredits.crearCheckout({
            appId, userId,
            packageId: req.body?.packageId,
            amountEur: req.body?.amountEur,
            email: rows[0]?.email || undefined,
        });
        res.json({ success: true, url: out.url, eur: out.eur, credits: out.credits });
    } catch (err) {
        if (err instanceof apiCredits.CreditError) return res.status(err.status).json({ error: err.message, code: err.code });
        console.error('saldo API: checkout fallido:', err.type || err.name, err.message);
        res.status(502).json({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo en un momento.', code: 'CHECKOUT_FAILED' });
    }
});

module.exports = router;
