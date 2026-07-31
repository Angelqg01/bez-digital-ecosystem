const pool = require('../../db/pool');

/**
 * TreasuryTransfer — registro contable de una solicitud de transferencia
 * interna entre organizaciones vinculadas (advance = padre financia a un
 * subordinado; sweep = subordinado remite excedente al padre). Esta tabla
 * NO mueve fondos reales: audita solicitud → aprobación → liquidación para
 * que un operador humano o una integración (Stripe Connect / tx on-chain)
 * ejecute el movimiento y confirme con settlementRef.
 */
class TreasuryTransferPG {
  static async create(data) {
    const query = `
      INSERT INTO treasury_transfers (
        from_org_id, to_org_id, direction, currency, amount, requested_by, note
      ) VALUES ($1::uuid,$2::uuid,$3::transfer_direction,$4,$5,$6::uuid,$7)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      data.fromOrgId,
      data.toOrgId,
      data.direction,
      data.currency,
      data.amount,
      data.requestedBy || null,
      data.note || null,
    ]);
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM treasury_transfers WHERE id = $1::uuid', [id]);
    return rows[0] || null;
  }

  static async listForOrg(orgId, { limit = 200 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM treasury_transfers WHERE from_org_id = $1::uuid OR to_org_id = $1::uuid
        ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }

  static async approve(id, approvedBy) {
    const { rows } = await pool.query(
      `UPDATE treasury_transfers SET status = 'approved', approved_by = $2::uuid, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid AND status = 'pending' RETURNING *`,
      [id, approvedBy || null],
    );
    return rows[0] || null;
  }

  static async reject(id) {
    const { rows } = await pool.query(
      `UPDATE treasury_transfers SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid AND status = 'pending' RETURNING *`,
      [id],
    );
    return rows[0] || null;
  }

  static async settle(id, settlementRef) {
    const { rows } = await pool.query(
      `UPDATE treasury_transfers SET status = 'settled', settlement_ref = $2, settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid AND status = 'approved' RETURNING *`,
      [id, settlementRef || null],
    );
    return rows[0] || null;
  }
}

module.exports = TreasuryTransferPG;
