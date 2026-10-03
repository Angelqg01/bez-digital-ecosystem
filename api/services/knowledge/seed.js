'use strict';

/**
 * Conocimiento público de la plataforma (global, PUBLIC). Idempotente: un
 * documento que ya existe con el mismo contenido no se reindexa.
 *
 * Los datos salen de la configuración real (config/plans.js, config/bez-price.js,
 * routes/webhooks.js, deploy/gcp/config.env). Si cambian allí, cambiar aquí:
 * el asistente responde con esto y no debe inventar precios ni direcciones.
 */
const crypto = require('crypto');
const { PLANS } = require('../../config/plans');

const eur = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const planes = PLANS.map((p) => (p.priceEUR === 0
    ? `- ${p.name} (${p.profile}): sin cuota, pago por uso de créditos; ${p.aiActions} acciones de IA incluidas; ${p.trialDays || 0} días de prueba.`
    : `- ${p.name} (${p.profile}): ${eur(p.priceEUR)} €/mes + IVA o ${eur(p.yearlyEUR)} €/año + IVA (2 meses gratis); ${p.aiActions ? `${eur(p.aiActions)} acciones de IA` : 'acciones de IA ilimitadas'}, ${p.gasSubsidy}% de subvención de gas.`)).join('\n');

const DOCS = [
    ['bz_que_es', 'Qué es BeZhas',
        'BeZhas es una red B2B firmada que conecta el ERP de una empresa con puertos, aduanas, bancos y clientes de cualquier país. '
        + 'Cada operación se prueba con un hash: los datos comerciales se quedan en la empresa, el pago se libera cuando la contraparte '
        + 'acepta y ningún intermediario decide por ti. BeZhas no sustituye el ERP: lo ancla mediante el Edge Node de cada cliente.'],
    ['bz_planes', 'Planes y precios',
        `BeZhas ofrece cuatro planes. Los precios no incluyen IVA (21 % en España), que se suma en el pago:\n${planes}\n`
        + 'Pagando la suscripción con BEZ hay un 20 % de descuento. Los planes se contratan desde la web con tarjeta (Stripe) '
        + 'y se activan en la app del cliente. Para comparar planes, abre la sección de planes de la plataforma.'],
    ['bz_token', 'BEZ-Coin',
        'BEZ-Coin (BEZ) vive en Polygon (cadena 137). Contrato oficial: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8. '
        + 'En la fase semilla el precio es fijo: 0,0075 USD por BEZ. Comprueba siempre la dirección del contrato antes de operar.'],
    ['bz_comprar_bez', 'Cómo comprar BEZ',
        'Se puede comprar BEZ con tarjeta (Stripe) o por transferencia bancaria SEPA desde la página del token. '
        + 'Con tarjeta, la compra queda retenida hasta que el banco confirma el cobro (normalmente pocos días hábiles) '
        + 'y después tesorería entrega los BEZ en la wallet indicada. Una disputa o un reembolso durante la retención cancela la entrega.'],
    ['bz_pagos', 'Pagos y facturación',
        'Los cobros de BeZhas se hacen con Stripe en la cuenta de BeZhas (tarjeta) y por transferencia SEPA. '
        + 'Los planes se renuevan automáticamente; cancelar la suscripción o un reembolso completo desactivan el plan. '
        + 'Las facturas y recibos llegan por email desde Stripe.'],
    ['bz_mcp', 'Conectar una IA a BeZhas (MCP)',
        'BeZhas publica un servidor MCP en https://mcp.bezhas.com/mcp con OAuth 2.1 y PKCE. '
        + 'Se puede conectar desde Claude, ChatGPT, Codex, Gemini, Antigravity y otros clientes compatibles. '
        + 'La página https://www.bezhas.com/mcp tiene la configuración de cada cliente. Las operaciones con coste o con fondos '
        + 'muestran antes su coste y requieren aprobación.'],
    ['bz_seguridad', 'Seguridad',
        'BeZhas nunca pide claves privadas ni frases semilla: ni este asistente, ni soporte, ni ningún formulario. '
        + 'Las operaciones sensibles pasan por la capa de seguridad transaccional (AEGIS, que falla cerrada): política, simulación '
        + 'y aprobaciones antes de ejecutar. El asistente no ejecuta transacciones; solo abre la pantalla donde el usuario firma.'],
    ['bz_edge', 'Edge Node',
        'Cada empresa ejecuta su propio Edge Node: los eventos de su ERP salen por él, se anonimizan y solo se publica su prueba (hash). '
        + 'Los datos comerciales no salen de la empresa. El alta del nodo se hace desde el onboarding de la plataforma.'],
];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function seedPublicKnowledge(service) {
    const admin = { userId: 'system', tenantId: 'system', roles: ['ADMIN', 'USER'], plan: 'enterprise_vip' };
    let added = 0;
    for (const [id, title, content] of DOCS) {
        const existing = await service.store.getDoc(id);
        if (existing && existing.checksum === `sha256:${sha(content)}`) continue;
        await service.ingest(admin, { id, title, content, classification: 'PUBLIC', global: true, source: 'platform_docs' });
        added++;
    }
    return added;
}

module.exports = { seedPublicKnowledge, DOCS };
