/**
 * webhook-tier-gate.js — Unified webhook access control.
 *
 * Webhooks are only available to subscribers on the 2nd and 3rd most expensive
 * plans (professional / enterprise).
 *
 * Works with three identity sources:
 *  1. JWT user  → looks up subscription tier via ai_billing_subscriptions
 *  2. Enterprise (B2B) → looks up enterprises.tier
 *  3. Registered App (Gateway) → uses app_registry.tier
 */
const { query } = require('../db/pool');
const logger = require('pino')({ level: 'info', name: 'webhook-tier-gate' });

// Tiers that are allowed to use webhooks (2nd and 3rd most expensive plans)
const ALLOWED_SUBSCRIPTION_TIERS = ['professional', 'enterprise'];
const ALLOWED_ENTERPRISE_TIERS   = ['professional', 'enterprise'];
const ALLOWED_APP_TIERS          = ['premium', 'internal'];

/**
 * Middleware: Require a qualifying subscription tier before allowing webhook access.
 *
 * Must be placed AFTER authentication middleware (authenticateToken, authenticateApp,
 * or requireAuth).
 *
 * Resolution order:
 *  1. req.registeredApp (gateway API-key auth)  → check app_registry.tier
 *  2. req.user          (JWT / SSO auth)        → check enterprise tier, then subscription tier
 *  3. req.enterpriseTier (set upstream by edge/enterprise-node after API lookup)
 */
function requireWebhookTier(req, res, next) {
    // ── 1. Gateway-registered app ──
    if (req.registeredApp) {
        const tier = req.registeredApp.tier;
        if (ALLOWED_APP_TIERS.includes(tier)) {
            return next();
        }
        logger.warn({ app: req.registeredApp.name, tier }, 'Webhook access denied — app tier insufficient');
        return res.status(403).json({
            error: 'Webhook access requires a premium or internal app tier.',
            current_tier: tier,
            required_tiers: ALLOWED_APP_TIERS,
        });
    }

    // ── 2. Enterprise tier supplied upstream (edge-node / enterprise-node) ──
    if (req.enterpriseTier) {
        if (ALLOWED_ENTERPRISE_TIERS.includes(req.enterpriseTier)) {
            return next();
        }
        return res.status(403).json({
            error: 'Webhook access requires a professional or enterprise plan.',
            current_tier: req.enterpriseTier,
            required_tiers: ALLOWED_ENTERPRISE_TIERS,
        });
    }

    // ── 3. JWT-authenticated user → DB lookup ──
    if (req.user && req.user.address) {
        return resolveUserTier(req, res, next);
    }

    return res.status(401).json({ error: 'Authentication required to access webhooks.' });
}

/**
 * Internal: resolve a JWT user's webhook eligibility from the DB.
 * Checks enterprise tier first, then falls back to AI billing subscription.
 */
async function resolveUserTier(req, res, next) {
    const addr = req.user.address;

    try {
        // Check enterprise tier
        const entRes = await query(
            'SELECT tier FROM enterprises WHERE wallet_address = $1 LIMIT 1',
            [addr]
        );
        if (entRes.rows.length > 0) {
            const tier = entRes.rows[0].tier;
            if (ALLOWED_ENTERPRISE_TIERS.includes(tier)) {
                req.enterpriseTier = tier;
                return next();
            }
            return res.status(403).json({
                error: 'Webhook access requires a professional or enterprise plan.',
                current_tier: tier,
                required_tiers: ALLOWED_ENTERPRISE_TIERS,
            });
        }

        // Fall back to AI billing subscription tier
        const subRes = await query(
            `SELECT tier FROM ai_billing_subscriptions
             WHERE user_address = $1 AND status = 'active'
             ORDER BY created_at DESC LIMIT 1`,
            [addr]
        );
        if (subRes.rows.length > 0) {
            const tier = subRes.rows[0].tier;
            if (ALLOWED_SUBSCRIPTION_TIERS.includes(tier)) {
                return next();
            }
            return res.status(403).json({
                error: 'Webhook access requires a professional or enterprise subscription.',
                current_tier: tier,
                required_tiers: ALLOWED_SUBSCRIPTION_TIERS,
            });
        }

        return res.status(403).json({
            error: 'No active subscription found. Webhook access requires professional or enterprise plan.',
            required_tiers: ALLOWED_SUBSCRIPTION_TIERS,
        });
    } catch (err) {
        logger.error({ error: err.message }, 'Webhook tier check failed');
        return res.status(500).json({ error: 'Internal error during subscription verification.' });
    }
}

module.exports = {
    requireWebhookTier,
    ALLOWED_SUBSCRIPTION_TIERS,
    ALLOWED_ENTERPRISE_TIERS,
    ALLOWED_APP_TIERS,
};
