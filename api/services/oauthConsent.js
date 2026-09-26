'use strict';

/**
 * services/oauthConsent.js — pantalla de consentimiento del authorization
 * server OAuth 2.1 (routes/oauth.js).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUÉ HACE ESTA CAPA QUE NO PUEDE HACER EL CLIENTE OAUTH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GET /oauth/authorize crea la fila y redirige al navegador de una PERSONA.
 * Es aquí, y sólo aquí, donde:
 *
 *   · esa persona se identifica con su correo y contraseña de BeZhas,
 *   · elige a qué organización conecta el cliente OAuth,
 *   · ve qué scopes está a punto de conceder.
 *
 * El cliente OAuth (ChatGPT, Codex) espera fuera con un `session_token` en la
 * URL de redirección; no participa en nada de lo anterior.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ NO SE REUTILIZA onboarding_sessions
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El flujo `connect` de onboarding_sessions resuelve un problema hermano
 * (persona ya-cliente conecta una IA), y services/onboardingLogin.js ya tiene
 * el login con hash-señuelo y límite de intentos. Se reutilizan aquí las dos
 * funciones que son genéricas de verdad —`organizacionesDe` y
 * `verificarMembresia`, que no saben nada de onboarding_sessions—, pero NO la
 * función `identificar` ni la tabla: están cosidas a `onboarding_sessions.kind
 * = 'connect'` y a su columna `intentos_login` propia. Forzar el authorization
 * code OAuth a vivir dentro de esa tabla habría significado tocar el flujo de
 * onboarding (con su propio conjunto de tests) para un caso que en realidad no
 * comparte tabla, sólo criterio de seguridad. Se duplica la treintena de
 * líneas del login —hash de descarte, mensajes genéricos, límite de
 * intentos— en vez de la tabla entera.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { sha256Hex, tokenAleatorio, verificarPkce } = require('./oauthTokens');
const { verificarMembresia, organizacionesDe, LoginError } = require('./onboardingLogin');
const logger = require('../utils/logger');

const TTL_CONSENTIMIENTO_MIN = parseInt(process.env.OAUTH_CONSENT_TTL_MIN || '10', 10);
const TTL_CODIGO_SEGUNDOS = parseInt(process.env.OAUTH_CODE_TTL_SEGUNDOS || '60', 10);
const MAX_INTENTOS = parseInt(process.env.OAUTH_MAX_INTENTOS_LOGIN || '5', 10);

// Igual que onboardingLogin: un bcrypt de mentira para que "no existe" y
// "contraseña mala" tarden lo mismo. Sin esto el tiempo de respuesta contesta
// la pregunta que el mensaje se niega a contestar.
const HASH_SEÑUELO = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

// Permisos que una conexión OAuth de "quick connect" puede llegar a conceder.
// Los mismos, y por el mismo motivo, que credentialIssuance._emitirConexion:
// ampliarlos se hace en el panel, con las dos manos, no en una pantalla de
// autorización de treinta segundos.
const SCOPES_MAXIMOS = ['token', 'contracts', 'wallet'];

class OAuthConsentError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.name = 'OAuthConsentError';
        this.code = code;
        this.status = status;
    }
}

/**
 * GET /oauth/authorize — valida la petición del cliente y abre la sesión de
 * consentimiento. Devuelve el token de la URL (en claro, una vez); en BD sólo
 * queda su hash.
 */
async function crearSolicitud({
    client, redirectUri, codeChallenge, codeChallengeMethod, scope, state, resource, sourceIp,
}) {
    if (codeChallengeMethod !== 'S256' || typeof codeChallenge !== 'string' || codeChallenge.length < 43) {
        throw new OAuthConsentError(
            'code_challenge_method debe ser S256 con un code_challenge válido (PKCE es obligatorio).',
            'invalid_request'
        );
    }
    if (!client.redirect_uris.includes(redirectUri)) {
        // No se redirige a una redirect_uri no registrada aunque el resto de
        // la petición sea válido: sería el propio authorization server
        // haciendo de open redirector.
        throw new OAuthConsentError('redirect_uri no registrada para este cliente.', 'invalid_request');
    }

    const scopeSolicitado = [...new Set(String(scope || '').split(/\s+/).filter(Boolean))];
    if (scopeSolicitado.length === 0 || scopeSolicitado.some((s) => !SCOPES_MAXIMOS.includes(s))) {
        throw new OAuthConsentError(
            `El scope solicitado debe ser un subconjunto no vacío de: ${SCOPES_MAXIMOS.join(', ')}.`,
            'invalid_scope'
        );
    }

    const sessionToken = tokenAleatorio(32);
    await query(
        `INSERT INTO oauth_authorization_codes
             (session_token_hash, client_id, redirect_uri, code_challenge, code_challenge_method,
              scope_solicitado, resource, state, source_ip, expires_at)
         VALUES ($1, $2, $3, $4, 'S256', $5, $6, $7, $8, NOW() + ($9 || ' minutes')::interval)`,
        [sha256Hex(sessionToken), client.client_id, redirectUri, codeChallenge,
            scopeSolicitado, resource || null, state || null, sourceIp || null, String(TTL_CONSENTIMIENTO_MIN)]
    );
    return sessionToken;
}

async function _fila(sessionToken) {
    if (typeof sessionToken !== 'string' || !/^[0-9a-f]{64}$/.test(sessionToken)) {
        throw new OAuthConsentError('Enlace no válido.', 'invalid_session', 404);
    }
    const { rows } = await query(
        `SELECT * FROM oauth_authorization_codes WHERE session_token_hash = $1 LIMIT 1`,
        [sha256Hex(sessionToken)]
    );
    if (rows.length === 0) throw new OAuthConsentError('Enlace no válido.', 'invalid_session', 404);
    return rows[0];
}

/** Estado público para la pantalla — nunca expone code_challenge ni hashes. */
async function obtenerSolicitud(sessionToken) {
    const f = await _fila(sessionToken);
    const vigente = ['pendiente'].includes(f.status) && new Date(f.expires_at).getTime() > Date.now();
    // El nombre lo declara el propio cliente en el DCR: es informativo, por eso
    // se enseña junto al client_id y la pantalla lo pinta con textContent.
    const { rows: cli } = await query('SELECT client_name FROM oauth_clients WHERE client_id = $1', [f.client_id]);
    return {
        estado: vigente ? f.status : (f.status === 'pendiente' ? 'caducado' : f.status),
        clientId: f.client_id,
        clientName: cli[0]?.client_name || null,
        scopeSolicitado: f.scope_solicitado,
        identificado: Boolean(f.user_id),
        expiraEn: f.expires_at,
    };
}

/**
 * Identifica a la persona en la pantalla. Mismas propiedades de seguridad que
 * onboardingLogin.identificar: intentos limitados por sesión (no sólo por IP),
 * mensaje idéntico exista o no el correo, comparación bcrypt SIEMPRE.
 */
async function identificar(sessionToken, { email, password }) {
    const f = await _fila(sessionToken);
    if (f.status !== 'pendiente' || new Date(f.expires_at).getTime() <= Date.now()) {
        throw new OAuthConsentError(
            'Esta autorización ya no está activa. Vuelve a intentar la conexión desde tu asistente.',
            'invalid_session', 409
        );
    }
    if (f.intentos_login >= MAX_INTENTOS) {
        throw new OAuthConsentError('Demasiados intentos. Pide al asistente que reinicie la conexión.', 'too_many_attempts', 429);
    }
    if (typeof email !== 'string' || typeof password !== 'string' || !email.includes('@')) {
        throw new OAuthConsentError('Correo o contraseña no válidos.', 'invalid_credentials', 400);
    }

    const { rows } = await query(
        `SELECT id, email, username, password_hash FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email.trim().toLowerCase()]
    );
    const hash = rows[0]?.password_hash || HASH_SEÑUELO;
    const correcta = await bcrypt.compare(password, hash);

    if (rows.length === 0 || !rows[0].password_hash || !correcta) {
        const { rows: tras } = await query(
            `UPDATE oauth_authorization_codes SET intentos_login = intentos_login + 1
              WHERE id = $1 RETURNING intentos_login`,
            [f.id]
        );
        const gastados = tras[0]?.intentos_login ?? MAX_INTENTOS;
        if (gastados >= MAX_INTENTOS) {
            await query(`UPDATE oauth_authorization_codes SET status = 'denegado' WHERE id = $1`, [f.id]);
        }
        logger.warn({ oauthCodeId: f.id, intentos: gastados }, 'Identificación fallida en consentimiento OAuth');
        throw new OAuthConsentError(
            gastados >= MAX_INTENTOS
                ? 'Demasiados intentos. Esta autorización ya no sirve: reinicia la conexión desde tu asistente.'
                : `Correo o contraseña incorrectos. Te quedan ${MAX_INTENTOS - gastados} intentos.`,
            'invalid_credentials', 401
        );
    }

    const usuario = rows[0];
    await query(
        `UPDATE oauth_authorization_codes SET user_id = $2, intentos_login = 0 WHERE id = $1`,
        [f.id, usuario.id]
    );
    logger.info({ oauthCodeId: f.id, userId: usuario.id }, 'Identificación correcta en consentimiento OAuth');
    return {
        usuario: { id: usuario.id, nombre: usuario.username || usuario.email },
        organizaciones: await organizacionesDe(usuario.id),
    };
}

/**
 * Aprueba la autorización: resuelve (o crea) el app_registry de la
 * organización elegida, fija el scope realmente concedido y emite el código.
 * El código se devuelve en claro una única vez; en BD sólo queda su hash.
 */
async function aprobar(sessionToken, { organizationId }) {
    const f = await _fila(sessionToken);
    if (f.status !== 'pendiente' || new Date(f.expires_at).getTime() <= Date.now()) {
        throw new OAuthConsentError('Esta autorización ya no está activa.', 'invalid_session', 409);
    }
    if (!f.user_id) {
        throw new OAuthConsentError('Hay que identificarse antes de autorizar.', 'login_required', 401);
    }
    if (!organizationId) {
        throw new OAuthConsentError('Falta elegir la organización.', 'invalid_request', 400);
    }

    let organizacion;
    try {
        organizacion = await verificarMembresia(f.user_id, organizationId);
    } catch (err) {
        if (err instanceof LoginError) throw new OAuthConsentError(err.message, err.code, 403);
        throw err;
    }

    // Un app_registry por (cliente OAuth, organización): dos autorizaciones
    // del mismo par reutilizan la misma fila en vez de acumular una por cada
    // vez que alguien pulsa "Autorizar" — igual de credenciales que tratar
    // cada api-key derivada como desechable, aquí no hace falta: no hay
    // secreto que enseñar una sola vez, sólo un id que el token referencia.
    const appName = `oauth-${f.client_id}-${String(organizacion.name).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)}`;
    const scopeConcedido = f.scope_solicitado.filter((s) => SCOPES_MAXIMOS.includes(s));

    const { rows: existente } = await query(
        `SELECT id FROM app_registry WHERE app_name = $1 LIMIT 1`, [appName]
    );
    let appId;
    if (existente.length > 0) {
        appId = existente[0].id;
        await query(
            `UPDATE app_registry SET scopes = $2, is_active = TRUE WHERE id = $1`,
            [appId, scopeConcedido]
        );
    } else {
        const { rows } = await query(
            `INSERT INTO app_registry
                 (app_name, api_key_hash, scopes, tier, enterprise_id, address_access_mode, is_active)
             VALUES ($1, $2, $3, 'free', $4, 'strict', TRUE)
             RETURNING id`,
            // api_key_hash NOT NULL/UNIQUE en app_registry: esta fila nunca se
            // autentica por api-key, así que se rellena con un valor que
            // ninguna clave puede producir (mismo truco que la 051).
            [appName, `OAUTH_ONLY_${crypto.randomUUID()}`, scopeConcedido, organizacion.legacy_enterprise_id || null]
        );
        appId = rows[0].id;
    }

    const code = tokenAleatorio(32);
    await query(
        `UPDATE oauth_authorization_codes
            SET status = 'aprobado', code_hash = $2, scope_concedido = $3, app_id = $4,
                expires_at = NOW() + ($5 || ' seconds')::interval
          WHERE id = $1`,
        [f.id, sha256Hex(code), scopeConcedido, appId, String(TTL_CODIGO_SEGUNDOS)]
    );

    logger.info({ oauthCodeId: f.id, appId, clientId: f.client_id, organizationId },
        'Autorización OAuth aprobada');
    return { code, redirectUri: f.redirect_uri, state: f.state };
}

async function denegar(sessionToken) {
    const f = await _fila(sessionToken);
    await query(`UPDATE oauth_authorization_codes SET status = 'denegado' WHERE id = $1`, [f.id]);
    return { redirectUri: f.redirect_uri, state: f.state };
}

/**
 * Canjea el código en /oauth/token. Operación atómica (UPDATE condicional):
 * dos canjes simultáneos del mismo código sólo dejan ganar a uno, igual que
 * credentialIssuance._consumirSesion.
 */
async function canjearCodigo({ code, clientId, redirectUri, codeVerifier }) {
    const { rows } = await query(
        `UPDATE oauth_authorization_codes
            SET status = 'canjeado', consumed_at = NOW()
          WHERE code_hash = $1 AND client_id = $2 AND status = 'aprobado' AND expires_at > NOW()
      RETURNING app_id, scope_concedido, redirect_uri, code_challenge`,
        [sha256Hex(code), clientId]
    );
    if (rows.length === 0) {
        throw new OAuthConsentError('El código no es válido, ya se usó o caducó.', 'invalid_grant', 400);
    }
    const f = rows[0];
    // redirect_uri exacto: RFC 6749 §4.1.3 — si no coincide con el de
    // /authorize, quien canjea no es a quien se le emitió el código.
    if (f.redirect_uri !== redirectUri) {
        throw new OAuthConsentError('redirect_uri no coincide con la de la autorización original.', 'invalid_grant', 400);
    }
    if (!verificarPkce(codeVerifier, f.code_challenge)) {
        throw new OAuthConsentError('code_verifier no corresponde al code_challenge de la autorización.', 'invalid_grant', 400);
    }
    return { appId: f.app_id, scope: f.scope_concedido };
}

module.exports = {
    crearSolicitud, obtenerSolicitud, identificar, aprobar, denegar, canjearCodigo,
    OAuthConsentError, SCOPES_MAXIMOS, MAX_INTENTOS,
};
