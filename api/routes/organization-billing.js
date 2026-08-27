/**
 * routes/organization-billing.js — Facturación de cliente final por organización.
 *
 * Bloque "3. Datos Financieros y de Facturación" del registro extendido:
 * método de pago corporativo, contactos admin/técnico/seguridad, y
 * facturación electrónica. Reutiliza Stripe de verdad con el mismo patrón
 * `getStripe()` perezoso que usageBilling.js/webhooks.js — nada de un
 * segundo cliente de Stripe en el repo.
 *
 * El backend NUNCA ve un número de tarjeta ni un IBAN completo: la captura
 * pasa por un SetupIntent + Stripe Elements en el frontend, y aquí solo se
 * guardan los ids que Stripe devuelve.
 *
 * Rol: owner/admin/financial pueden escribir; cualquier miembro activo puede
 * leer (transparencia contable dentro de la empresa, igual que en organization-tech.js).
 */
const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { authenticateToken, requireOrgRole } = require('../middleware/security');

const router = Router();

const ANY_MEMBER = ['owner', 'admin', 'developer', 'auditor', 'financial', 'operator'];
const BILLING_WRITERS = ['owner', 'admin', 'financial'];
const CONTACT_TYPES = ['administrative', 'technical', 'security'];

// Perezoso a propósito — mismo motivo que en usageBilling.js: construirlo al
// importar tumbaría la API entera si falta STRIPE_SECRET_KEY, aunque nada más
// de la plataforma dependa de facturación.
let _stripe = null;
function getStripe() {
    if (_stripe) return _stripe;
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Stripe no configurado: falta STRIPE_SECRET_KEY');
    }
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return _stripe;
}

async function getOrCreateBillingProfile(orgId) {
    const existing = await query('SELECT * FROM organization_billing_profiles WHERE organization_id = $1', [orgId]);
    if (existing.rows.length > 0) return existing.rows[0];

    // ON CONFLICT DO UPDATE (no-op) en vez de DO NOTHING: así RETURNING
    // siempre trae una fila, incluso si dos peticiones concurrentes chocan
    // en el INSERT (el primer registro de una organización nueva es el caso
    // típico — dos pestañas cargando Settings a la vez).
    const { rows } = await query(
        `INSERT INTO organization_billing_profiles (organization_id) VALUES ($1)
         ON CONFLICT (organization_id) DO UPDATE SET organization_id = EXCLUDED.organization_id
         RETURNING *`,
        [orgId]
    );
    return rows[0];
}

async function ensureStripeCustomer(orgId, billingEmail) {
    const profile = await getOrCreateBillingProfile(orgId);
    if (profile.stripe_customer_id) return profile;

    const org = await query('SELECT name, legal_name FROM organizations WHERE id = $1', [orgId]);
    const customer = await getStripe().customers.create({
        name: org.rows[0]?.legal_name || org.rows[0]?.name,
        email: billingEmail || profile.billing_email || undefined,
        metadata: { organization_id: orgId },
    });

    const { rows } = await query(
        `UPDATE organization_billing_profiles SET stripe_customer_id = $1, updated_at = NOW()
         WHERE organization_id = $2 RETURNING *`,
        [customer.id, orgId]
    );
    return rows[0];
}

// ── Perfil de facturación (datos + estado del método de pago) ──
router.get('/:orgId/billing', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    const profile = await getOrCreateBillingProfile(req.params.orgId);
    // El id de Stripe no se expone al cliente — no aporta nada a la UI y es
    // superficie de más para un ataque de enumeración.
    const { stripe_customer_id, stripe_default_payment_method_id, ...safe } = profile;
    res.json({ success: true, billingProfile: { ...safe, hasPaymentMethod: Boolean(stripe_default_payment_method_id) } });
});

// ── Actualizar email de facturación / config de facturación electrónica ──
router.patch('/:orgId/billing', authenticateToken, requireOrgRole(...BILLING_WRITERS), [
    body('billingEmail').optional().isEmail(),
    body('einvoicingEnabled').optional().isBoolean(),
    body('einvoicingFormat').optional().isIn(['facturae', 'sii', 'other']),
    body('einvoicingConfig').optional().isObject(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    await getOrCreateBillingProfile(req.params.orgId);

    const sets = [];
    const params = [];
    let idx = 1;
    const fieldMap = {
        billingEmail: 'billing_email',
        einvoicingEnabled: 'einvoicing_enabled',
        einvoicingFormat: 'einvoicing_format',
    };
    for (const [key, column] of Object.entries(fieldMap)) {
        if (req.body[key] !== undefined) { sets.push(`${column} = $${idx++}`); params.push(req.body[key]); }
    }
    if (req.body.einvoicingConfig !== undefined) {
        sets.push(`einvoicing_config = $${idx++}`);
        params.push(JSON.stringify(req.body.einvoicingConfig));
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    sets.push('updated_at = NOW()');
    params.push(req.params.orgId);

    const { rows } = await query(
        `UPDATE organization_billing_profiles SET ${sets.join(', ')} WHERE organization_id = $${idx} RETURNING *`,
        params
    );
    const { stripe_customer_id, stripe_default_payment_method_id, ...safe } = rows[0];
    res.json({ success: true, billingProfile: { ...safe, hasPaymentMethod: Boolean(stripe_default_payment_method_id) } });
});

// ── Iniciar la captura de un método de pago (tarjeta o SEPA) ──
// Devuelve el clientSecret de un SetupIntent: el frontend lo usa con Stripe
// Elements para que la tarjeta/IBAN viaje directo a Stripe, nunca por aquí.
router.post('/:orgId/billing/setup-intent', authenticateToken, requireOrgRole(...BILLING_WRITERS), [
    body('billingEmail').optional().isEmail(),
], async (req, res) => {
    try {
        const profile = await ensureStripeCustomer(req.params.orgId, req.body.billingEmail);
        const setupIntent = await getStripe().setupIntents.create({
            customer: profile.stripe_customer_id,
            payment_method_types: ['card', 'sepa_debit'],
            metadata: { organization_id: req.params.orgId },
        });
        res.json({ success: true, clientSecret: setupIntent.client_secret });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo iniciar la captura del método de pago', details: error.message });
    }
});

// ── Confirmar el método de pago tras completarse el SetupIntent en el frontend ──
router.post('/:orgId/billing/payment-method/confirm', authenticateToken, requireOrgRole(...BILLING_WRITERS), [
    body('paymentMethodId').isString().notEmpty(),
], async (req, res) => {
    try {
        const profile = await getOrCreateBillingProfile(req.params.orgId);
        if (!profile.stripe_customer_id) {
            return res.status(409).json({ error: 'No hay cliente de Stripe todavía — llama primero a setup-intent' });
        }

        const stripe = getStripe();
        await stripe.paymentMethods.attach(req.body.paymentMethodId, { customer: profile.stripe_customer_id });
        await stripe.customers.update(profile.stripe_customer_id, {
            invoice_settings: { default_payment_method: req.body.paymentMethodId },
        });
        const pm = await stripe.paymentMethods.retrieve(req.body.paymentMethodId);
        const last4 = pm.card?.last4 || pm.sepa_debit?.last4 || null;
        const type = pm.card ? 'card' : (pm.sepa_debit ? 'sepa_debit' : null);

        const { rows } = await query(
            `UPDATE organization_billing_profiles
             SET stripe_default_payment_method_id = $1, payment_method_type = $2, payment_method_last4 = $3, updated_at = NOW()
             WHERE organization_id = $4 RETURNING *`,
            [req.body.paymentMethodId, type, last4, req.params.orgId]
        );
        const { stripe_customer_id, stripe_default_payment_method_id, ...safe } = rows[0];
        res.json({ success: true, billingProfile: { ...safe, hasPaymentMethod: true } });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo confirmar el método de pago', details: error.message });
    }
});

// ── Quitar el método de pago guardado ──
router.delete('/:orgId/billing/payment-method', authenticateToken, requireOrgRole(...BILLING_WRITERS), async (req, res) => {
    const profile = await getOrCreateBillingProfile(req.params.orgId);
    if (!profile.stripe_default_payment_method_id) {
        return res.status(404).json({ error: 'No hay ningún método de pago guardado' });
    }
    try {
        await getStripe().paymentMethods.detach(profile.stripe_default_payment_method_id);
    } catch (error) {
        // Si Stripe ya no lo tiene (borrado manual en el dashboard, por ej.),
        // seguimos y limpiamos igualmente nuestro lado — no dejar el registro colgado.
    }
    await query(
        `UPDATE organization_billing_profiles
         SET stripe_default_payment_method_id = NULL, payment_method_type = NULL, payment_method_last4 = NULL, updated_at = NOW()
         WHERE organization_id = $1`,
        [req.params.orgId]
    );
    res.json({ success: true });
});

// ── Facturas emitidas por Stripe (solo lectura) ──
router.get('/:orgId/billing/invoices', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    const profile = await getOrCreateBillingProfile(req.params.orgId);
    if (!profile.stripe_customer_id) return res.json({ success: true, invoices: [] });

    try {
        const list = await getStripe().invoices.list({ customer: profile.stripe_customer_id, limit: 24 });
        const invoices = list.data.map((inv) => ({
            id: inv.id,
            number: inv.number,
            status: inv.status,
            amountDue: inv.amount_due,
            currency: inv.currency,
            hostedInvoiceUrl: inv.hosted_invoice_url,
            created: inv.created,
        }));
        res.json({ success: true, invoices });
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron obtener las facturas', details: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
//  CONTACTOS (administrativo / técnico / seguridad)
// ═══════════════════════════════════════════════════════════════════

router.get('/:orgId/billing/contacts', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    const { rows } = await query(
        `SELECT * FROM organization_billing_contacts WHERE organization_id = $1 ORDER BY contact_type, created_at ASC`,
        [req.params.orgId]
    );
    res.json({ success: true, contacts: rows });
});

router.post('/:orgId/billing/contacts', authenticateToken, requireOrgRole(...BILLING_WRITERS), [
    body('contactType').isIn(CONTACT_TYPES).withMessage(`contactType debe ser uno de: ${CONTACT_TYPES.join(', ')}`),
    body('name').isLength({ min: 1, max: 255 }),
    body('email').isEmail(),
    body('phone').optional().isLength({ max: 50 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows } = await query(
        `INSERT INTO organization_billing_contacts (organization_id, contact_type, name, email, phone, added_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.params.orgId, req.body.contactType, req.body.name, req.body.email, req.body.phone || null, req.user.userId]
    );
    res.status(201).json({ success: true, contact: rows[0] });
});

router.delete('/:orgId/billing/contacts/:contactId', authenticateToken, requireOrgRole(...BILLING_WRITERS), [
    param('contactId').isUUID(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rowCount } = await query(
        'DELETE FROM organization_billing_contacts WHERE id = $1 AND organization_id = $2',
        [req.params.contactId, req.params.orgId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json({ success: true });
});

module.exports = router;
