'use strict';

/**
 * bezhasTxClient — el Hub pide las entregas de BEZ a la capa de seguridad
 * transaccional de la API de BeZhas, en vez de firmarlas con su hot wallet.
 *
 * Con una credencial de AGENTE (bzag_…, BEZPAY_TX_AGENT_KEY) el Hub puede:
 *   · crear la intención de entrega desde la tesorería,
 *   · consultarla,
 *   · ejecutarla cuando las personas de tesorería la han aprobado (el agente
 *     necesita `canExecute`; la firma la hace el tx-signer aislado),
 *   · cancelarla si el cobro se disputa o se reembolsa antes.
 * Lo que NO puede: aprobarla. Eso exige firmas EIP-712 de aprobadores.
 */

const crypto = require('crypto');

const TIMEOUT_MS = 20000;

function error(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
}

function configuracion(env = process.env) {
    const url = env.BEZHAS_API_URL;
    const clave = env.BEZPAY_TX_AGENT_KEY;
    if (!url || !clave) throw error('TX_CLIENT_NOT_CONFIGURED', 'Falta BEZHAS_API_URL o BEZPAY_TX_AGENT_KEY: no se puede pedir la entrega.');
    return { url, clave };
}

async function llamar(metodo, ruta, cuerpo, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
    const { url, clave } = configuracion(env);
    const res = await fetchImpl(new URL(`/api/gateway/v1/tx${ruta}`, url).toString(), {
        method: metodo,
        headers: { 'content-type': 'application/json', 'x-api-key': clave },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw error(datos.code || `HTTP_${res.status}`, datos.error || `La API respondió ${res.status}.`);
    return datos.intencion;
}

/** Concepto con el juego de caracteres SEPA que exige la intención. */
const concepto = (s) => String(s).replace(/[^A-Za-z0-9 /\-?:().,'+]/g, '').slice(0, 140);

/**
 * Crea (o recupera, por idempotencia) la intención de entregar `bezAmount` BEZ
 * a `wallet` por la orden `paymentId`. `intento` cambia la clave cuando la
 * intención anterior caducó sin aprobarse.
 */
function crearEntrega({ paymentId, wallet, bezAmount, titular = {}, intento = 0 }, opciones) {
    const clave = `hub-${crypto.createHash('sha256').update(String(paymentId)).digest('hex').slice(0, 40)}-${intento}`;
    const cuerpo = {
        rail: 'crypto_transfer',
        asset: 'BEZ',
        amount: String(bezAmount),
        network: (opciones?.env || process.env).BEZPAY_DELIVERY_NETWORK || 'polygon',
        source: { type: 'bezhas_treasury' },
        destination: { type: 'evm_address', value: wallet, ...(titular.nombre ? { name: String(titular.nombre).slice(0, 140) } : {}) },
        purpose: 'token_purchase',
        reference: concepto(`BZ-HUB-${paymentId}`),
        idempotencyKey: clave,
        expiresInSeconds: 86400,
    };
    if (titular.nombre && /^[A-Z]{2}$/.test(String(titular.pais || ''))) {
        cuerpo.counterparty = { legalName: String(titular.nombre).slice(0, 140), country: titular.pais };
    }
    return llamar('POST', '/intents', cuerpo, opciones);
}

const obtener = (id, opciones) => llamar('GET', `/intents/${encodeURIComponent(id)}`, null, opciones);
const ejecutar = (id, opciones) => llamar('POST', `/intents/${encodeURIComponent(id)}/execute`, {}, opciones);
const cancelar = (id, motivo, opciones) => llamar('POST', `/intents/${encodeURIComponent(id)}/cancel`, { reason: motivo }, opciones);

module.exports = { crearEntrega, obtener, ejecutar, cancelar, configuracion };
