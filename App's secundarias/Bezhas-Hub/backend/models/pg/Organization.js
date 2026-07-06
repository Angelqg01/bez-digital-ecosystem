const pool = require('../../db/pool');

/**
 * Organization — tenant raíz (Holding / Institución / Empresa multi-sede).
 * Capa de datos pura (SQL), sin lógica HTTP. Sigue el patrón de models/pg/*.
 */
class OrganizationPG {
  static async create(data) {
    const query = `
      INSERT INTO organizations (
        name, slug, type, owner_user_id, owner_wallet, plan, status, tax_id, country, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      RETURNING *;
    `;
    const baseSlug = data.slug || OrganizationPG.slugify(data.name);
    const mkValues = (slug) => [
      data.name,
      slug,
      data.type || 'empresa',
      data.ownerUserId || null,
      data.ownerWallet ? data.ownerWallet.toLowerCase() : null,
      data.plan || 'starter',
      data.status || 'active',
      data.taxId || null,
      data.country || 'ES',
      JSON.stringify(data.metadata || {}),
    ];
    // Dedupe de slug: si el nombre ya existe (dos clientes con nombre similar),
    // reintenta con un sufijo corto en vez de fallar.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${OrganizationPG.shortId()}`;
      try {
        const { rows } = await pool.query(query, mkValues(slug));
        return rows[0];
      } catch (err) {
        if (err.code === '23505' && attempt < 4) continue; // unique_violation → reintenta
        throw err;
      }
    }
  }

  static shortId() {
    return Math.random().toString(36).slice(2, 6);
  }

  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
    return rows[0] || null;
  }

  static async findBySlug(slug) {
    const { rows } = await pool.query('SELECT * FROM organizations WHERE slug = $1', [slug]);
    return rows[0] || null;
  }

  /** Organizaciones a las que pertenece un usuario o wallet (vía memberships). */
  static async listForActor({ userId, wallet }) {
    const { rows } = await pool.query(
      `SELECT DISTINCT o.*, m.role
         FROM organizations o
         JOIN memberships m ON m.org_id = o.id
        WHERE (m.user_id = $1)
           OR ($2 IS NOT NULL AND lower(m.wallet_address) = lower($2))
        ORDER BY o.created_at DESC`,
      [userId || null, wallet || null],
    );
    return rows;
  }

  static async update(id, fields) {
    const allowed = ['name', 'type', 'plan', 'status', 'tax_id', 'country', 'metadata'];
    const sets = [];
    const values = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      const col = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      if (!allowed.includes(col)) continue;
      sets.push(col === 'metadata' ? `${col} = $${i}::jsonb` : `${col} = $${i}`);
      values.push(col === 'metadata' ? JSON.stringify(v) : v);
      i++;
    }
    if (!sets.length) return OrganizationPG.findById(id);
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE organizations SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return rows[0] || null;
  }

  static slugify(name) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 110);
  }
}

module.exports = OrganizationPG;
