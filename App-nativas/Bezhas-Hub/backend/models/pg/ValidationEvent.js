const pool = require('../../db/pool');

/**
 * ValidationEvent — hecho validable de un subordinado (pago, envío confirmado,
 * lectura IoT, liberación de escrow…) que dispara el cálculo de comisiones.
 * Idempotente por (subject_org_id, tx_ref): reintentar el mismo evento nunca
 * duplica comisión.
 */
class ValidationEventPG {
  static async create(data) {
    const query = `
      INSERT INTO validation_events (
        subject_org_id, subject_site_id, tx_type, tx_ref, tx_amount, tx_currency, metadata
      ) VALUES ($1::uuid,$2::uuid,$3::validation_tx_type,$4,$5,$6,$7::jsonb)
      ON CONFLICT (subject_org_id, tx_ref) DO NOTHING
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      data.subjectOrgId,
      data.subjectSiteId || null,
      data.txType || 'custom',
      data.txRef,
      data.txAmount || 0,
      data.txCurrency || 'EUR',
      JSON.stringify(data.metadata || {}),
    ]);
    if (rows[0]) return { event: rows[0], duplicate: false };
    const existing = await pool.query(
      `SELECT * FROM validation_events WHERE subject_org_id = $1::uuid AND tx_ref = $2`,
      [data.subjectOrgId, data.txRef],
    );
    return { event: existing.rows[0], duplicate: true };
  }

  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM validation_events WHERE id = $1::uuid', [id]);
    return rows[0] || null;
  }

  static async listBySubject(subjectOrgId, { since = '30 days', limit = 200 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM validation_events
        WHERE subject_org_id = $1::uuid AND created_at >= NOW() - ($2)::interval
        ORDER BY created_at DESC LIMIT $3`,
      [subjectOrgId, since, limit],
    );
    return rows;
  }

  /** Suma de importes validados por tipo, para agregación jerárquica. */
  static async aggregateBySubjects(orgIds, { since = '30 days' } = {}) {
    if (!orgIds.length) return [];
    const { rows } = await pool.query(
      `SELECT subject_org_id, tx_type,
              COUNT(*)::int AS events,
              SUM(tx_amount)::numeric AS total_amount,
              tx_currency
         FROM validation_events
        WHERE subject_org_id = ANY($1::uuid[]) AND created_at >= NOW() - ($2)::interval
        GROUP BY subject_org_id, tx_type, tx_currency
        ORDER BY subject_org_id`,
      [orgIds, since],
    );
    return rows.map((r) => ({
      orgId: r.subject_org_id,
      txType: r.tx_type,
      events: Number(r.events),
      totalAmount: Number(r.total_amount),
      currency: r.tx_currency,
    }));
  }
}

module.exports = ValidationEventPG;
