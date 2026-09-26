'use strict';

/**
 * services/oauth/consent.js — pantalla de consentimiento del MCP.
 *
 * GET /oauth/authorize abre una sesión y manda el navegador de una PERSONA a
 * la pantalla. Ahí, y sólo ahí, esa persona se identifica con su cuenta de
 * BeZhas (y su 2FA si lo tiene), ve qué va a poder hacer el conector y lo
 * autoriza. El cliente OAuth espera fuera: nunca ve la contraseña.
 *
 * Mismas defensas que el login normal, más las propias de un formulario al
 * que se llega desde un enlace: intentos limitados por sesión (no sólo por IP),
 * mismo mensaje exista o no el correo, y comparación bcrypt SIEMPRE, con un
 * hash señuelo si el usuario no existe, para que el tiempo de respuesta no
 * delate qué correos son clientes.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../../db/pool');
const totpService = require('../totp.service');
const { sha256Hex, tokenAleatorio, verificarPkce } = require('./tokens');

const TTL_CONSENTIMIENTO_MIN = parseInt(process.env.OAUTH_CONSENT_TTL_MIN || '10', 10);
const TTL_CODIGO_SEGUNDOS = parseInt(process.env.OAUTH_CODE_TTL_SEGUNDOS || '60', 10);
const MAX_INTENTOS = parseInt(process.env.OAUTH_MAX_INTENTOS_LOGIN || '5', 10);
const HASH_SENUELO = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

/**
 * Lo máximo que un conector puede pedir. Son permisos de CONSULTA: el MCP
 * público no expone nada que mueva fondos, envíe mensajes ni toque sistemas.
 */
const SCOPES = Object.freeze({
    'chain.read': 'Consultar la red: gas, contratos y saldos públicos en el explorador',
    'payments.quote': 'Cotizar pagos en BEZ-Coin (sin ejecutarlos)',
});
const SCOPES_MAXIMOS = Object.keys(SCOPES);

class OAuthConsentError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.name = 'OAuthConsentError';
        this.code = code;
        this.status = status;
    }
}

async function crearSolicitud({ client, redirectUri, codeChallenge, codeChallengeMethod, scope, state, sourceIp }) {
    if (codeChallengeMethod !== 'S256' || typeof codeChallenge !== 'string' || codeChallenge.length < 43) {
        throw new OAuthConsentError('PKCE es obligatorio: code_challenge_method=S256 con un code_challenge válido.', 'invalid_request');
    }
    if (!Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) {
        // Nunca se redirige a una URI no registrada: sería un open redirect.
        throw new OAuthConsentError('redirect_uri no registrada para este cliente.', 'invalid_request');
    }
    const pedido = [...new Set(String(scope || SCOPES_MAXIMOS.join(' ')).split(/\s+/).filter(Boolean))];
    if (pedido.length === 0 || pedido.some((s) => !SCOPES_MAXIMOS.includes(s))) {
        throw new OAuthConsentError(`El scope debe ser un subconjunto de: ${SCOPES_MAXIMOS.join(', ')}.`, 'invalid_scope');
    }
    const sesion = tokenAleatorio(32);
    await pool.query(
        `INSERT INTO oauth_authorization_codes
             (session_token_hash, client_id, redirect_uri, code_challenge, code_challenge_method,
              scope_solicitado, state, source_ip, expires_at)
         VALUES ($1, $2, $3, $4, 'S256', $5::jsonb, $6, $7, NOW() + ($8 || ' minutes')::interval)`,
        [sha256Hex(sesion), client.client_id, redirectUri, codeChallenge, JSON.stringify(pedido),
            state || null, sourceIp || null, String(TTL_CONSENTIMIENTO_MIN)]
    );
    return sesion;
}

async function _fila(sesion) {
    if (typeof sesion !== 'string' || !/^[0-9a-f]{64}$/.test(sesion)) {
        throw new OAuthConsentError('Enlace no válido.', 'invalid_session', 404);
    }
    const { rows } = await pool.query(
        `SELECT c.*, cl.client_name FROM oauth_authorization_codes c
           JOIN oauth_clients cl ON cl.client_id = c.client_id
          WHERE c.session_token_hash = $1 LIMIT 1`,
        [sha256Hex(sesion)]
    );
    if (rows.length === 0) throw new OAuthConsentError('Enlace no válido.', 'invalid_session', 404);
    return rows[0];
}

const _vigente = (f) => f.status === 'pendiente' && new Date(f.expires_at).getTime() > Date.now();

async function obtenerSolicitud(sesion) {
    const f = await _fila(sesion);
    return {
        estado: _vigente(f) ? 'pendiente' : (f.status === 'pendiente' ? 'caducado' : f.status),
        clientId: f.client_id,
        clientName: f.client_name,
        scopes: (f.scope_solicitado || []).map((s) => ({ scope: s, descripcion: SCOPES[s] || s })),
    };
}

async function _contarFallo(f) {
    const { rows } = await pool.query(
        `UPDATE oauth_authorization_codes SET intentos_login = intentos_login + 1
          WHERE id = $1 RETURNING intentos_login`, [f.id]
    );
    const gastados = rows[0]?.intentos_login ?? MAX_INTENTOS;
    if (gastados >= MAX_INTENTOS) {
        await pool.query(`UPDATE oauth_authorization_codes SET status = 'denegado' WHERE id = $1`, [f.id]);
    }
    return gastados;
}

/**
 * Identifica a la persona y deja el usuario en la sesión. Si la cuenta tiene
 * 2FA, exige el código en la misma llamada: un conector no puede saltarse el
 * segundo factor que la cuenta tiene activado.
 */
async function identificar(sesion, { email, password, codigo2fa }) {
    const f = await _fila(sesion);
    if (!_vigente(f)) throw new OAuthConsentError('Esta autorización ya no está activa. Reinicia la conexión desde tu asistente.', 'invalid_session', 409);
    if (f.intentos_login >= MAX_INTENTOS) throw new OAuthConsentError('Demasiados intentos. Reinicia la conexión desde tu asistente.', 'too_many_attempts', 429);
    if (typeof email !== 'string' || typeof password !== 'string' || !email.includes('@')) {
        throw new OAuthConsentError('Correo o contraseña no válidos.', 'invalid_credentials');
    }

    const { rows } = await pool.query(
        `SELECT id, email, username, password, is_2fa_enabled, two_factor_secret
           FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email.trim().toLowerCase()]
    );
    const usuario = rows[0];
    const correcta = await bcrypt.compare(password, usuario?.password || HASH_SENUELO);
    if (!usuario || !usuario.password || !correcta) {
        const gastados = await _contarFallo(f);
        throw new OAuthConsentError(
            gastados >= MAX_INTENTOS
                ? 'Demasiados intentos. Esta autorización ya no sirve: reinicia la conexión desde tu asistente.'
                : `Correo o contraseña incorrectos. Te quedan ${MAX_INTENTOS - gastados} intentos.`,
            'invalid_credentials', 401
        );
    }

    if (usuario.is_2fa_enabled && totpService.is2FAEnabled()) {
        if (!codigo2fa) {
            // No cuenta como intento fallido: la contraseña era buena.
            throw new OAuthConsentError('Tu cuenta tiene verificación en dos pasos: introduce el código.', 'mfa_required', 401);
        }
        let ok = false;
        try {
            ok = totpService.verify2FAToken(String(codigo2fa), totpService.decryptSecret(usuario.two_factor_secret));
        } catch { ok = false; }
        if (!ok) {
            const gastados = await _contarFallo(f);
            throw new OAuthConsentError(`Código de verificación incorrecto. Te quedan ${Math.max(0, MAX_INTENTOS - gastados)} intentos.`, 'invalid_credentials', 401);
        }
    }

    await pool.query(`UPDATE oauth_authorization_codes SET user_id = $2, intentos_login = 0 WHERE id = $1`, [f.id, usuario.id]);
    return { usuario: { id: usuario.id, nombre: usuario.username || usuario.email } };
}

/** Aprueba: fija el scope concedido y emite el código (en claro una sola vez). */
async function aprobar(sesion) {
    const f = await _fila(sesion);
    if (!_vigente(f)) throw new OAuthConsentError('Esta autorización ya no está activa.', 'invalid_session', 409);
    if (!f.user_id) throw new OAuthConsentError('Hay que identificarse antes de autorizar.', 'login_required', 401);
    const concedido = (f.scope_solicitado || []).filter((s) => SCOPES_MAXIMOS.includes(s));
    const codigo = tokenAleatorio(32);
    await pool.query(
        `UPDATE oauth_authorization_codes
            SET status = 'aprobado', code_hash = $2, scope_concedido = $3::jsonb,
                expires_at = NOW() + ($4 || ' seconds')::interval
          WHERE id = $1`,
        [f.id, sha256Hex(codigo), JSON.stringify(concedido), String(TTL_CODIGO_SEGUNDOS)]
    );
    return { code: codigo, redirectUri: f.redirect_uri, state: f.state };
}

async function denegar(sesion) {
    const f = await _fila(sesion);
    await pool.query(`UPDATE oauth_authorization_codes SET status = 'denegado' WHERE id = $1`, [f.id]);
    return { redirectUri: f.redirect_uri, state: f.state };
}

/**
 * Canje atómico del código: el UPDATE condicional sólo deja ganar a uno, y el
 * código queda quemado aunque el PKCE falle después (no se puede adivinar el
 * verifier a base de reintentos sobre el mismo código).
 */
async function canjearCodigo({ code, clientId, redirectUri, codeVerifier }) {
    const { rows } = await pool.query(
        `UPDATE oauth_authorization_codes SET status = 'canjeado', consumed_at = NOW()
          WHERE code_hash = $1 AND client_id = $2 AND status = 'aprobado' AND expires_at > NOW()
      RETURNING user_id, scope_concedido, redirect_uri, code_challenge`,
        [sha256Hex(String(code || '')), clientId]
    );
    if (rows.length === 0) throw new OAuthConsentError('El código no es válido, ya se usó o caducó.', 'invalid_grant');
    const f = rows[0];
    if (f.redirect_uri !== redirectUri) throw new OAuthConsentError('redirect_uri no coincide con la de la autorización.', 'invalid_grant');
    if (!verificarPkce(codeVerifier, f.code_challenge)) throw new OAuthConsentError('code_verifier no corresponde al code_challenge.', 'invalid_grant');
    return { userId: f.user_id, scope: f.scope_concedido || [] };
}

module.exports = {
    crearSolicitud, obtenerSolicitud, identificar, aprobar, denegar, canjearCodigo,
    OAuthConsentError, SCOPES, SCOPES_MAXIMOS, MAX_INTENTOS,
};
