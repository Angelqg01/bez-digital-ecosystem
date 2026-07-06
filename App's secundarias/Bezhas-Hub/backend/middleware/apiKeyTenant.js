/**
 * apiKeyTenant — autenticación de API key respaldada por base de datos, con
 * binding de organización/sede para el flujo máquina-a-máquina (SDK · Plugin
 * WordPress · integraciones del cliente).
 *
 * Resuelve la cabecera `X-API-Key` contra `api_keys` (por hash SHA-256), y deja:
 *   req.apiKeyRecord = { id, org_id, site_id, status, rate_limit, ... }
 *   req.apiTier, req.rateLimit, req.apiKeyId
 *
 * A partir de aquí, el middleware de tenancy lee `req.apiKeyRecord.org_id/site_id`
 * y fija `req.tenant`. Se construye con `createApiKeyTenant({ ApiKey })` para
 * poder testear sin base de datos (inyección de dependencias).
 */
function createApiKeyTenant({ ApiKey } = {}) {
  if (!ApiKey) ApiKey = require('../models/pg/ApiKey');

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.required=true] si false, permite seguir sin clave.
   */
  function apiKeyTenant(opts = {}) {
    const required = opts.required !== false;

    return async function apiKeyTenantMiddleware(req, res, next) {
      try {
        const raw = req.header?.('X-API-Key') || req.header?.('x-api-key');
        if (!raw) {
          if (!required) return next();
          return res.status(401).json({ error: 'Missing API Key', message: 'Incluye tu clave en la cabecera X-API-Key.', code: 'NO_API_KEY' });
        }

        const keyHash = ApiKey.hashKey(raw);
        const record = await ApiKey.findActiveByHash(keyHash);
        if (!record) {
          return res.status(403).json({ error: 'Invalid API Key', message: 'La clave no es válida o ha sido revocada.', code: 'BAD_API_KEY' });
        }

        if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
          return res.status(403).json({ error: 'Expired API Key', message: 'La clave ha expirado.', code: 'EXPIRED_API_KEY' });
        }

        req.apiKeyRecord = record;
        req.apiKeyId = record.id;
        req.apiTier = record.environment === 'production' ? 'pro' : 'free';
        req.rateLimit = record.rate_limit || null;
        return next();
      } catch (err) {
        return next(err);
      }
    };
  }

  return { apiKeyTenant };
}

/**
 * apiUsageMeter — registra cada llamada con su scope (org/site) para la
 * facturación por sede. Fire-and-forget: nunca bloquea ni rompe la respuesta.
 * Aplicar DESPUÉS de apiKeyTenant + tenancy (necesita req.apiKeyId / req.tenant).
 */
function createApiUsageMeter({ ApiLog } = {}) {
  if (!ApiLog) ApiLog = require('../models/pg/ApiLog');

  return function apiUsageMeter(req, res, next) {
    const startedAt = Date.now();
    res.on('finish', () => {
      try {
        if (!req.apiKeyId && !req.tenant?.orgId) return; // sólo tráfico con scope
        ApiLog.create({
          apiKeyId: req.apiKeyId || null,
          userId: req.user?.id || null,
          orgId: req.tenant?.orgId || req.apiKeyRecord?.org_id || null,
          siteId: req.tenant?.siteId || req.apiKeyRecord?.site_id || null,
          request: { method: req.method, endpoint: req.originalUrl?.split('?')[0] },
          response: { statusCode: res.statusCode, responseTime: Date.now() - startedAt },
          client: { ip: req.ip, userAgent: req.header?.('user-agent') || null },
        }).catch(() => {});
      } catch (_) { /* nunca propagar errores de medición */ }
    });
    next();
  };
}

const _default = createApiKeyTenant();

module.exports = {
  createApiKeyTenant,
  apiKeyTenant: _default.apiKeyTenant,
  createApiUsageMeter,
  apiUsageMeter: createApiUsageMeter(),
};
