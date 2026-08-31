/**
 * commissionEngine — jerarquía de organizaciones (holding/consorcio/naviera →
 * subordinados) + comisión en cascada por validación de transacciones +
 * políticas de gasto/scope + tesorería interna entre niveles.
 *
 * Regla de cascada: el padre directo (nivel 1) cobra la tasa configurada en
 * el vínculo (capturada del plan del padre al crearlo); cada nivel adicional
 * (abuelo, bisabuelo…) cobra la mitad de la tasa del nivel anterior, sólo si
 * el plan de ESE ancestro permite alcanzar esa profundidad
 * (`commissionCascadeDepth`). Evita el efecto pirámide: el operador BeZhas
 * fija el decaimiento y el tope, no cada holding.
 *
 * BeZhas cobra su comisión de plataforma (PLATFORM_FEE_BPS) en CADA
 * transacción ANTES de repartir la cascada jerárquica. La cascada se
 * recorta proporcionalmente si excede MAX_CASCADE_BPS para que el coste
 * total (plataforma + cascada) nunca supere MAX_TOTAL_BURDEN_BPS.
 *
 * Construido con `createCommissionEngine({...modelos})` para testear sin BD
 * (mismo patrón que tenancy.js / identity.service.js).
 */
const CASCADE_DECAY = 0.5;
const MAX_CASCADE_LEVELS = 5;

function createCommissionEngine({
  HierarchyLink,
  ValidationEvent,
  CommissionLedger,
  OrgPolicy,
  TreasuryTransfer,
  Organization,
  getHierarchyConfig,
  PLATFORM_FEE_BPS: _platformFeeBps,
  MAX_TOTAL_BURDEN_BPS: _maxTotalBurdenBps,
} = {}) {
  if (!HierarchyLink) HierarchyLink = require('../models/pg/HierarchyLink');
  if (!ValidationEvent) ValidationEvent = require('../models/pg/ValidationEvent');
  if (!CommissionLedger) CommissionLedger = require('../models/pg/CommissionLedger');
  if (!OrgPolicy) OrgPolicy = require('../models/pg/OrgPolicy');
  if (!TreasuryTransfer) TreasuryTransfer = require('../models/pg/TreasuryTransfer');
  if (!Organization) Organization = require('../models/pg/Organization');
  let _plans;
  if (!getHierarchyConfig) {
    _plans = require('../config/plans');
    ({ getHierarchyConfig } = _plans);
  }
  const PLATFORM_FEE_BPS = typeof _platformFeeBps === 'number'
    ? _platformFeeBps
    : (_plans || require('../config/plans')).PLATFORM_FEE_BPS;
  const MAX_TOTAL_BURDEN_BPS = typeof _maxTotalBurdenBps === 'number'
    ? _maxTotalBurdenBps
    : (_plans || require('../config/plans')).MAX_TOTAL_BURDEN_BPS;
  const MAX_CASCADE_BPS = MAX_TOTAL_BURDEN_BPS - PLATFORM_FEE_BPS;

  function err(message, code, status = 400) {
    const e = new Error(message);
    e.code = code;
    e.status = status;
    return e;
  }

  async function requireHierarchyPlan(orgId) {
    const org = await Organization.findById(orgId);
    if (!org) throw err('Organización no encontrada.', 'NO_ORG', 404);
    const config = getHierarchyConfig(org.plan);
    if (!config) {
      throw err(
        'Tu plan no incluye jerarquía de organizaciones. Sube a Business o Enterprise VIP.',
        'PLAN_NO_HIERARCHY',
        403,
      );
    }
    return { org, config };
  }

  // ── Vínculos padre → subordinado ────────────────────────────────────────
  async function linkSubordinate({ parentOrgId, childOrgId, relationshipType }) {
    if (parentOrgId === childOrgId) throw err('Una organización no puede ser subordinada de sí misma.', 'SELF_LINK');
    const { config } = await requireHierarchyPlan(parentOrgId);

    const existingParent = await HierarchyLink.findParentOf(childOrgId);
    if (existingParent) throw err('La organización subordinada ya tiene un padre asignado.', 'ALREADY_LINKED', 409);

    const count = await HierarchyLink.countChildren(parentOrgId);
    if (count >= config.maxSubOrgs) {
      throw err(`Límite de sub-empresas de tu plan alcanzado (${config.maxSubOrgs}).`, 'MAX_SUBORGS', 403);
    }

    return HierarchyLink.create({
      parentOrgId,
      childOrgId,
      relationshipType,
      commissionRateBps: config.commissionRateBps,
    });
  }

  async function unlinkSubordinate(parentOrgId, childOrgId) {
    return HierarchyLink.revoke(parentOrgId, childOrgId);
  }

  async function listSubordinates(parentOrgId) {
    return HierarchyLink.listChildren(parentOrgId);
  }

  // ── Cadena de ancestros (para cascada de comisión y de políticas) ───────
  async function resolveAncestorChain(childOrgId, maxDepth = MAX_CASCADE_LEVELS) {
    const chain = [];
    let current = childOrgId;
    for (let level = 1; level <= maxDepth; level++) {
      const link = await HierarchyLink.findParentOf(current);
      if (!link) break;
      chain.push({ orgId: link.parent_org_id, level, link });
      current = link.parent_org_id;
    }
    return chain;
  }

  // ── Políticas: ¿bloquea algún ancestro este importe/scope? ──────────────
  async function checkPolicies({ orgId, siteId, amount, currency }) {
    const policies = await OrgPolicy.listApplicableTo(orgId, siteId || null);
    for (const p of policies) {
      if (p.policy_type !== 'spend_limit') continue;
      const cfg = p.config || {};
      if (cfg.currency && currency && cfg.currency !== currency) continue;
      if (typeof cfg.maxAmount === 'number' && amount > cfg.maxAmount) {
        throw err(
          `Transacción bloqueada por política de gasto (${cfg.maxAmount} ${cfg.currency || currency}) impuesta por la organización matriz.`,
          'POLICY_SPEND_LIMIT',
          403,
        );
      }
    }
    return true;
  }

  // ── Registrar un evento validable y devengar comisión en cascada ────────
  async function recordValidation({ subjectOrgId, subjectSiteId, txType, txRef, txAmount, txCurrency, metadata }) {
    if (!txRef) throw err('txRef es obligatorio (idempotencia).', 'NO_TX_REF');

    await checkPolicies({ orgId: subjectOrgId, siteId: subjectSiteId, amount: txAmount, currency: txCurrency });

    const { event, duplicate } = await ValidationEvent.create({
      subjectOrgId, subjectSiteId, txType, txRef, txAmount, txCurrency, metadata,
    });
    if (duplicate) return { event, ledgerEntries: [], platformFee: null, totalBurdenBps: 0, duplicate: true };

    // ── 1. Comisión BeZhas (SIEMPRE, antes de la cascada) ──────────────
    const platformFeeAmount = Number(((txAmount * PLATFORM_FEE_BPS) / 10000).toFixed(8));
    const platformFee = {
      rateBps: PLATFORM_FEE_BPS,
      amount: platformFeeAmount,
      currency: txCurrency,
    };

    // ── 2. Cascada jerárquica: calcular tasas en memoria ───────────────
    const ancestors = await resolveAncestorChain(subjectOrgId, MAX_CASCADE_LEVELS);
    const baseRateBps = ancestors[0]?.link?.commission_rate_bps || 0;
    const rawEntries = [];

    for (const ancestor of ancestors) {
      const ancestorOrg = await Organization.findById(ancestor.orgId);
      const config = ancestorOrg ? getHierarchyConfig(ancestorOrg.plan) : null;
      if (!config || ancestor.level > config.cascadeDepth) continue;

      const rateBps = Math.round(baseRateBps * Math.pow(CASCADE_DECAY, ancestor.level - 1));
      if (rateBps <= 0) continue;
      rawEntries.push({ orgId: ancestor.orgId, level: ancestor.level, rateBps });
    }

    // ── 3. Recortar cascada si excede el máximo ────────────────────────
    const rawSum = rawEntries.reduce((s, e) => s + e.rateBps, 0);
    if (rawSum > MAX_CASCADE_BPS) {
      const factor = MAX_CASCADE_BPS / rawSum;
      let assigned = 0;
      for (let i = 0; i < rawEntries.length; i++) {
        if (i === rawEntries.length - 1) {
          rawEntries[i].rateBps = MAX_CASCADE_BPS - assigned;
        } else {
          rawEntries[i].rateBps = Math.round(rawEntries[i].rateBps * factor);
          assigned += rawEntries[i].rateBps;
        }
      }
    }

    // ── 4. Persistir entradas en el ledger ──────────────────────────────
    const ledgerEntries = [];
    let cascadeBps = 0;
    for (const raw of rawEntries) {
      const amount = Number(((txAmount * raw.rateBps) / 10000).toFixed(8));
      if (amount <= 0) continue;
      cascadeBps += raw.rateBps;
      const entry = await CommissionLedger.create({
        validationEventId: event.id,
        beneficiaryOrgId: raw.orgId,
        level: raw.level,
        rateBpsApplied: raw.rateBps,
        amount,
        currency: txCurrency,
      });
      ledgerEntries.push(entry);
    }

    const totalBurdenBps = PLATFORM_FEE_BPS + cascadeBps;
    return { event, ledgerEntries, platformFee, totalBurdenBps, duplicate: false };
  }

  async function getLedger(orgId, opts) {
    return CommissionLedger.listByBeneficiary(orgId, opts);
  }

  async function getLedgerSummary(orgId) {
    return CommissionLedger.summaryByBeneficiary(orgId);
  }

  async function settleLedgerEntry(ledgerId, orgId, settlementRef) {
    const entry = await CommissionLedger.settle(ledgerId, orgId, settlementRef);
    if (!entry) throw err('Entrada de comisión no encontrada o ya liquidada.', 'NO_LEDGER_ENTRY', 404);
    return entry;
  }

  // ── Políticas: CRUD para el padre ────────────────────────────────────────
  async function createPolicy({ ownerOrgId, appliesToOrgId, siteId, policyType, config, createdBy }) {
    const { config: hierarchyConfig } = await requireHierarchyPlan(ownerOrgId);
    if (!hierarchyConfig.policyEngine) {
      throw err('Tu plan no incluye motor de políticas.', 'PLAN_NO_POLICY_ENGINE', 403);
    }
    if (ownerOrgId !== appliesToOrgId) {
      const link = await HierarchyLink.findLink(ownerOrgId, appliesToOrgId);
      if (!link) throw err('Sólo puedes imponer políticas sobre tus propios subordinados.', 'NOT_SUBORDINATE', 403);
    }
    return OrgPolicy.create({ ownerOrgId, appliesToOrgId, siteId, policyType, config, createdBy });
  }

  async function listPolicies(ownerOrgId) {
    return OrgPolicy.listByOwner(ownerOrgId);
  }

  async function revokePolicy(policyId, ownerOrgId) {
    return OrgPolicy.revoke(policyId, ownerOrgId);
  }

  // ── Tesorería interna (registro, no ejecuta movimiento real de fondos) ──
  async function requestTransfer({ fromOrgId, toOrgId, direction, currency, amount, note, requestedBy }) {
    const link =
      (await HierarchyLink.findLink(fromOrgId, toOrgId)) || (await HierarchyLink.findLink(toOrgId, fromOrgId));
    if (!link) throw err('Sólo puedes transferir entre organizaciones vinculadas en tu jerarquía.', 'NOT_LINKED', 403);

    const parentOrgId = link.parent_org_id;
    const { config } = await requireHierarchyPlan(parentOrgId);
    if (!config.treasuryTransfers) throw err('Tu plan no incluye tesorería interna.', 'PLAN_NO_TREASURY', 403);

    return TreasuryTransfer.create({ fromOrgId, toOrgId, direction, currency, amount, note, requestedBy });
  }

  async function approveTransfer(transferId, approvedBy) {
    const transfer = await TreasuryTransfer.approve(transferId, approvedBy);
    if (!transfer) throw err('Transferencia no encontrada o ya procesada.', 'NO_TRANSFER', 404);
    return transfer;
  }

  async function rejectTransfer(transferId) {
    const transfer = await TreasuryTransfer.reject(transferId);
    if (!transfer) throw err('Transferencia no encontrada o ya procesada.', 'NO_TRANSFER', 404);
    return transfer;
  }

  async function settleTransfer(transferId, settlementRef) {
    const transfer = await TreasuryTransfer.settle(transferId, settlementRef);
    if (!transfer) throw err('Transferencia no encontrada o no está aprobada.', 'NO_TRANSFER', 404);
    return transfer;
  }

  async function listTransfers(orgId) {
    return TreasuryTransfer.listForOrg(orgId);
  }

  // ── Agregación de datos de toda la jerarquía (rollup para el padre) ─────
  async function getHierarchyAggregate(orgId, opts = {}) {
    const { config } = await requireHierarchyPlan(orgId);
    if (!config.dataAggregation) throw err('Tu plan no incluye agregación de datos.', 'PLAN_NO_AGGREGATION', 403);

    const descendants = await HierarchyLink.listDescendants(orgId, { maxDepth: config.cascadeDepth + 2 });
    const orgIds = [orgId, ...descendants.map((d) => d.orgId)];
    const events = await ValidationEvent.aggregateBySubjects(orgIds, opts);
    return { orgId, descendants: descendants.length, orgIds, events };
  }

  return {
    CASCADE_DECAY,
    MAX_CASCADE_LEVELS,
    PLATFORM_FEE_BPS,
    MAX_CASCADE_BPS,
    MAX_TOTAL_BURDEN_BPS,
    linkSubordinate,
    unlinkSubordinate,
    listSubordinates,
    resolveAncestorChain,
    checkPolicies,
    recordValidation,
    getLedger,
    getLedgerSummary,
    settleLedgerEntry,
    createPolicy,
    listPolicies,
    revokePolicy,
    requestTransfer,
    approveTransfer,
    rejectTransfer,
    settleTransfer,
    listTransfers,
    getHierarchyAggregate,
    requireHierarchyPlan,
  };
}

const _default = createCommissionEngine();

module.exports = { createCommissionEngine, ..._default };
