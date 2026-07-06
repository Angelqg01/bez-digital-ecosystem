const pool = require('../../db/pool');
const crypto = require('crypto');

/**
 * Identity — BeZhas_ID: identidad única y portable (email + wallet + OAuth → 1 id).
 * Capa de datos pura (SQL). La lógica de resolución/fusión vive en
 * services/identity.service.js para poder testearse sin BD.
 */
class IdentityPG {
  /** Genera un BeZhas_ID canónico: BZ-XXXXXXXXXX (Crockford base32, sin ambigüedad). */
  static generateBezhasId() {
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // sin I,L,O,U
    const bytes = crypto.randomBytes(10);
    let out = '';
    for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
    return `BZ-${out}`;
  }

  /** Hash de email (minúsculas) para emparejar sin almacenar el email en claro. */
  static hashEmail(email) {
    if (!email) return null;
    return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
  }

  static async create(data) {
    const bezhasId = data.bezhasId || IdentityPG.generateBezhasId();
    const query = `
      INSERT INTO identities (bezhas_id, user_id, email_hash, wallet_address, display_name, status, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
      RETURNING *;
    `;
    const values = [
      bezhasId,
      data.userId || null,
      data.emailHash || null,
      data.wallet ? data.wallet.toLowerCase() : null,
      data.displayName || null,
      data.status || 'active',
      JSON.stringify(data.metadata || {}),
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findByBezhasId(bezhasId) {
    const { rows } = await pool.query('SELECT * FROM identities WHERE bezhas_id = $1', [bezhasId]);
    return rows[0] || null;
  }

  static async findByWallet(wallet) {
    if (!wallet) return null;
    const { rows } = await pool.query(
      'SELECT * FROM identities WHERE lower(wallet_address) = lower($1) LIMIT 1',
      [wallet],
    );
    return rows[0] || null;
  }

  static async findByEmailHash(emailHash) {
    if (!emailHash) return null;
    const { rows } = await pool.query(
      'SELECT * FROM identities WHERE email_hash = $1 LIMIT 1',
      [emailHash],
    );
    return rows[0] || null;
  }

  static async findByUserId(userId) {
    if (!userId) return null;
    const { rows } = await pool.query(
      'SELECT * FROM identities WHERE user_id = $1 LIMIT 1',
      [userId],
    );
    return rows[0] || null;
  }

  /** Rellena campos que falten (link de wallet a una identidad email, etc.). */
  static async link(bezhasId, fields) {
    const allowed = ['user_id', 'email_hash', 'wallet_address', 'display_name'];
    const sets = [];
    const values = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      const col = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      if (!allowed.includes(col) || v == null) continue;
      sets.push(`${col} = COALESCE(${col}, $${i})`); // sólo rellena si estaba vacío
      values.push(col === 'wallet_address' ? String(v).toLowerCase() : v);
      i++;
    }
    if (!sets.length) return IdentityPG.findByBezhasId(bezhasId);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(bezhasId);
    const { rows } = await pool.query(
      `UPDATE identities SET ${sets.join(', ')} WHERE bezhas_id = $${i} RETURNING *`,
      values,
    );
    return rows[0] || null;
  }
}

module.exports = IdentityPG;
