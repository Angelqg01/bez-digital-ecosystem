const pool = require('../../db/pool');

/**
 * OrgPolicy — regla que una organización padre impone sobre sí misma o un
 * subordinado (límite de gasto, scope de API permitido, geofencing, rate
 * limit). Se evalúa en el motor de comisiones antes de aceptar un evento.
 */
class OrgPolicyPG {
  static async create(data) {
    const query = `
      INSERT INTO org_policies (
        owner_org_id, applies_to_org_id, site_id, policy_type, config, created_by
      ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::policy_type,$5::jsonb,$6::uuid)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      data.ownerOrgId,
      data.appliesToOrgId,
      data.siteId || null,
      data.policyType,
      JSON.stringify(data.config || {}),
      data.createdBy || null,
    ]);
    return rows[0];
  }

  static async listByOwner(ownerOrgId) {
    const { rows } = await pool.query(
      `SELECT * FROM org_policies WHERE owner_org_id = $1::uuid AND status = 'active' ORDER BY created_at DESC`,
      [ownerOrgId],
    );
    return rows;
  }

  /** Políticas activas que afectan a una org (y, si aplica, a una sede concreta). */
  static async listApplicableTo(orgId, siteId = null) {
    const { rows } = await pool.query(
      `SELECT * FROM org_policies
        WHERE applies_to_org_id = $1::uuid AND status = 'active'
          AND (site_id IS NULL OR site_id = $2::uuid)
        ORDER BY created_at DESC`,
      [orgId, siteId],
    );
    return rows;
  }

  static async revoke(id, ownerOrgId) {
    const { rows } = await pool.query(
      `UPDATE org_policies SET status = 'closed', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid AND owner_org_id = $2::uuid RETURNING *`,
      [id, ownerOrgId],
    );
    return rows[0] || null;
  }
}

module.exports = OrgPolicyPG;
