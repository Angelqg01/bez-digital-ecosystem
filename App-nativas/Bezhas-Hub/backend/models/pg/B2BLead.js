const pool = require('../../db/pool');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Leads B2B y su mensaje de salida (migración 022). Sustituye a models/B2BLead.model.js (Mongoose).
 * El mensaje (`outreach`) sigue siendo un objeto anidado para quien lo lee; en la tabla son columnas outreach_*.
 */
class B2BLeadPG {
    static isValidId(id) { return typeof id === 'string' && UUID.test(id); }

    static hydrate(r) {
        if (!r) return null;
        const lead = {
            _id: r.id, id: r.id,
            campaignId: r.campaign_id, sector: r.sector, companyName: r.company_name, url: r.url, type: r.type,
            contactEmail: r.contact_email, whatsappNumber: r.whatsapp_number, linkedinProfile: r.linkedin_profile,
            score: r.score, scoreReasons: r.score_reasons || [], status: r.status, source: r.source,
            outreach: r.outreach_status ? {
                channel: r.outreach_channel, subject: r.outreach_subject, message: r.outreach_message, status: r.outreach_status,
                approvedBy: r.outreach_approved_by, approvedAt: r.outreach_approved_at, sentAt: r.outreach_sent_at,
                providerMessageId: r.outreach_provider_message_id, error: r.outreach_error,
            } : undefined,
            metadata: r.metadata || {}, createdAt: r.created_at, updatedAt: r.updated_at,
        };
        return lead;
    }

    static async create(d) {
        const o = d.outreach || {};
        const { rows } = await pool.query(
            `INSERT INTO b2b_leads (campaign_id, sector, company_name, url, type, contact_email, whatsapp_number, linkedin_profile,
                                    score, score_reasons, status, source, outreach_channel, outreach_subject, outreach_message, outreach_status, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17::jsonb) RETURNING *`,
            [d.campaignId, d.sector, d.companyName, d.url || null, d.type || 'B2B',
                d.contactEmail ? String(d.contactEmail).trim().toLowerCase() : null, d.whatsappNumber || null, d.linkedinProfile || null,
                Math.min(100, Math.max(0, Math.round(d.score || 0))), JSON.stringify(d.scoreReasons || []), d.status || 'needs_approval', d.source || 'openclaw',
                o.channel || null, o.subject || null, o.message || null, o.status || null, JSON.stringify(d.metadata || {})]);
        return B2BLeadPG.hydrate(rows[0]);
    }

    static async findById(id) {
        if (!B2BLeadPG.isValidId(id)) return null;
        const { rows } = await pool.query('SELECT * FROM b2b_leads WHERE id = $1', [id]);
        return B2BLeadPG.hydrate(rows[0]);
    }

    /**
     * Aprueba el mensaje de forma ATÓMICA: sólo la primera llamada sobre un lead `needs_approval` lo consigue. Dos
     * aprobaciones simultáneas (doble clic, dos administradores) ya no envían el mismo mensaje dos veces.
     * Devuelve null si el lead no existe o no estaba pendiente.
     */
    static async approve(id, approver) {
        if (!B2BLeadPG.isValidId(id)) return null;
        const { rows } = await pool.query(
            `UPDATE b2b_leads SET status = 'approved', outreach_status = 'approved', outreach_approved_by = $2,
                    outreach_approved_at = NOW(), updated_at = NOW()
              WHERE id = $1 AND outreach_status = 'needs_approval' RETURNING *`, [id, String(approver || 'human-admin').slice(0, 255)]);
        return B2BLeadPG.hydrate(rows[0]);
    }

    static async markSent(id, providerMessageId) {
        const { rows } = await pool.query(
            `UPDATE b2b_leads SET status = 'sent', outreach_status = 'sent', outreach_sent_at = NOW(),
                    outreach_provider_message_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, providerMessageId || null]);
        return B2BLeadPG.hydrate(rows[0]);
    }

    static async markFailed(id, { blocked = false, error = null } = {}) {
        const estado = blocked ? 'blocked' : 'failed';
        const { rows } = await pool.query(
            `UPDATE b2b_leads SET status = $2, outreach_status = $2, outreach_error = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, estado, error ? String(error).slice(0, 2000) : null]);
        return B2BLeadPG.hydrate(rows[0]);
    }
}

module.exports = B2BLeadPG;
