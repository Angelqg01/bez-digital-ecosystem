'use strict';

/**
 * routes/admin-governance.js — Lectura de gobernanza para el panel SuperAdmin.
 *
 * El panel llamaba a /gateway/v1/governance/proposals, que existe pero está
 * detrás de `authenticateGateway` + scope: esa puerta es para clientes externos
 * con api-key, y el panel se autentica con la cookie de administrador. El
 * resultado era un 401 permanente que la UI tragaba y pintaba como "no hay
 * propuestas".
 *
 * Se duplica la lectura en vez de dejar entrar la cookie de admin en el
 * gateway: mezclar los dos modelos de autenticación en el mismo router
 * convierte cualquier despiste futuro allí en un agujero para clientes.
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const { requireSuperAdmin } = require('../middleware/admin-auth');

const router = Router();

router.use(requireSuperAdmin);

// ── GET /proposals ──
router.get('/proposals', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const status = req.query.status;

    const params = [];
    let where = '';
    if (status && status !== 'all') {
        params.push(status);
        where = `WHERE status = $${params.length}`;
    }
    params.push(limit, offset);

    try {
        const { rows } = await query(
            `SELECT * FROM governance_proposals
             ${where}
             ORDER BY created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        res.json({ success: true, proposals: rows });
    } catch (error) {
        // El módulo de gobernanza puede no estar desplegado todavía. Se
        // distingue de "no hay propuestas" con `available`, para que el panel
        // pueda decir la verdad en vez de pintar una lista vacía ambigua.
        res.json({
            success: true,
            proposals: [],
            available: false,
            note: 'Módulo de gobernanza pendiente de despliegue',
        });
    }
});

module.exports = router;
