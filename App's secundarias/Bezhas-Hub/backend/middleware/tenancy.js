/**
 * Tenancy middleware — resuelve la organización/sede (tenant) de cada request y
 * el rol efectivo del actor, dejándolo en `req.tenant = { orgId, siteId, role }`.
 *
 * Orden de resolución (precedencia):
 *   1) API key con scope (req.apiKeyRecord.org_id/site_id) — máquina-a-máquina.
 *   2) Cabeceras X-Org-Id / X-Site-Id validadas contra una membresía activa del
 *      actor (req.user.id ó req.walletAddress / X-Wallet-Address) — usuario humano.
 *
 * Escalable y desacoplado: se construye con `createTenancy({ Membership, Site })`,
 * lo que permite testear la lógica sin base de datos (inyección de dependencias).
 * El módulo exporta una instancia por defecto con los modelos reales.
 */
const ROLE_LEVEL = { auditor: 1, operator: 2, site_manager: 3, org_admin: 4, owner: 5 };

function getActor(req) {
  const userId = req.user?.id || req.user?.userId || null;
  const wallet =
    req.walletAddress ||
    req.user?.walletAddress ||
    req.user?.wallet ||
    req.header?.('X-Wallet-Address') ||
    null;
  return { userId, wallet };
}

function createTenancy({ Membership, Site } = {}) {
  if (!Membership) Membership = require('../models/pg/Membership');
  if (!Site) Site = require('../models/pg/Site');

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.required=false] si true, 401/403 cuando no hay tenant válido.
   */
  function tenancy(opts = {}) {
    const required = !!opts.required;

    return async function tenancyMiddleware(req, res, next) {
      try {
        // 1) Scope desde la API key (M2M)
        const keyOrg = req.apiKeyRecord?.org_id || req.apiKeyRecord?.orgId || null;
        if (keyOrg) {
          req.tenant = {
            orgId: keyOrg,
            siteId: req.apiKeyRecord.site_id || req.apiKeyRecord.siteId || null,
            role: 'org_admin', // una API key opera a nivel org salvo que tenga site
            source: 'api_key',
          };
          if (req.tenant.siteId) req.tenant.role = 'site_manager';
          return next();
        }

        // 2) Cabeceras + membresía del actor (humano)
        const orgId = req.header?.('X-Org-Id') || req.query?.orgId || req.params?.orgId || null;
        if (!orgId) {
          if (required) {
            return res.status(400).json({ error: 'Missing tenant', message: 'Indica la organización (X-Org-Id).', code: 'NO_ORG' });
          }
          req.tenant = null;
          return next();
        }

        const { userId, wallet } = getActor(req);
        if (!userId && !wallet) {
          if (required) {
            return res.status(401).json({ error: 'Unauthenticated', message: 'Inicia sesión o conecta tu wallet.', code: 'NO_ACTOR' });
          }
          req.tenant = null;
          return next();
        }

        const membership = await Membership.findForActorInOrg({ orgId, userId, wallet });
        if (!membership) {
          if (required) {
            return res.status(403).json({ error: 'Forbidden', message: 'No perteneces a esta organización.', code: 'NOT_MEMBER' });
          }
          req.tenant = null;
          return next();
        }

        // Sede solicitada (opcional). Debe pertenecer a la org y, si el rol está
        // limitado a una sede, coincidir con la suya.
        let siteId = req.header?.('X-Site-Id') || req.query?.siteId || null;
        if (siteId) {
          const ok = await Site.belongsToOrg(siteId, orgId);
          if (!ok) {
            return res.status(404).json({ error: 'Site not found', message: 'La sede no pertenece a la organización.', code: 'BAD_SITE' });
          }
          if (membership.site_id && membership.site_id !== siteId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Tu acceso está limitado a otra sede.', code: 'SITE_SCOPE' });
          }
        } else if (membership.site_id) {
          // Acceso limitado a su sede por defecto
          siteId = membership.site_id;
        }

        req.tenant = { orgId, siteId: siteId || null, role: membership.role, source: 'membership' };
        return next();
      } catch (err) {
        return next(err);
      }
    };
  }

  /** Exige un rol mínimo sobre el tenant ya resuelto. Usar tras tenancy({required:true}). */
  function requireRole(minRole) {
    return function (req, res, next) {
      const role = req.tenant?.role;
      if (!role) {
        return res.status(401).json({ error: 'Unauthenticated', message: 'Tenant no resuelto.', code: 'NO_TENANT' });
      }
      if ((ROLE_LEVEL[role] || 0) < (ROLE_LEVEL[minRole] || 0)) {
        return res.status(403).json({ error: 'Forbidden', message: `Requiere rol ${minRole} o superior.`, code: 'ROLE_TOO_LOW' });
      }
      return next();
    };
  }

  return { tenancy, requireRole, getActor, ROLE_LEVEL };
}

// Instancia por defecto con los modelos reales.
const _default = createTenancy();

module.exports = {
  createTenancy,
  tenancy: _default.tenancy,
  requireRole: _default.requireRole,
  getActor: _default.getActor,
  ROLE_LEVEL,
};
