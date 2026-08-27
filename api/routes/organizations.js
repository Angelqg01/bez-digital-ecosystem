/**
 * routes/organizations.js — Organizaciones (empresas), su membresía con rol,
 * y la verificación KYB documental.
 *
 * Fundamento del registro extendido: KYB, config técnica/cripto y billing por
 * empresa se enganchan todos a `organization_id` (ver migración 044). La
 * config técnica/cripto (wallets, RPC, oráculos, contratos) vive en su propio
 * router — routes/organization-tech.js — porque la gatea un rol distinto
 * (developer, no cualquier miembro) y no tiene nada que ver con lo legal/fiscal.
 */
const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { authenticateToken, requireOrgRole, requireRole } = require('../middleware/security');

const router = Router();

const ORG_ROLES = ['owner', 'admin', 'developer', 'auditor', 'financial', 'operator'];

// ── Crear organización (el creador queda como 'owner') ──
router.post('/', authenticateToken, [
    body('name').isLength({ min: 2, max: 255 }).withMessage('Nombre requerido'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { rows } = await query(
            `INSERT INTO organizations (name) VALUES ($1) RETURNING *`,
            [req.body.name]
        );
        const organization = rows[0];

        await query(
            `INSERT INTO organization_members (organization_id, user_id, role)
             VALUES ($1, $2, 'owner')`,
            [organization.id, req.user.userId]
        );

        res.status(201).json({ success: true, organization, role: 'owner' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo crear la organización', details: error.message });
    }
});

// ── Organizaciones a las que pertenece el usuario autenticado ──
router.get('/mine', authenticateToken, async (req, res) => {
    const { rows } = await query(
        `SELECT o.*, m.role AS my_role, m.status AS my_status
         FROM organizations o
         JOIN organization_members m ON m.organization_id = o.id
         WHERE m.user_id = $1 AND m.status = 'active'
         ORDER BY o.created_at ASC`,
        [req.user.userId]
    );
    res.json({ success: true, organizations: rows });
});

// ── Detalle de una organización (cualquier miembro activo) ──
router.get('/:orgId', authenticateToken, requireOrgRole(...ORG_ROLES), async (req, res) => {
    const { rows } = await query('SELECT * FROM organizations WHERE id = $1', [req.params.orgId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({ success: true, organization: rows[0], my_role: req.orgRole });
});

// ── Actualizar datos de organización (legales/fiscales incluidos) — solo owner/admin ──
router.patch('/:orgId', authenticateToken, requireOrgRole('owner', 'admin'), [
    body('name').optional().isLength({ min: 2, max: 255 }),
    body('legal_name').optional().isLength({ max: 255 }),
    body('tax_id').optional().isLength({ max: 50 }),
    body('country').optional().isLength({ min: 2, max: 2 }),
    body('fiscal_address').optional().isLength({ max: 2000 }),
    body('legal_representative_name').optional().isLength({ max: 255 }),
    body('legal_representative_id').optional().isLength({ max: 50 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const editable = [
        'name', 'legal_name', 'tax_id', 'country', 'fiscal_address',
        'legal_representative_name', 'legal_representative_id',
    ];
    const sets = [];
    const params = [];
    let idx = 1;

    for (const field of editable) {
        if (req.body[field] !== undefined) {
            sets.push(`${field} = $${idx++}`);
            params.push(req.body[field]);
        }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    sets.push('updated_at = NOW()');
    params.push(req.params.orgId);

    const { rows } = await query(
        `UPDATE organizations SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({ success: true, organization: rows[0] });
});

// ── Listar miembros (cualquier miembro activo) ──
router.get('/:orgId/members', authenticateToken, requireOrgRole(...ORG_ROLES), async (req, res) => {
    const { rows } = await query(
        `SELECT m.id, m.role, m.status, m.created_at, u.id AS user_id, u.username, u.email
         FROM organization_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = $1
         ORDER BY m.created_at ASC`,
        [req.params.orgId]
    );
    res.json({ success: true, members: rows });
});

// ── Añadir miembro por email (debe tener ya cuenta BeZhas) — owner/admin ──
router.post('/:orgId/members', authenticateToken, requireOrgRole('owner', 'admin'), [
    body('email').isEmail().withMessage('Email válido requerido'),
    body('role').isIn(ORG_ROLES).withMessage(`Rol debe ser uno de: ${ORG_ROLES.join(', ')}`),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Solo un owner puede dar de alta a otro owner.
    if (req.body.role === 'owner' && req.orgRole !== 'owner') {
        return res.status(403).json({ error: 'Solo un owner puede asignar el rol owner' });
    }

    try {
        const email = String(req.body.email).trim().toLowerCase();
        const found = await query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [email]);
        if (found.rows.length === 0) {
            return res.status(404).json({ error: 'No existe ninguna cuenta BeZhas con ese email' });
        }

        const { rows } = await query(
            `INSERT INTO organization_members (organization_id, user_id, role, invited_by)
             VALUES ($1, $2, $3, $4)
             RETURNING id, organization_id, user_id, role, status, created_at`,
            [req.params.orgId, found.rows[0].id, req.body.role, req.user.userId]
        );
        res.status(201).json({ success: true, member: rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ese usuario ya es miembro de la organización' });
        }
        res.status(500).json({ error: 'No se pudo añadir el miembro', details: error.message });
    }
});

// ── Cambiar el rol de un miembro — owner/admin ──
router.patch('/:orgId/members/:memberId', authenticateToken, requireOrgRole('owner', 'admin'), [
    param('memberId').isUUID(),
    body('role').isIn(ORG_ROLES).withMessage(`Rol debe ser uno de: ${ORG_ROLES.join(', ')}`),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (req.orgRole !== 'owner' && (req.body.role === 'owner')) {
        return res.status(403).json({ error: 'Solo un owner puede asignar o quitar el rol owner' });
    }

    const target = await query(
        'SELECT role FROM organization_members WHERE id = $1 AND organization_id = $2',
        [req.params.memberId, req.params.orgId]
    );
    if (target.rows.length === 0) return res.status(404).json({ error: 'Miembro no encontrado' });

    if (target.rows[0].role === 'owner' && req.body.role !== 'owner') {
        const owners = await query(
            `SELECT COUNT(*) FROM organization_members
             WHERE organization_id = $1 AND role = 'owner' AND status = 'active'`,
            [req.params.orgId]
        );
        if (Number(owners.rows[0].count) <= 1) {
            return res.status(409).json({ error: 'La organización debe conservar al menos un owner' });
        }
    }

    const { rows } = await query(
        `UPDATE organization_members SET role = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3
         RETURNING id, organization_id, user_id, role, status`,
        [req.body.role, req.params.memberId, req.params.orgId]
    );
    res.json({ success: true, member: rows[0] });
});

// ── Revocar acceso de un miembro — owner/admin ──
router.delete('/:orgId/members/:memberId', authenticateToken, requireOrgRole('owner', 'admin'), [
    param('memberId').isUUID(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const target = await query(
        'SELECT role FROM organization_members WHERE id = $1 AND organization_id = $2',
        [req.params.memberId, req.params.orgId]
    );
    if (target.rows.length === 0) return res.status(404).json({ error: 'Miembro no encontrado' });

    if (target.rows[0].role === 'owner') {
        const owners = await query(
            `SELECT COUNT(*) FROM organization_members
             WHERE organization_id = $1 AND role = 'owner' AND status = 'active'`,
            [req.params.orgId]
        );
        if (Number(owners.rows[0].count) <= 1) {
            return res.status(409).json({ error: 'La organización debe conservar al menos un owner' });
        }
    }

    await query(
        `UPDATE organization_members SET status = 'revoked', updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [req.params.memberId, req.params.orgId]
    );
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
//  KYB — Know Your Business (documental)
// ═══════════════════════════════════════════════════════════════════

const KYB_DOC_TYPES = [
    'incorporation_certificate', 'tax_id_proof', 'legal_representative_id',
    'proof_of_address', 'other',
];

// ── Listar documentos KYB (cualquier miembro activo) ──
router.get('/:orgId/documents', authenticateToken, requireOrgRole(...ORG_ROLES), async (req, res) => {
    const { rows } = await query(
        `SELECT id, doc_type, file_name, mime_type, status, rejection_reason, created_at, reviewed_at
         FROM organization_documents WHERE organization_id = $1 ORDER BY created_at DESC`,
        [req.params.orgId]
    );
    res.json({ success: true, documents: rows });
});

// ── Registrar un documento KYB — owner/admin ──
// El archivo en sí ya está subido a un storage externo (GCS/IPFS); aquí solo
// se registran sus metadatos y el hash, igual que hace routes/documents.js
// para los documentos de comercio.
router.post('/:orgId/documents', authenticateToken, requireOrgRole('owner', 'admin'), [
    body('docType').isIn(KYB_DOC_TYPES).withMessage(`docType debe ser uno de: ${KYB_DOC_TYPES.join(', ')}`),
    body('fileName').isLength({ min: 1, max: 255 }),
    body('storageUrl').isURL().withMessage('storageUrl debe ser una URL válida'),
    body('fileHash').optional().matches(/^0x[a-fA-F0-9]{64}$/).withMessage('fileHash debe ser SHA-256 hex (0x...)'),
    body('mimeType').optional().isLength({ max: 100 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows } = await query(
        `INSERT INTO organization_documents (organization_id, doc_type, file_name, file_hash, mime_type, storage_url, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, doc_type, file_name, mime_type, status, created_at`,
        [req.params.orgId, req.body.docType, req.body.fileName, req.body.fileHash || null,
            req.body.mimeType || null, req.body.storageUrl, req.user.userId]
    );
    res.status(201).json({ success: true, document: rows[0] });
});

// ── Retirar un documento aún no revisado — owner/admin ──
router.delete('/:orgId/documents/:docId', authenticateToken, requireOrgRole('owner', 'admin'), [
    param('docId').isUUID(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows } = await query(
        `DELETE FROM organization_documents
         WHERE id = $1 AND organization_id = $2 AND status = 'pending'
         RETURNING id`,
        [req.params.docId, req.params.orgId]
    );
    if (rows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado o ya revisado (no se puede borrar)' });
    }
    res.json({ success: true });
});

// ── Enviar la organización a revisión KYB — owner/admin ──
// Gate mínimo: los campos legales rellenos y al menos un documento adjunto.
// La lista de qué tipos de documento son obligatorios para cada país queda
// para cuando haya un flujo de verificación real con un proveedor (KYB-as-a-
// service) — por ahora un admin de BeZhas revisa a mano lo que se ha enviado.
router.post('/:orgId/kyb/submit', authenticateToken, requireOrgRole('owner', 'admin'), async (req, res) => {
    const org = await query('SELECT * FROM organizations WHERE id = $1', [req.params.orgId]);
    if (org.rows.length === 0) return res.status(404).json({ error: 'Organización no encontrada' });

    const o = org.rows[0];
    const missingFields = ['legal_name', 'tax_id', 'country', 'fiscal_address', 'legal_representative_name']
        .filter((f) => !o[f]);
    if (missingFields.length > 0) {
        return res.status(400).json({ error: 'Faltan datos legales/fiscales', missingFields });
    }

    const docs = await query(
        `SELECT COUNT(*) FROM organization_documents WHERE organization_id = $1`,
        [req.params.orgId]
    );
    if (Number(docs.rows[0].count) === 0) {
        return res.status(400).json({ error: 'Adjunta al menos un documento antes de enviar a revisión' });
    }

    if (o.verification_status === 'verified') {
        return res.status(409).json({ error: 'La organización ya está verificada' });
    }

    const { rows } = await query(
        `UPDATE organizations SET verification_status = 'pending', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [req.params.orgId]
    );
    res.json({ success: true, organization: rows[0] });
});

// ── Revisar KYB (aprobar/rechazar un documento y, opcionalmente, decidir la
//    organización entera) — solo admins de BeZhas, no de la empresa ──
router.post('/:orgId/documents/:docId/review', authenticateToken, requireRole('admin'), [
    param('docId').isUUID(),
    body('decision').isIn(['approved', 'rejected']),
    body('rejectionReason').if(body('decision').equals('rejected')).notEmpty()
        .withMessage('rejectionReason requerido al rechazar'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows } = await query(
        `UPDATE organization_documents
         SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW()
         WHERE id = $4 AND organization_id = $5
         RETURNING *`,
        [req.body.decision, req.body.rejectionReason || null, req.user.userId, req.params.docId, req.params.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ success: true, document: rows[0] });
});

// ── Decidir el estado KYB de la organización — solo admins de BeZhas ──
router.post('/:orgId/kyb/review', authenticateToken, requireRole('admin'), [
    body('decision').isIn(['verified', 'rejected']),
    body('notes').optional().isLength({ max: 2000 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows } = await query(
        `UPDATE organizations SET verification_status = $1, verification_notes = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [req.body.decision, req.body.notes || null, req.params.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({ success: true, organization: rows[0] });
});

module.exports = router;
