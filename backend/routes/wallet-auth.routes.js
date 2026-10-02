/**
 * Login/registro con wallet (SIWE) → JWT. Montado en /api/wallet-auth.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const walletAuth = require('../services/walletAuth.service');

const router = express.Router();

router.use(rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.WALLET_AUTH_RATE_LIMIT || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos, espera un momento.' },
}));

const handle = (fn) => async (req, res) => {
    try {
        res.json(await fn(req));
    } catch (err) {
        if (!err.status) console.error('wallet-auth error:', err.message);
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno' });
    }
};

// POST (no GET) para no filtrar la dirección en logs de acceso/URL.
router.post('/nonce', handle(async (req) => walletAuth.issueNonce(req.body && req.body.address)));
router.post('/verify', handle(async (req) => walletAuth.loginOrRegisterWithWallet({
    message: req.body && req.body.message,
    signature: req.body && req.body.signature,
})));

module.exports = router;
