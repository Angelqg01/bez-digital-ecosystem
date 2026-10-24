'use strict';

/**
 * gasTank/autoRecharge — recarga automática off-session cuando el saldo baja del umbral.
 *
 *   rechargeIfNeeded(orgId)   evalúa una cuenta y, si procede, cobra y acredita
 *   sweep()                   recorre las cuentas con auto-recarga activa y saldo bajo
 *
 * Reglas:
 *   - Sólo con auto-recarga activada, método de pago guardado y saldo disponible < umbral.
 *   - Tope mensual (monthly_cap_credits) sobre las recargas automáticas del mes natural UTC.
 *   - Un intento por cuenta cada COOLDOWN_MIN minutos, reclamado con UPDATE atómico (varias
 *     instancias de la API pueden correr el barrido a la vez).
 *   - Si el cobro falla o pide autenticación, se guarda el motivo, se avisa por correo y NO se
 *     insiste hasta pasado el cooldown.
 */

const db = require('../../db/pool');
const cfg = require('../../config/gas-tank');
const ledger = require('./ledger');
const { sendMail } = require('../mailer');
const logger = require('../../utils/logger');

const COOLDOWN_MIN = 60;

let _stripe = null;
function getStripe() {
    if (_stripe) return _stripe;
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe no configurado: falta STRIPE_SECRET_KEY');
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return _stripe;
}

async function monthlyAutoSpent(orgId) {
    const { rows } = await db.query(
        `SELECT COALESCE(SUM(credits), 0)::bigint AS n FROM gas_tank_ledger
          WHERE organization_id = $1 AND kind = 'recharge' AND external_ref LIKE 'auto:%'
            AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
        [orgId]
    );
    return Number(rows[0].n);
}

async function notifyFailure(orgId, motivo) {
    try {
        const { rows } = await db.query(
            `SELECT p.billing_email, o.name FROM organizations o
               LEFT JOIN organization_billing_profiles p ON p.organization_id = o.id WHERE o.id = $1`, [orgId]
        );
        const to = rows[0]?.billing_email;
        if (!to) return;
        await sendMail({
            to,
            subject: 'Gas Tank: no se pudo hacer la recarga automática',
            text: `La recarga automática del Gas Tank de ${rows[0].name} no se completó (${motivo}). ` +
                  `Actualiza el método de pago o recarga manualmente para que tus operaciones no se detengan.`,
        });
    } catch (err) {
        logger.warn({ err: err.message, orgId }, '[gasTank] aviso de recarga fallida no enviado');
    }
}

async function rechargeIfNeeded(orgId) {
    const b = await ledger.getBalance(orgId);
    if (b.status !== 'active' || !b.autoRecharge.enabled) return { skipped: 'disabled' };
    if (b.balanceCredits >= b.autoRecharge.thresholdCredits) return { skipped: 'above_threshold' };

    const credits = b.autoRecharge.rechargeCredits;
    if (b.monthlyCapCredits != null && (await monthlyAutoSpent(orgId)) + credits > b.monthlyCapCredits) {
        return { skipped: 'monthly_cap' };
    }

    const prof = await db.query(
        `SELECT stripe_customer_id, stripe_default_payment_method_id FROM organization_billing_profiles WHERE organization_id = $1`, [orgId]
    );
    const { stripe_customer_id: customer, stripe_default_payment_method_id: pm } = prof.rows[0] || {};
    if (!customer || !pm) return { skipped: 'no_payment_method' };

    // Cerrojo: un solo intento por cuenta y cooldown.
    const claim = await db.query(
        `UPDATE gas_tank_accounts SET last_auto_attempt_at = NOW()
          WHERE organization_id = $1
            AND (last_auto_attempt_at IS NULL OR last_auto_attempt_at < NOW() - ($2 || ' minutes')::interval)
          RETURNING last_auto_attempt_at`,
        [orgId, String(COOLDOWN_MIN)]
    );
    if (!claim.rows.length) return { skipped: 'cooldown' };

    const eur = Math.round(credits * cfg.EUR_PER_CREDIT * 100) / 100;
    try {
        const pi = await getStripe().paymentIntents.create({
            amount: Math.round(eur * 100),
            currency: 'eur',
            customer,
            payment_method: pm,
            off_session: true,
            confirm: true,
            description: 'Recarga automática Gas Tank BeZhas',
            metadata: { gas_tank_org_id: orgId, gas_tank_auto: 'true' },
        }, { idempotencyKey: `gastank-auto-${orgId}-${new Date(claim.rows[0].last_auto_attempt_at).getTime()}` });

        if (pi.status !== 'succeeded') throw new Error(`pago ${pi.status}`);
        const out = await ledger.credit(orgId, credits, { kind: 'recharge', externalRef: `auto:${pi.id}` });
        await db.query(`UPDATE gas_tank_accounts SET last_auto_error = NULL WHERE organization_id = $1`, [orgId]);
        return { recharged: true, credits, ...out };
    } catch (err) {
        const motivo = String(err.message).slice(0, 300);
        await db.query(`UPDATE gas_tank_accounts SET last_auto_error = $2 WHERE organization_id = $1`, [orgId, motivo]);
        logger.warn({ orgId, motivo }, '[gasTank] recarga automática fallida');
        await notifyFailure(orgId, motivo);
        return { recharged: false, error: motivo };
    }
}

async function sweep() {
    const { rows } = await db.query(
        `SELECT organization_id FROM gas_tank_accounts
          WHERE status = 'active' AND auto_recharge_enabled AND balance_credits < threshold_credits
            AND (last_auto_attempt_at IS NULL OR last_auto_attempt_at < NOW() - ($1 || ' minutes')::interval)
          LIMIT 100`,
        [String(COOLDOWN_MIN)]
    );
    const out = [];
    for (const r of rows) {
        try { out.push({ orgId: r.organization_id, ...(await rechargeIfNeeded(r.organization_id)) }); }
        catch (err) { logger.warn({ err: err.message, orgId: r.organization_id }, '[gasTank] barrido'); }
    }
    return out;
}

let timer = null;
function startSweep(intervalMs = 5 * 60_000) {
    if (timer) return;
    timer = setInterval(() => { ledger.releaseExpired().catch(() => {}); sweep().catch(() => {}); }, intervalMs);
    timer.unref?.();
}
function stopSweep() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { rechargeIfNeeded, sweep, startSweep, stopSweep, COOLDOWN_MIN };
