/**
 * routes/documents.js — Document validation REST API.
 *
 * Security:
 *  - Input validation with express-validator
 *  - Authentication required for all endpoints
 *  - File hash computed server-side (SHA-256)
 *  - Signature verification via ethers
 *  - asyncRoute wrapper prevents stack trace leaks
 */
const { Router } = require('express');
const { body, param, query: qv, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/security');
const {
    createDocument, getDocument, getDocumentByHash,
    listDocuments, startValidation, approveDocument,
    rejectDocument, linkQRToDocument, addSignature,
    getSignatures, getDocumentStats, computeFileHash,
} = require('../services/documentService');
const { createQR } = require('../services/qrService');

const router = Router();

const VALID_DOC_TYPES = [
    'invoice', 'bill_of_lading', 'certificate_of_origin', 'customs_declaration',
    'inspection_report', 'insurance_certificate', 'packing_list', 'contract', 'other',
];

function asyncRoute(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            console.error(`[documents] ${req.method} ${req.path}:`, err.message);
            if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
        });
    };
}

// ═══════════════════════════════════
//  DOCUMENT MANAGEMENT
// ═══════════════════════════════════

/**
 * POST / — Register a new document for validation.
 */
router.post('/', authenticateToken, [
    body('docType').isIn(VALID_DOC_TYPES),
    body('title').isLength({ min: 1, max: 255 }).trim(),
    body('description').optional().isLength({ max: 2000 }),
    body('fileHash').matches(/^0x[a-fA-F0-9]{64}$/).withMessage('fileHash must be SHA-256 hex (0x...)'),
    body('fileName').isLength({ min: 1, max: 255 }),
    body('fileSize').optional().isInt({ min: 1 }),
    body('mimeType').optional().isLength({ max: 100 }),
    body('ipfsCid').optional().isLength({ min: 1, max: 100 }),
    body('storageUrl').optional().isURL(),
    body('enterpriseId').optional().isUUID(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const doc = await createDocument({
        ...req.body,
        ownerAddress: req.user.address,
    });

    res.status(201).json(doc);
}));

/**
 * GET / — List own documents.
 */
router.get('/', authenticateToken, [
    qv('docType').optional().isIn(VALID_DOC_TYPES),
    qv('status').optional().isIn(['pending', 'validating', 'approved', 'rejected', 'expired', 'revoked']),
    qv('limit').optional().isInt({ min: 1, max: 200 }),
    qv('offset').optional().isInt({ min: 0 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const docs = await listDocuments(req.user.address, {
        docType: req.query.docType,
        status: req.query.status,
        limit: parseInt(req.query.limit, 10) || 50,
        offset: parseInt(req.query.offset, 10) || 0,
    });

    res.json({ documents: docs });
}));

/**
 * GET /stats — Document stats for authenticated user.
 */
router.get('/stats', authenticateToken, asyncRoute(async (req, res) => {
    const stats = await getDocumentStats(req.user.address);
    res.json({ stats });
}));

/**
 * GET /verify/:fileHash — Verify a document by its file hash (public).
 */
router.get('/verify/:fileHash', [
    param('fileHash').matches(/^0x[a-fA-F0-9]{64}$/),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const doc = await getDocumentByHash(req.params.fileHash);
    if (!doc) return res.status(404).json({ error: 'Document not found', verified: false });

    res.json({
        verified: doc.status === 'approved',
        status: doc.status,
        docType: doc.doc_type,
        title: doc.title,
        validatedAt: doc.validated_at,
        txHash: doc.tx_hash,
        blockNumber: doc.block_number,
    });
}));

/**
 * GET /:id — Get document details.
 */
router.get('/:id', authenticateToken, [
    param('id').isUUID(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Owner or validator can view
    const isOwner = doc.owner_address.toLowerCase() === req.user.address.toLowerCase();
    const isValidator = doc.validator_address?.toLowerCase() === req.user.address.toLowerCase();
    if (!isOwner && !isValidator && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to view this document' });
    }

    const signatures = await getSignatures(req.params.id);
    res.json({ ...doc, signatures });
}));

// ═══════════════════════════════════
//  VALIDATION WORKFLOW
// ═══════════════════════════════════

/**
 * POST /:id/validate — Start validation process (validator/admin only).
 */
router.post('/:id/validate', authenticateToken, [
    param('id').isUUID(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const started = await startValidation(req.params.id, req.user.address);
    if (!started) return res.status(400).json({ error: 'Document not in pending status or not found' });

    res.json({ success: true, message: 'Validation started' });
}));

/**
 * POST /:id/approve — Approve a document (validator/admin only).
 */
router.post('/:id/approve', authenticateToken, [
    param('id').isUUID(),
    body('txHash').optional().matches(/^0x[a-fA-F0-9]{64}$/),
    body('blockNumber').optional().isInt({ min: 0 }),
    body('aiConfidence').optional().isFloat({ min: 0, max: 1 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const approved = await approveDocument(req.params.id, req.user.address, {
        txHash: req.body.txHash,
        blockNumber: req.body.blockNumber,
        aiConfidence: req.body.aiConfidence,
    });

    if (!approved) return res.status(400).json({ error: 'Cannot approve document' });
    res.json({ success: true, message: 'Document approved' });
}));

/**
 * POST /:id/reject — Reject a document (validator/admin only).
 */
router.post('/:id/reject', authenticateToken, [
    param('id').isUUID(),
    body('reason').isLength({ min: 1, max: 500 }),
    body('aiConfidence').optional().isFloat({ min: 0, max: 1 }),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const rejected = await rejectDocument(req.params.id, req.user.address, req.body.reason, {
        aiConfidence: req.body.aiConfidence,
    });

    if (!rejected) return res.status(400).json({ error: 'Cannot reject document' });
    res.json({ success: true, message: 'Document rejected' });
}));

// ═══════════════════════════════════
//  SIGNATURES
// ═══════════════════════════════════

/**
 * POST /:id/sign — Add a digital signature to a document.
 */
router.post('/:id/sign', authenticateToken, [
    param('id').isUUID(),
    body('signature').isLength({ min: 1 }),
    body('messageHash').matches(/^0x[a-fA-F0-9]{64}$/),
    body('txHash').optional().matches(/^0x[a-fA-F0-9]{64}$/),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const result = await addSignature(
        req.params.id,
        req.user.address,
        req.body.signature,
        req.body.messageHash,
        req.body.txHash,
    );

    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result);
}));

/**
 * GET /:id/signatures — List all signatures for a document.
 */
router.get('/:id/signatures', authenticateToken, [
    param('id').isUUID(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const signatures = await getSignatures(req.params.id);
    res.json({ signatures });
}));

// ═══════════════════════════════════
//  QR LINKING
// ═══════════════════════════════════

/**
 * POST /:id/qr — Generate and link a QR code to a document.
 */
router.post('/:id/qr', authenticateToken, [
    param('id').isUUID(),
], asyncRoute(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (doc.owner_address.toLowerCase() !== req.user.address.toLowerCase()) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    // Create a validation QR linked to this document
    const qr = await createQR({
        type: 'validation',
        ownerAddress: req.user.address,
        enterpriseId: doc.enterprise_id,
        data: { documentId: doc.id, fileHash: doc.file_hash },
        maxScans: req.body.maxScans || 100,
        expiresInHours: req.body.expiresInHours || 8760, // 1 year default
    });

    await linkQRToDocument(doc.id, qr.id);

    res.status(201).json({ qr, documentId: doc.id });
}));

module.exports = router;
