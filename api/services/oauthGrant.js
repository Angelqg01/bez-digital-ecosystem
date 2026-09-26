'use strict';

/**
 * services/oauthGrant.js — emisión y rotación de tokens para POST /oauth/token
 * y POST /oauth/revoke.
 *
 * Separado de oauthConsent.js (que resuelve QUIÉN autoriza QUÉ) y de
 * oauthTokens.js (que sólo firma/verifica JWT y PKCE, sin tocar la base de
 * datos): aquí vive el ciclo de vida del refresh token, que es puramente de
 * almacenamiento.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ROTACIÓN Y DETECCIÓN DE REPLAY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada canje de un refresh token consume el actual y emite uno nuevo con el
 * MISMO family_id. Si el token consumido (`used_at` no nulo) vuelve a
 * presentarse, sólo puede ser porque alguien tiene una copia — el legítimo ya
 * recibió el siguiente de la cadena. En ese caso se revoca la FAMILIA entera:
 * el legítimo tendrá que volver a autorizar, pero eso es preferible a dejar
 * viva una sesión que ya se sabe duplicada.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const { emitirAccessToken, sha256Hex, tokenAleatorio } = require('./oauthTokens');
const logger = require('../utils/logger');

const REFRESH_TOKEN_TTL_DIAS = parseInt(process.env.OAUTH_REFRESH_TOKEN_TTL_DIAS || '30', 10);

class OAuthGrantError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.name = 'OAuthGrantError';
        this.code = code;
        this.status = status;
    }
}

/** Primer par de tokens de una autorización nueva (tras canjear el code). */
async function emitirParInicial({ appId, clientId, scope }) {
    const familyId = crypto.randomUUID();
    return _emitirPar({ appId, clientId, scope, familyId });
}

async function _emitirPar({ appId, clientId, scope, familyId }) {
    const { token: accessToken, expiresIn } = emitirAccessToken({ appId, clientId, scope });
    const refreshToken = tokenAleatorio(32);
    await query(
        `INSERT INTO oauth_refresh_tokens (token_hash, family_id, client_id, app_id, scope, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' days')::interval)`,
        [sha256Hex(refreshToken), familyId, clientId, appId, scope, String(REFRESH_TOKEN_TTL_DIAS)]
    );
    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        refresh_token: refreshToken,
        scope: scope.join(' '),
    };
}

/**
 * grant_type=refresh_token. Operación atómica: el UPDATE condicional sólo deja
 * ganar a un canje por token, igual que el resto del sistema con sus vales de
 * un solo uso.
 */
async function rotarRefresh({ refreshToken, clientId }) {
    if (typeof refreshToken !== 'string' || refreshToken.length < 16) {
        throw new OAuthGrantError('refresh_token no válido.', 'invalid_grant');
    }
    const hash = sha256Hex(refreshToken);

    const { rows } = await query(
        `UPDATE oauth_refresh_tokens
            SET used_at = NOW()
          WHERE token_hash = $1 AND client_id = $2 AND used_at IS NULL
                AND revoked_at IS NULL AND expires_at > NOW()
      RETURNING id, family_id, app_id, scope`,
        [hash, clientId]
    );

    if (rows.length === 0) {
        // ¿Es un replay (el token existe pero ya se usó) o simplemente no
        // existe/caducó? Sólo en el primer caso hay familia que revocar.
        const { rows: previo } = await query(
            `SELECT family_id, used_at, revoked_at FROM oauth_refresh_tokens
              WHERE token_hash = $1 AND client_id = $2 LIMIT 1`,
            [hash, clientId]
        );
        if (previo.length > 0 && previo[0].used_at && !previo[0].revoked_at) {
            await query(
                `UPDATE oauth_refresh_tokens SET revoked_at = NOW()
                  WHERE family_id = $1 AND revoked_at IS NULL`,
                [previo[0].family_id]
            );
            logger.error({ familyId: previo[0].family_id, clientId },
                'REFRESH TOKEN REPLAY detectado: familia completa revocada');
        }
        throw new OAuthGrantError('refresh_token no válido, ya usado o caducado.', 'invalid_grant');
    }

    const fila = rows[0];
    return _emitirPar({ appId: fila.app_id, clientId, scope: fila.scope, familyId: fila.family_id });
}

/** POST /oauth/revoke — RFC 7009. Nunca lanza: revocar algo ya revocado no es un error. */
async function revocarRefresh({ refreshToken, clientId }) {
    if (typeof refreshToken !== 'string') return;
    await query(
        `UPDATE oauth_refresh_tokens SET revoked_at = NOW()
          WHERE token_hash = $1 AND client_id = $2 AND revoked_at IS NULL`,
        [sha256Hex(refreshToken), clientId]
    );
}

/** Añade un jti a la denylist — revoca un access token pese a ser autocontenido. */
async function revocarAccessToken({ jti, expiraEn }) {
    if (!jti) return;
    await query(
        `INSERT INTO oauth_token_denylist (jti, expires_at) VALUES ($1, $2)
         ON CONFLICT (jti) DO NOTHING`,
        [jti, expiraEn]
    );
}

/**
 * Purga lo que ya no puede servir para nada. La llama el barrido periódico
 * (services/onboardingSweeper.js).
 *
 *  · Códigos y sesiones de consentimiento: un día después de caducar. Guardan
 *    la IP de quien autorizó, que es dato personal y sólo se recogió para el
 *    límite de intentos.
 *  · Denylist: en cuanto el access token habría caducado de todas formas.
 *  · Refresh tokens: al caducar, y los revocados a la semana. Los ROTADOS
 *    (used_at) se conservan hasta su caducidad a propósito: son los que
 *    permiten detectar un replay y revocar la familia. Borrarlos antes haría
 *    que una copia robada fallara en silencio en vez de delatarse.
 */
async function purgarOAuth() {
    const codigos = await query(
        `DELETE FROM oauth_authorization_codes WHERE expires_at < NOW() - INTERVAL '1 day'`
    );
    const denylist = await query(`DELETE FROM oauth_token_denylist WHERE expires_at < NOW()`);
    const refresh = await query(
        `DELETE FROM oauth_refresh_tokens
          WHERE expires_at < NOW()
             OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`
    );
    return {
        oauthCodigos: codigos.rowCount || 0,
        oauthDenylist: denylist.rowCount || 0,
        oauthRefresh: refresh.rowCount || 0,
    };
}

module.exports = {
    emitirParInicial, rotarRefresh, revocarRefresh, revocarAccessToken, purgarOAuth, OAuthGrantError,
};
