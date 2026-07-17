const express = require('express');
const request = require('supertest');
const { ethers } = require('ethers');
const { mockQuery } = require('../helpers');

const cargoLinkRoutes = require('../../routes/cargolink');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cargolink', cargoLinkRoutes);
  return app;
}

function seedKey(role, bezhasId = 'BZ_ID_ACME') {
  mockQuery.mockResolvedValueOnce({ rows: [{ bezhas_id: bezhasId, role, status: 'active' }], rowCount: 1 });
}

function seedDevice(overrides = {}) {
  mockQuery.mockResolvedValueOnce({
    rows: [{
      device_id: 'dev_abc', bezhas_id: 'BZ_ID_ACME', type: 'multi',
      b_uid: 'BZ-LOG-AAA', config: { tempMin: 2, tempMax: 8, shockMax: 5 },
      status: 'active', signer_address: null,
      ...overrides,
    }],
    rowCount: 1,
  });
}

function seedTx(overrides = {}) {
  mockQuery.mockResolvedValueOnce({
    rows: [{
      b_uid: 'BZ-LOG-AAA', owner_bezhas_id: 'BZ_ID_ACME', status: 'CREATED',
      escrow_status: 'NONE', escrow_amount_bez: 0, pos_ref: null,
      ...overrides,
    }],
    rowCount: 1,
  });
}

const seedFences = (fences = []) => mockQuery.mockResolvedValueOnce({ rows: fences, rowCount: fences.length });

describe('Routes: /api/cargolink IoT ingestion (v2 unified pipeline)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('registers a device with a signer address and returns the device key once', async () => {
    const wallet = ethers.Wallet.createRandom();
    seedKey('pos');
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, device_id: 'dev_abc', type: 'eseal', b_uid: 'BZ-LOG-AAA', config: {}, label: 'eseal device', status: 'active', signer_address: wallet.address, created_at: 'now' }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/devices')
      .set('Authorization', 'Bearer pos_key')
      .send({ type: 'eseal', bUid: 'BZ-LOG-AAA', signerAddress: wallet.address });

    expect(res.status).toBe(201);
    expect(res.body.device.signer_address).toBe(wallet.address);
    expect(res.body.deviceKey).toMatch(/^bzd_/);
  });

  it('rejects an unknown device type', async () => {
    seedKey('pos');
    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/devices')
      .set('Authorization', 'Bearer pos_key')
      .send({ type: 'sonar' });
    expect(res.status).toBe(400);
  });

  it('ingests a normal reading without a breach (canonical row)', async () => {
    seedDevice();
    seedTx();
    seedFences();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, metric: 'temperature', value: 5, unit: '°C', breach: false, reason: null, event_type: 'READING', tamper: false, trust_level: 'key' }], rowCount: 1 }) // INSERT telemetry
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_seen

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bzd_device_key')
      .send({ temperature: 5 });

    expect(res.status).toBe(200);
    expect(res.body.stored).toBe(1);
    expect(res.body.breaches).toHaveLength(0);
    expect(res.body.dispute).toBeNull();
    expect(res.body.trustLevel).toBe('key');
  });

  it('minor cold-chain breach → ON_COLD_CHAIN_BREACH webhook, escrow untouched', async () => {
    seedDevice();
    seedTx({ escrow_status: 'LOCKED', escrow_amount_bez: 100 });
    seedFences();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2, metric: 'temperature', value: 9.5, breach: true, reason: 'temperature 9.5°C outside [2,8]', event_type: 'COLD_CHAIN_BREACH' }], rowCount: 1 }) // INSERT telemetry
      .mockResolvedValueOnce({ rows: [{ id: 9, url: 'https://acme.com/hook', events: [], secret: 's3cr3t' }], rowCount: 1 }) // fanout SELECT webhooks
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })   // delivery INSERT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })            // delivery UPDATE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });           // UPDATE last_seen

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bzd_device_key')
      .send({ temperature: 9.5 });

    expect(res.status).toBe(200);
    expect(res.body.verdict.severity).toBe(1);
    expect(res.body.verdict.action).toBe('ALERT_ONLY');
    expect(res.body.dispute).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://acme.com/hook',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-BeZhas-Event': 'ON_COLD_CHAIN_BREACH' }) }),
    );
  });

  it('moderate breach with LOCKED escrow → dispute opened and escrow DISPUTED', async () => {
    seedDevice();
    seedTx({ escrow_status: 'LOCKED', escrow_amount_bez: 100 });
    seedFences();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 3, metric: 'temperature', value: 14, breach: true, reason: 'temperature 14°C outside [2,8]', event_type: 'COLD_CHAIN_BREACH' }], rowCount: 1 }) // INSERT telemetry
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })  // UPDATE tx → DISPUTED
      .mockResolvedValueOnce({ rows: [{ id: 7, b_uid: 'BZ-LOG-AAA', severity: 2, action: 'HOLD_ESCROW', status: 'open' }], rowCount: 1 }) // INSERT dispute
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // fanout SELECT webhooks (none)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_seen

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bzd_device_key')
      .send({ temperature: 14 });

    expect(res.status).toBe(200);
    expect(res.body.verdict.severity).toBe(2);
    expect(res.body.verdict.action).toBe('HOLD_ESCROW');
    expect(res.body.dispute).toMatchObject({ id: 7, severity: 2, action: 'HOLD_ESCROW' });
    expect(res.body.verdict.settlement.escrowStatus).toBe('DISPUTED');
  });

  it('e-seal opened outside the customs geofence → CRITICAL tamper dispute', async () => {
    seedDevice({ type: 'eseal' });
    seedTx({ escrow_status: 'LOCKED', escrow_amount_bez: 50 });
    seedFences([{
      id: 1, name: 'Aduana Algeciras', kind: 'customs',
      center_lat: 36.1408, center_lng: -5.4386, radius_m: 2000,
      polygon: null, enforce: false, status: 'active',
    }]);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 4, metric: 'seal', value: 1, breach: true, event_type: 'CONTAINER_UNSEALED', tamper: true }], rowCount: 1 }) // INSERT telemetry
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })  // UPDATE tx → DISPUTED
      .mockResolvedValueOnce({ rows: [{ id: 8, severity: 3, action: 'AUTO_CLAIM', status: 'open' }], rowCount: 1 }) // INSERT dispute
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // fanout SELECT webhooks
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_seen

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bzd_device_key')
      // Sevilla — far from the Algeciras customs fence
      .send({ readings: [{ metric: 'seal', state: 'open', lat: 37.3891, lng: -5.9845 }] });

    expect(res.status).toBe(200);
    expect(res.body.breaches[0]).toMatchObject({ eventType: 'CONTAINER_UNSEALED', tamper: true });
    expect(res.body.verdict.severity).toBe(3);
    expect(res.body.verdict.settlement.refundToBuyerBEZ).toBe(50);
  });

  it('rejects telemetry from an unknown device key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // resolveDevice -> none

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bad_key')
      .send({ temperature: 5 });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unknown device key/);
  });

  describe('edge signatures (secp256k1)', () => {
    const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

    function signedBody(readings, recordedAt = '2026-07-17T10:00:00.000Z') {
      const canonical = JSON.stringify({ deviceId: 'dev_abc', bUid: 'BZ-LOG-AAA', recordedAt, readings });
      return wallet.signMessage(canonical).then((signature) => ({ bUid: 'BZ-LOG-AAA', recordedAt, readings, signature }));
    }

    it('accepts a correctly signed payload with trust_level=signed', async () => {
      seedDevice({ signer_address: wallet.address });
      seedTx();
      seedFences();
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 5, metric: 'temperature', value: 5, breach: false, trust_level: 'signed' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_seen

      const body = await signedBody([{ metric: 'temperature', value: 5 }]);
      const res = await request(createApp())
        .post('/api/cargolink/v1/iot/telemetry')
        .set('Authorization', 'Bearer bzd_device_key')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.trustLevel).toBe('signed');
    });

    it('rejects a payload signed by a different key', async () => {
      seedDevice({ signer_address: ethers.Wallet.createRandom().address });

      const body = await signedBody([{ metric: 'temperature', value: 5 }]);
      const res = await request(createApp())
        .post('/api/cargolink/v1/iot/telemetry')
        .set('Authorization', 'Bearer bzd_device_key')
        .send(body);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/SIGNATURE_INVALID/);
    });

    it('rejects an unsigned payload when the device registered a signer', async () => {
      seedDevice({ signer_address: wallet.address });

      const res = await request(createApp())
        .post('/api/cargolink/v1/iot/telemetry')
        .set('Authorization', 'Bearer bzd_device_key')
        .send({ temperature: 5 });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/signature is required/);
    });
  });
});
