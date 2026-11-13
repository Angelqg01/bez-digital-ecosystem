'use strict';

/**
 * config/api-credits.js — saldo prepago de la API (plan Starter, pago por uso).
 *
 * El cliente compra saldo en euros y lo gasta con su api-key en la API y el MCP
 * de BeZhas, incluidos los modelos de IA. El precio de cada llamada NO se define
 * aquí: sale de config/usage-pricing.js (coste del modelo + cómputo, + margen).
 * Este fichero sólo dice cuánto saldo da cada euro y qué importes se venden.
 */

const { EUR_PER_CREDIT } = require('./usage-pricing');

/** Importes que se ofrecen en la pantalla de recarga. Sin bonos: 1 € = 1 € de saldo. */
const PAQUETES = Object.freeze([
    Object.freeze({ id: 'saldo_10', eur: 10 }),
    Object.freeze({ id: 'saldo_25', eur: 25 }),
    Object.freeze({ id: 'saldo_50', eur: 50 }),
    Object.freeze({ id: 'saldo_100', eur: 100 }),
]);

const limites = () => ({
    min: Number(process.env.API_CREDITS_MIN_EUR || 5),
    max: Number(process.env.API_CREDITS_MAX_EUR || 1000),
});

/** Créditos que da un importe en euros (antes de impuestos). Entero, hacia abajo. */
function creditosDe(eur) {
    return Math.floor((Number(eur) + 1e-9) / EUR_PER_CREDIT);
}

const eurDe = (credits) => Math.round(Number(credits) * EUR_PER_CREDIT * 1000) / 1000;

const paquete = (id) => PAQUETES.find((p) => p.id === id) || null;

/**
 * Modelos de IA que hoy se pueden gastar con el saldo. Es lo que se le puede
 * prometer al cliente: sólo los proveedores conectados en
 * services/ai-workspace/gateway.js. Añadir uno aquí sin conectarlo allí es
 * anunciar algo que no se entrega.
 */
const MODELOS_DISPONIBLES = Object.freeze([
    Object.freeze({ proveedor: 'Anthropic', familia: 'Claude', estado: 'disponible' }),
    Object.freeze({ proveedor: 'Google', familia: 'Gemini', estado: 'disponible' }),
    Object.freeze({ proveedor: 'OpenAI', familia: 'GPT / Codex', estado: 'proximamente' }),
    Object.freeze({ proveedor: 'xAI', familia: 'Grok', estado: 'proximamente' }),
]);

module.exports = { PAQUETES, MODELOS_DISPONIBLES, limites, creditosDe, eurDe, paquete, EUR_PER_CREDIT };
