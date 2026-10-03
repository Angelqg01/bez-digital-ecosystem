/**
 * gateway-auth.js — Authentication middleware for the BeZhas Gateway.
 * 
 * Supports two auth modes:
 *  1. API Key auth (server-to-server between registered apps)
 *  2. Cross-app JWT (user sessions shared across BeZhas apps via SSO)
 * 
 * Each registered app has an API key and a list of allowed scopes.
 */
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const logger = require('pino')({ level: 'info', name: 'gateway-auth' });

// Single source of truth for secrets (never read process.env independently here).
const { JWT_SECRET, AUTH_BYPASS } = require('../config/secrets');
const oauthTokens = require('../services/oauthTokens');

/**
 * Especificación de autorización de MCP (RFC 9728 §5.1): un 401 del recurso
 * protegido dice DÓNDE está su metadata OAuth. Es lo que permite a Claude,
 * ChatGPT o Codex descubrir solos el login al añadir el conector con solo la
 * URL; sin la cabecera, algunos clientes no llegan a iniciar el flujo.
 */
function anunciarMetadataOAuth(res) {
    res.set('WWW-Authenticate',
        `Bearer resource_metadata="${oauthTokens.ISSUER}/.well-known/oauth-protected-resource"`);
}

/**
 * Credenciales de agente (§41 del documento de seguridad del MCP).
 *
 * La api-key de una empresa identifica a la empresa, no a cuál de sus agentes
 * habla. Con una sola clave, el agente de marketing y el de tesorería tienen el
 * mismo poder, y si uno se desvía no hay forma de pararlo sin parar a todos.
 *
 * Una clave `bzag_…` es una subclave de la empresa para UN agente:
 *   · sus scopes son la INTERSECCIÓN con los de la empresa (nunca más), y
 *     nunca incluyen `admin`;
 *   · lleva carriles de dinero, límites propios y si puede ejecutar o sólo
 *     preparar (txPolicyEngine aplica el más restrictivo);
 *   · caduca siempre y se revoca sola, sin tocar la clave de la empresa.
 */
const PREFIJO_AGENTE = 'bzag_';

async function authenticateAgent(req, res, next, clave) {
    try {
        const { rows } = await query(
            `SELECT a.agent_id, a.scopes AS agent_scopes, a.rails, a.per_tx_limit_eur, a.daily_limit_eur,
                    a.can_execute, a.status AS agent_status, a.expires_at,
                    r.id, r.app_name, r.scopes, r.tier, r.is_active,
                    r.enterprise_id, r.authorized_addresses, r.address_access_mode
               FROM app_agents a JOIN app_registry r ON r.id = a.app_id
              WHERE a.key_hash = encode(digest($1, 'sha256'), 'hex')`,
            [clave]
        );
        if (rows.length === 0) {
            logger.warn({ ip: req.ip }, 'Invalid agent key attempt');
            return res.status(401).json({ error: 'Invalid API key' });
        }
        const f = rows[0];
        if (!f.is_active) return res.status(403).json({ error: 'App is deactivated' });
        if (f.agent_status !== 'active' || !f.expires_at || new Date(f.expires_at).getTime() <= Date.now()) {
            return res.status(401).json({ error: 'Agent credential revoked or expired', code: 'AGENT_KEY_INACTIVE' });
        }

        const deEmpresa = f.scopes || [];
        const pedidos = (f.agent_scopes || []).filter((s) => s !== 'admin');
        const efectivos = deEmpresa.includes('admin') ? pedidos : pedidos.filter((s) => deEmpresa.includes(s));
        const numero = (v) => (v === null || v === undefined ? undefined : Number(v));

        req.registeredApp = {
            id: f.id,
            name: f.app_name,
            scopes: efectivos,
            tier: f.tier,
            enterpriseId: f.enterprise_id || null,
            authorizedAddresses: f.authorized_addresses || [],
            addressAccessMode: f.address_access_mode || 'strict',
            viaAgente: true,
        };
        req.agent = {
            agentId: f.agent_id,
            rails: f.rails || [],
            porOperacionEur: numero(f.per_tx_limit_eur),
            diarioEur: numero(f.daily_limit_eur),
            canExecute: f.can_execute === true,
        };
        query('UPDATE app_agents SET last_used_at = NOW() WHERE key_hash = encode(digest($1, \'sha256\'), \'hex\')', [clave])
            .catch(() => {});
        return next();
    } catch (error) {
        logger.error({ error: error.message }, 'Gateway agent auth failed');
        return res.status(500).json({ error: 'Authentication service error' });
    }
}

/**
 * Autentica un access token OAuth 2.1 emitido por routes/oauth.js
 * (Authorization: Bearer <jwt>).
 *
 * El `sub` del JWT es el MISMO app_registry.id que usa el camino de api-key,
 * así que se reutiliza la consulta de siempre en vez de duplicar lógica —
 * mismo principio que documenta la cabecera de routes/mcp-gateway.js. El
 * scope efectivo es la INTERSECCIÓN entre lo concedido en el consentimiento y
 * lo que la fila tiene HOY: si a la empresa le quitan un scope después de
 * autorizar el conector, un token todavía válido no lo resucita.
 */
async function authenticateOAuthToken(req, res, next, token) {
    let claims;
    try {
        claims = oauthTokens.verificarAccessToken(token);
    } catch (err) {
        anunciarMetadataOAuth(res);
        return res.status(401).json({ error: 'Invalid or expired access token', code: 'OAUTH_TOKEN_INVALID' });
    }

    try {
        const { rows: denylist } = await query('SELECT 1 FROM oauth_token_denylist WHERE jti = $1', [claims.jti]);
        if (denylist.length > 0) {
            anunciarMetadataOAuth(res);
            return res.status(401).json({ error: 'Token revoked', code: 'OAUTH_TOKEN_REVOKED' });
        }

        const { rows } = await query(
            `SELECT id, app_name, scopes, tier, is_active,
                    enterprise_id, authorized_addresses, address_access_mode
               FROM app_registry WHERE id = $1`,
            [claims.sub]
        );
        if (rows.length === 0 || !rows[0].is_active) {
            return res.status(403).json({ error: 'App is deactivated', code: 'OAUTH_APP_INACTIVE' });
        }

        const app = rows[0];
        const scopeToken = String(claims.scope || '').split(' ').filter(Boolean);
        req.registeredApp = {
            id: app.id,
            name: app.app_name,
            scopes: scopeToken.filter((s) => app.scopes.includes(s) || app.scopes.includes('admin')),
            tier: app.tier,
            enterpriseId: app.enterprise_id || null,
            authorizedAddresses: app.authorized_addresses || [],
            addressAccessMode: app.address_access_mode || 'strict',
            viaOAuth: true,
            oauthClientId: claims.client_id,
        };
        return next();
    } catch (error) {
        logger.error({ error: error.message }, 'OAuth token auth failed');
        return res.status(500).json({ error: 'Authentication service error' });
    }
}

/**
 * Authenticate a registered app via x-api-key header, OR via an OAuth 2.1
 * access token (Authorization: Bearer <jwt> — ver authenticateOAuthToken).
 * Populates req.app with { id, name, scopes, tier }.
 */
async function authenticateApp(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];

    if (!apiKey) {
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            return authenticateOAuthToken(req, res, next, authHeader.slice(7).trim());
        }
        anunciarMetadataOAuth(res);
        return res.status(401).json({ error: 'Missing x-api-key header or Authorization: Bearer token' });
    }
    if (typeof apiKey === 'string' && apiKey.startsWith(PREFIJO_AGENTE)) {
        return authenticateAgent(req, res, next, apiKey);
    }

    try {
        const { rows } = await query(
            `SELECT id, app_name, scopes, tier, is_active,
                    enterprise_id, authorized_addresses, address_access_mode
             FROM app_registry 
             WHERE api_key_hash = encode(digest($1, 'sha256'), 'hex')`,
            [apiKey]
        );

        if (rows.length === 0) {
            logger.warn({ ip: req.ip }, 'Invalid gateway API key attempt');
            return res.status(401).json({ error: 'Invalid API key' });
        }

        const app = rows[0];
        if (!app.is_active) {
            return res.status(403).json({ error: 'App is deactivated' });
        }

        req.registeredApp = {
            id: app.id,
            name: app.app_name,
            scopes: app.scopes || [],
            tier: app.tier,
            // Titularidad: contra esto se contrasta cualquier dirección que
            // llegue por la URL. Ver middleware/address-access.js.
            enterpriseId: app.enterprise_id || null,
            authorizedAddresses: app.authorized_addresses || [],
            // Si la columna no existe todavía (base sin migrar), se asume
            // 'strict': una migración pendiente no puede abrir un permiso.
            addressAccessMode: app.address_access_mode || 'strict',
        };
        next();
    } catch (error) {
        logger.error({ error: error.message }, 'Gateway app auth failed');
        return res.status(500).json({ error: 'Authentication service error' });
    }
}

/**
 * Verify that the registered app has the required scope.
 * Must be called after authenticateApp.
 */
function requireScope(...scopes) {
    return (req, res, next) => {
        // API-key auth: check app scopes
        if (req.registeredApp) {
            const appScopes = req.registeredApp.scopes;
            if (appScopes.includes('admin')) return next();
            const hasScope = scopes.some(s => appScopes.includes(s));
            if (!hasScope) {
                return res.status(403).json({
                    error: `Insufficient scope. Required: ${scopes.join(' | ')}`,
                });
            }
            return next();
        }

        // JWT-only auth: derive scopes from user role
        if (req.user) {
            if (req.user.role === 'admin') return next();

            // Regular users can access consumer scopes
            const userScopes = ['wallet', 'staking', 'farming', 'governance', 'bridge', 'treasury', 'token', 'contracts'];
            const hasScope = scopes.some(s => userScopes.includes(s));
            if (!hasScope) {
                return res.status(403).json({
                    error: `Insufficient scope. Required: ${scopes.join(' | ')}`,
                });
            }
            return next();
        }

        return res.status(401).json({ error: 'Authentication required' });
    };
}

/**
 * Authenticate a cross-app user JWT (SSO token).
 * The token must contain: address, userId, role, app_origin.
 * Populates req.user with the decoded claims.
 */
function authenticateSSOToken(req, res, next) {
    // Auth bypass: ONLY when explicitly opted in (AUTH_BYPASS=true, non-prod).
    // Impossible in production — see config/secrets.js.
    if (AUTH_BYPASS) {
        req.user = {
            address: '0xDev0000000000000000000000000000000000001',
            userId: 1,
            role: 'admin',
            app_origin: 'dev',
        };
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'SSO access token required' });
    }

    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired SSO token' });
        }
        req.user = decoded;
        next();
    });
}

/**
 * Combined middleware: accepts either API key OR JWT.
 * API key → populates req.registeredApp
 * JWT → populates req.user
 * At least one must be present.
 */
function authenticateGateway(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];

    if (apiKey) {
        return authenticateApp(req, res, () => {
            // If JWT is also present, decode it too (for user context)
            if (authHeader) {
                const token = authHeader.split(' ')[1];
                if (token) {
                    try {
                        req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
                    } catch (_) {
                        // API key is enough; JWT is optional bonus context
                    }
                }
            }
            next();
        });
    }

    if (authHeader) {
        return authenticateSSOToken(req, res, next);
    }

    return res.status(401).json({ error: 'Authentication required (API key or JWT)' });
}

module.exports = {
    authenticateApp,
    authenticateOAuthToken,
    requireScope,
    authenticateSSOToken,
    authenticateGateway,
};
