const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { mockQuery } = require('../helpers');

const cargoLinkRoutes = require('../../routes/cargolink');
const ingestHub = require('../../services/cargoIngestHub');

function createApp() {
  const app = express();
  // Same rawBody capture as api/index.js — the HMAC covers the exact bytes.
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use('/api/cargolink', cargoLinkRoutes);
  return app;
}

function seedKey(role, bezhasId = 'BZ_ID_ACME') {
  mockQuery.mockResolvedValueOnce({ rows: [{ bezhas_id: bezhasId, role, status: 'active' }], rowCount: 1 });
}

const SECRET = 'bzp_test_secret';
const MAPPING = {
  buidField: 'shipment.reference',
  eventField: 'status',
  events: { SEAL_OPEN: 'CONTAINER_UNSEALED', POD: 'CHECKPOINT_DELIVERED' },
  systemIdField: 'device.id',
  timestampField: 'occurred_at',
  telemetryFields: {
    'location.lat': 'lat',
    'location.lng': 'lng',
    'sensors.temp_c': 'temperature',
  },
};

function seedProvider(overrides = {}) {
  mockQuery.mockResolvedValueOnce({
    rows: [{
      id: 1, provider_id: 'prv_dhl', bezhas_id: 'BZ_ID_ACME', name: 'DHL_API',
      kind: 'carrier', secret: SECRET, mapping: MAPPING, status: 'active',
      ...overrides,
    }],
    rowCount: 1,
  });
}

function sign(rawBody, timestamp, nonce, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}.${rawBody}`).digest('hex');
}

describe('cargoIngestHub — applyMapping (declarative normalization)', () => {
  it('maps a third-party payload to the canonical event', () => {
    const event = ingestHub.applyMapping(MAPPING, {
      status: 'SEAL_OPEN',
      occurred_at: '2026-07-17T09:00:00Z',
      shipment: { reference: 'BZ-LOG-AAA' },
      device: { id: 'ES-LINE-773' },
      location: { lat: 36.53, lng: -6.29 },
      sensors: { temp_c: 4.2 },
    });
    expect(event).toEqual({
      bUid: 'BZ-LOG-AAA',
      eventType: 'CONTAINER_UNSEALED',
      systemId: 'ES-LINE-773',
      recordedAt: '2026-07-17T09:00:00Z',
      telemetry: { lat: 36.53, lng: -6.29, temperature: 4.2 },
    });
  });

  it('falls back to tracking_id when no buidField matches', () => {
    const event = ingestHub.applyMapping({}, { tracking_id: 'BZ-2026-99482' });
    expect(event.bUid).toBe('BZ-2026-99482');
  });
});

describe('Routes: /api/cargolink third-party ingestion (HMAC inbound)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('registers a provider and returns the HMAC secret once', async () => {
    seedKey('pos');
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, provider_id: 'prv_abc', name: 'DHL_API', kind: 'carrier', mapping: MAPPING, status: 'active', created_at: 'now' }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/providers')
      .set('Authorization', 'Bearer pos_key')
      .send({ name: 'DHL_API', kind: 'carrier', mapping: MAPPING });

    expect(res.status).toBe(201);
    expect(res.body.secret).toMatch(/^bzp_/);
    expect(res.body.ingestUrl).toBe('/api/cargolink/v1/ingest/prv_abc');
  });

  it('accepts a correctly signed webhook and runs the canonical pipeline', async () => {
    const payload = {
      status: 'POD',
      occurred_at: '2026-07-17T09:00:00Z',
      shipment: { reference: 'BZ-LOG-AAA' },
      device: { id: 'DHL-SCAN-9' },
      location: { lat: 36.53, lng: -6.29 },
      sensors: { temp_c: 4.2 },
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = 'n-001';

    seedProvider();                                                  // SELECT provider
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });      // INSERT nonce
    mockQuery.mockResolvedValueOnce({                                // SELECT tx (pipeline)
      rows: [{ b_uid: 'BZ-LOG-AAA', owner_bezhas_id: 'BZ_ID_ACME', status: 'IN_TRANSIT', escrow_status: 'NONE', escrow_amount_bez: 0, pos_ref: null }],
      rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });      // SELECT fences
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 11, metric: 'temperature', value: 4.2, breach: false, event_type: 'CHECKPOINT_DELIVERED' }], rowCount: 1 }); // INSERT telemetry (temperature)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 12, metric: 'gps', value: null, breach: false, event_type: 'CHECKPOINT_DELIVERED' }], rowCount: 1 });         // INSERT telemetry (gps)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });      // UPDATE provider last_event_at

    const res = await request(createApp())
      .post('/api/cargolink/v1/ingest/prv_dhl')
      .set('Content-Type', 'application/json')
      .set('X-BeZhas-Timestamp', String(timestamp))
      .set('X-BeZhas-Nonce', nonce)
      .set('X-BeZhas-Signature', `sha256=${sign(rawBody, timestamp, nonce)}`)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('DHL_API');
    expect(res.body.eventType).toBe('CHECKPOINT_DELIVERED');
    expect(res.body.stored).toBe(2);
  });

  it('rejects a bad signature', async () => {
    const rawBody = JSON.stringify({ status: 'POD' });
    const timestamp = Math.floor(Date.now() / 1000);
    seedProvider();

    const res = await request(createApp())
      .post('/api/cargolink/v1/ingest/prv_dhl')
      .set('Content-Type', 'application/json')
      .set('X-BeZhas-Timestamp', String(timestamp))
      .set('X-BeZhas-Nonce', 'n-002')
      .set('X-BeZhas-Signature', 'sha256=deadbeef')
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid HMAC/);
  });

  it('rejects a stale timestamp (outside the ±300s window)', async () => {
    const rawBody = JSON.stringify({ status: 'POD' });
    const timestamp = Math.floor(Date.now() / 1000) - 3600;
    seedProvider();

    const res = await request(createApp())
      .post('/api/cargolink/v1/ingest/prv_dhl')
      .set('Content-Type', 'application/json')
      .set('X-BeZhas-Timestamp', String(timestamp))
      .set('X-BeZhas-Nonce', 'n-003')
      .set('X-BeZhas-Signature', `sha256=${sign(rawBody, timestamp, 'n-003')}`)
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Timestamp/);
  });

  it('rejects a replayed nonce with 409', async () => {
    const rawBody = JSON.stringify({ status: 'POD' });
    const timestamp = Math.floor(Date.now() / 1000);
    seedProvider();
    const dup = new Error('duplicate key value violates unique constraint');
    dup.code = '23505';
    mockQuery.mockRejectedValueOnce(dup); // INSERT nonce fails

    const res = await request(createApp())
      .post('/api/cargolink/v1/ingest/prv_dhl')
      .set('Content-Type', 'application/json')
      .set('X-BeZhas-Timestamp', String(timestamp))
      .set('X-BeZhas-Nonce', 'n-dup')
      .set('X-BeZhas-Signature', `sha256=${sign(rawBody, timestamp, 'n-dup')}`)
      .send(rawBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/replay/i);
  });

  it('rejects an unknown provider', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT provider → none
    const res = await request(createApp())
      .post('/api/cargolink/v1/ingest/prv_nope')
      .set('Content-Type', 'application/json')
      .set('X-BeZhas-Timestamp', String(Math.floor(Date.now() / 1000)))
      .set('X-BeZhas-Nonce', 'n-004')
      .set('X-BeZhas-Signature', 'sha256=00')
      .send('{}');
    expect(res.status).toBe(404);
  });
});
