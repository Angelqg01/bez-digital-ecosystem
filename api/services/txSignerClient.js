'use strict';

/**
 * txSignerClient — cómo la API pide una firma al tx-signer aislado.
 *
 * La petición va autenticada con HMAC (marca de tiempo + nonce + hash del
 * cuerpo), de modo que nada que no sea la API pueda hablar con el firmante y
 * una petición capturada no se pueda repetir.
 *
 * Esa clave NO es lo que protege los fondos. Si alguien compromete la API, la
 * tiene. Lo que protege los fondos es que el firmante vuelve a verificar TODO
 * por su cuenta —hash de la intención, policyHash, firmas EIP-712 contra su
 * propia lista de aprobadores, topes propios, calldata reconstruida— y que la
 * clave privada vive en el KMS, no aquí ni allí.
 */

const crypto = require('crypto');

const TIMEOUT_MS = 15000;

function error(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
}

function firmarPeticion(clave, cuerpo, ts, nonce) {
    const hashCuerpo = crypto.createHash('sha256').update(cuerpo, 'utf8').digest('hex');
    return crypto.createHmac('sha256', clave).update(`${ts}.${nonce}.${hashCuerpo}`).digest('hex');
}

async function solicitarFirma(peticion, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
    const url = env.TX_SIGNER_URL;
    const clave = env.TX_SIGNER_REQUEST_KEY;
    // Sin firmante no hay plan B: nunca se cae a firmar en este proceso.
    if (!url || !clave) throw error('SIGNER_UNAVAILABLE', 'El firmante aislado no está configurado.');

    const cuerpo = JSON.stringify(peticion);
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    let res;
    try {
        res = await fetchImpl(new URL('/v1/sign', url).toString(), {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-bezhas-timestamp': ts,
                'x-bezhas-nonce': nonce,
                'x-bezhas-signature': firmarPeticion(clave, cuerpo, ts, nonce),
            },
            body: cuerpo,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch (err) {
        throw error('SIGNER_UNAVAILABLE', `El firmante no responde: ${err.message}`);
    }
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw error(datos.code || 'SIGNER_REJECTED', datos.error || `El firmante respondió ${res.status}.`);
    if (!datos.signedTx || !datos.txHash) throw error('SIGNER_BAD_RESPONSE', 'Respuesta del firmante incompleta.');
    return datos;
}

module.exports = { solicitarFirma, firmarPeticion };
