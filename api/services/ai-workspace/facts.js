'use strict';

/**
 * Respuestas DETERMINISTAS del chat para lo que es dato de configuración y no conocimiento: precios de los planes y
 * límites de pago. Las redacta el servidor desde config/plans.js y config/plan-entitlements.js (vía planFacts), sin
 * pasar por el modelo: un modelo pequeño puede inventar «19,99 € por entidad» o mezclar los límites de dos planes, y
 * en una conversación comercial eso es una oferta falsa.
 *
 * Es CONSERVADOR a propósito: sólo contesta cuando el mensaje habla de los planes de BeZhas o de los límites de pago.
 * Una pregunta de precio sobre otra cosa («¿cuánto cuesta tokenizar un activo?», «¿comisión de BEZ-Pay?», «¿cuánto
 * vale un BEZ?») sigue yendo al modelo con su documento.
 */
const { textoPlanes, textoLimites, PLANS, eur } = require('../knowledge/planFacts');

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const PALABRA_PRECIO = /\b(cuest\w*|cuanto|precio\w*|coste\w*|costo\w*|tarifa\w*|vale|valen|cobr\w+ por (?:el )?plan)\b/;
const HABLA_DE_PLANES = /\b(plan(?:es)?|suscripci\w*|starter|creator|business|enterprise|vip|licencia\w*|mensualidad|cuota)\b/;
// Si el precio es de otra cosa, no es esta respuesta.
const OTRO_TEMA = /\b(tokeniz\w*|rwa|activo\w*|bez-?pay|cobros?|comision\w*|nomina\w*|gas\b|stak\w*|bez-?coin|comprar bez|token\b|api|mcp|sdk|erp|sap|odoo)\b/;

const PALABRA_LIMITE = /\b(limite\w*|tope\w*|umbral\w*|aprobacion\w*|doble aprobacion|maximo|cuanto (?:se )?puede\w*)\b/;
const HABLA_DE_FONDOS = /\b(mover|movimiento\w*|transfer\w*|pago\w*|pagar|fondos|tesorer\w*|operacion\w*|diario\w*|mensual\w*|por operacion|cripto|euros)\b/;

const HOLDING = /\b(holding\w*|grupo (?:empresarial|energetic\w*|de empresas|industrial|financiero)|(?:\d+|varias|muchas|ocho|diez) sociedades|filiales?|varias empresas|multinacional|instituci\w+|conglomerado)\b/;

const quierePrecios = (t) => PALABRA_PRECIO.test(t) && HABLA_DE_PLANES.test(t) && !OTRO_TEMA.test(t);
const quiereLimites = (t) => PALABRA_LIMITE.test(t) && HABLA_DE_FONDOS.test(t);
const esHolding = (t) => HOLDING.test(t);

function lineaHolding() {
    const vip = PLANS.find((p) => p.id === 'enterprise_vip');
    const biz = PLANS.find((p) => p.id === 'business');
    return `**Si es un grupo con varias sociedades**, el plan pensado es **${vip.name}** (${vip.profile}): ${eur(vip.priceEUR)} €/mes + IVA, acciones de IA ilimitadas y los límites de pago más altos. `
        + `Los planes se contratan **por organización**: no existe un precio por sociedad ni por entidad. Si sólo una sociedad necesita empezar, ${biz.name} (${eur(biz.priceEUR)} €/mes + IVA) basta para conectar el ERP y operar con aprobaciones.`;
}

/**
 * @param {{plan?:string}} principal
 * @param {string} mensaje
 * @returns {null | {texto:string, tipo:string}}
 */
function respuestaDeterminista(principal, mensaje) {
    const t = norm(mensaje);
    const precios = quierePrecios(t);
    const limites = quiereLimites(t);
    if (!precios && !limites) return null;

    const partes = [];
    if (precios) {
        partes.push(`**Planes de BeZhas** (precios sin IVA; el IVA del 21 % se suma en el pago):\n${textoPlanes()}\n\nPagando la suscripción con BEZ hay un 20 % de descuento.`);
    }
    if (limites) {
        partes.push(`**Límites y aprobaciones de pagos por plan.** Starter no incluye carriles de pago. En los demás planes:\n${textoLimites()}\n\nPor encima del umbral, la operación queda a la espera de una o dos aprobaciones humanas firmadas. Además se aplican la verificación KYC, el nivel de riesgo y si el destino es nuevo, que puede denegar o frenar la operación aunque esté dentro del límite.`);
    }
    if (esHolding(t)) partes.push(lineaHolding());
    const actual = PLANS.find((p) => p.id === principal?.plan);
    if (actual) partes.push(`Tu plan actual: **${actual.name}**.`);
    partes.push('_Datos de la configuración vigente de los planes de BeZhas._');
    return { texto: partes.join('\n\n'), tipo: precios && limites ? 'precios+limites' : precios ? 'precios' : 'limites' };
}

module.exports = { respuestaDeterminista, quierePrecios, quiereLimites, esHolding, lineaHolding };
