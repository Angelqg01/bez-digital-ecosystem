/**
 * /api/organizations/:orgId/hierarchy — jerarquía padre→subordinados,
 * comisiones por validación de transacciones, políticas de control y
 * tesorería interna. Requiere plan Business+ (ver config/plans.js).
 *
 * Montado junto a organizations.routes.js (mismo prefijo, router separado
 * para no sobrecargar el archivo base).
 */
const express = require('express');
const { tenancy, requireRole, getActor } = require('../middleware/tenancy');
const commissionEngine = require('../services/commissionEngine.service');

const router = express.Router();

function handleEngineError(err, res, next) {
  if (err && err.code && err.status) {
    return res.status(err.status).json({ error: err.code, message: err.message, code: err.code });
  }
  return next(err);
}

// ── Subordinados ─────────────────────────────────────────────────────────
router.post('/:orgId/hierarchy/subordinates', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const { childOrgId, relationshipType } = req.body || {};
    if (!childOrgId) return res.status(400).json({ error: 'Bad Request', message: 'childOrgId es obligatorio.', code: 'NO_CHILD' });
    const link = await commissionEngine.linkSubordinate({ parentOrgId: req.params.orgId, childOrgId, relationshipType });
    res.status(201).json({ link });
  } catch (err) { handleEngineError(err, res, next); }
});

router.get('/:orgId/hierarchy/subordinates', tenancy({ required: true }), requireRole('auditor'), async (req, res, next) => {
  try {
    const links = await commissionEngine.listSubordinates(req.params.orgId);
    res.json({ subordinates: links });
  } catch (err) { handleEngineError(err, res, next); }
});

router.delete('/:orgId/hierarchy/subordinates/:childOrgId', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const link = await commissionEngine.unlinkSubordinate(req.params.orgId, req.params.childOrgId);
    if (!link) return res.status(404).json({ error: 'Not Found', code: 'NO_LINK' });
    res.json({ unlinked: true, link });
  } catch (err) { handleEngineError(err, res, next); }
});

// ── Validaciones (dispara comisión en cascada) ───────────────────────────
// Lo llama el sistema (webhook interno, integración IoT/pagos) con la API
// key scoped al subordinado, o un org_admin manualmente.
router.post('/:orgId/hierarchy/validations', tenancy({ required: true }), requireRole('operator'), async (req, res, next) => {
  try {
    const { siteId, txType, txRef, txAmount, txCurrency, metadata } = req.body || {};
    const result = await commissionEngine.recordValidation({
      subjectOrgId: req.params.orgId,
      subjectSiteId: siteId || req.tenant.siteId || null,
      txType, txRef, txAmount: Number(txAmount) || 0, txCurrency: txCurrency || 'EUR', metadata,
    });
    res.status(201).json(result);
  } catch (err) { handleEngineError(err, res, next); }
});

// ── Comisiones devengadas por ESTA organización (como beneficiaria) ─────
router.get('/:orgId/hierarchy/commissions', tenancy({ required: true }), requireRole('auditor'), async (req, res, next) => {
  try {
    const entries = await commissionEngine.getLedger(req.params.orgId, { status: req.query.status });
    res.json({ entries });
  } catch (err) { handleEngineError(err, res, next); }
});

router.get('/:orgId/hierarchy/commissions/summary', tenancy({ required: true }), requireRole('auditor'), async (req, res, next) => {
  try {
    const summary = await commissionEngine.getLedgerSummary(req.params.orgId);
    res.json({ summary });
  } catch (err) { handleEngineError(err, res, next); }
});

router.post('/:orgId/hierarchy/commissions/:ledgerId/settle', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const entry = await commissionEngine.settleLedgerEntry(req.params.ledgerId, req.params.orgId, req.body?.settlementRef);
    res.json({ entry });
  } catch (err) { handleEngineError(err, res, next); }
});

// ── Políticas (límite de gasto, scope, geofencing, rate limit) ──────────
router.post('/:orgId/hierarchy/policies', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const { appliesToOrgId, siteId, policyType, config } = req.body || {};
    if (!policyType || !config) return res.status(400).json({ error: 'Bad Request', message: 'policyType y config son obligatorios.', code: 'NO_POLICY' });
    const actor = getActor(req);
    const policy = await commissionEngine.createPolicy({
      ownerOrgId: req.params.orgId,
      appliesToOrgId: appliesToOrgId || req.params.orgId,
      siteId, policyType, config, createdBy: actor.userId,
    });
    res.status(201).json({ policy });
  } catch (err) { handleEngineError(err, res, next); }
});

router.get('/:orgId/hierarchy/policies', tenancy({ required: true }), requireRole('auditor'), async (req, res, next) => {
  try {
    const policies = await commissionEngine.listPolicies(req.params.orgId);
    res.json({ policies });
  } catch (err) { handleEngineError(err, res, next); }
});

router.delete('/:orgId/hierarchy/policies/:policyId', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const policy = await commissionEngine.revokePolicy(req.params.policyId, req.params.orgId);
    if (!policy) return res.status(404).json({ error: 'Not Found', code: 'NO_POLICY' });
    res.json({ revoked: true, policy });
  } catch (err) { handleEngineError(err, res, next); }
});

// ── Tesorería interna (advance/sweep entre niveles) ──────────────────────
router.post('/:orgId/hierarchy/treasury/transfers', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const { toOrgId, direction, currency, amount, note } = req.body || {};
    if (!toOrgId || !direction || !currency || !amount) {
      return res.status(400).json({ error: 'Bad Request', message: 'toOrgId, direction, currency y amount son obligatorios.', code: 'NO_TRANSFER_DATA' });
    }
    const actor = getActor(req);
    const transfer = await commissionEngine.requestTransfer({
      fromOrgId: req.params.orgId, toOrgId, direction, currency, amount: Number(amount), note, requestedBy: actor.userId,
    });
    res.status(201).json({ transfer });
  } catch (err) { handleEngineError(err, res, next); }
});

router.get('/:orgId/hierarchy/treasury/transfers', tenancy({ required: true }), requireRole('auditor'), async (req, res, next) => {
  try {
    const transfers = await commissionEngine.listTransfers(req.params.orgId);
    res.json({ transfers });
  } catch (err) { handleEngineError(err, res, next); }
});

router.post('/:orgId/hierarchy/treasury/transfers/:transferId/approve', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const actor = getActor(req);
    const transfer = await commissionEngine.approveTransfer(req.params.transferId, actor.userId);
    res.json({ transfer });
  } catch (err) { handleEngineError(err, res, next); }
});

router.post('/:orgId/hierarchy/treasury/transfers/:transferId/reject', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const transfer = await commissionEngine.rejectTransfer(req.params.transferId);
    res.json({ transfer });
  } catch (err) { handleEngineError(err, res, next); }
});

router.post('/:orgId/hierarchy/treasury/transfers/:transferId/settle', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const transfer = await commissionEngine.settleTransfer(req.params.transferId, req.body?.settlementRef);
    res.json({ transfer });
  } catch (err) { handleEngineError(err, res, next); }
});

// ── Agregación de datos de toda la jerarquía ─────────────────────────────
router.get('/:orgId/hierarchy/data/aggregate', tenancy({ required: true }), requireRole('org_admin'), async (req, res, next) => {
  try {
    const aggregate = await commissionEngine.getHierarchyAggregate(req.params.orgId, { since: req.query.since || '30 days' });
    res.json(aggregate);
  } catch (err) { handleEngineError(err, res, next); }
});

module.exports = router;
