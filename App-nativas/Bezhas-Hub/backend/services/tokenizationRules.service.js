/**
 * tokenizationRules — motor de reglas que convierte HECHOS DE NEGOCIO en
 * intenciones de tokenización, sin intervención humana.
 *
 * Flujo completo:
 *   webhook entrante / conector ERP  →  evento normalizado
 *      → gate de plan (¿tiene tokenización? ¿cuota? ¿auto?)
 *      → evaluación de reglas
 *      → INTENCIÓN de tokenización (+ registro de uso para facturar el extra)
 *      → el firmante on-chain la ejecuta y la marca como acuñada
 *
 * DECISIÓN DE SEGURIDAD DELIBERADA: este motor **no acuña tokens on-chain**.
 * Produce una intención auditable. Acuñar es irreversible y mueve valor real:
 * un fallo de regla o un webhook falsificado no puede desembocar en un mint
 * automático. La ejecución on-chain es un paso separado y explícito
 * (ver `settleIntent`), igual que hicimos con las transferencias de tesorería.
 *
 * Construido con `createTokenizationRules({...})` para testear sin BD ni red.
 */
const DEFAULT_RULES = [
  {
    id: 'freight-high-value',
    description: 'Envío de alto valor → NFT de carga con escrow',
    when: { assetType: 'shipment', minValue: 10000, currency: 'EUR' },
    then: { contract: 'BeZhasLogisticsNFT', standard: 'ERC-721', escrow: true },
  },
  {
    id: 'energy-cae',
    description: 'Certificado de ahorro energético → token CAE',
    when: { assetType: 'energy_certificate' },
    then: { contract: 'EnergyCAEToken', standard: 'ERC-20' },
  },
  {
    id: 'carbon-credit',
    description: 'Crédito de carbono verificado → token de carbono',
    when: { assetType: 'carbon_credit', requiresOracle: true },
    then: { contract: 'CarbonCreditToken', standard: 'ERC-20' },
  },
  {
    id: 'material-lot',
    description: 'Lote de materia prima en MRP → token de material',
    when: { assetType: 'material_lot', minValue: 1000 },
    then: { contract: 'MaterialTokenMRP', standard: 'ERC-1155' },
  },
];

function createTokenizationRules({
  getTokenizationConfig,
  Organization,
  IntentStore,
  UsageMeter,
  rules,
  logger,
} = {}) {
  if (!getTokenizationConfig) ({ getTokenizationConfig } = require('../config/plans'));
  if (!Organization) Organization = require('../models/pg/Organization');
  if (!logger) logger = console;
  const RULES = rules || DEFAULT_RULES;

  // Almacén en memoria por defecto (los tests inyectan el suyo; en producción
  // se inyecta uno respaldado por Postgres).
  const memIntents = [];
  const store = IntentStore || {
    async create(intent) { memIntents.push(intent); return intent; },
    async listByOrg(orgId) { return memIntents.filter((i) => i.orgId === orgId); },
    async countInPeriod(orgId) { return memIntents.filter((i) => i.orgId === orgId).length; },
    async markMinted(id, txHash) {
      const i = memIntents.find((x) => x.id === id);
      if (i) { i.status = 'minted'; i.txHash = txHash; }
      return i || null;
    },
  };
  const meter = UsageMeter || { async record() { /* no-op por defecto */ } };

  function err(message, code, status = 400) {
    const e = new Error(message); e.code = code; e.status = status; return e;
  }

  /** ¿El evento cumple la condición de la regla? */
  function matches(rule, event) {
    const w = rule.when || {};
    if (w.assetType && w.assetType !== event.assetType) return false;
    if (w.currency && event.currency && w.currency !== event.currency) return false;
    if (typeof w.minValue === 'number' && !(Number(event.value) >= w.minValue)) return false;
    if (w.requiresOracle && !event.oracleVerified) return false;
    if (w.source && w.source !== event.source) return false;
    return true;
  }

  function evaluate(event) {
    return RULES.filter((r) => matches(r, event));
  }

  /**
   * Punto de entrada: un evento de activo normalizado (venga de un webhook,
   * de un conector ERP o de una llamada directa del cliente).
   */
  async function onAssetEvent(event = {}) {
    if (!event.orgId) throw err('orgId es obligatorio.', 'NO_ORG');
    if (!event.assetType) throw err('assetType es obligatorio.', 'NO_ASSET_TYPE');
    if (!event.externalRef) throw err('externalRef es obligatorio (idempotencia).', 'NO_REF');

    const org = await Organization.findById(event.orgId);
    if (!org) throw err('Organización no encontrada.', 'NO_ORG', 404);

    const cfg = getTokenizationConfig(org.plan);
    if (!cfg) {
      throw err('Tu plan no incluye tokenización de activos.', 'PLAN_NO_TOKENIZATION', 403);
    }

    const matched = evaluate(event);
    if (!matched.length) return { matched: [], intents: [], reason: 'no-rule-matched' };

    // Cuota del plan: lo que exceda se factura como extra (pago por uso).
    const used = await store.countInPeriod(event.orgId);
    const overQuota = !cfg.unlimited && used >= cfg.included;

    const intents = [];
    for (const rule of matched) {
      const intent = {
        id: `ti_${event.orgId}_${event.externalRef}_${rule.id}`,
        orgId: event.orgId,
        externalRef: event.externalRef,
        ruleId: rule.id,
        assetType: event.assetType,
        value: event.value ?? null,
        currency: event.currency ?? null,
        contract: rule.then.contract,
        standard: rule.then.standard,
        // `auto` decide si queda lista para firmar o espera aprobación humana.
        status: cfg.auto ? 'ready' : 'pending_approval',
        billable: overQuota,
        overageEUR: overQuota ? cfg.overageEUR : 0,
        metadata: event.metadata || {},
      };
      await store.create(intent);
      if (overQuota) {
        await meter.record({
          orgId: event.orgId, unit: 'asset_tokenization',
          quantity: 1, amountEUR: cfg.overageEUR, ref: intent.id,
        });
      }
      intents.push(intent);
    }
    return { matched: matched.map((r) => r.id), intents, overQuota };
  }

  /** Marca una intención como acuñada tras ejecutarla on-chain. */
  async function settleIntent(intentId, txHash) {
    const i = await store.markMinted(intentId, txHash);
    if (!i) throw err('Intención de tokenización no encontrada.', 'NO_INTENT', 404);
    return i;
  }

  async function listIntents(orgId) { return store.listByOrg(orgId); }

  /**
   * Engancha el motor al bus de eventos de pago: al confirmarse la suscripción
   * o un pago, la organización queda habilitada y se reprocesan los activos que
   * quedaron esperando por falta de plan.
   */
  function attachToPaymentEvents(bridgeEvents, { onEnabled } = {}) {
    if (!bridgeEvents || typeof bridgeEvents.on !== 'function') return false;
    const handler = async (payload) => {
      try {
        if (onEnabled) await onEnabled(payload);
        logger.info?.({ wallet: payload?.walletAddress, plan: payload?.plan },
          '[Tokenization] cliente habilitado por evento de pago');
      } catch (e) {
        logger.warn?.({ err: e.message }, '[Tokenization] fallo al habilitar tras pago');
      }
    };
    bridgeEvents.on('client.provisioned', handler);
    bridgeEvents.on('payment.processed', handler);
    return true;
  }

  return {
    RULES, evaluate, matches, onAssetEvent, settleIntent, listIntents,
    attachToPaymentEvents, DEFAULT_RULES,
  };
}

const _default = createTokenizationRules();
module.exports = { createTokenizationRules, DEFAULT_RULES, ..._default };
