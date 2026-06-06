const express = require('express');
const request = require('supertest');
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
      b_uid: 'BZ-LOG-AAA', config: { tempMin: 2, tempMax: 8, shockMax: 5 }, status: 'active',
      ...overrides,
    }],
    rowCount: 1,
  });
}

describe('Routes: /api/cargolink IoT ingestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('registers a device and returns the device key once', async () => {
    seedKey('pos');
    mockQuery.mockResolvedValueOnce({  // INSERT device RETURNING
      rows: [{ id: 1, device_id: 'dev_abc', type: 'temp', b_uid: 'BZ-LOG-AAA', config: {}, label: 'temp device', status: 'active', created_at: 'now' }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/devices')
      .set('Authorization', 'Bearer pos_key')
      .send({ type: 'temp', bUid: 'BZ-LOG-AAA', config: { tempMax: 8 } });

    expect(res.status).toBe(201);
    expect(res.body.device.device_id).toBe('dev_abc');
    expect(res.body.deviceKey).toMatch(/^bzd_/);
  });

  it('ingests a normal temperature reading without a breach', async () => {
    seedDevice();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, metric: 'temperature', value: 5, unit: '°C', breach: false, reason: null }], rowCount: 1 }) // INSERT telemetry
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_seen

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bzd_device_key')
      .send({ temperature: 5 });

    expect(res.status).toBe(200);
    expect(res.body.stored).toBe(1);
    expect(res.body.breaches).toHaveLength(0);
    expect(res.body.webhookDeliveries).toHaveLength(0);
  });

  it('flags a cold-chain breach and fans out ON_COLD_CHAIN_BREACH', async () => {
    seedDevice();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2, metric: 'temperature', value: 14, unit: '°C', breach: true, reason: 'temperature 14°C outside [2,8]' }], rowCount: 1 }) // INSERT telemetry
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // UPDATE last_seen
      .mockResolvedValueOnce({ rows: [{ id: 9, url: 'https://acme.com/hook', events: ['ON_COLD_CHAIN_BREACH'], secret: 's3cr3t' }], rowCount: 1 }); // fanout SELECT webhooks
    // delivery INSERT + UPDATE inside fanout
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(createApp())
      .post('/api/cargolink/v1/iot/telemetry')
      .set('Authorization', 'Bearer bzd_device_key')
      .send({ temperature: 14 });

    expect(res.status).toBe(200);
    expect(res.body.breaches).toHaveLength(1);
    expect(res.body.breaches[0].metric).toBe('temperature');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://acme.com/hook',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-BeZhas-Event': 'ON_COLD_CHAIN_BREACH' }) }),
    );
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
});
