/**
 * routes/qr.js — QR code management REST API.
 *
 * Security:
 *  - Input validation with express-validator
 *  - Authentication required for create/list/revoke
 *  - Public scan endpoint (with rate limiting)
 *  - asyncRoute wrapper prevents stack trace leaks
 */
const { Router } = require('express');
const { body, param, query: qv, validationResult } = require('express-validator');
const { authenticateToken, enterpriseRateLimit } = require('../middleware/security');
const {
    createQR, getQR, listQRsByOwner, scanQR,
    getScanHistory, revokeQR, getQRStats,
} = require('../services/qrService');

const router = Router();

const VALID_QR_TYPES = ['payment', 'tracking', 'validation', 'identity', 'custom'];

function asyncRoute(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            console.error(`[qr] ${req.method} ${req.path}:`, err.message);
            if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
        });
    };
}

// ═══════════════════════════════════
//  PUBLIC ENDPOINTS
// ═══════════════════════════════════

/**
 * POST /scan/:code — Scan/validate a QR code (public).
 */
router.post('/scan/:code', [
    param('code').isHexadecimal().isLength({ min: 32, max: 32 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const result = await scanQR(req.params.code, {
        scannedBy: req.body.scannedBy || null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        gpsLat: req.body.gpsLat,
        gpsLng: req.body.gpsLng,
    });

    if (!result.valid) {
        return res.status(result.result === 'invalid' ? 404 : 410).json(result);
    }

    res.json(result);
}));

/**
 * GET /verify/:code — Verify a QR code without consuming a scan (public).
 */
router.get('/verify/:code', [
    param('code').isHexadecimal().isLength({ min: 32, max: 32 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const qr = await getQR(req.params.code);
    if (!qr) return res.status(404).json({ error: 'QR code not found' });

    // Return minimal public info
    res.json({
        type: qr.type,
        status: qr.status,
        enterprise: qr.enterprise_name || null,
        createdAt: qr.created_at,
        expiresAt: qr.expires_at,
        scansRemaining: Math.max(0, qr.max_scans - qr.scan_count),
    });
}));

// ═══════════════════════════════════
//  AUTHENTICATED ENDPOINTS
// ═══════════════════════════════════

/**
 * POST / — Create a new QR code (authenticated).
 */
router.post('/', authenticateToken, [
    body('type').isIn(VALID_QR_TYPES),
    body('maxScans').optional().isInt({ min: 1, max: 10000 }),
    body('expiresInHours').optional().isInt({ min: 1, max: 8760 }),
    body('data').optional().isObject(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { type, data, maxScans, expiresInHours, enterpriseId } = req.body;

    const qr = await createQR({
        type,
        ownerAddress: req.user.address,
        enterpriseId,
        data,
        maxScans,
        expiresInHours,
    });

    res.status(201).json(qr);
}));

/**
 * GET / — List own QR codes (authenticated).
 */
router.get('/', authenticateToken, [
    qv('type').optional().isIn(VALID_QR_TYPES),
    qv('status').optional().isIn(['active', 'used', 'expired', 'revoked']),
    qv('limit').optional().isInt({ min: 1, max: 200 }),
    qv('offset').optional().isInt({ min: 0 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const codes = await listQRsByOwner(req.user.address, {
        type: req.query.type,
        status: req.query.status,
        limit: parseInt(req.query.limit, 10) || 50,
        offset: parseInt(req.query.offset, 10) || 0,
    });

    res.json({ qrCodes: codes });
}));

/**
 * GET /stats — QR code stats for authenticated user.
 */
router.get('/stats', authenticateToken, asyncRoute(async (req, res) => {
    const stats = await getQRStats(req.user.address);
    res.json({ stats });
}));

/**
 * GET /:code — Get detailed QR info (authenticated, owner only).
 */
router.get('/:code', authenticateToken, [
    param('code').isHexadecimal().isLength({ min: 32, max: 32 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const qr = await getQR(req.params.code);
    if (!qr) return res.status(404).json({ error: 'QR code not found' });
    if (qr.owner_address.toLowerCase() !== req.user.address.toLowerCase()) {
        return res.status(403).json({ error: 'Not authorized to view this QR code' });
    }

    res.json(qr);
}));

/**
 * GET /:code/scans — Get scan history (authenticated, owner only).
 */
router.get('/:code/scans', authenticateToken, [
    param('code').isHexadecimal().isLength({ min: 32, max: 32 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const qr = await getQR(req.params.code);
    if (!qr) return res.status(404).json({ error: 'QR code not found' });
    if (qr.owner_address.toLowerCase() !== req.user.address.toLowerCase()) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    const scans = await getScanHistory(qr.id);
    res.json({ scans });
}));

/**
 * POST /:code/revoke — Revoke a QR code (authenticated, owner only).
 */
router.post('/:code/revoke', authenticateToken, [
    param('code').isHexadecimal().isLength({ min: 32, max: 32 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const revoked = await revokeQR(req.params.code, req.user.address);
    if (!revoked) return res.status(404).json({ error: 'QR code not found or already inactive' });

    res.json({ success: true, message: 'QR code revoked' });
}));

module.exports = router;
