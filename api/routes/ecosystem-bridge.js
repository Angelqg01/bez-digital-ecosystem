/**
 * routes/ecosystem-bridge.js — Receiver for the BeZhas Universal Bridge.
 * 
 * This route allows external BeZhas applications (like bezhas-web3) to
 * synchronize registration and payment data with the core blockchain DB.
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const logger = require('pino')({ level: 'info' });

const router = Router();

// API Key middleware (mejorado para el bridge)
// Buenas prácticas: Limitar intentos fallidos, registrar accesos y considerar rate limiting en producción.
const bridgeAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.BRIDGE_API_KEY) {
        // Aquí se puede agregar lógica de monitoreo/alerta ante intentos fallidos
        logger.warn({ ip: req.ip }, 'Intento fallido de autenticación en el bridge');
        return res.status(401).json({ error: 'Unauthorized: Invalid Bridge API Key' });
    }
    next();
};

/**
 * POST /users/sync
 * Synchronize a user registered in a sub-app with the blockchain ecosystem.
 */
router.post('/users/sync', bridgeAuth, async (req, res) => {
    const { username, email, walletAddress, roles } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'walletAddress is required for sync' });
    }

    try {
        // Upsert user into the blockchain database
        const { rows } = await query(
            `INSERT INTO users (wallet_address, username, email, roles, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (wallet_address) 
             DO UPDATE SET 
                username = EXCLUDED.username, 
                email = EXCLUDED.email,
                roles = EXCLUDED.roles,
                updated_at = NOW()
             RETURNING *`,
            [walletAddress.toLowerCase(), username, email, roles || ['USER']]
        );

        logger.info({ walletAddress }, 'User synced from ecosystem bridge');
        res.json({ success: true, user: rows[0] });
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to sync user via bridge');
        res.status(500).json({ error: 'Internal server error during sync' });
    }
});

/**
 * POST /payments/notify
 * Record a payment settled in the web platform/gateway into the blockchain audit trail.
 */
router.post('/payments/notify', bridgeAuth, async (req, res) => {
    const { paymentId, walletAddress, amount, type, txHash } = req.body;

    try {
        // Record into a generic blockchain_events table or a specialized audit table
        await query(
            `INSERT INTO blockchain_events (event_type, event_name, actor_address, tx_hash, event_data)
             VALUES ($1, $2, $3, $4, $5)`,
            ['ecosystem-payment', 'PaymentSettled', walletAddress?.toLowerCase(), txHash, { paymentId, amount, type }]
        );

        logger.info({ paymentId, txHash }, 'Payment notified to ecosystem bridge');
        res.json({ success: true });
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to notify payment via bridge');
        res.status(500).json({ error: 'Internal server error during notification' });
    }
});

module.exports = router;
