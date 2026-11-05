'use strict';

/**
 * Firma de llamadas salientes al proveedor y de recibos para el consumidor.
 *
 * Llamada al proveedor (HMAC con el secreto del listing):
 *     X-BeZhas-Signature: sha256=HEX(HMAC_SHA256(secret, `${ts}.${nonce}.${METHOD}.${path+query}.${body}`))
 * Mismo formato `sha256=` que los webhooks de CargoLink, pero firmando también
 * método y ruta: en un GET el cuerpo va vacío, y sin ellos una firma capturada
 * valdría para cualquier otra ruta del mismo proveedor dentro de la ventana.
 *
 * Recibo (ES256, JWS compacto): lo puede verificar cualquiera con la clave
 * pública de GET /receipts/keys, sin preguntar a BeZhas. Clave propia, NO la de
 * OAuth: una clave, un propósito.
 *
 * En producción sin MARKETPLACE_RECEIPT_PRIVATE_KEY/PUBLIC_KEY los recibos dan
 * 503 en vez de tumbar la API al arrancar: el marketplace aún no está abierto y
 * no puede impedir que arranque el resto.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const KID = 'mkt-receipt-1';
const ISSUER = 'bezhas-marketplace';

function sha256(texto) {
    return crypto.createHash('sha256').update(texto).digest('hex');
}

function firmaUpstream(secreto, { ts, nonce, metodo, ruta, cuerpo = '' }) {
    const hmac = crypto.createHmac('sha256', secreto)
        .update(`${ts}.${nonce}.${String(metodo).toUpperCase()}.${ruta}.${cuerpo}`)
        .digest('hex');
    return `sha256=${hmac}`;
}

/** Id estable por (listing, consumidor) que no revela el id de la app ni sirve entre listings. */
function consumidorOpaco(listingId, consumerAppId) {
    return `c_${sha256(`mkt:${listingId}:${consumerAppId}`).slice(0, 32)}`;
}

function leerPem(valor) {
    if (!valor) return null;
    const v = valor.includes('-----BEGIN') ? valor : Buffer.from(valor, 'base64').toString('utf8');
    return v.includes('-----BEGIN') ? v : null;
}

let claves; // { privada, publica } | null (no configuradas en producción)
function cargarClaves() {
    if (claves !== undefined) return claves;
    const privada = leerPem(process.env.MARKETPLACE_RECEIPT_PRIVATE_KEY);
    const publica = leerPem(process.env.MARKETPLACE_RECEIPT_PUBLIC_KEY);
    if (privada && publica) {
        claves = { privada, publica };
    } else if (process.env.NODE_ENV === 'production' && process.env.MARKETPLACE_RECEIPT_EPHEMERAL !== 'true') {
        claves = null;
    } else {
        // eslint-disable-next-line no-console
        console.warn('MARKETPLACE_RECEIPT_* no configuradas: recibos firmados con un par EFÍMERO (sólo desarrollo).');
        const par = crypto.generateKeyPairSync('ec', {
            namedCurve: 'prime256v1',
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            publicKeyEncoding: { type: 'spki', format: 'pem' },
        });
        claves = { privada: par.privateKey, publica: par.publicKey };
    }
    return claves;
}

function recibosDisponibles() {
    return cargarClaves() !== null;
}

function jwks() {
    const c = cargarClaves();
    if (!c) return { keys: [] };
    const jwk = crypto.createPublicKey(c.publica).export({ format: 'jwk' });
    return { keys: [{ ...jwk, use: 'sig', alg: 'ES256', kid: KID }] };
}

/** Contenido canónico del recibo a partir de la fila de marketplace_calls. */
function contenidoRecibo(fila) {
    return {
        call_id: fila.id,
        listing: fila.slug,
        consumer: consumidorOpaco(fila.listing_id, fila.consumer_app_id),
        at: new Date(fila.at).toISOString(),
        http_status: fila.http_status,
        req_hash: fila.req_hash,
        resp_hash: fila.resp_hash,
        amount_cents: fila.amount_cents,
        fee_cents: fila.fee_cents,
        currency: fila.currency || null,
    };
}

function firmarRecibo(contenido) {
    const c = cargarClaves();
    if (!c) return null;
    return jwt.sign(contenido, c.privada, { algorithm: 'ES256', keyid: KID, issuer: ISSUER, noTimestamp: true });
}

module.exports = {
    sha256, firmaUpstream, consumidorOpaco, contenidoRecibo, firmarRecibo, jwks, recibosDisponibles,
    KID, ISSUER, _reset: () => { claves = undefined; },
};
