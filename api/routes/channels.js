/**
 * routes/channels.js — Multichannel communication REST API.
 *
 * Security:
 *  - All endpoints require authentication
 *  - Channel verification via 6-digit code
 *  - Input validation with express-validator
 *  - asyncRoute wrapper prevents stack trace leaks
 */
const { Router } = require('express');
const { body, param, query: qv, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const { query } = require('../db/pool');
const {
    registerChannel, verifyChannel, getUserChannels, removeChannel,
    sendMessage, notifyUser, getNotificationPreferences,
    setNotificationPreference, getMessageHistory,
} = require('../services/channelService');

const router = Router();

const VALID_CHANNEL_TYPES = ['email', 'whatsapp', 'telegram', 'discord', 'slack', 'webhook', 'sms'];
const VALID_EVENT_TYPES = [
    'transaction_confirmed', 'payment_received', 'document_approved', 'document_rejected',
    'validator_reward', 'qr_scanned', 'security_alert', 'shipment_update',
];

function asyncRoute(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            console.error(`[channels] ${req.method} ${req.path}:`, err.message);
            if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
        });
    };
}

/** Resolve user UUID from wallet address. */
async function resolveUserId(walletAddress) {
    const { rows } = await query('SELECT id FROM users WHERE wallet_address = $1', [walletAddress]);
    return rows.length > 0 ? rows[0].id : null;
}

// ═══════════════════════════════════
//  CHANNEL MANAGEMENT
// ═══════════════════════════════════

/**
 * GET / — List all registered channels for authenticated user.
 */
router.get('/', authenticateToken, asyncRoute(async (req, res) => {
    const userId = await resolveUserId(req.user.address);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const channels = await getUserChannels(userId);
    res.json({ channels });
}));

/**
 * POST / — Register a new communication channel.
 */
router.post('/', authenticateToken, [
    body('channelType').isIn(VALID_CHANNEL_TYPES),
    body('channelId').isLength({ min: 1, max: 255 }).trim(),
    body('displayName').optional().isLength({ max: 100 }).trim(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = await resolveUserId(req.user.address);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const channel = await registerChannel(
        userId,
        req.body.channelType,
        req.body.channelId,
        req.body.displayName,
    );

    res.status(201).json(channel);
}));

/**
 * POST /verify — Verify a channel with the verification code.
 */
router.post('/verify', authenticateToken, [
    body('channelType').isIn(VALID_CHANNEL_TYPES),
    body('channelId').isLength({ min: 1, max: 255 }),
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = await resolveUserId(req.user.address);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const result = await verifyChannel(userId, req.body.channelType, req.body.channelId, req.body.code);
    if (!result.success) return res.status(400).json({ error: result.error });

    res.json(result);
}));

/**
 * DELETE /:channelId — Remove (deactivate) a channel.
 */
router.delete('/:channelId', authenticateToken, [
    param('channelId').isUUID(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = await resolveUserId(req.user.address);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const removed = await removeChannel(userId, req.params.channelId);
    if (!removed) return res.status(404).json({ error: 'Channel not found' });

    res.json({ success: true, message: 'Channel deactivated' });
}));

// ═══════════════════════════════════
//  SEND MESSAGES
// ═══════════════════════════════════

/**
 * POST /send — Send a message through a specific channel.
 */
router.post('/send', authenticateToken, [
    body('channelType').isIn(VALID_CHANNEL_TYPES),
    body('recipient').isLength({ min: 1, max: 255 }),
    body('template').optional().isIn(Object.keys(require('../services/channelService').TEMPLATES)),
    body('templateVars').optional().isObject(),
    body('subject').optional().isLength({ max: 255 }),
    body('body').optional().isLength({ min: 1, max: 5000 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (!req.body.template && !req.body.body) {
        return res.status(400).json({ error: 'Either template or body is required' });
    }

    const userId = await resolveUserId(req.user.address);

    const message = await sendMessage({
        userId,
        channelType: req.body.channelType,
        recipient: req.body.recipient,
        template: req.body.template,
        templateVars: req.body.templateVars,
        subject: req.body.subject,
        body: req.body.body,
    });

    res.status(201).json(message);
}));

/**
 * POST /notify — Trigger a notification to a user across all their channels.
 */
router.post('/notify', authenticateToken, [
    body('targetAddress').isEthereumAddress(),
    body('eventType').isIn(VALID_EVENT_TYPES),
    body('vars').optional().isObject(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const targetUserId = await resolveUserId(req.body.targetAddress);
    if (!targetUserId) return res.status(404).json({ error: 'Target user not found' });

    const results = await notifyUser(targetUserId, req.body.eventType, req.body.vars || {});
    res.json({ dispatched: results });
}));

// ═══════════════════════════════════
//  NOTIFICATION PREFERENCES
// ═══════════════════════════════════

/**
 * GET /preferences — Get notification preferences.
 */
router.get('/preferences', authenticateToken, asyncRoute(async (req, res) => {
    const userId = await resolveUserId(req.user.address);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const prefs = await getNotificationPreferences(userId);
    res.json({ preferences: prefs, availableEvents: VALID_EVENT_TYPES, availableChannels: VALID_CHANNEL_TYPES });
}));

/**
 * PUT /preferences — Update a notification preference.
 */
router.put('/preferences', authenticateToken, [
    body('eventType').isIn(VALID_EVENT_TYPES),
    body('channelTypes').isArray(),
    body('channelTypes.*').isIn(VALID_CHANNEL_TYPES),
    body('isEnabled').optional().isBoolean(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = await resolveUserId(req.user.address);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const pref = await setNotificationPreference(
        userId,
        req.body.eventType,
        req.body.channelTypes,
        req.body.isEnabled !== false,
    );

    res.json(pref);
}));

// ═══════════════════════════════════
//  MESSAGE HISTORY
// ═══════════════════════════════════

/**
 * GET /messages — Get message history for authenticated user.
 */
router.get('/messages', authenticateToken, [
    qv('channelType').optional().isIn(VALID_CHANNEL_TYPES),
    qv('status').optional().isIn(['queued', 'sent', 'delivered', 'read', 'failed', 'bounced']),
    qv('limit').optional().isInt({ min: 1, max: 200 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = await resolveUserId(req.user.address);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const messages = await getMessageHistory(userId, {
        channelType: req.query.channelType,
        status: req.query.status,
        limit: parseInt(req.query.limit, 10) || 50,
    });

    res.json({ messages });
}));

/**
 * GET /templates — List available message templates.
 */
router.get('/templates', authenticateToken, (_req, res) => {
    const { TEMPLATES } = require('../services/channelService');
    const templateList = Object.entries(TEMPLATES).map(([key, val]) => ({
        name: key,
        subject: val.subject,
        bodyTemplate: val.body,
    }));
    res.json({ templates: templateList });
});

module.exports = router;
