const pool = require('../../db/pool');

/**
 * Site — sede / filial / departamento / flota / inmueble … dentro de una org.
 * Capa de datos pura (SQL). Todo cuelga de org_id (tenant raíz).
 */
class SitePG {
  static async create(data) {
    const query = `
      INSERT INTO sites (
        org_id, name, type, external_ref, parent_site_id, status, location, metadata
      ) VALUES ($1::uuid,$2,$3::site_type,$4,$5::uuid,$6::org_status,$7::jsonb,$8::jsonb)
      RETURNING *;
    `;
    const values = [
      data.orgId,
      data.name,
      data.type || 'sede',
      data.externalRef || null,
      data.parentSiteId || null,
      data.status || 'active',
      JSON.stringify(data.location || {}),
      JSON.stringify(data.metadata || {}),
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM sites WHERE id = $1', [id]);
    return rows[0] || null;
  }

  static async listByOrg(orgId) {
    const { rows } = await pool.query(
      'SELECT * FROM sites WHERE org_id = $1::uuid ORDER BY created_at ASC',
      [orgId],
    );
    return rows;
  }

  /** ¿Pertenece esta sede a esta organización? (defensa anti cross-tenant). */
  static async belongsToOrg(siteId, orgId) {
    const { rows } = await pool.query(
      'SELECT 1 FROM sites WHERE id = $1::uuid AND org_id = $2::uuid',
      [siteId, orgId],
    );
    return rows.length > 0;
  }

  static async update(id, fields) {
    const allowed = ['name', 'type', 'external_ref', 'parent_site_id', 'status', 'location', 'metadata'];
    const sets = [];
    const values = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      const col = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      if (!allowed.includes(col)) continue;
      const jsonb = col === 'location' || col === 'metadata';
      sets.push(jsonb ? `${col} = $${i}::jsonb` : `${col} = $${i}`);
      values.push(jsonb ? JSON.stringify(v) : v);
      i++;
    }
    if (!sets.length) return SitePG.findById(id);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE sites SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return rows[0] || null;
  }

  static async remove(id) {
    await pool.query('DELETE FROM sites WHERE id = $1', [id]);
    return true;
  }
}

module.exports = SitePG;
