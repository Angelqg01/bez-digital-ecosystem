'use strict';

/**
 * E2E: BZ CargoLink full shipment lifecycle
 *
 * Scenario 1 — Complete POS → DELIVERED journey with signed webhook fan-out
 *              and BEZ escrow release on delivery.
 *
 *   POS ─► CREATED ─► CUSTOMS_CLEARED ─► STOWED ─► DEPARTED ─► IN_TRANSIT ─► DELIVERED
 *   (pos)   (pos)       (customs)       (carrier) (carrier)  (logistics)   (lastmile)
 *
 * Scenario 2 — IoT cold-chain breach fires ON_COLD_CHAIN_BREACH webhook
 *              via the same signed fan-out mechanism.
 *
 * Scenario 3 — POS sync idempotency: second sync run skips already-imported
 *              orders; no duplicate B-UIDs created.
 *
 * These tests use mock DB (no live Postgres needed) to verify the full
 * actor-sequence, validator logic, and webhook delivery end-to-end.
 */

const express = require('express');
const request = require('supertest');

// ─── Mock DB (same mock pool used by all cargolink services) ──────────────────
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

// ─── Mock Redis (not used by cargolink but imported transitively) ─────────────
jest.mock('../../cache/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(true),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue('OK'),
  publish: jest.fn().mockResolvedValue(1),
  checkRateLimit: jest.fn().mockResolvedValue(false),
}));

// ─── Stub heavyweight services not relevant to cargolink ─────────────────────
jest.mock('../../services/eventListener', () => ({ startListening: jest.fn().mockResolvedValue(true) }));
jest.mock('../../services/gasMonitor',    () => ({ startDaemon: jest.fn() }));
jest.mock('../../services/contractService', () => ({
  getContract: jest.fn(), getSignedContract: jest.fn(), getAllAddresses: jest.fn(),
  getContractAddress: jest.fn(), loadABI: jest.fn().mockReturnValue([]),
  getBlockchainStats: jest.fn(), getBEZTotalSupply: jest.fn(),
}));
jest.mock('../../services/txService',     () => ({ watchTx: jest.fn(), getRecentTxs: jest.fn() }));
jest.mock('../../services/walletService', () => ({
  createSmartWallet: jest.fn(), getUserWallets: jest.fn().mockResolvedValue([]),
  getBalance: jest.fn(), ensureFiatSafeWalletForUser: jest.fn(),
}));
jest.mock('../../services/aegisService', () => ({ processTelemetryAndTokenize: jest.fn() }));
jest.mock('../../services/agentService',  () => ({
  listAgents: jest.fn(), getAgentMetrics: jest.fn(), invokeMCPTool: jest.fn(),
  listMCPTools: jest.fn(), getAgentAnalytics: jest.fn(), getBEZTokenData: jest.fn(),
}));
jest.mock('stripe', () => jest.fn(() => ({ webhooks: { constructEvent: jest.fn() } })), { virtual: true });
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));

const cargoLinkRoutes = require('../../routes/cargolink');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cargolink', cargoLinkRoutes);
  return app;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Queue: resolveIdentity SELECT (1 query) */
function seedKey(role, bezhasId) {
  mockQuery.mockResolvedValueOnce({ rows: [{ bezhas_id: bezhasId, role, status: 'active' }], rowCount: 1 });
}

/** Queue: SELECT webhooks + INSERT delivery + UPDATE delivery (3 queries) */
function seedWebhookFanout(hookOverrides = {}) {
  const hook = {
    id: 1,
    url: 'https://pos.acme.com/hook',
    events: [],           // empty = receive all events
    secret: 'wh_s3cr3t',
    ...hookOverrides,
  };
  mockQuery
    .mockResolvedValueOnce({ rows: [hook], rowCount: 1 })  // SELECT webhooks
    .mockResolvedValueOnce({ rows: [{ id: 99 }], rowCount: 1 }) // INSERT delivery
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });     // UPDATE delivery
}

/** Full reset between steps inside a single `it` block. */
function reset() {
  jest.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
}

/** Build a transaction fixture for a given status. */
function tx(status, escrow = 'LOCKED') {
  return {
    b_uid: 'BZ-E2E-ALPHA',
    owner_bezhas_id: 'BZ_POS_001',
    status,
    pos_ref: 'SALE-001',
    cargo: {},
    escrow_status: escrow,
    escrow_amount_bez: 100,
    escrow_token: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
const APP = createApp();

describe('E2E: BZ CargoLink full shipment lifecycle', () => {
  beforeEach(reset);

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 1: full 6-state lifecycle with real validators, HMAC webhooks,
  // BEZ escrow release, and idempotency guard on terminal state.
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 1 — POS→CUSTOMS→CARRIER→LOGISTICS→LASTMILE + webhooks + escrow release', async () => {
    // ── 1. POS creates transaction (BEZ escrow locked) ─────────────────────
    seedKey('pos', 'BZ_POS_001');
    mockQuery
      .mockResolvedValueOnce({ rows: [tx('CREATED')], rowCount: 1 }) // INSERT tx
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });              // INSERT transition
    seedWebhookFanout(); // ON_TRANSACTION_CREATED

    const r1 = await request(APP)
      .post('/api/cargolink/v1/tx')
      .set('Authorization', 'Bearer pos_key')
      .send({ posRef: 'SALE-001', destination: 'Valencia', escrowAmountBez: 100, cargo: { weight: 450 } });

    expect(r1.status).toBe(201);
    expect(r1.body.transaction.b_uid).toBe('BZ-E2E-ALPHA');
    expect(r1.body.transaction.escrow_status).toBe('LOCKED');
    // BEZ Token V1 (Polygon) must be the settlement currency
    expect(r1.body.transaction.escrow_token).toBe('0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://pos.acme.com/hook',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-BeZhas-Event': 'ON_TRANSACTION_CREATED' }) }),
    );

    // ── 2. Customs → CUSTOMS_CLEARED (GREEN_LANE, 4% duty) ─────────────────
    reset();
    seedKey('customs', 'BZ_CUS_001');
    mockQuery
      .mockResolvedValueOnce({ rows: [tx('CREATED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [tx('CUSTOMS_CLEARED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // INSERT transition
    seedWebhookFanout(); // ON_CUSTOMS_CLEARED

    const r2 = await request(APP)
      .post('/api/cargolink/v1/tx/BZ-E2E-ALPHA/advance')
      .set('Authorization', 'Bearer customs_key')
      .send({ payload: { manifestId: 'MAN-ALPHA-01', declaredValue: 8500, hsCode: '8471' } });

    expect(r2.status).toBe(200);
    expect(r2.body.transition).toMatchObject({ from: 'CREATED', to: 'CUSTOMS_CLEARED', role: 'customs' });
    expect(r2.body.validation.result.lane).toBe('GREEN_LANE');
    expect(r2.body.validation.result.dutyEstimate).toBe(340); // 8500 × 0.04
    expect(r2.body.validation.result.inspectionRequired).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://pos.acme.com/hook',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-BeZhas-Event': 'ON_CUSTOMS_CLEARED',
          'X-BeZhas-Signature': expect.stringMatching(/^sha256=/),
        }),
      }),
    );

    // ── 3. Carrier → STOWED (balanced COG verified) ─────────────────────────
    reset();
    seedKey('carrier', 'BZ_CAR_001');
    mockQuery
      .mockResolvedValueOnce({ rows: [tx('CUSTOMS_CLEARED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [tx('STOWED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedWebhookFanout(); // ON_STOWAGE_COMPLETE

    const r3 = await request(APP)
      .post('/api/cargolink/v1/tx/BZ-E2E-ALPHA/advance')
      .set('Authorization', 'Bearer carrier_key')
      .send({ payload: {
        container: { length: 12, width: 2.4 },
        items: [
          { x: 5, y: 1.0, weight: 225 }, // symmetrically balanced
          { x: 7, y: 1.4, weight: 225 },
        ],
      }});

    expect(r3.status).toBe(200);
    expect(r3.body.transition).toMatchObject({ from: 'CUSTOMS_CLEARED', to: 'STOWED', role: 'carrier' });
    expect(r3.body.validation.result.status).toBe('VERIFIED');
    expect(r3.body.validation.result.cog.x).toBe(6);   // (5×225 + 7×225) / 450
    expect(r3.body.validation.result.totalWeight).toBe(450);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://pos.acme.com/hook',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-BeZhas-Event': 'ON_STOWAGE_COMPLETE' }) }),
    );

    // ── 4. Carrier → DEPARTED (vessel + voyage required) ────────────────────
    reset();
    seedKey('carrier', 'BZ_CAR_001');
    mockQuery
      .mockResolvedValueOnce({ rows: [tx('STOWED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [tx('DEPARTED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedWebhookFanout(); // ON_VESSEL_DEPARTURE

    const r4 = await request(APP)
      .post('/api/cargolink/v1/tx/BZ-E2E-ALPHA/advance')
      .set('Authorization', 'Bearer carrier_key')
      .send({ payload: { vessel: 'MSC VALENTINA', voyage: 'AG241W', departurePort: 'ESALG' } });

    expect(r4.status).toBe(200);
    expect(r4.body.transition).toMatchObject({ from: 'STOWED', to: 'DEPARTED', role: 'carrier' });
    expect(r4.body.validation.result.vessel).toBe('MSC VALENTINA');
    expect(r4.body.validation.result.voyage).toBe('AG241W');
    expect(r4.body.validation.result.departurePort).toBe('ESALG');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://pos.acme.com/hook',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-BeZhas-Event': 'ON_VESSEL_DEPARTURE' }) }),
    );

    // ── 5. Logistics → IN_TRANSIT (trackingRef required) ────────────────────
    reset();
    seedKey('logistics', 'BZ_LOG_001');
    mockQuery
      .mockResolvedValueOnce({ rows: [tx('DEPARTED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [tx('IN_TRANSIT')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedWebhookFanout(); // ON_IN_TRANSIT

    const r5 = await request(APP)
      .post('/api/cargolink/v1/tx/BZ-E2E-ALPHA/advance')
      .set('Authorization', 'Bearer logistics_key')
      .send({ payload: { trackingRef: 'TRK-ALPHA-2024', carrier: 'DHL Express' } });

    expect(r5.status).toBe(200);
    expect(r5.body.transition).toMatchObject({ from: 'DEPARTED', to: 'IN_TRANSIT', role: 'logistics' });
    expect(r5.body.validation.result.routeId).toBe('TRK-ALPHA-2024');
    expect(r5.body.validation.result.carrier).toBe('DHL Express');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://pos.acme.com/hook',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-BeZhas-Event': 'ON_IN_TRANSIT' }) }),
    );

    // ── 6. Lastmile → DELIVERED (GPS proof + BEZ escrow released) ───────────
    reset();
    seedKey('lastmile', 'BZ_LM_001');
    mockQuery
      .mockResolvedValueOnce({ rows: [tx('IN_TRANSIT', 'LOCKED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [tx('DELIVERED', 'RELEASED')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedWebhookFanout(); // ON_DELIVERY_PROOF

    const r6 = await request(APP)
      .post('/api/cargolink/v1/tx/BZ-E2E-ALPHA/advance')
      .set('Authorization', 'Bearer lastmile_key')
      .send({ payload: { lat: 39.4699, lng: -0.3763, geoVerified: true } });

    expect(r6.status).toBe(200);
    expect(r6.body.transition).toMatchObject({ from: 'IN_TRANSIT', to: 'DELIVERED', role: 'lastmile' });
    expect(r6.body.validation.result.proof).toBe('GEO');
    expect(r6.body.validation.result.geoVerified).toBe(true);
    expect(r6.body.validation.result.geo).toMatchObject({ lat: 39.4699, lng: -0.3763 });
    expect(r6.body.escrowReleased).toBe(true);
    expect(r6.body.transaction.escrow_status).toBe('RELEASED');
    // ON_DELIVERY_PROOF must be delivered to the POS webhook
    expect(global.fetch).toHaveBeenCalledWith(
      'https://pos.acme.com/hook',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-BeZhas-Event': 'ON_DELIVERY_PROOF',
          'X-BeZhas-Signature': expect.stringMatching(/^sha256=/),
        }),
      }),
    );

    // ── 7. Read-back: full audit trail visible to the POS ───────────────────
    reset();
    seedKey('pos', 'BZ_POS_001');
    mockQuery
      .mockResolvedValueOnce({ rows: [tx('DELIVERED', 'RELEASED')], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          { from_status: null,              to_status: 'CREATED',         role: 'pos',      actor_bezhas_id: 'BZ_POS_001', payload_hash: '0xaaa', created_at: '2024-01-01T00:00:00Z' },
          { from_status: 'CREATED',         to_status: 'CUSTOMS_CLEARED', role: 'customs',  actor_bezhas_id: 'BZ_CUS_001', payload_hash: '0xbbb', created_at: '2024-01-01T01:00:00Z' },
          { from_status: 'CUSTOMS_CLEARED', to_status: 'STOWED',          role: 'carrier',  actor_bezhas_id: 'BZ_CAR_001', payload_hash: '0xccc', created_at: '2024-01-01T02:00:00Z' },
          { from_status: 'STOWED',          to_status: 'DEPARTED',        role: 'carrier',  actor_bezhas_id: 'BZ_CAR_001', payload_hash: '0xddd', created_at: '2024-01-01T03:00:00Z' },
          { from_status: 'DEPARTED',        to_status: 'IN_TRANSIT',      role: 'logistics', actor_bezhas_id: 'BZ_LOG_001', payload_hash: '0xeee', created_at: '2024-01-01T04:00:00Z' },
          { from_status: 'IN_TRANSIT',      to_status: 'DELIVERED',       role: 'lastmile', actor_bezhas_id: 'BZ_LM_001',  payload_hash: '0xfff', created_at: '2024-01-01T05:00:00Z' },
        ],
        rowCount: 6,
      });

    const r7 = await request(APP)
      .get('/api/cargolink/v1/tx/BZ-E2E-ALPHA')
      .set('Authorization', 'Bearer pos_key');

    expect(r7.status).toBe(200);
    expect(r7.body.transaction.status).toBe('DELIVERED');
    expect(r7.body.transaction.escrow_status).toBe('RELEASED');
    expect(r7.body.history).toHaveLength(6);
    expect(r7.body.history[0]).toMatchObject({ to_status: 'CREATED',   role: 'pos' });
    expect(r7.body.history[1]).toMatchObject({ to_status: 'CUSTOMS_CLEARED', role: 'customs' });
    expect(r7.body.history[4]).toMatchObject({ to_status: 'IN_TRANSIT', role: 'logistics' });
    expect(r7.body.history[5]).toMatchObject({ to_status: 'DELIVERED',  role: 'lastmile' });
    expect(r7.body.viewerRole).toBe('pos');

    // ── 8. Terminal state guard — can't advance past DELIVERED ───────────────
    reset();
    seedKey('lastmile', 'BZ_LM_001');
    mockQuery.mockResolvedValueOnce({ rows: [tx('DELIVERED', 'RELEASED')], rowCount: 1 });

    const r8 = await request(APP)
      .post('/api/cargolink/v1/tx/BZ-E2E-ALPHA/advance')
      .set('Authorization', 'Bearer lastmile_key')
      .send({ payload: { lat: 39.4699, lng: -0.3763 } });

    expect(r8.status).toBe(409);
    expect(r8.body.error).toMatch(/already DELIVERED/);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 2: IoT device detects cold-chain breach → ON_COLD_CHAIN_BREACH
  // webhook delivered to the POS subscriber with HMAC signature.
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 2 — IoT cold-chain breach fans out ON_COLD_CHAIN_BREACH to POS webhook', async () => {
    // Device resolveDevice (authenticated with bzd_ key)
    mockQuery.mockResolvedValueOnce({
      rows: [{
        device_id: 'dev_freezer_01',
        bezhas_id: 'BZ_POS_001',
        type: 'temp',
        b_uid: 'BZ-IOT-BETA',
        config: { tempMin: 2, tempMax: 8, shockMax: 5 },
        status: 'active',
      }],
      rowCount: 1,
    });
    // SELECT transacción asociada al B-UID → ninguna: la telemetría llega suelta,
    // sin envío vinculado, así que el oráculo no abre expediente de disputa.
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // SELECT geocercas aplicables → ninguna
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // INSERT telemetry row (breach = true, 12°C violates [2,8])
    // 12°C se desvía 4 grados del máximo: el oráculo lo gradúa como Leve y el
    // evento resultante es ON_COLD_CHAIN_BREACH. Con una desviación mayor que 5
    // el incidente escala a ON_DISPUTE_OPENED — ese caso va en el test siguiente.
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 5, metric: 'temperature', value: 12, unit: '°C',
        breach: true, reason: 'temperature 12°C outside [2,8]',
      }],
      rowCount: 1,
    });
    // fanoutWebhooks: SELECT webhooks subscribed to ON_COLD_CHAIN_BREACH
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, url: 'https://pos.acme.com/hook', events: ['ON_COLD_CHAIN_BREACH'], secret: 'wh_s3cr3t' }],
      rowCount: 1,
    });
    // INSERT delivery + UPDATE delivery
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 20 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(APP)
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bzd_freeze_key')
      .send({ temperature: 12, bUid: 'BZ-IOT-BETA' });

    expect(res.status).toBe(200);
    expect(res.body.deviceId).toBe('dev_freezer_01');
    expect(res.body.bUid).toBe('BZ-IOT-BETA');
    expect(res.body.stored).toBe(1);
    // La fila persistida se devuelve tal cual: con la secuencia de mocks
    // desalineada esto era `undefined` y el test seguía en verde.
    expect(res.body.readings[0]).toMatchObject({ id: 5, metric: 'temperature', value: 12, breach: true });
    expect(res.body.breaches).toHaveLength(1);
    expect(res.body.breaches[0]).toMatchObject({
      metric: 'temperature',
      reason: expect.stringContaining('12'),
    });
    // El oráculo lo gradúa como Leve: notifica, pero no abre disputa.
    expect(res.body.verdict).toMatchObject({ severity: 1, webhookEvent: 'ON_COLD_CHAIN_BREACH' });
    // Exactly one webhook delivery (the POS subscriber)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://pos.acme.com/hook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-BeZhas-Event': 'ON_COLD_CHAIN_BREACH',
          'X-BeZhas-Signature': expect.stringMatching(/^sha256=/),
        }),
      }),
    );
    // Delivery logged in response
    expect(res.body.webhookDeliveries).toHaveLength(1);
    expect(res.body.webhookDeliveries[0]).toMatchObject({
      url: 'https://pos.acme.com/hook',
      status: 'delivered',
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 2b — La misma rotura, pero grave, escala a disputa.
  //
  // El oráculo de severidad (cargoDisputeOracle) gradúa la desviación térmica:
  //   ≤ 5 grados → Leve     → ON_COLD_CHAIN_BREACH  (escenario anterior)
  //   > 5 grados → Moderado → ON_DISPUTE_OPENED     (este)
  //
  // La frontera importa: un suscriptor apuntado solo a ON_COLD_CHAIN_BREACH
  // NO debe recibir la rotura grave, porque esa va por el canal de disputas.
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 2b — una rotura grave escala a ON_DISPUTE_OPENED y no llega al suscriptor de frío', async () => {
    // resolveDevice
    mockQuery.mockResolvedValueOnce({
      rows: [{
        device_id: 'dev_freezer_01',
        bezhas_id: 'BZ_POS_001',
        type: 'temp',
        b_uid: 'BZ-IOT-BETA',
        config: { tempMin: 2, tempMax: 8, shockMax: 5 },
        status: 'active',
      }],
      rowCount: 1,
    });
    // SELECT transacción asociada → ninguna · SELECT geocercas → ninguna
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // INSERT telemetry (14°C = 6 grados por encima del máximo → Moderado)
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 6, metric: 'temperature', value: 14, unit: '°C',
        breach: true, reason: 'temperature 14°C outside [2,8]',
      }],
      rowCount: 1,
    });
    // fanoutWebhooks: el único hook está suscrito solo al evento de frío
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, url: 'https://pos.acme.com/hook', events: ['ON_COLD_CHAIN_BREACH'], secret: 'wh_s3cr3t' }],
      rowCount: 1,
    });

    const res = await request(APP)
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bzd_freeze_key')
      .send({ temperature: 14, bUid: 'BZ-IOT-BETA' });

    expect(res.status).toBe(200);
    expect(res.body.breaches).toHaveLength(1);
    expect(res.body.verdict).toMatchObject({ severity: 2, webhookEvent: 'ON_DISPUTE_OPENED' });
    // El suscriptor de frío queda fuera: ni entrega ni llamada HTTP.
    expect(res.body.webhookDeliveries).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 3: POS sync is idempotent.
  //   First run  → 2 new orders → 2 B-UIDs created.
  //   Second run → same orders → duplicate key → 0 created, 2 skipped.
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 3 — POS sync idempotency: second run skips existing orders', async () => {
    const ORDERS = {
      orders: [
        { id: 'POS-301', destination: 'Barcelona', weight: 15 },
        { id: 'POS-302', destination: 'Bilbao',    weight: 8 },
      ],
    };
    const POS_LINK_ROW = {
      bezhas_id: 'BZ_POS_001', provider: 'shopify',
      base_url: 'https://shop.acme.com', orders_path: '/orders',
      api_key: 'sk_shopify', status: 'active',
    };

    // ── First sync: both orders are new ────────────────────────────────────
    seedKey('pos', 'BZ_POS_001');
    mockQuery.mockResolvedValueOnce({ rows: [POS_LINK_ROW], rowCount: 1 }); // SELECT pos_link
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ORDERS,
    });

    // POS-301: INSERT tx → RETURNING, INSERT transition, SELECT webhooks (none)
    mockQuery
      .mockResolvedValueOnce({ rows: [{ b_uid: 'BZ-LOG-P301', owner_bezhas_id: 'BZ_POS_001', status: 'CREATED', escrow_status: 'NONE' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // INSERT transition
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT webhooks
    // POS-302: same
    mockQuery
      .mockResolvedValueOnce({ rows: [{ b_uid: 'BZ-LOG-P302', owner_bezhas_id: 'BZ_POS_001', status: 'CREATED', escrow_status: 'NONE' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_sync_at

    const sync1 = await request(APP)
      .post('/api/cargolink/v1/pos/sync')
      .set('Authorization', 'Bearer pos_key')
      .send({});

    expect(sync1.status).toBe(200);
    expect(sync1.body.pulled).toBe(2);
    expect(sync1.body.created).toHaveLength(2);
    expect(sync1.body.created[0]).toMatchObject({ posRef: 'POS-301', bUid: 'BZ-LOG-P301' });
    expect(sync1.body.created[1]).toMatchObject({ posRef: 'POS-302', bUid: 'BZ-LOG-P302' });
    expect(sync1.body.skipped).toHaveLength(0);

    // ── Second sync: same orders → duplicate key → idempotent skip ─────────
    reset();
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ORDERS,
    });

    seedKey('pos', 'BZ_POS_001');
    mockQuery.mockResolvedValueOnce({ rows: [POS_LINK_ROW], rowCount: 1 }); // SELECT pos_link
    // Both INSERT tx calls throw the PostgreSQL duplicate key error
    mockQuery.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "uq_cargolink_tx_owner_posref"'),
    );
    mockQuery.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "uq_cargolink_tx_owner_posref"'),
    );
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_sync_at (created=0)

    const sync2 = await request(APP)
      .post('/api/cargolink/v1/pos/sync')
      .set('Authorization', 'Bearer pos_key')
      .send({});

    expect(sync2.status).toBe(200);
    expect(sync2.body.pulled).toBe(2);
    expect(sync2.body.created).toHaveLength(0);
    expect(sync2.body.skipped).toEqual(['POS-301', 'POS-302']);
  });
});
