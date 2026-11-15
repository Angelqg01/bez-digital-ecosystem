const pool = require('../../db/pool');

class UserPG {
    static hydrate(row) {
        if (!row) return null;
        const user = {
            ...row,
            _id: row.id,
            walletAddress: row.wallet_address,
            encryptedPrivateKey: row.encrypted_private_key,
            smartAccountAddress: row.smart_account_address,
            accountType: row.account_type,
            isEmailVerified: row.is_email_verified,
            is2FAEnabled: row.is_2fa_enabled || row.two_factor_enabled || false,
            select() {
                return this;
            },
            async save() {
                const updates = {};
                for (const [key, value] of Object.entries(this)) {
                    if (typeof value === 'function') continue;
                    if (['_id', 'id'].includes(key)) continue;
                    updates[key] = value;
                }
                return UserPG.update(this.id || this._id, updates);
            }
        };
        return user;
    }

    static async create(data) {
        const query = `
            INSERT INTO users (
                username, email, password, wallet_address, account_type, 
                roles, is_email_verified, affiliate_referral_code,
                encrypted_private_key, smart_account_address
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6::jsonb, $7, $8, $9, $10
            ) RETURNING *;
        `;
        const values = [
            data.username,
            data.email,
            data.password,
            data.walletAddress || data.wallet_address,
            data.accountType || data.account_type || 'individual',
            JSON.stringify(data.roles || ['USER']),
            data.isEmailVerified || data.is_email_verified || false,
            data.affiliate?.referralCode || data.affiliate_referral_code,
            data.encryptedPrivateKey || data.encrypted_private_key,
            data.smartAccountAddress || data.smart_account_address
        ];
        
        try {
            const result = await pool.query(query, values);
            return this.hydrate(result.rows[0]);
        } catch (error) {
            throw error;
        }
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return this.hydrate(result.rows[0]);
    }

    static async findByWallet(walletAddress) {
        const result = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
        return this.hydrate(result.rows[0]);
    }

    static async findByEmail(email) {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return this.hydrate(result.rows[0]);
    }

    /**
     * Código de referido del usuario; lo genera la primera vez. Atómico: `WHERE affiliate_referral_code IS NULL` evita pisar
     * el código si dos peticiones lo piden a la vez, y una colisión del UNIQUE se reintenta con otro código.
     */
    static async ensureReferralCode(id, generate) {
        for (let intento = 0; intento < 5; intento += 1) {
            const actual = await pool.query('SELECT affiliate_referral_code AS code FROM users WHERE id = $1', [id]);
            if (!actual.rows[0]) return null;
            if (actual.rows[0].code) return actual.rows[0].code;
            try {
                const up = await pool.query('UPDATE users SET affiliate_referral_code = $2 WHERE id = $1 AND affiliate_referral_code IS NULL RETURNING affiliate_referral_code AS code', [id, generate()]);
                if (up.rows[0]) return up.rows[0].code;
            } catch (err) {
                if (err.code !== '23505') throw err;
            }
        }
        throw new Error('No se pudo generar un código de referido único');
    }

    /** Usuario cuyo email o teléfono (ya hasheados por el cliente) coinciden. Lo usa la sincronización de contactos. */
    static async findByContactHashes({ emailHash, phoneHash }) {
        if (!emailHash && !phoneHash) return null;
        const { rows } = await pool.query(
            `SELECT id FROM users
              WHERE (email_hash IS NOT NULL AND email_hash = $1) OR (phone_hash IS NOT NULL AND phone_hash = $2)
              LIMIT 1`, [emailHash || null, phoneHash || null]);
        return rows[0] || null;
    }

    static async findOne(filter = {}) {
        if (filter.email) return this.findByEmail(filter.email);
        if (filter.walletAddress || filter.wallet_address) {
            return this.findByWallet(filter.walletAddress || filter.wallet_address);
        }
        if (filter.id || filter._id) return this.findById(filter.id || filter._id);
        return null;
    }

    static async update(id, updates) {
        const setClauses = [];
        const values = [];
        let paramIdx = 1;

        for (const [key, value] of Object.entries(updates)) {
            let dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            
            if (value === undefined) continue;
            
            if (typeof value === 'object' && value !== null) {
                setClauses.push(`${dbKey} = $${paramIdx}::jsonb`);
                values.push(JSON.stringify(value));
            } else {
                setClauses.push(`${dbKey} = $${paramIdx}`);
                values.push(value);
            }
            paramIdx++;
        }

        if (setClauses.length === 0) return this.findById(id);

        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        
        const query = `
            UPDATE users 
            SET ${setClauses.join(', ')} 
            WHERE id = $${paramIdx} RETURNING *;
        `;
        
        const result = await pool.query(query, values);
        return this.hydrate(result.rows[0]);
    }
}

module.exports = UserPG;
