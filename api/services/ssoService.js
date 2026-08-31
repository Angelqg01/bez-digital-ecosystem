/**
 * ssoService.js — Single Sign-On service for the BeZhas ecosystem.
 * 
 * Issues cross-app JWT tokens that work across:
 *  - BeZhas Core (control-center)
 *  - BeZhas App (consumer social/marketplace)
 *  - BeZhas DeFi (staking/bridge/governance)
 * 
 * Tokens include app_origin claim so each app knows where the user came from.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db/pool');

// Igual que en el resto de la API: el secreto viene de config/secrets.js, que
// se niega a arrancar en producción con secretos de desarrollo. Leerlo aquí a
// mano dejaba pasar 'dev-only-secret' con un NODE_ENV mal configurado.
const { JWT_SECRET } = require('../config/secrets');
const SSO_TOKEN_EXPIRY = process.env.SSO_TOKEN_EXPIRY || '24h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

class SSOService {
    /**
     * Issue a cross-app SSO token for a user.
     * @param {Object} params
     * @param {string} params.walletAddress - User wallet address
     * @param {string} params.appOrigin - Which app is requesting ('core', 'defi', 'app', 'web3')
     * @param {string} [params.userId] - Optional user UUID
     * @param {string} [params.role] - Optional role override
     * @returns {{ accessToken: string, refreshToken: string, expiresIn: string }}
     */
    async issueToken({ walletAddress, appOrigin, userId, role }) {
        // Lookup or create user
        const { rows } = await query(
            `INSERT INTO users (wallet_address, last_login)
             VALUES ($1, NOW())
             ON CONFLICT (wallet_address) DO UPDATE SET last_login = NOW()
             RETURNING id, wallet_address, username, role, email`,
            [walletAddress.toLowerCase()]
        );

        const user = rows[0];
        const tokenPayload = {
            address: user.wallet_address,
            userId: user.id,
            role: role || user.role,
            app_origin: appOrigin,
            iss: 'bezhas-core',
        };

        const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: SSO_TOKEN_EXPIRY });
        const refreshToken = jwt.sign(
            { ...tokenPayload, type: 'refresh' },
            JWT_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        // Store session in sso_sessions table
        const sessionId = crypto.randomUUID();
        await query(
            `INSERT INTO sso_sessions (id, user_id, app_origin, refresh_token_hash, expires_at)
             VALUES ($1, $2, $3, encode(digest($4, 'sha256'), 'hex'), NOW() + INTERVAL '7 days')`,
            [sessionId, user.id, appOrigin, refreshToken]
        );

        return {
            accessToken,
            refreshToken,
            expiresIn: SSO_TOKEN_EXPIRY,
            user: {
                id: user.id,
                address: user.wallet_address,
                username: user.username,
                role: user.role,
                email: user.email,
            },
        };
    }

    /**
     * Refresh an SSO token.
     * @param {string} refreshToken
     * @param {string} appOrigin - New app origin (for cross-app navigation)
     * @returns {{ accessToken: string, refreshToken: string }}
     */
    async refreshToken(refreshToken, appOrigin) {
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_SECRET, { algorithms: ['HS256'] });
        } catch {
            throw new Error('Invalid or expired refresh token');
        }

        if (decoded.type !== 'refresh') {
            throw new Error('Not a refresh token');
        }

        // Verify session exists
        const { rows } = await query(
            `SELECT id FROM sso_sessions 
             WHERE user_id = $1 
               AND refresh_token_hash = encode(digest($2, 'sha256'), 'hex')
               AND expires_at > NOW()
               AND is_revoked = FALSE`,
            [decoded.userId, refreshToken]
        );

        if (rows.length === 0) {
            throw new Error('Session not found or revoked');
        }

        // Issue new tokens (rotate refresh token)
        return this.issueToken({
            walletAddress: decoded.address,
            appOrigin: appOrigin || decoded.app_origin,
            userId: decoded.userId,
            role: decoded.role,
        });
    }

    /**
     * Revoke all sessions for a user (logout everywhere).
     * @param {string} userId
     */
    async revokeAllSessions(userId) {
        await query(
            `UPDATE sso_sessions SET is_revoked = TRUE WHERE user_id = $1`,
            [userId]
        );
    }

    /**
     * Validate an SSO token without middleware context.
     * @param {string} token
     * @returns {Object} decoded payload
     */
    validateToken(token) {
        return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    }

    /**
     * Register a new app in the app_registry and return its API key.
     * @param {Object} params
     * @param {string} params.appName - App name ('bezhas-defi', 'bezhas-app', etc.)
     * @param {string[]} params.scopes - Allowed scopes
     * @param {string} [params.tier] - Rate limit tier ('free', 'standard', 'premium')
     * @returns {{ appId: string, apiKey: string }}
     */
    async registerApp({ appName, scopes, tier = 'standard' }) {
        const apiKey = `bzk_${crypto.randomBytes(32).toString('hex')}`;

        const { rows } = await query(
            `INSERT INTO app_registry (app_name, api_key_hash, scopes, tier)
             VALUES ($1, encode(digest($2, 'sha256'), 'hex'), $3, $4)
             RETURNING id, app_name`,
            [appName, apiKey, scopes, tier]
        );

        return {
            appId: rows[0].id,
            appName: rows[0].app_name,
            apiKey, // Only returned once at registration
        };
    }
}

module.exports = new SSOService();
