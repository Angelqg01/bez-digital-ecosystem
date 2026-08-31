/**
 * /api/organizations — gestión multi-tenant (Holding/Institución/Empresa).
 *
 * Modelo: Organización → Sedes → Membresías (roles). El owner que crea la org
 * obtiene automáticamente una membresía `owner`. El resto de rutas exige
 * pertenencia y un rol mínimo, resuelto por el middleware de tenancy.
 */
const express = require('express');
const Organization = require('../models/pg/Organization');
const Site = require('../models/pg/Site');
const Membership = require('../models/pg/Membership');
const ApiKey = require('../models/pg/ApiKey');
const ApiLog = require('../models/pg/ApiLog');
const { tenancy, requireRole, getActor } = require('../middleware/tenancy');

/** Enmascara una clave para listados (nunca devolver la clave completa). */
function maskKey(k) {
  if (!k) return null;
  return `${k.slice(0, 12)}…${k.slice(-4)}`;
}

const router = express.Router();

function actorOr401(req, res) {
  const actor = getActor(req);
  if (!actor.userId && !actor.wallet) {
    res.status(401).json({ error: 'Unauthenticated', message: 'Inicia sesión o conecta tu wallet.', code: 'NO_ACTOR' });
    return null;
  }
  return actor;
}

// ── Mis organizaciones ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const actor = actorOr401(req, res);
    if (!actor) return;
    const orgs = await Organization.listForActor(actor);
    res.json({ organizations: orgs });
  } catch (err) { next(err); }
});

// ── Crear organización (el actor queda como owner) ───────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const actor = actorOr401(req, res);
    if (!actor) return;
    const { name, type, taxId, country, plan, metadata } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Bad Request', message: 'El nombre es obligatorio.', code: 'NO_NAME' });
    }
    const org = await Organization.create({
      name, type, taxId, country, plan, metadata,
      ownerUserId: actor.userId, ownerWallet: actor.wallet,
    });
    await Membership.create({
      orgId: org.id, userId: actor.userId, wallet: actor.wallet, role: 'owner',
    });
    res.status(201).json({ organization: org });
  } catch (err) { next(err); }
});

// ── Detalle de organización (cualquier miembro) ──────────────────────────────
router.get('/:orgId', tenancy({ required: true }), requireRole('auditor'), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).json({ error: 'Not Found', code: 'NO_ORG' });
    res.json({ organization: org, role: req.tenant.role });
  } catch (err) { next(err); }
});

// ── Actualizar organización (org_admin+) ─────────────────────────────────────
router.patch('/:orgId', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const org = await Organization.update(req.params.orgId, req.body || {});
    res.json({ organization: org });
  } catch (err) { next(err); }
});

// ── Sedes ────────────────────────────────────────────────────────────────────
router.get('/:orgId/sites', tenancy({ required: true }), requireRole('auditor'), async (req, res, next) => {
  try {
    let sites = await Site.listByOrg(req.params.orgId);
    // Un actor limitado a una sede sólo ve la suya.
    if (req.tenant.siteId && req.tenant.role !== 'org_admin' && req.tenant.role !== 'owner') {
      sites = sites.filter((s) => s.id === req.tenant.siteId);
    }
    res.json({ sites });
  } catch (err) { next(err); }
});

router.post('/:orgId/sites', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const { name, type, externalRef, parentSiteId, location, metadata } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Bad Request', message: 'El nombre de la sede es obligatorio.', code: 'NO_NAME' });
    const site = await Site.create({ orgId: req.params.orgId, name, type, externalRef, parentSiteId, location, metadata });
    res.status(201).json({ site });
  } catch (err) { next(err); }
});

// ── Membresías ───────────────────────────────────────────────────────────────
router.get('/:orgId/members', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const members = await Membership.listByOrg(req.params.orgId);
    res.json({ members });
  } catch (err) { next(err); }
});

router.post('/:orgId/members', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const { userId, wallet, siteId, role } = req.body || {};
    if (!userId && !wallet) {
      return res.status(400).json({ error: 'Bad Request', message: 'Indica user_id o wallet del miembro.', code: 'NO_IDENTITY' });
    }
    if (siteId) {
      const ok = await Site.belongsToOrg(siteId, req.params.orgId);
      if (!ok) return res.status(404).json({ error: 'Site not found', code: 'BAD_SITE' });
    }
    const actor = getActor(req);
    const member = await Membership.create({
      orgId: req.params.orgId, userId, wallet, siteId, role: role || 'operator', invitedBy: actor.userId,
    });
    res.status(201).json({ member });
  } catch (err) { next(err); }
});

// ── API Keys con scope de organización/sede (núcleo API/SDK/Plugin) ──────────
// Emitir una clave para que los sistemas del cliente (SDK, plugin WordPress,
// integraciones) operen con el scope correcto. La clave en claro se devuelve
// UNA sola vez; en BD se guarda sólo su hash.
router.post('/:orgId/api-keys', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const { name, sector, environment, siteId, description, scopes, signatureRequired } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Bad Request', message: 'El nombre de la clave es obligatorio.', code: 'NO_NAME' });

    if (siteId) {
      const ok = await Site.belongsToOrg(siteId, req.params.orgId);
      if (!ok) return res.status(404).json({ error: 'Site not found', code: 'BAD_SITE' });
    }

    const env = environment === 'production' ? 'production' : 'development';
    const sec = sector || 'general';
    const plain = ApiKey.generateKey(getActor(req).userId || 'org', sec, env);
    const keyHash = ApiKey.hashKey(plain);
    // Secreto de firma: el cliente firma cada petición con él (HMAC + nonce),
    // de modo que una clave filtrada no basta por sí sola para operar.
    const signingSecret = ApiKey.generateSigningSecret();

    const record = await ApiKey.create({
      userId: getActor(req).userId || null,
      orgId: req.params.orgId,
      siteId: siteId || null,
      name,
      description: description || null,
      key: plain,
      keyHash,
      sector: sec,
      environment: env,
      // Scopes explícitos (p.ej. ['wallet:read','cargolink:*']). Sin scopes la
      // clave queda en modo legado hasta que se active API_STRICT_SCOPES.
      permissions: Array.isArray(scopes) ? scopes : [],
      signingSecret,
      signatureRequired: signatureRequired === true,
    });

    res.status(201).json({
      message: 'Guarda estas credenciales: no se volverán a mostrar.',
      apiKey: plain,
      signingSecret,
      key: {
        id: record.id, name: record.name, sector: record.sector, environment: record.environment,
        orgId: record.org_id, siteId: record.site_id, status: record.status,
        scopes: record.permissions || [], signatureRequired: record.signature_required === true,
      },
    });
  } catch (err) { next(err); }
});

router.get('/:orgId/api-keys', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const keys = await ApiKey.findByOrg(req.params.orgId);
    res.json({
      keys: keys.map((k) => ({
        id: k.id, name: k.name, sector: k.sector, environment: k.environment,
        status: k.status, orgId: k.org_id, siteId: k.site_id,
        masked: maskKey(k.key), createdAt: k.created_at,
      })),
    });
  } catch (err) { next(err); }
});

router.delete('/:orgId/api-keys/:keyId', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const revoked = await ApiKey.revoke(req.params.keyId, req.params.orgId);
    if (!revoked) return res.status(404).json({ error: 'Not Found', message: 'Clave no encontrada en esta organización.', code: 'NO_KEY' });
    res.json({ revoked: true, id: revoked.id, status: revoked.status });
  } catch (err) { next(err); }
});

// ── Uso de API por sede (base de facturación) ────────────────────────────────
router.get('/:orgId/usage', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const since = typeof req.query.since === 'string' ? req.query.since : '30 days';
    const usage = await ApiLog.getUsageByOrg(req.params.orgId, { since });
    res.json(usage);
  } catch (err) { next(err); }
});

module.exports = router;
