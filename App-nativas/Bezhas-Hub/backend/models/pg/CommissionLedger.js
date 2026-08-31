const pool = require('../../db/pool');

/**
 * CommissionLedger — comisión devengada por cada organización ancestro
 * cuando un subordinado genera un evento validable. Append-only; el estado
 * (`accrued` → `settled`/`disputed`/`void`) es la única mutación permitida.
 */
class CommissionLedgerPG {
  static async create(data) {
    const query = `
      INSERT INTO commission_ledger (
        validation_event_id, beneficiary_org_id, level, rate_bps_applied, amount, currency
      ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      data.validationEventId,
      data.beneficiaryOrgId,
      data.level,
      data.rateBpsApplied,
      data.amount,
      data.currency,
    ]);
    return rows[0];
  }

  static async listByBeneficiary(orgId, { status, limit = 200 } = {}) {
    const params = [orgId];
    let where = 'beneficiary_org_id = $1::uuid';
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT * FROM commission_ledger WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows;
  }

  static async summaryByBeneficiary(orgId) {
    const { rows } = await pool.query(
      `SELECT status, currency, COUNT(*)::int AS entries, SUM(amount)::numeric AS total
         FROM commission_ledger WHERE beneficiary_org_id = $1::uuid
        GROUP BY status, currency ORDER BY status, currency`,
      [orgId],
    );
    return rows.map((r) => ({
      status: r.status,
      currency: r.currency,
      entries: Number(r.entries),
      total: Number(r.total),
    }));
  }

  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM commission_ledger WHERE id = $1::uuid', [id]);
    return rows[0] || null;
  }

  static async settle(id, beneficiaryOrgId, settlementRef) {
    const { rows } = await pool.query(
      `UPDATE commission_ledger SET status = 'settled', settlement_ref = $3, settled_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid AND beneficiary_org_id = $2::uuid AND status = 'accrued'
        RETURNING *`,
      [id, beneficiaryOrgId, settlementRef || null],
    );
    return rows[0] || null;
  }

  static async dispute(id, beneficiaryOrgId) {
    const { rows } = await pool.query(
      `UPDATE commission_ledger SET status = 'disputed'
        WHERE id = $1::uuid AND beneficiary_org_id = $2::uuid AND status = 'accrued'
        RETURNING *`,
      [id, beneficiaryOrgId],
    );
    return rows[0] || null;
  }
}

module.exports = CommissionLedgerPG;
