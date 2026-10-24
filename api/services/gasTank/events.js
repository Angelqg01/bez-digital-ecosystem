'use strict';

/**
 * gasTank/events — webhooks salientes del Gas Tank.
 *
 * Reutiliza el sistema de payment_webhooks (firma HMAC, reintentos, dead-letter): un evento del
 * tanque de una organización se encola para cada app suya (app_registry.enterprise_id =
 * organizations.legacy_enterprise_id) que esté suscrita a él (o a «*»).
 *
 *   gas.recharged         { organizationId, credits, balanceCredits, source: 'checkout'|'auto' }
 *   gas.recharge_failed   { organizationId, reason }
 *   gas.low_balance       { organizationId, balanceCredits, thresholdCredits }
 *
 * Nunca lanza: un webhook que no sale no debe romper un abono ni una operación ya enviada.
 */

const db = require('../../db/pool');
const logger = require('../../utils/logger');

async function emitToOrg(orgId, eventName, data, { paymentWebhooks = require('../paymentWebhooks') } = {}) {
    try {
        const { rows } = await db.query(
            `SELECT a.id::text AS id FROM app_registry a
               JOIN organizations o ON o.legacy_enterprise_id = a.enterprise_id
              WHERE o.id = $1`,
            [orgId]
        );
        let n = 0;
        for (const r of rows) n += await paymentWebhooks.emit(r.id, eventName, { organizationId: orgId, ...data });
        return n;
    } catch (err) {
        logger.warn({ err: err.message, orgId, eventName }, '[gasTank] webhook no encolado');
        return 0;
    }
}

module.exports = { emitToOrg };
