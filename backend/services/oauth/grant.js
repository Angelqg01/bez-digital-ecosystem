'use strict';

/**
 * services/oauth/grant.js — emisión y rotación de tokens (POST /oauth/token).
 *
 * Cada canje de refresh consume el actual y emite otro de la misma familia. Si
 * un refresh ya rotado reaparece es que alguien tiene una copia: se revoca la
 * FAMILIA entera. El legítimo tendrá que volver a autorizar, que es mejor que
 * dejar viva una sesión que ya se sabe duplicada.
 *
 * El access token es un JWT de 10 minutos que el servicio MCP verifica sin
 * base de datos: por eso revocar corta los refresh (sin sesión nueva al
 * caducar el access) en vez de mantener una lista negra que el MCP no leería.
 */

const crypto = require('crypto');
const pool = require('../../db/pool');
const { emitirAccessToken, sha256Hex, tokenAleatorio } = require('./tokens');

const REFRESH_TTL_DIAS = parseInt(process.env.OAUTH_REFRESH_TOKEN_TTL_DIAS || '30', 10);

class OAuthGrantError extends Error {
    constructor(message, code = 'invalid_grant', status = 400) {
        super(message);
        this.name = 'OAuthGrantError';
        this.code = code;
        this.status = status;
    }
}

async function _emitirPar({ userId, clientId, scope, familyId }) {
    const { token, expiresIn } = emitirAccessToken({ userId, clientId, scope });
    const refresh = tokenAleatorio(32);
    await pool.query(
        `INSERT INTO oauth_refresh_tokens (token_hash, family_id, client_id, user_id, scope, expires_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW() + ($6 || ' days')::interval)`,
        [sha256Hex(refresh), familyId, clientId, userId, JSON.stringify(scope), String(REFRESH_TTL_DIAS)]
    );
    return {
        access_token: token, token_type: 'Bearer', expires_in: expiresIn,
        refresh_token: refresh, scope: scope.join(' '),
    };
}

function emitirParInicial({ userId, clientId, scope }) {
    return _emitirPar({ userId, clientId, scope, familyId: crypto.randomUUID() });
}

async function rotarRefresh({ refreshToken, clientId }) {
    if (typeof refreshToken !== 'string' || refreshToken.length < 16) {
        throw new OAuthGrantError('refresh_token no válido.');
    }
    const hash = sha256Hex(refreshToken);
    const { rows } = await pool.query(
        `UPDATE oauth_refresh_tokens SET used_at = NOW()
          WHERE token_hash = $1 AND client_id = $2 AND used_at IS NULL
                AND revoked_at IS NULL AND expires_at > NOW()
      RETURNING family_id, user_id, scope`,
        [hash, clientId]
    );
    if (rows.length === 0) {
        const { rows: previo } = await pool.query(
            `SELECT family_id, used_at, revoked_at FROM oauth_refresh_tokens
              WHERE token_hash = $1 AND client_id = $2 LIMIT 1`,
            [hash, clientId]
        );
        if (previo[0]?.used_at && !previo[0].revoked_at) {
            await pool.query(
                `UPDATE oauth_refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
                [previo[0].family_id]
            );
            console.error(`[oauth] REPLAY de refresh token: familia ${previo[0].family_id} revocada`);
        }
        throw new OAuthGrantError('refresh_token no válido, ya usado o caducado.');
    }
    const f = rows[0];
    return _emitirPar({ userId: f.user_id, clientId, scope: f.scope || [], familyId: f.family_id });
}

/** RFC 7009: revocar algo que no existe no es un error. */
async function revocarRefresh({ refreshToken, clientId }) {
    if (typeof refreshToken !== 'string') return;
    await pool.query(
        `UPDATE oauth_refresh_tokens SET revoked_at = NOW()
          WHERE token_hash = $1 AND client_id = $2 AND revoked_at IS NULL`,
        [sha256Hex(refreshToken), clientId]
    );
}

/**
 * Purga de lo que ya no sirve. Los refresh ROTADOS se conservan hasta su
 * caducidad: son los que delatan una copia robada si reaparecen.
 */
async function purgar() {
    const codigos = await pool.query(`DELETE FROM oauth_authorization_codes WHERE expires_at < NOW() - INTERVAL '1 day'`);
    const refresh = await pool.query(
        `DELETE FROM oauth_refresh_tokens
          WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`
    );
    return { codigos: codigos.rowCount || 0, refresh: refresh.rowCount || 0 };
}

module.exports = { emitirParInicial, rotarRefresh, revocarRefresh, purgar, OAuthGrantError };
