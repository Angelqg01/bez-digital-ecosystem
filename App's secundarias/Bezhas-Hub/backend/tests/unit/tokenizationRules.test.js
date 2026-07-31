/**
 * Motor de reglas de tokenización. Sin BD ni red: modelos y almacén inyectados.
 */
const { createTokenizationRules } = require('../../services/tokenizationRules.service');
const { getTokenizationConfig } = require('../../config/plans');

function build(plan = 'business', overrides = {}) {
  const created = [];
  const store = {
    create: jest.fn(async (i) => { created.push(i); return i; }),
    listByOrg: jest.fn(async () => created),
    countInPeriod: jest.fn(async () => overrides.used ?? 0),
    markMinted: jest.fn(async (id, tx) => ({ id, status: 'minted', txHash: tx })),
  };
  const meter = { record: jest.fn(async () => {}) };
  const engine = createTokenizationRules({
    getTokenizationConfig,
    Organization: { findById: jest.fn(async () => (plan ? { id: 'org-1', plan } : null)) },
    IntentStore: store, UsageMeter: meter,
    logger: { info: () => {}, warn: () => {} },
  });
  return { engine, store, meter, created };
}

const SHIPMENT = { orgId: 'org-1', externalRef: 'ORD-1', assetType: 'shipment', value: 25000, currency: 'EUR' };

describe('getTokenizationConfig — derechos por plan', () => {
  test('starter: habilitado, sin cuota, extra medido, sin automatismo', () => {
    expect(getTokenizationConfig('starter')).toEqual({
      enabled: true, included: 0, overageEUR: 2.5, auto: false, unlimited: false,
    });
  });
  test('business activa la tokenización automática', () => {
    expect(getTokenizationConfig('business')).toMatchObject({ included: 250, auto: true });
  });
  test('enterprise_vip es ilimitado y sin coste por activo', () => {
    expect(getTokenizationConfig('enterprise_vip')).toMatchObject({ unlimited: true, overageEUR: 0, auto: true });
  });
});

describe('evaluate — coincidencia de reglas', () => {
  const { engine } = build();
  test('un envío de alto valor dispara la regla de carga', () => {
    expect(engine.evaluate(SHIPMENT).map((r) => r.id)).toContain('freight-high-value');
  });
  test('por debajo del umbral no dispara', () => {
    expect(engine.evaluate({ ...SHIPMENT, value: 500 })).toHaveLength(0);
  });
  test('el crédito de carbono exige verificación de oráculo', () => {
    const ev = { assetType: 'carbon_credit' };
    expect(engine.evaluate(ev)).toHaveLength(0);
    expect(engine.evaluate({ ...ev, oracleVerified: true }).map((r) => r.id)).toContain('carbon-credit');
  });
});

describe('onAssetEvent — gate de plan y cuota', () => {
  test('crea una intención lista para firmar en un plan con automatismo', async () => {
    const { engine, store } = build('business');
    const out = await engine.onAssetEvent(SHIPMENT);
    expect(out.intents).toHaveLength(1);
    expect(out.intents[0]).toMatchObject({
      contract: 'BeZhasLogisticsNFT', standard: 'ERC-721', status: 'ready', billable: false,
    });
    expect(store.create).toHaveBeenCalled();
  });

  test('sin automatismo (creator_pro) la intención queda pendiente de aprobación', async () => {
    const { engine } = build('creator_pro');
    const out = await engine.onAssetEvent(SHIPMENT);
    expect(out.intents[0].status).toBe('pending_approval');
  });

  test('NUNCA acuña on-chain por su cuenta: no hay txHash hasta liquidar', async () => {
    const { engine } = build('enterprise_vip');
    const out = await engine.onAssetEvent(SHIPMENT);
    expect(out.intents[0].txHash).toBeUndefined();
    expect(out.intents[0].status).not.toBe('minted');
  });

  test('superada la cuota, el activo se factura como extra y se mide', async () => {
    const { engine, meter } = build('business', { used: 250 });
    const out = await engine.onAssetEvent(SHIPMENT);
    expect(out.overQuota).toBe(true);
    expect(out.intents[0]).toMatchObject({ billable: true, overageEUR: 1.2 });
    expect(meter.record).toHaveBeenCalledWith(expect.objectContaining({
      unit: 'asset_tokenization', quantity: 1, amountEUR: 1.2,
    }));
  });

  test('enterprise_vip es ilimitado: nunca factura extra', async () => {
    const { engine, meter } = build('enterprise_vip', { used: 9999 });
    const out = await engine.onAssetEvent(SHIPMENT);
    expect(out.overQuota).toBe(false);
    expect(meter.record).not.toHaveBeenCalled();
  });

  test('rechaza si el plan no incluye tokenización', async () => {
    const { engine } = build('plan-inventado');
    await expect(engine.onAssetEvent(SHIPMENT)).rejects.toMatchObject({ code: 'PLAN_NO_TOKENIZATION' });
  });

  test('exige externalRef para ser idempotente', async () => {
    const { engine } = build();
    await expect(engine.onAssetEvent({ orgId: 'org-1', assetType: 'shipment' }))
      .rejects.toMatchObject({ code: 'NO_REF' });
  });

  test('la intención lleva un id determinista (misma entrada → mismo id)', async () => {
    const a = build('business'), b = build('business');
    const r1 = await a.engine.onAssetEvent(SHIPMENT);
    const r2 = await b.engine.onAssetEvent(SHIPMENT);
    expect(r1.intents[0].id).toBe(r2.intents[0].id);
  });

  test('sin regla coincidente no crea nada', async () => {
    const { engine, store } = build('business');
    const out = await engine.onAssetEvent({ ...SHIPMENT, assetType: 'desconocido' });
    expect(out.intents).toHaveLength(0);
    expect(store.create).not.toHaveBeenCalled();
  });
});

describe('settleIntent — ejecución on-chain explícita', () => {
  test('marca la intención como acuñada con su txHash', async () => {
    const { engine } = build('business');
    const i = await engine.settleIntent('ti_x', '0xabc');
    expect(i).toMatchObject({ status: 'minted', txHash: '0xabc' });
  });
});

describe('attachToPaymentEvents — enganche al bus de pagos', () => {
  test('se suscribe a client.provisioned y payment.processed', () => {
    const { engine } = build();
    const on = jest.fn();
    expect(engine.attachToPaymentEvents({ on })).toBe(true);
    expect(on.mock.calls.map((c) => c[0])).toEqual(['client.provisioned', 'payment.processed']);
  });
  test('sin bus válido degrada sin romper', () => {
    const { engine } = build();
    expect(engine.attachToPaymentEvents(null)).toBe(false);
  });
});
