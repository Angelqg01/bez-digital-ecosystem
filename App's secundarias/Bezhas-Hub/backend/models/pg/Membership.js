const pool = require('../../db/pool');

/**
 * Membership — vínculo usuario/wallet ↔ organización (y opcionalmente una sede)
 * con un rol. site_id NULL = acceso a toda la organización.
 *
 * Jerarquía de roles (mayor incluye al menor):
 *   owner > org_admin > site_manager > operator > auditor
 */
const ROLE_LEVEL = { auditor: 1, operator: 2, site_manager: 3, org_admin: 4, owner: 5 };

class MembershipPG {
  static get ROLE_LEVEL() {
    return ROLE_LEVEL;
  }

  static async create(data) {
    const query = `
      INSERT INTO memberships (
        org_id, site_id, user_id, wallet_address, bezhas_id, role, status, invited_by, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      RETURNING *;
    `;
    const values = [
      data.orgId,
      data.siteId || null,
      data.userId || null,
      data.wallet ? data.wallet.toLowerCase() : null,
      data.bezhasId || null,
      data.role || 'operator',
      data.status || 'active',
      data.invitedBy || null,
      JSON.stringify(data.metadata || {}),
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async listByOrg(orgId) {
    const { rows } = await pool.query(
      'SELECT * FROM memberships WHERE org_id = $1 ORDER BY created_at ASC',
      [orgId],
    );
    return rows;
  }

  /**
   * Membresía efectiva de un actor en una organización. Devuelve la de MAYOR
   * privilegio (p.ej. un org_admin de toda la org gana a un operator de una sede).
   */
  static async findForActorInOrg({ orgId, userId, wallet, bezhasId }) {
    const { rows } = await pool.query(
      `SELECT * FROM memberships
        WHERE org_id = $1::uuid AND status = 'active'
          AND ( ($2::uuid IS NOT NULL AND user_id = $2::uuid)
                OR ($3::text IS NOT NULL AND lower(wallet_address) = lower($3::text))
                OR ($4::text IS NOT NULL AND bezhas_id = $4::text) )`,
      [orgId, userId || null, wallet || null, bezhasId || null],
    );
    if (!rows.length) return null;
    return rows.sort((a, b) => (ROLE_LEVEL[b.role] || 0) - (ROLE_LEVEL[a.role] || 0))[0];
  }

  /** ¿El rol `role` alcanza el mínimo requerido `min`? (lógica pura, testeable). */
  static roleSatisfies(role, min) {
    return (ROLE_LEVEL[role] || 0) >= (ROLE_LEVEL[min] || 0);
  }

  static async remove(id) {
    await pool.query('DELETE FROM memberships WHERE id = $1', [id]);
    return true;
  }
}

module.exports = MembershipPG;
