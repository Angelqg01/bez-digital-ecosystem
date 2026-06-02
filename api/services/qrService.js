/**
 * qrService.js — QR code generation, validation, and scan tracking.
 *
 * Supports:
 *  - Payment QRs (BEZ transfer requests)
 *  - Tracking QRs (shipment/NFT tracking)
 *  - Validation QRs (document verification)
 *  - Identity QRs (wallet identity)
 *  - Custom QRs (enterprise-defined payloads)
 *
 * Security:
 *  - Codes generated with crypto.randomBytes (128-bit entropy)
 *  - All DB access uses parameterized queries
 *  - Scan rate-limiting via max_scans + expiry
 */
const crypto = require('crypto');
const { query } = require('../db/pool');
const { cacheGet, cacheSet, cacheDelete } = require('../cache/redis');

// ── Code generation ──

function generateCode() {
    return crypto.randomBytes(16).toString('hex'); // 32-char hex
}

function buildPayload(type, data) {
    const base = { version: 1, type, ts: Date.now() };
    switch (type) {
        case 'payment':
            return { ...base, recipient: data.recipient, amount: data.amount, currency: 'BEZ', memo: data.memo };
        case 'tracking':
            return { ...base, shipmentId: data.shipmentId, nftTokenId: data.nftTokenId, checkpoints: [] };
        case 'validation':
            return { ...base, documentId: data.documentId, fileHash: data.fileHash };
        case 'identity':
            return { ...base, walletAddress: data.walletAddress, displayName: data.displayName };
        case 'custom':
            return { ...base, ...data.payload };
        default:
            return base;
    }
}

// ── CRUD Operations ──

async function createQR({ type, ownerAddress, enterpriseId, data, maxScans, expiresInHours }) {
    const code = generateCode();
    const payload = buildPayload(type, data || {});
    const expiresAt = expiresInHours
        ? new Date(Date.now() + expiresInHours * 3600000).toISOString()
        : null;

    const { rows } = await query(
        `INSERT INTO qr_codes (code, type, owner_address, enterprise_id, payload, amount_bez, recipient, shipment_id, nft_token_id, max_scans, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, code, type, status, payload, max_scans, expires_at, created_at`,
        [
            code, type, ownerAddress, enterpriseId || null,
            JSON.stringify(payload),
            data?.amount || null, data?.recipient || null,
            data?.shipmentId || null, data?.nftTokenId || null,
            maxScans || 1, expiresAt,
        ]
    );

    return rows[0];
}

async function getQR(code) {
    const cacheKey = `qr:${code}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const { rows } = await query(
        `SELECT q.*, e.name AS enterprise_name
         FROM qr_codes q
         LEFT JOIN enterprises e ON q.enterprise_id = e.id
         WHERE q.code = $1`,
        [code]
    );

    if (rows.length === 0) return null;
    const qr = rows[0];
    await cacheSet(cacheKey, qr, 60);
    return qr;
}

async function getQRById(id) {
    const { rows } = await query('SELECT * FROM qr_codes WHERE id = $1', [id]);
    return rows[0] || null;
}

async function listQRsByOwner(ownerAddress, { type, status, limit = 50, offset = 0 } = {}) {
    let sql = 'SELECT * FROM qr_codes WHERE owner_address = $1';
    const params = [ownerAddress];
    let idx = 2;

    if (type) { sql += ` AND type = $${idx++}`; params.push(type); }
    if (status) { sql += ` AND status = $${idx++}`; params.push(status); }

    sql += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);
    return rows;
}

async function listQRsByEnterprise(enterpriseId, { type, limit = 50 } = {}) {
    let sql = 'SELECT * FROM qr_codes WHERE enterprise_id = $1';
    const params = [enterpriseId];
    let idx = 2;

    if (type) { sql += ` AND type = $${idx++}`; params.push(type); }
    sql += ` ORDER BY created_at DESC LIMIT $${idx++}`;
    params.push(limit);

    const { rows } = await query(sql, params);
    return rows;
}

// ── Scan & Validate ──

async function scanQR(code, { scannedBy, ipAddress, userAgent, gpsLat, gpsLng } = {}) {
    const qr = await getQR(code);
    if (!qr) return { valid: false, result: 'invalid', error: 'QR code not found' };

    // Check status
    if (qr.status === 'revoked') return { valid: false, result: 'revoked', error: 'QR code has been revoked' };
    if (qr.status === 'expired') return { valid: false, result: 'expired', error: 'QR code has expired' };

    // Check expiry
    if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
        await query('UPDATE qr_codes SET status = $1, updated_at = NOW() WHERE id = $2', ['expired', qr.id]);
        await cacheDelete(`qr:${code}`);
        return { valid: false, result: 'expired', error: 'QR code has expired' };
    }

    // Check scan limit
    if (qr.scan_count >= qr.max_scans) {
        if (qr.status !== 'used') {
            await query('UPDATE qr_codes SET status = $1, updated_at = NOW() WHERE id = $2', ['used', qr.id]);
            await cacheDelete(`qr:${code}`);
        }
        return { valid: false, result: 'limit_reached', error: 'QR code scan limit reached' };
    }

    // Record scan
    await query(
        `INSERT INTO qr_scans (qr_id, scanned_by, ip_address, user_agent, gps_lat, gps_lng, result)
         VALUES ($1, $2, $3, $4, $5, $6, 'success')`,
        [qr.id, scannedBy || null, ipAddress || null, userAgent || null, gpsLat || null, gpsLng || null]
    );

    // Increment scan count
    const newCount = qr.scan_count + 1;
    const newStatus = newCount >= qr.max_scans ? 'used' : 'active';
    await query(
        'UPDATE qr_codes SET scan_count = $1, status = $2, updated_at = NOW() WHERE id = $3',
        [newCount, newStatus, qr.id]
    );
    await cacheDelete(`qr:${code}`);

    return {
        valid: true,
        result: 'success',
        qr: { ...qr, scan_count: newCount, status: newStatus },
        payload: qr.payload,
    };
}

async function getScanHistory(qrId, limit = 100) {
    const { rows } = await query(
        `SELECT * FROM qr_scans WHERE qr_id = $1 ORDER BY scanned_at DESC LIMIT $2`,
        [qrId, limit]
    );
    return rows;
}

async function revokeQR(code, ownerAddress) {
    const { rowCount } = await query(
        `UPDATE qr_codes SET status = 'revoked', updated_at = NOW()
         WHERE code = $1 AND owner_address = $2 AND status = 'active'`,
        [code, ownerAddress]
    );
    await cacheDelete(`qr:${code}`);
    return rowCount > 0;
}

// ── Stats ──

async function getQRStats(ownerAddress) {
    const { rows } = await query(
        `SELECT 
            type,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'used')::int AS used,
            SUM(scan_count)::int AS total_scans
         FROM qr_codes
         WHERE owner_address = $1
         GROUP BY type`,
        [ownerAddress]
    );
    return rows;
}

module.exports = {
    createQR,
    getQR,
    getQRById,
    listQRsByOwner,
    listQRsByEnterprise,
    scanQR,
    getScanHistory,
    revokeQR,
    getQRStats,
};
