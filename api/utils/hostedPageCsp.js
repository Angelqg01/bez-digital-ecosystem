'use strict';

/**
 * CSP con nonce para las pantallas alojadas server-rendered (checkout `/c`,
 * onboarding `/o`, consentimiento OAuth `/oauth/authorize/:token`).
 *
 * Las tres llevan su lógica en un único `<script>` inline, y el CSP global de
 * helmet (index.js) dice `script-src 'self'`: el navegador bloqueaba ese script
 * y la pantalla se quedaba en "Cargando…" para siempre. nginx añade su propio
 * CSP con 'unsafe-inline', pero con dos cabeceras CSP el navegador aplica
 * AMBAS, así que el de helmet seguía mandando.
 *
 * En vez de abrir 'unsafe-inline' para toda la API, se sustituye la cabecera
 * SÓLO en estas respuestas por la misma política global más un nonce de un
 * solo uso: únicamente el script que lleva ese nonce puede ejecutarse.
 * `frame-ancestors 'none'` además: ninguna de estas pantallas debe poder
 * enmarcarse (clickjacking sobre "Autorizar" o "Pagar").
 */

const crypto = require('crypto');

function cspConNonce(res) {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https: wss:",
        "font-src 'self'",
        "object-src 'none'",
        "media-src 'self'",
        "frame-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; '));
    return nonce;
}

module.exports = { cspConNonce };
