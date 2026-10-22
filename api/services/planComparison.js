'use strict';

/**
 * planComparison — qué le saldría al cliente de Starter (pago por uso) en cada plan de pago.
 *
 * Compara el consumo del ciclo (en euros, sin IVA, como el precio de los planes) con la cuota mensual de Creator Pro,
 * Business y Enterprise VIP. Recomienda cambiar al plan más barato que cubra sus acciones de IA y salga por menos de lo
 * que ha gastado; si ninguno compensa, recomienda seguir por uso. Es una sugerencia: nunca cambia nada solo.
 */
const { PLANS } = require('../config/plans');

const PAID = ['creator_pro', 'business', 'enterprise_vip'];
const round2 = (n) => Math.round(n * 100) / 100;
const eur = (n) => `${round2(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * @param {{usageEUR: number, calls?: number}} u  consumo del ciclo (€ sin IVA) y número de acciones
 */
function compare({ usageEUR, calls = 0 }) {
    const usage = round2(Number(usageEUR) || 0);
    const plans = PAID.map((id) => {
        const p = PLANS.find((x) => x.id === id);
        return {
            id,
            name: p.name,
            priceEUR: p.priceEUR,
            aiActions: p.aiActions,                                    // null = sin límite
            fits: p.aiActions === null || p.aiActions >= calls,
            diffEUR: round2(usage - p.priceEUR),                       // > 0: el plan sale más barato que tu uso
        };
    });

    const best = plans.filter((p) => p.fits && p.priceEUR < usage).sort((a, b) => a.priceEUR - b.priceEUR)[0];
    if (best) {
        return {
            usageEUR: usage, plans,
            suggestion: {
                kind: 'switch', planId: best.id, planName: best.name, savingsEUR: best.diffEUR,
                message: `Has consumido ${eur(usage)} por uso. Con ${best.name} (${eur(best.priceEUR)} al mes) habrías pagado ${eur(best.diffEUR)} menos. Puedes cambiar de plan o seguir pagando por uso.`,
            },
        };
    }
    const cheapest = plans[0];
    return {
        usageEUR: usage, plans,
        suggestion: {
            kind: 'stay', planId: 'starter', planName: 'Starter', savingsEUR: 0,
            message: usage === 0
                ? `Todavía no has consumido nada. Pagarás solo lo que uses; el plan de pago más barato es ${cheapest.name} (${eur(cheapest.priceEUR)} al mes).`
                : usage < cheapest.priceEUR
                    ? `Tu consumo (${eur(usage)}) sale por debajo del plan de pago más barato (${cheapest.name}, ${eur(cheapest.priceEUR)} al mes). Te conviene seguir pagando solo lo que uses.`
                    : `Tu consumo (${eur(usage)}) supera la cuota de ${cheapest.name}, pero tus ${calls} acciones no caben en los planes que saldrían más baratos. Te conviene seguir pagando por uso; si tu volumen crece, te lo volveremos a comparar.`,
        },
    };
}

module.exports = { compare, PAID };
