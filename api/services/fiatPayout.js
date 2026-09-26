'use strict';

/**
 * fiatPayout — adaptadores de los proveedores que mueven FIAT.
 *
 * Cada adaptador implementa, como mucho:
 *     verificarBeneficiario({ iban, nombre }) → { resultado: 'match'|'close_match'|'no_match'|'unavailable' }
 *     cotizar(intent)                          → { comision, esquema }
 *     ejecutar(intent, { intentId })           → { estado, referencia?, instruccion? }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ LA CUENTA PROPIA NO TIENE «ENVIAR»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La cuenta de BeZhas en ING no tiene API de pagos, y aunque la tuviera, sólo
 * puede pagar lo de BeZhas. Su `ejecutar` NO mueve dinero: genera la instrucción
 * SEPA exacta para que una persona la ejecute en la banca y la marque después
 * con la referencia del banco. La política ya ha impedido que llegue aquí un
 * pago con fondos de un cliente (UNLICENSED_THIRD_PARTY_FUNDS).
 *
 * El socio con licencia (EMI / entidad de pago) sí ejecuta, con idempotencia
 * por id de intención: reintentar la llamada nunca duplica el pago.
 */

const { BANK_TRANSFER_DETAILS } = require('../config/bank-transfer-details');

const ENCABEZADO_TIMEOUT_MS = 8000;

function errorProveedor(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
}

const sepaIngPropia = {
    id: 'sepa_ing_propia',
    async verificarBeneficiario() {
        // Sin API no hay verificación automática del titular: queda en manos de
        // quien ejecuta, y el riesgo lo cuenta como `unavailable`.
        return { resultado: 'unavailable' };
    },
    async cotizar() {
        return { comision: { importe: '0', divisa: 'EUR' }, esquema: 'SEPA Credit Transfer' };
    },
    async ejecutar(intent, { intentId }) {
        if (intent.source.type !== 'bezhas_treasury') {
            throw errorProveedor('UNLICENSED_THIRD_PARTY_FUNDS', 'La cuenta propia sólo paga obligaciones de BeZhas.');
        }
        return {
            estado: 'awaiting_manual_execution',
            instruccion: {
                esquema: 'SEPA Credit Transfer',
                ordenante: { nombre: BANK_TRANSFER_DETAILS.beneficiaryAlias, iban: BANK_TRANSFER_DETAILS.iban.replace(/\s/g, ''), bic: BANK_TRANSFER_DETAILS.bic },
                beneficiario: { nombre: intent.destination.name, iban: intent.destination.value },
                importe: intent.amount,
                divisa: intent.asset,
                concepto: intent.reference || `BZ-${String(intentId).slice(0, 8).toUpperCase()}`,
                aviso: 'Ejecutar en la banca de ING y registrar la referencia del banco. Comprobar el titular antes de enviar.',
            },
        };
    },
};

function socioEmi(env = process.env, fetchImpl = globalThis.fetch) {
    const base = env.FIAT_PARTNER_API_URL;
    const clave = env.FIAT_PARTNER_API_KEY;
    const llamar = async (ruta, cuerpo, idempotencia) => {
        if (!base || !clave) throw errorProveedor('PROVIDER_DISABLED', 'Socio FIAT sin configurar.');
        const res = await fetchImpl(new URL(ruta, base).toString(), {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${clave}`,
                ...(idempotencia ? { 'idempotency-key': idempotencia } : {}),
            },
            body: JSON.stringify(cuerpo),
            signal: AbortSignal.timeout(ENCABEZADO_TIMEOUT_MS),
        });
        if (!res.ok) throw errorProveedor('PROVIDER_ERROR', `El socio FIAT respondió ${res.status}.`);
        return res.json();
    };
    return {
        id: 'emi_partner',
        async verificarBeneficiario({ iban, nombre }) {
            const r = await llamar('/v1/payee-verifications', { iban, name: nombre });
            const valido = ['match', 'close_match', 'no_match', 'unavailable'];
            return { resultado: valido.includes(r.result) ? r.result : 'unavailable' };
        },
        async cotizar(intent) {
            const r = await llamar('/v1/quotes', {
                amount_minor: intent.amountMinor, currency: intent.asset,
                target_currency: intent.targetAsset || intent.asset, scheme: 'sepa',
            });
            return { comision: r.fee || null, esquema: r.scheme || 'sepa' };
        },
        async ejecutar(intent, { intentId }) {
            const r = await llamar('/v1/payouts', {
                amount_minor: intent.amountMinor,
                currency: intent.asset,
                beneficiary: { name: intent.destination.name, iban: intent.destination.value },
                reference: intent.reference || `BZ-${String(intentId).slice(0, 8).toUpperCase()}`,
                purpose: intent.purpose,
            }, `bezhas-intent-${intentId}`);
            return { estado: 'dispatched', referencia: r.id || null };
        },
    };
}

/** Adaptador por id de proveedor, o null si no existe o no aplica. */
function adaptadorPara(id, env = process.env) {
    if (id === 'sepa_ing_propia') return sepaIngPropia;
    if (id === 'emi_partner') return socioEmi(env);
    return null;
}

module.exports = { adaptadorPara, sepaIngPropia, socioEmi };
