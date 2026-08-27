/**
 * routes/organization-tech.js — Config técnica/cripto por organización.
 *
 * Tres cosas que un SaaS normal no necesita registrar por cliente y una
 * plataforma blockchain B2B sí (ver migración 045):
 *   - Wallets corporativas (direcciones públicas; el detalle de firmantes de
 *     un multisig ya lo sirve GET /wallet/multisig/:address, no se duplica).
 *   - Credenciales de RPC/oráculos — el secreto va cifrado con secretVault,
 *     nunca en claro ni siquiera en la respuesta de esta API.
 *   - Parámetros de smart contracts desplegados por la organización.
 *
 * Solo owner/admin/developer pueden escribir aquí — es la config técnica del
 * equipo dev de la empresa, no algo que un rol financiero o auditor deba
 * poder tocar (sí pueden verla, para trazabilidad).
 */
const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { query, getClient } = require('../db/pool');
const { authenticateToken, requireOrgRole } = require('../middleware/security');
const { encryptSecret, decryptSecret, maskSecret } = require('../services/secretVault');

const router = Router();

const ANY_MEMBER = ['owner', 'admin', 'developer', 'auditor', 'financial', 'operator'];
const TECH_WRITERS = ['owner', 'admin', 'developer'];

// ═══════════════════════════════════════════════════════════════════
//  WALLETS CORPORATIVAS
// ═══════════════════════════════════════════════════════════════════

router.get('/:orgId/wallets', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    const { rows } = await query(
        `SELECT * FROM organization_wallets WHERE organization_id = $1 ORDER BY is_primary DESC, created_at ASC`,
        [req.params.orgId]
    );
    res.json({ success: true, wallets: rows });
});

router.post('/:orgId/wallets', authenticateToken, requireOrgRole(...TECH_WRITERS), [
    body('address').isEthereumAddress(),
    body('chainId').isInt({ min: 1 }),
    body('walletType').optional().isIn(['eoa', 'multisig', 'safe']),
    body('label').optional().isLength({ max: 120 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { rows } = await query(
            `INSERT INTO organization_wallets (organization_id, address, chain_id, wallet_type, label, added_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.params.orgId, req.body.address.toLowerCase(), req.body.chainId,
                req.body.walletType || 'eoa', req.body.label || null, req.user.userId]
        );
        res.status(201).json({ success: true, wallet: rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Esa dirección ya está registrada para esta organización en esa red' });
        }
        res.status(500).json({ error: 'No se pudo registrar la wallet', details: error.message });
    }
});

// Marca una wallet como primaria y desmarca el resto — en transacción para no
// dejar dos primarias a medio camino si algo falla entre las dos UPDATE.
router.patch('/:orgId/wallets/:walletId/primary', authenticateToken, requireOrgRole(...TECH_WRITERS), [
    param('walletId').isUUID(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const client = await getClient();
    try {
        await client.query('BEGIN');
        const target = await client.query(
            'SELECT id FROM organization_wallets WHERE id = $1 AND organization_id = $2',
            [req.params.walletId, req.params.orgId]
        );
        if (target.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Wallet no encontrada' });
        }
        await client.query(
            'UPDATE organization_wallets SET is_primary = FALSE WHERE organization_id = $1',
            [req.params.orgId]
        );
        const { rows } = await client.query(
            'UPDATE organization_wallets SET is_primary = TRUE WHERE id = $1 RETURNING *',
            [req.params.walletId]
        );
        await client.query('COMMIT');
        res.json({ success: true, wallet: rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'No se pudo actualizar la wallet primaria', details: error.message });
    } finally {
        client.release();
    }
});

router.delete('/:orgId/wallets/:walletId', authenticateToken, requireOrgRole(...TECH_WRITERS), [
    param('walletId').isUUID(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rowCount } = await query(
        'DELETE FROM organization_wallets WHERE id = $1 AND organization_id = $2',
        [req.params.walletId, req.params.orgId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Wallet no encontrada' });
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
//  CREDENCIALES: RPC providers y oráculos
// ═══════════════════════════════════════════════════════════════════

const CREDENTIAL_CATEGORIES = ['rpc_provider', 'oracle'];

// El secreto nunca sale de aquí — ni siquiera enmascarado por completo se
// necesita en el listado normal; se enmascara igualmente por si acaso.
router.get('/:orgId/credentials', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    const { rows } = await query(
        `SELECT id, category, provider, chain_id, label, metadata, is_active, created_at, secret_encrypted
         FROM organization_credentials WHERE organization_id = $1 ORDER BY created_at DESC`,
        [req.params.orgId]
    );
    // Se descifra en memoria solo para calcular la vista enmascarada
    // (ej. "abcd…wxyz") — el valor descifrado nunca sale de este proceso.
    const credentials = rows.map(({ secret_encrypted, ...rest }) => ({
        ...rest,
        secretPreview: maskSecret(decryptSecret(secret_encrypted)),
    }));
    res.json({ success: true, credentials });
});

router.post('/:orgId/credentials', authenticateToken, requireOrgRole(...TECH_WRITERS), [
    body('category').isIn(CREDENTIAL_CATEGORIES).withMessage(`category debe ser uno de: ${CREDENTIAL_CATEGORIES.join(', ')}`),
    body('provider').isLength({ min: 1, max: 50 }),
    body('label').isLength({ min: 1, max: 120 }),
    body('secret').isLength({ min: 1 }).withMessage('secret requerido (API key / URL con key)'),
    body('chainId').optional().isInt({ min: 1 }),
    body('metadata').optional().isObject(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows } = await query(
        `INSERT INTO organization_credentials
            (organization_id, category, provider, chain_id, label, secret_encrypted, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, category, provider, chain_id, label, metadata, is_active, created_at`,
        [req.params.orgId, req.body.category, req.body.provider, req.body.chainId || null,
            req.body.label, encryptSecret(req.body.secret), JSON.stringify(req.body.metadata || {}), req.user.userId]
    );
    res.status(201).json({ success: true, credential: rows[0] });
});

router.patch('/:orgId/credentials/:credentialId', authenticateToken, requireOrgRole(...TECH_WRITERS), [
    param('credentialId').isUUID(),
    body('isActive').isBoolean(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows } = await query(
        `UPDATE organization_credentials SET is_active = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3
         RETURNING id, category, provider, chain_id, label, metadata, is_active, created_at`,
        [req.body.isActive, req.params.credentialId, req.params.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Credencial no encontrada' });
    res.json({ success: true, credential: rows[0] });
});

router.delete('/:orgId/credentials/:credentialId', authenticateToken, requireOrgRole(...TECH_WRITERS), [
    param('credentialId').isUUID(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rowCount } = await query(
        'DELETE FROM organization_credentials WHERE id = $1 AND organization_id = $2',
        [req.params.credentialId, req.params.orgId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Credencial no encontrada' });
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
//  PARÁMETROS DE SMART CONTRACTS
// ═══════════════════════════════════════════════════════════════════

const TOKEN_STANDARDS = ['ERC-20', 'ERC-721', 'ERC-1155', 'ERC-1400', 'other'];

router.get('/:orgId/contract-configs', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    const { rows } = await query(
        `SELECT * FROM organization_contract_configs WHERE organization_id = $1 ORDER BY created_at DESC`,
        [req.params.orgId]
    );
    res.json({ success: true, contractConfigs: rows });
});

router.post('/:orgId/contract-configs', authenticateToken, requireOrgRole(...TECH_WRITERS), [
    body('tokenStandard').isIn(TOKEN_STANDARDS).withMessage(`tokenStandard debe ser uno de: ${TOKEN_STANDARDS.join(', ')}`),
    body('name').isLength({ min: 1, max: 120 }),
    body('chainId').isInt({ min: 1 }),
    body('address').optional().isEthereumAddress(),
    body('notes').optional().isLength({ max: 2000 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows } = await query(
        `INSERT INTO organization_contract_configs (organization_id, token_standard, name, address, chain_id, notes, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.params.orgId, req.body.tokenStandard, req.body.name,
            req.body.address ? req.body.address.toLowerCase() : null, req.body.chainId, req.body.notes || null, req.user.userId]
    );
    res.status(201).json({ success: true, contractConfig: rows[0] });
});

router.delete('/:orgId/contract-configs/:configId', authenticateToken, requireOrgRole(...TECH_WRITERS), [
    param('configId').isUUID(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rowCount } = await query(
        'DELETE FROM organization_contract_configs WHERE id = $1 AND organization_id = $2',
        [req.params.configId, req.params.orgId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json({ success: true });
});

module.exports = router;
