'use strict';

/**
 * gas-tank.js — Catálogo y economía del Gas Tank (fuente de verdad).
 *
 * El saldo de cada organización va en créditos (1 crédito = EUR_PER_CREDIT), los
 * mismos de usage-pricing.js. Las recargas son paquetes fijos o un importe libre
 * dentro de los topes. El coste de una operación on-chain (fase 2) se calcula
 * aquí: (gas × precio del gas × POL/EUR + comisión de protocolo en BEZ × BEZ/EUR)
 * × (1 + markup), redondeado SIEMPRE hacia arriba.
 */

const { EUR_PER_CREDIT } = require('./usage-pricing');

const MIN_RECHARGE_EUR = 10;
const MAX_RECHARGE_EUR = 5000;

// Paquetes de la pantalla de recarga. El bono es sobre los créditos pagados.
const RECHARGE_PACKAGES = [
    { id: 'gas-10',  eur: 10,  bonusPct: 0 },
    { id: 'gas-25',  eur: 25,  bonusPct: 0 },
    { id: 'gas-50',  eur: 50,  bonusPct: 5 },
    { id: 'gas-100', eur: 100, bonusPct: 10 },
    { id: 'gas-250', eur: 250, bonusPct: 15 },
    { id: 'gas-500', eur: 500, bonusPct: 20 },
];

// Markup sobre el coste real de la cadena. Provisional: decisión abierta nº 4 del plan.
const MARKUP_RATE = 0.25;

const creditsForEur = (eur) => Math.round(eur / EUR_PER_CREDIT);

function getPackage(id) {
    return RECHARGE_PACKAGES.find((p) => p.id === id) || null;
}

/** Créditos que recibe una recarga de `eur` (paquete o importe libre, sin bono el libre). */
function rechargeCredits(eur, pkg = null) {
    const base = creditsForEur(eur);
    return base + (pkg ? Math.floor((base * pkg.bonusPct) / 100) : 0);
}

/**
 * Coste en créditos de una operación on-chain.
 * @param {{gasUsed:number, gasPriceGwei:number, polEur:number, protocolFeeBez?:number, bezEur?:number}} p
 */
function operationCostCredits({ gasUsed, gasPriceGwei, polEur, protocolFeeBez = 0, bezEur = 0 }) {
    const gasEur = gasUsed * gasPriceGwei * 1e-9 * polEur;
    const feeEur = protocolFeeBez * bezEur;
    return Math.max(1, Math.ceil(((gasEur + feeEur) * (1 + MARKUP_RATE)) / EUR_PER_CREDIT));
}

/** Estimación de operaciones que alcanza un saldo, a un coste medio por operación. */
function opsRemaining(balanceCredits, avgCostCredits) {
    return avgCostCredits > 0 ? Math.floor(balanceCredits / avgCostCredits) : 0;
}

module.exports = {
    EUR_PER_CREDIT,
    MIN_RECHARGE_EUR,
    MAX_RECHARGE_EUR,
    RECHARGE_PACKAGES,
    MARKUP_RATE,
    creditsForEur,
    getPackage,
    rechargeCredits,
    operationCostCredits,
    opsRemaining,
};
