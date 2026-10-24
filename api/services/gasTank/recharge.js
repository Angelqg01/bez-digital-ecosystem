'use strict';

/**
 * gasTank/recharge — acredita una recarga pagada (webhook checkout.session.completed).
 *
 * Los créditos se recalculan AQUÍ a partir de lo que Stripe cobró (amount_total, EUR); nunca se
 * fían de un número que viaje en la metadata. Idempotente por el id de la sesión.
 */

const cfg = require('../../config/gas-tank');
const ledger = require('./ledger');

function isGasTankSession(session) {
    return Boolean(session && session.metadata && session.metadata.gas_tank_org_id);
}

async function creditFromSession(session) {
    const orgId = session.metadata.gas_tank_org_id;
    if (String(session.currency || '').toLowerCase() !== 'eur') {
        throw new Error(`Moneda no admitida en Gas Tank: ${session.currency}`);
    }
    if (!Number.isInteger(session.amount_total) || session.amount_total <= 0) {
        throw new Error('Sesión sin importe fiable');
    }
    const eur = session.amount_total / 100;
    // El bono sólo si el importe cobrado coincide con el del paquete declarado.
    const declared = cfg.getPackage(session.metadata.gas_tank_package_id);
    const pkg = declared && declared.eur === eur ? declared : null;
    const credits = cfg.rechargeCredits(eur, pkg);
    const out = await ledger.credit(orgId, credits, { kind: 'recharge', externalRef: `stripe:${session.id}` });
    return { orgId, credits, eur, ...out };
}

module.exports = { isGasTankSession, creditFromSession };
