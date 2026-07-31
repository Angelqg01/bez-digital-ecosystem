const pool = require('../../db/pool');

/**
 * HierarchyLink — vínculo padre→subordinado entre organizaciones
 * (holding/consorcio/naviera sobre sus filiales/flotas/sub-empresas).
 */
class HierarchyLinkPG {
  static async create(data) {
    const query = `
      INSERT INTO org_hierarchy_links (
        parent_org_id, child_org_id, relationship_type, commission_rate_bps, metadata
      ) VALUES ($1::uuid,$2::uuid,$3::hierarchy_relationship,$4,$5::jsonb)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      data.parentOrgId,
      data.childOrgId,
      data.relationshipType || 'filial',
      data.commissionRateBps || 0,
      JSON.stringify(data.metadata || {}),
    ]);
    return rows[0];
  }

  static async findLink(parentOrgId, childOrgId) {
    const { rows } = await pool.query(
      `SELECT * FROM org_hierarchy_links WHERE parent_org_id = $1::uuid AND child_org_id = $2::uuid AND status = 'active'`,
      [parentOrgId, childOrgId],
    );
    return rows[0] || null;
  }

  /** Padre directo activo de una organización (una org sólo tiene un padre). */
  static async findParentOf(childOrgId) {
    const { rows } = await pool.query(
      `SELECT * FROM org_hierarchy_links WHERE child_org_id = $1::uuid AND status = 'active' LIMIT 1`,
      [childOrgId],
    );
    return rows[0] || null;
  }

  static async listChildren(parentOrgId) {
    const { rows } = await pool.query(
      `SELECT * FROM org_hierarchy_links WHERE parent_org_id = $1::uuid AND status = 'active' ORDER BY created_at ASC`,
      [parentOrgId],
    );
    return rows;
  }

  static async countChildren(parentOrgId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM org_hierarchy_links WHERE parent_org_id = $1::uuid AND status = 'active'`,
      [parentOrgId],
    );
    return rows[0]?.n || 0;
  }

  static async revoke(parentOrgId, childOrgId) {
    const { rows } = await pool.query(
      `UPDATE org_hierarchy_links SET status = 'closed', updated_at = CURRENT_TIMESTAMP
        WHERE parent_org_id = $1::uuid AND child_org_id = $2::uuid RETURNING *`,
      [parentOrgId, childOrgId],
    );
    return rows[0] || null;
  }

  /** Todos los descendientes (BFS), acotado a maxDepth niveles y maxNodes totales. */
  static async listDescendants(rootOrgId, { maxDepth = 5, maxNodes = 1000 } = {}) {
    const out = [];
    let frontier = [rootOrgId];
    let depth = 0;
    const seen = new Set([rootOrgId]);
    while (frontier.length && depth < maxDepth && out.length < maxNodes) {
      const { rows } = await pool.query(
        `SELECT * FROM org_hierarchy_links WHERE parent_org_id = ANY($1::uuid[]) AND status = 'active'`,
        [frontier],
      );
      const next = [];
      for (const link of rows) {
        if (seen.has(link.child_org_id)) continue;
        seen.add(link.child_org_id);
        out.push({ orgId: link.child_org_id, parentOrgId: link.parent_org_id, level: depth + 1, link });
        next.push(link.child_org_id);
      }
      frontier = next;
      depth++;
    }
    return out;
  }
}

module.exports = HierarchyLinkPG;
