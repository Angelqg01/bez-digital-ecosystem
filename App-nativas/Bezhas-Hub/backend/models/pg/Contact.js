const pool = require('../../db/pool');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Contactos sincronizados por cada usuario (migración 021). Sustituye a models/contact.model.js (Mongoose).
 * Se conserva el mismo vocabulario que usaban la ruta y el worker (`ownerId`, `matchedUserId`, `_id`).
 */
class ContactPG {
    static isValidId(id) { return typeof id === 'string' && UUID.test(id); }

    static hydrate(row) {
        if (!row) return null;
        return {
            _id: row.id,
            id: row.id,
            ownerId: row.owner_id,
            emailHash: row.email_hash,
            phoneHash: row.phone_hash,
            encryptedData: row.encrypted_data,
            status: row.status,
            matchedUserId: row.matched_user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Crea el contacto del propietario o actualiza el que ya tenga con el mismo email o teléfono.
     * Si el contacto ya estaba `invited` no se reabre: su recompensa ya se pagó y volver a `is_user` permitiría cobrarla otra vez.
     */
    static async upsert({ ownerId, emailHash, phoneHash, encryptedData, status, matchedUserId }) {
        if (!emailHash && !phoneHash) throw new Error('Un contacto necesita emailHash o phoneHash');
        const params = [ownerId, emailHash || null, phoneHash || null, encryptedData, status, matchedUserId || null];
        const actualizar = async () => {
            const { rows } = await pool.query(
                `UPDATE contacts
                    SET email_hash = COALESCE($2, email_hash), phone_hash = COALESCE($3, phone_hash),
                        encrypted_data = $4,
                        status = CASE WHEN status = 'invited' THEN status ELSE $5 END,
                        matched_user_id = CASE WHEN status = 'invited' THEN matched_user_id ELSE $6 END,
                        updated_at = NOW()
                  WHERE owner_id = $1 AND ((email_hash IS NOT NULL AND email_hash = $2) OR (phone_hash IS NOT NULL AND phone_hash = $3))
                  RETURNING *`, params);
            return rows[0];
        };
        let fila = await actualizar();
        if (!fila) {
            try {
                const { rows } = await pool.query(
                    `INSERT INTO contacts (owner_id, email_hash, phone_hash, encrypted_data, status, matched_user_id)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, params);
                fila = rows[0];
            } catch (err) {
                // Dos sincronizaciones simultáneas del mismo contacto: la segunda actualiza lo que insertó la primera.
                if (err.code !== '23505') throw err;
                fila = await actualizar();
            }
        }
        return ContactPG.hydrate(fila);
    }

    /** Coincidencias del usuario con los datos públicos del usuario emparejado (lo que antes hacía populate). */
    static async findMatches(ownerId) {
        const { rows } = await pool.query(
            `SELECT c.*, u.username AS m_username, u.profile_image AS m_profile_image, u.is_email_verified AS m_is_verified
               FROM contacts c JOIN users u ON u.id = c.matched_user_id
              WHERE c.owner_id = $1 AND c.status = 'is_user'
              ORDER BY c.updated_at DESC`, [ownerId]);
        return rows.map((r) => ({
            ...ContactPG.hydrate(r),
            matchedUserId: { _id: r.matched_user_id, username: r.m_username, profileImage: r.m_profile_image, isVerified: r.m_is_verified },
        }));
    }

    /**
     * Pasa un contacto coincidente a `invited` de forma ATÓMICA. Devuelve el contacto sólo a quien lo consigue:
     * dos peticiones simultáneas no pueden cobrar la recompensa las dos (antes: findOne + save, con carrera).
     */
    static async claimInvite(id, ownerId) {
        if (!ContactPG.isValidId(id)) return null;
        const { rows } = await pool.query(
            `UPDATE contacts SET status = 'invited', updated_at = NOW()
              WHERE id = $1 AND owner_id = $2 AND status = 'is_user' RETURNING *`, [id, ownerId]);
        return ContactPG.hydrate(rows[0]);
    }

    /** Devuelve el contacto a `is_user` si el pago de la recompensa falló después de reclamarlo. */
    static async releaseInvite(id, ownerId) {
        await pool.query(`UPDATE contacts SET status = 'is_user', updated_at = NOW() WHERE id = $1 AND owner_id = $2 AND status = 'invited'`, [id, ownerId]);
    }
}

module.exports = ContactPG;
