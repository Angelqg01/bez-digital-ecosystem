/**
 * documentService.js — Document validation, blockchain anchoring, and signature management.
 *
 * Supports:
 *  - Upload document metadata + file hash
 *  - AI-assisted pre-validation (via Aegis)
 *  - Blockchain anchoring (file hash stored on-chain)
 *  - Multi-party digital signatures (wallet-based)
 *  - QR code linking for physical verification
 *
 * Security:
 *  - File hashes computed server-side (SHA-256)
 *  - Parameterized SQL queries only
 *  - Signature verification via ethers.verifyMessage
 */
const crypto = require('crypto');
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const { cacheGet, cacheSet, cacheDelete } = require('../cache/redis');

// ── Helpers ──

function computeFileHash(buffer) {
    return '0x' + crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── CRUD ──

async function createDocument({
    docType, title, description, ownerAddress, enterpriseId,
    fileHash, fileName, fileSize, mimeType, ipfsCid, storageUrl,
    expiresAt, metadata,
}) {
    const { rows } = await query(
        `INSERT INTO documents (
            doc_type, title, description, owner_address, enterprise_id,
            file_hash, file_name, file_size, mime_type, ipfs_cid, storage_url,
            expires_at, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *`,
        [
            docType, title, description || null, ownerAddress, enterpriseId || null,
            fileHash, fileName, fileSize || null, mimeType || null, ipfsCid || null, storageUrl || null,
            expiresAt || null, metadata ? JSON.stringify(metadata) : null,
        ]
    );
    return rows[0];
}

async function getDocument(id) {
    const cacheKey = `doc:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const { rows } = await query(
        `SELECT d.*, e.name AS enterprise_name,
            (SELECT COUNT(*)::int FROM document_signatures WHERE document_id = d.id) AS signature_count
         FROM documents d
         LEFT JOIN enterprises e ON d.enterprise_id = e.id
         WHERE d.id = $1`,
        [id]
    );

    if (rows.length === 0) return null;
    await cacheSet(cacheKey, rows[0], 30);
    return rows[0];
}

async function getDocumentByHash(fileHash) {
    const { rows } = await query(
        'SELECT * FROM documents WHERE file_hash = $1 ORDER BY created_at DESC LIMIT 1',
        [fileHash]
    );
    return rows[0] || null;
}

async function listDocuments(ownerAddress, { docType, status, limit = 50, offset = 0 } = {}) {
    let sql = `SELECT d.*, 
        (SELECT COUNT(*)::int FROM document_signatures WHERE document_id = d.id) AS signature_count
        FROM documents d WHERE d.owner_address = $1`;
    const params = [ownerAddress];
    let idx = 2;

    if (docType) { sql += ` AND d.doc_type = $${idx++}`; params.push(docType); }
    if (status) { sql += ` AND d.status = $${idx++}`; params.push(status); }

    sql += ` ORDER BY d.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);
    return rows;
}

async function listDocumentsByEnterprise(enterpriseId, { status, limit = 50 } = {}) {
    let sql = 'SELECT * FROM documents WHERE enterprise_id = $1';
    const params = [enterpriseId];
    let idx = 2;

    if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
    sql += ` ORDER BY created_at DESC LIMIT $${idx++}`;
    params.push(limit);

    const { rows } = await query(sql, params);
    return rows;
}

// ── Validation Workflow ──

async function startValidation(documentId, validatorAddress) {
    const { rowCount } = await query(
        `UPDATE documents SET status = 'validating', validator_address = $1, updated_at = NOW()
         WHERE id = $2 AND status = 'pending'`,
        [validatorAddress, documentId]
    );
    await cacheDelete(`doc:${documentId}`);
    return rowCount > 0;
}

async function approveDocument(documentId, validatorAddress, { txHash, blockNumber, aiConfidence } = {}) {
    const { rowCount } = await query(
        `UPDATE documents SET 
            status = 'approved', 
            validator_address = $1, 
            validated_at = NOW(),
            tx_hash = $2,
            block_number = $3,
            ai_confidence = $4,
            ai_verdict = 'approved',
            updated_at = NOW()
         WHERE id = $5 AND status IN ('pending', 'validating')`,
        [validatorAddress, txHash || null, blockNumber || null, aiConfidence || null, documentId]
    );
    await cacheDelete(`doc:${documentId}`);
    return rowCount > 0;
}

async function rejectDocument(documentId, validatorAddress, reason, { aiConfidence } = {}) {
    const { rowCount } = await query(
        `UPDATE documents SET 
            status = 'rejected', 
            validator_address = $1,
            validated_at = NOW(),
            rejection_reason = $2,
            ai_confidence = $3,
            ai_verdict = 'rejected',
            updated_at = NOW()
         WHERE id = $4 AND status IN ('pending', 'validating')`,
        [validatorAddress, reason, aiConfidence || null, documentId]
    );
    await cacheDelete(`doc:${documentId}`);
    return rowCount > 0;
}

async function linkQRToDocument(documentId, qrCodeId) {
    const { rowCount } = await query(
        'UPDATE documents SET qr_code_id = $1, updated_at = NOW() WHERE id = $2',
        [qrCodeId, documentId]
    );
    await cacheDelete(`doc:${documentId}`);
    return rowCount > 0;
}

// ── Digital Signatures ──

async function addSignature(documentId, signerAddress, signature, messageHash, txHash) {
    // Verify signature matches signer
    try {
        const recoveredAddress = ethers.verifyMessage(
            ethers.getBytes(messageHash),
            signature
        );
        if (recoveredAddress.toLowerCase() !== signerAddress.toLowerCase()) {
            return { success: false, error: 'Signature does not match signer address' };
        }
    } catch {
        return { success: false, error: 'Invalid signature format' };
    }

    try {
        const { rows } = await query(
            `INSERT INTO document_signatures (document_id, signer_address, signature, message_hash, tx_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, signer_address, signed_at`,
            [documentId, signerAddress, signature, messageHash, txHash || null]
        );
        await cacheDelete(`doc:${documentId}`);
        return { success: true, signature: rows[0] };
    } catch (err) {
        if (err.code === '23505') { // unique violation
            return { success: false, error: 'Document already signed by this address' };
        }
        throw err;
    }
}

async function getSignatures(documentId) {
    const { rows } = await query(
        'SELECT * FROM document_signatures WHERE document_id = $1 ORDER BY signed_at ASC',
        [documentId]
    );
    return rows;
}

async function verifyDocumentIntegrity(documentId, fileBuffer) {
    const doc = await getDocument(documentId);
    if (!doc) return { valid: false, error: 'Document not found' };

    const currentHash = computeFileHash(fileBuffer);
    const isMatch = currentHash === doc.file_hash;

    return {
        valid: isMatch,
        originalHash: doc.file_hash,
        currentHash,
        status: doc.status,
        signatureCount: doc.signature_count,
    };
}

// ── Stats ──

async function getDocumentStats(ownerAddress) {
    const { rows } = await query(
        `SELECT 
            doc_type,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
         FROM documents
         WHERE owner_address = $1
         GROUP BY doc_type`,
        [ownerAddress]
    );
    return rows;
}

module.exports = {
    computeFileHash,
    createDocument,
    getDocument,
    getDocumentByHash,
    listDocuments,
    listDocumentsByEnterprise,
    startValidation,
    approveDocument,
    rejectDocument,
    linkQRToDocument,
    addSignature,
    getSignatures,
    verifyDocumentIntegrity,
    getDocumentStats,
};
