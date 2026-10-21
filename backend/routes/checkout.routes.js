/**
 * Pagos reales con Stripe: planes y compra de BEZ.
 *
 * Mismo servicio para la web, las apps nativas, el chat y el MCP: la identidad
 * sale SIEMPRE de la sesión, el precio SIEMPRE del servidor y la redirección
 * SIEMPRE de FRONTEND_URL. Los datos de tarjeta nunca pasan por aquí: se
 * paga en la página alojada por Stripe.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const billing = require('../services/billing-checkout.service');
const { isOAuthBearer, requireOAuthScope } = require('../middleware/oauthBearer');

const router = express.Router();

// Misma API para la web/apps nativas (JWT de sesión) y para el MCP (token OAuth ES256 con scope billing.checkout).
const SCOPE = 'billing.checkout';
const oauthAuth = requireOAuthScope(SCOPE);
const auth = (req, res, next) => (isOAuthBearer(req) ? oauthAuth(req, res, next) : protect(req, res, next));

const limiter = (max) => rateLimit({
    windowMs: 60 * 1000,
    max,
    keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', message: 'Demasiadas solicitudes, espera un momento.' },
});
const readLimiter = limiter(Number(process.env.CHECKOUT_READ_RATE_LIMIT || 60));
const writeLimiter = limiter(Number(process.env.CHECKOUT_RATE_LIMIT || 10));

// Nunca se devuelve error.message de excepciones desconocidas: puede traer detalles de Stripe.
function fail(res, error) {
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
    if (status >= 500 && status !== 503) console.error('[checkout]', error?.message);
    res.status(status).json({
        success: false,
        code: error?.code && status < 500 ? error.code : (status === 503 ? 'PAYMENTS_UNAVAILABLE' : 'CHECKOUT_ERROR'),
        message: status < 500 || status === 503 ? error.message : 'No se pudo completar la operación',
    });
}

const wrap = (fn) => async (req, res) => {
    try { res.json({ success: true, ...(await fn(req)) }); } catch (error) { fail(res, error); }
};

/** Catálogo público de planes (precios del servidor). */
router.get('/plans', (req, res) => res.json({ success: true, plans: billing.listPlans() }));

router.post('/plan', auth, writeLimiter, wrap(async (req) => {
    const { planId, cycle } = req.body || {};
    return billing.createPlanCheckout({ user: req.user, planId, cycle });
}));

router.post('/bez', auth, writeLimiter, wrap(async (req) => {
    return billing.createBezCheckout({ user: req.user, amountEur: (req.body || {}).amountEur });
}));

router.post('/credits', auth, writeLimiter, wrap(async (req) => {
    return billing.createCreditsCheckout({ user: req.user, packId: (req.body || {}).packId });
}));

router.get('/credit-packs', (req, res) => res.json({ success: true, packs: require('../config/credit-packs').publicPacks() }));

router.post('/portal', auth, writeLimiter, wrap(async (req) => billing.createPortalSession({ user: req.user })));

router.get('/session/:id', auth, readLimiter, wrap(async (req) =>
    billing.getSessionForUser({ user: req.user, sessionId: req.params.id })));

module.exports = router;
