'use strict';

/**
 * Precios y límites de los planes, generados SIEMPRE desde la configuración (config/plans.js y
 * config/plan-entitlements.js). Los usan el conocimiento sembrado (seed.js) y las respuestas deterministas del chat
 * (ai-workspace/facts.js): así el documento que lee el modelo y la respuesta fija que ve el cliente no pueden divergir.
 */
const { PLANS } = require('../../config/plans');
const { getEntitlements } = require('../../config/plan-entitlements');

const eur = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const CARRILES = { crypto_transfer: 'transferencia cripto', fiat_to_crypto: 'euros → cripto', crypto_to_fiat: 'cripto → euros', fiat_to_fiat: 'euros → euros' };

function textoPlanes() {
    return PLANS.map((p) => (p.priceEUR === 0
        ? `- ${p.name} (${p.profile}): sin cuota fija, pago por uso (coste real + 25 %), hasta ${p.aiActions} acciones de IA al mes; ${p.trialDays || 0} días de prueba.`
        : `- ${p.name} (${p.profile}): ${eur(p.priceEUR)} €/mes + IVA o ${eur(p.yearlyEUR)} €/año + IVA (2 meses gratis); ${p.aiActions ? `${eur(p.aiActions)} acciones de IA` : 'acciones de IA ilimitadas'}, ${p.gasSubsidy}% de subvención de gas.`)).join('\n');
}

function textoLimites() {
    return PLANS.filter((p) => p.id !== 'starter').map((p) => {
        const ops = getEntitlements(p.id).operaciones || {};
        const lineas = Object.entries(ops.rails || {}).map(([carril, l]) =>
            `${CARRILES[carril] || carril}: hasta ${eur(l.porOperacionEur)} € por operación, ${eur(l.diarioEur)} €/día y ${eur(l.mensualEur)} €/mes, con aprobación humana desde ${eur(l.aprobacionDesdeEur)} €`);
        return `- ${p.name}: ${lineas.join('; ')}${ops.dobleAprobacionDesdeEur ? `; doble aprobación desde ${eur(ops.dobleAprobacionDesdeEur)} €` : ''}.`;
    }).join('\n');
}

module.exports = { textoPlanes, textoLimites, eur, PLANS };
