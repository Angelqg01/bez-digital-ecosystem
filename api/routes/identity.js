/**
 * api/routes/identity.js
 *
 * SuperAdmin Identity & Secrets Vault
 *
 * Endpoints:
 *   GET  /api/identity/did       — Retrieve DID profile
 *   GET  /api/identity/secrets   — List secrets metadata (names only, no values)
 *   POST /api/identity/secrets   — Create/update a secret (encrypted at rest)
 *   GET  /api/identity/secrets/:name/reveal — Reveal a secret value (audit-logged)
 *   GET  /api/identity/nodes     — List authorized OpenClaw execution nodes
 *   POST /api/identity/nodes     — Authorize a new execution node
 *   DELETE /api/identity/nodes/:nodeId — Revoke an execution node
 *
 * Security model:
 *   - All endpoints require authenticateToken + admin role
 *   - Secret values are stored in the database encrypted with AES-256-GCM
 *   - Every /reveal call is audit-logged with userId, IP, and timestamp
 *
 * NOTE: Secret encryption key must be set in VAULT_KEY env var (32-byte hex)
 */
'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/security');
const { query } = require('../db/pool');

// ── Encryption helpers ───────────────────────────────────────────────────────

const VAULT_KEY = process.env.VAULT_KEY
    ? Buffer.from(process.env.VAULT_KEY, 'hex')
    : crypto.randomBytes(32); // Fallback: ephemeral key (secrets won't survive restart)

const ALGO = 'aes-256-gcm';

function encrypt(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, VAULT_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext) {
    const [ivHex, tagHex, encHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, VAULT_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
    return decrypted.toString('utf8');
}

// ── Middleware: require superadmin ───────────────────────────────────────────
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Acceso denegado — solo SuperAdmin' });
    }
    next();
};

// ── Ensure tables exist ──────────────────────────────────────────────────────
async function ensureSchema() {
    await query(`
        CREATE TABLE IF NOT EXISTS identity_secrets (
            id          SERIAL PRIMARY KEY,
            name        VARCHAR(128) UNIQUE NOT NULL,
            service     VARCHAR(255),
            encrypted   TEXT NOT NULL,
            updated_by  VARCHAR(255),
            updated_at  TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS identity_nodes (
            id          SERIAL PRIMARY KEY,
            node_id     VARCHAR(128) UNIQUE NOT NULL,
            label       VARCHAR(255),
            ip_address  VARCHAR(64),
            role        VARCHAR(64) DEFAULT 'execution',
            status      VARCHAR(32) DEFAULT 'active',
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            last_seen   TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS identity_audit (
            id          SERIAL PRIMARY KEY,
            action      VARCHAR(128) NOT NULL,
            secret_name VARCHAR(128),
            actor       VARCHAR(255),
            ip          VARCHAR(64),
            created_at  TIMESTAMPTZ DEFAULT NOW()
        );
    `);
}

if (process.env.SKIP_SCHEMA_ON_IMPORT !== 'true') {
    ensureSchema().catch(err => console.error('[identity] Schema error:', err.message));
}

// ── DID Profile ──────────────────────────────────────────────────────────────

router.get('/did', authenticateToken, requireAdmin, (req, res) => {
    // In a real system: resolved from on-chain IdentityRegistry contract
    res.json({
        status: 'success',
        data: {
            did: `did:bezhas:${req.user.address || '0x0000000000000000000000000000000000000000'}`,
            displayName: req.user.display_name || 'SuperAdmin',
            email: req.user.email || '',
            verificationStatus: 'verified',
            biometricLinked: true,
            lastUpdated: new Date().toISOString(),
        },
    });
});

// ── Secrets Vault ─────────────────────────────────────────────────────────────

// List secret names + metadata (never values)
router.get('/secrets', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT id, name, service, updated_by, updated_at FROM identity_secrets ORDER BY name`
        );
        res.json({ status: 'success', data: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Create or update a secret
router.post('/secrets', authenticateToken, requireAdmin, async (req, res) => {
    const { name, value, service } = req.body;
    if (!name || !value) {
        return res.status(400).json({ status: 'error', message: 'name and value are required' });
    }
    try {
        const encrypted = encrypt(value);
        await query(
            `INSERT INTO identity_secrets (name, service, encrypted, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (name) DO UPDATE SET
               service = EXCLUDED.service,
               encrypted = EXCLUDED.encrypted,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()`,
            [name, service || '', encrypted, req.user.address || 'admin']
        );
        // Audit log
        await query(
            `INSERT INTO identity_audit (action, secret_name, actor, ip) VALUES ($1,$2,$3,$4)`,
            ['secret_updated', name, req.user.address, req.ip]
        );
        res.json({ status: 'success', message: `Secret '${name}' guardado correctamente` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Reveal (decrypt) a secret value — audit-logged, admin only
router.get('/secrets/:name/reveal', authenticateToken, requireAdmin, async (req, res) => {
    const { name } = req.params;
    try {
        const { rows } = await query(
            `SELECT encrypted FROM identity_secrets WHERE name = $1`, [name]
        );
        if (!rows.length) {
            return res.status(404).json({ status: 'error', message: 'Secret no encontrado' });
        }
        const value = decrypt(rows[0].encrypted);

        // Audit log every reveal
        await query(
            `INSERT INTO identity_audit (action, secret_name, actor, ip) VALUES ($1,$2,$3,$4)`,
            ['secret_revealed', name, req.user.address, req.ip]
        );

        res.json({ status: 'success', data: { name, value } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error al descifrar el secreto' });
    }
});

// ── Execution Nodes ───────────────────────────────────────────────────────────

router.get('/nodes', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT * FROM identity_nodes ORDER BY status DESC, created_at ASC`
        );
        res.json({ status: 'success', data: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

router.post('/nodes', authenticateToken, requireAdmin, async (req, res) => {
    const { nodeId, label, ipAddress, role } = req.body;
    if (!nodeId || !label) {
        return res.status(400).json({ status: 'error', message: 'nodeId and label are required' });
    }
    try {
        await query(
            `INSERT INTO identity_nodes (node_id, label, ip_address, role) VALUES ($1,$2,$3,$4)`,
            [nodeId, label, ipAddress || '', role || 'execution']
        );
        res.json({ status: 'success', message: `Nodo '${label}' autorizado` });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ status: 'error', message: 'Node ID ya existe' });
        }
        res.status(500).json({ status: 'error', message: err.message });
    }
});

router.delete('/nodes/:nodeId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await query(
            `UPDATE identity_nodes SET status = 'revoked' WHERE node_id = $1`,
            [req.params.nodeId]
        );
        res.json({ status: 'success', message: 'Nodo revocado' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ── Audit Log ─────────────────────────────────────────────────────────────────

router.get('/audit', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT * FROM identity_audit ORDER BY created_at DESC LIMIT 50`
        );
        res.json({ status: 'success', data: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
