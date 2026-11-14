/**
 * lib/rwaPricing.js — precio de las fracciones en BEZ frente a la valoración en USD.
 *
 * El BEZ tiene un precio real fijo en la fase semilla (0,0075 USD, config/bez-price.js
 * de la API, publicado en /api/gateway/v1/oracle/token-prices). No es un precio de
 * mercado: las equivalencias son orientativas. Sin precio no se calcula nada: no hay
 * valor por defecto, para no enseñar una equivalencia inventada.
 */

/** Diferencia máxima, en %, entre lo que se recauda y la valoración antes de avisar. */
export const TOLERANCIA_PCT = 5;

const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
};

/** Precio por fracción en BEZ que hace que fracciones × precio = valoración. Texto con 2 decimales o null. */
export function sugerirPrecioBez({ valoracionUsd, fracciones, precioBezUsd }) {
    const v = num(valoracionUsd), f = num(fracciones), p = num(precioBezUsd);
    if (!(v > 0) || !(f > 0) || !(p > 0)) return null;
    return (v / f / p).toFixed(2);
}

/** USD de un importe en BEZ, o null sin precio. */
export function bezAUsd(bez, precioBezUsd) {
    const b = num(bez), p = num(precioBezUsd);
    return b === null || !(p > 0) ? null : b * p;
}

/**
 * Equivalencias del asistente. `desviacionPct` es lo que se recauda respecto a la
 * valoración: 0 si cuadra, negativo si se recauda menos.
 */
export function equivalencias({ fracciones, precioFraccionBez, valoracionUsd, precioBezUsd }) {
    const f = num(fracciones), pf = num(precioFraccionBez), v = num(valoracionUsd);
    const precioFraccionUsd = bezAUsd(pf, precioBezUsd);
    if (precioFraccionUsd === null || !(f > 0)) return null;
    const capitalUsd = precioFraccionUsd * f;
    const desviacionPct = v > 0 ? ((capitalUsd - v) / v) * 100 : null;
    return {
        precioFraccionUsd, capitalUsd,
        valorFraccionUsd: v > 0 ? v / f : null,
        desviacionPct,
        cuadra: desviacionPct === null ? null : Math.abs(desviacionPct) <= TOLERANCIA_PCT,
    };
}

export const usd = (n, dec = 2) => (n === null || n === undefined ? '' : `$${n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`);
