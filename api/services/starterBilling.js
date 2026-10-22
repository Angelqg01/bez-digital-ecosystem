'use strict';

/**
 * starterBilling — consumo, resumen y correos del plan Starter (pago por uso).
 *
 *   cycleSummary(userId)      consumo del ciclo de la cuenta + comparación con los otros planes (pantalla /cuenta)
 *   alFacturar(invoice)       webhook invoice.paid de fin de ciclo: correo con lo cobrado y la comparación
 *   alAcabarPrueba(sub)       webhook customer.subscription.trial_will_end: correo con el consumo de la prueba
 *
 * El uso lo registra gateway_usage_ledger (middleware de medición de API/SDK y pasarela MCP) y se reporta a Stripe en
 * paralelo (usageBilling.recordUsage); aquí solo se lee. Stripe es quien cobra al cierre del ciclo.
 */
const { query } = require('../db/pool');
const { getPlan } = require('../config/plans');
const { compare } = require('./planComparison');
const { sendMail } = require('./mailer');
const logger = require('../utils/logger');

const hubUrl = () => String(process.env.HUB_PUBLIC_URL || 'https://hub.bezhas.com').replace(/\/+$/, '');
const idDe = (v) => (typeof v === 'string' ? v : v?.id) || null;
const fecha = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
const eur = (n) => `${(Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Apps (ids como texto, que es como las guarda el ledger) de las organizaciones de las que el usuario es miembro. */
async function appIdsOfUser(userId) {
    const { rows } = await query(
        `SELECT DISTINCT a.id::text AS id
           FROM organization_members m
           JOIN organizations o ON o.id = m.organization_id
           JOIN app_registry a ON a.enterprise_id = o.legacy_enterprise_id
          WHERE m.user_id = $1`,
        [userId]
    );
    return rows.map((r) => r.id);
}

async function usageBetween(appIds, from, to) {
    if (!appIds.length) return { calls: 0, credits: 0, eur: 0 };
    const { rows } = await query(
        `SELECT COUNT(*)::int AS calls, COALESCE(SUM(credits), 0)::int AS credits, COALESCE(SUM(billable_eur), 0)::numeric AS eur
           FROM gateway_usage_ledger
          WHERE app_id = ANY($1::text[]) AND created_at >= $2 AND created_at < $3`,
        [appIds, from, to]
    );
    const r = rows[0] || {};
    return { calls: r.calls || 0, credits: r.credits || 0, eur: Number(r.eur) || 0 };
}

/** Suscripción Starter de las apps del usuario (la más reciente), o null. */
async function starterOf(userId) {
    const { rows } = await query(
        `SELECT s.app_id, s.plan_id, s.status, s.stripe_subscription_id
           FROM organization_members m
           JOIN organizations o ON o.id = m.organization_id
           JOIN app_registry a ON a.enterprise_id = o.legacy_enterprise_id
           JOIN gateway_subscriptions s ON s.app_id = a.id
          WHERE m.user_id = $1
          ORDER BY s.updated_at DESC NULLS LAST
          LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
}

const startOfMonth = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); };
const secs = (s) => (Number.isFinite(s) ? new Date(s * 1000) : null);

/**
 * Consumo del ciclo en curso de la cuenta y su comparación con los otros planes.
 * @param {object|null} stripe  cliente de Stripe (si no hay, el ciclo es el mes natural y sin datos de prueba)
 */
async function cycleSummary(userId, stripe = null) {
    const sub = await starterOf(userId);
    if (!sub) return { plan: null, trial: null, cycle: null, usage: { calls: 0, credits: 0, eur: 0 }, comparison: null };
    const plan = getPlan(sub.plan_id);
    const out = { plan: { id: sub.plan_id, name: plan?.name || sub.plan_id, status: sub.status }, trial: null, cycle: null, usage: null, comparison: null };

    let from = startOfMonth();
    let to = new Date();
    if (stripe && sub.stripe_subscription_id) {
        try {
            const s = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
            const trialEnd = secs(s.trial_end);
            if (s.status === 'trialing' && trialEnd) {
                const ms = trialEnd.getTime() - Date.now();
                out.trial = { active: true, endsAt: trialEnd.toISOString(), daysLeft: Math.max(0, Math.ceil(ms / 86400000)) };
                from = secs(s.trial_start) || secs(s.start_date) || from;
                to = trialEnd;
            } else {
                const ps = secs(s.current_period_start ?? s.items?.data?.[0]?.current_period_start);
                const pe = secs(s.current_period_end ?? s.items?.data?.[0]?.current_period_end);
                if (ps) from = ps;
                if (pe) to = pe;
                if (trialEnd) out.trial = { active: false, endsAt: trialEnd.toISOString(), daysLeft: 0 };
            }
            out.plan.stripeStatus = s.status;
        } catch (e) {
            logger.warn({ error: e.message }, 'No se pudo leer la suscripción de Stripe: ciclo = mes natural');
        }
    }
    out.cycle = { from: from.toISOString(), to: to.toISOString() };
    out.usage = await usageBetween(await appIdsOfUser(userId), from, new Date(Math.max(to.getTime(), Date.now() + 1000)));
    if (sub.plan_id === 'starter') out.comparison = compare({ usageEUR: out.usage.eur, calls: out.usage.calls });
    return out;
}

// ── Correos ─────────────────────────────────────────────────────────────────────────────────────────────────

function buildMail({ kind, user, usage, comparison, totalEUR, period }) {
    const nombre = user.username || 'hola';
    const cuenta = `${hubUrl()}/cuenta`;
    const titulo = kind === 'trial' ? 'Tu prueba gratuita de Starter está a punto de acabar' : 'Resumen del mes de tu plan Starter';
    const intro = kind === 'trial'
        ? `Durante la prueba has hecho ${usage.calls} llamadas a la API, el SDK o el MCP, que a precio de uso serían ${eur(usage.eur)}. Al acabar la prueba empezarás a pagar solo lo que consumas.`
        : `Del ${fecha(period.from)} al ${fecha(period.to)} has hecho ${usage.calls} llamadas a la API, el SDK o el MCP.${totalEUR != null ? ` Se te han cobrado ${eur(totalEUR)} (IVA incluido).` : ''}`;
    const filas = comparison.plans.map((p) => `${p.name}: ${eur(p.priceEUR)} al mes${p.diffEUR > 0 ? ` (${eur(p.diffEUR)} menos que tu consumo)` : ''}`);
    const text = [
        `Hola ${nombre},`, '', intro, '',
        `Tu consumo del periodo: ${eur(usage.eur)} (sin IVA). Comparado con los planes de pago:`,
        ...filas.map((f) => `  · ${f}`), '',
        comparison.suggestion.message, '',
        `Ver mi consumo y cambiar de plan: ${cuenta}`, '— BeZhas',
    ].join('\n');
    const lis = filas.map((f) => `<li style="margin:4px 0">${esc(f)}</li>`).join('');
    const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f2f5f5;font-family:Arial,Helvetica,sans-serif;color:#08161a">
<table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="560" style="max-width:560px;background:#fff;border:1px solid #d8e0e1;border-radius:16px"><tr><td style="padding:32px">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#046c7a">BeZhas · Starter</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${esc(titulo)}</h1>
<p style="line-height:1.55">${esc(intro)}</p>
<p style="line-height:1.55;margin-top:16px">Tu consumo del periodo: <strong>${esc(eur(usage.eur))}</strong> (sin IVA). Comparado con los planes de pago:</p>
<ul style="line-height:1.5;padding-left:20px">${lis}</ul>
<p style="line-height:1.55;background:#f2f5f5;border-radius:10px;padding:14px 16px"><strong>${esc(comparison.suggestion.message)}</strong></p>
<p style="margin:24px 0 0"><a href="${esc(cuenta)}" style="display:inline-block;background:#046c7a;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px">Ver mi consumo y cambiar de plan</a></p>
</td></tr></table></td></tr></table></body></html>`;
    return { subject: titulo, text, html };
}

/** Dueño (titular) de una app: el usuario al que se escribe. */
async function ownerOfApp(appId) {
    const { rows } = await query(
        `SELECT u.id, u.email, u.username, u.bezhas_id
           FROM app_registry a
           JOIN organizations o ON o.legacy_enterprise_id = a.enterprise_id
           JOIN organization_members m ON m.organization_id = o.id AND m.role = 'owner'
           JOIN users u ON u.id = m.user_id
          WHERE a.id = $1
          LIMIT 1`,
        [appId]
    );
    return rows[0] || null;
}

/** Marca el resumen como enviado; devuelve false si ya existía (Stripe reenvía eventos). */
async function claim(key, subscriptionId, kind) {
    const { rows } = await query(
        'INSERT INTO starter_summaries (key, subscription_id, kind) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING RETURNING key',
        [key, subscriptionId, kind]
    );
    return rows.length > 0;
}

async function enviar({ kind, key, subId, period, totalEUR }) {
    const { rows } = await query(
        `SELECT app_id FROM gateway_subscriptions WHERE stripe_subscription_id = $1 AND plan_id = 'starter' LIMIT 1`, [subId]);
    if (!rows.length) return { accion: 'no_starter' };
    const user = await ownerOfApp(rows[0].app_id);
    if (!user?.email) return { accion: 'sin_destinatario' };
    if (!(await claim(key, subId, kind))) return { accion: 'repetido' };

    const usage = await usageBetween(await appIdsOfUser(user.id), period.from, period.to);
    const comparison = compare({ usageEUR: usage.eur, calls: usage.calls });
    const mail = buildMail({ kind, user, usage, comparison, totalEUR, period });
    const r = await sendMail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html });
    logger.info({ subscriptionId: subId, kind, enviado: !!r.sent, sugerencia: comparison.suggestion.kind }, 'Resumen de Starter');
    return { accion: 'enviado', enviado: !!r.sent, comparison };
}

/** invoice.paid: sólo la factura de fin de ciclo de una suscripción Starter. */
async function alFacturar(invoice) {
    if (invoice.billing_reason !== 'subscription_cycle') return { accion: 'ignorada' };
    const subId = idDe(invoice.subscription) || idDe(invoice.parent?.subscription_details?.subscription);
    if (!subId) return { accion: 'ignorada' };
    const from = secs(invoice.period_start) || startOfMonth();
    const to = secs(invoice.period_end) || new Date();
    return enviar({ kind: 'cycle', key: `invoice:${invoice.id}`, subId, period: { from, to }, totalEUR: Number.isFinite(invoice.amount_paid) ? invoice.amount_paid / 100 : null });
}

/** customer.subscription.trial_will_end: aviso (Stripe lo manda 3 días antes) con el consumo de la prueba. */
async function alAcabarPrueba(sub) {
    const from = secs(sub.trial_start) || secs(sub.start_date) || startOfMonth();
    const to = new Date();
    return enviar({ kind: 'trial', key: `trial:${sub.id}`, subId: sub.id, period: { from, to }, totalEUR: null });
}

module.exports = { cycleSummary, alFacturar, alAcabarPrueba, buildMail, appIdsOfUser, usageBetween };
