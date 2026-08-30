/**
 * routes/users.js — User profile routes (DB-backed).
 */
const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { authenticateToken } = require('../middleware/security');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const { getBEZBalance, getStakingInfo } = require('../services/contractService');

const router = Router();

// ── GET / — Listado de usuarios para el panel RBAC ──
//
// La pestaña DAO Governance lo consumía como `/user?limit=10&role=all` y no
// existía, así que la tabla de roles salía siempre vacía.
//
// Va detrás de requireSuperAdmin: devuelve wallets, correos y roles de todos
// los usuarios de la plataforma, que es exactamente el mapa que querría un
// atacante antes de elegir a quién suplantar. Nunca se expone sin sesión.
router.get('/', requireSuperAdmin, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const role = req.query.role;

    // 'all' (lo que manda el panel) y ausencia significan lo mismo: sin filtro.
    // Sin esta traducción, `role=all` buscaría literalmente el rol "all" y
    // devolvería cero filas — el fallo silencioso más fácil de no ver.
    const params = [];
    let where = '';
    if (role && role !== 'all') {
        params.push(role);
        where = `WHERE role = $${params.length}`;
    }
    params.push(limit, offset);

    try {
        // En serie, no con Promise.all: lanzar las dos a la vez exige dos
        // conexiones libres del pool al mismo tiempo y, bajo carga, este
        // endpoint fallaba de forma intermitente con "timeout exceeded when
        // trying to connect". El COUNT es trivial y no gana nada por
        // solaparse con la lista.
        const list = await query(
            `SELECT id, username, wallet_address, email, role, bezhas_id, created_at, last_login
               FROM users
               ${where}
              ORDER BY last_login DESC NULLS LAST, created_at DESC
              LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        const total = await query(
            `SELECT COUNT(*)::int AS total FROM users ${where}`,
            params.slice(0, params.length - 2)
        );

        res.json({
            users: list.rows,
            total: total.rows[0]?.total ?? 0,
            limit,
            offset,
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo listar los usuarios' });
    }
});

// ── Get profile by address ──
router.get('/profile/:address', [
    param('address').isEthereumAddress(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { address } = req.params;

    const { rows } = await query(
        `SELECT u.*, 
                (SELECT COUNT(*) FROM nfts WHERE owner_address = $1) AS nfts_owned,
                (SELECT COALESCE(SUM(amount_staked), 0) FROM staking_positions WHERE wallet_address = $1 AND is_active = true) AS tokens_staked
         FROM users u WHERE u.wallet_address = $1`,
        [address]
    );

    if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    let balance = '0';
    try {
        balance = await getBEZBalance(address);
    } catch (_) { /* chain not reachable */ }

    res.json({
        ...user,
        bez_balance: balance,
    });
});

// ── Update own profile ──
router.put('/profile', authenticateToken, [
    body('username').optional().isLength({ min: 3, max: 20 }),
    body('email').optional().isEmail(),
    body('avatar_url').optional().isURL(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, avatar_url } = req.body;
    const sets = [];
    const params = [];
    let idx = 1;

    if (username !== undefined) { sets.push(`username = $${idx++}`); params.push(username); }
    if (email !== undefined) { sets.push(`email = $${idx++}`); params.push(email); }
    if (avatar_url !== undefined) { sets.push(`avatar_url = $${idx++}`); params.push(avatar_url); }

    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    sets.push(`updated_at = NOW()`);
    params.push(req.user.address);

    const { rows } = await query(
        `UPDATE users SET ${sets.join(', ')} WHERE wallet_address = $${idx} RETURNING *`,
        params
    );

    res.json({ success: true, user: rows[0] });
});

module.exports = router;
