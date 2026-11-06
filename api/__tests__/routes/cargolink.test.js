const express = require('express');
const request = require('supertest');
const dns = require('dns');
const { mockQuery } = require('../helpers');

const cargoLinkRoutes = require('../../routes/cargolink');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cargolink', cargoLinkRoutes);
  return app;
}

describe('Routes: /api/cargolink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // El registro de webhooks resuelve el host (anti-SSRF): IP pública fija, sin red.
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mockQuery.mockResolvedValue({
      rows: [{ id: 42, created_at: '2026-05-19T06:00:00.000Z' }],
      rowCount: 1,
    });
  });

  // Responde por el texto de la SQL, no por orden: así cada prueba describe el
  // estado de la base y no la secuencia interna de consultas del servicio.
  function seedDb({ role = 'customs', tx = null, updated = null } = {}) {
    mockQuery.mockImplementation(async (sql) => {
      if (sql.includes('FROM cargolink_api_keys')) {
        return { rows: [{ bezhas_id: 'BZ_ID_ACME', role, status: 'active' }], rowCount: 1 };
      }
      if (sql.includes('SELECT * FROM cargolink_transactions')) {
        return tx ? { rows: [tx], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes('UPDATE cargolink_transactions')) {
        return { rows: [updated], rowCount: 1 };
      }
      if (sql.includes('FROM cargolink_transitions')) {
        return { rows: [{ to_status: tx?.status, role: 'pos', created_at: '2026-11-06T09:00:00.000Z' }], rowCount: 1 };
      }
      if (sql.includes('committed_eta')) {
        return { rows: [{ committed_eta: '2026-11-08T10:00:00.000Z', current_port: 'ESALG', eta_revisions: 1 }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO cargolink_events')) {
        return { rows: [{ id: 42, created_at: '2026-11-06T09:00:00.000Z' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
  }

  const createdTx = {
    b_uid: 'BZ-LOG-ABCDE', status: 'CREATED', escrow_status: 'LOCKED',
    owner_bezhas_id: 'BZ_ID_ACME', pos_ref: 'POS-9001', cargo: {},
  };

  it('customs/dispatch avanza el B-UID por el ciclo de vida real y no inventa autorización ni oráculo', async () => {
    seedDb({ role: 'customs', tx: createdTx, updated: { ...createdTx, status: 'CUSTOMS_CLEARED' } });

    const res = await request(createApp())
      .post('/api/cargolink/v1/customs/dispatch')
      .set('Authorization', 'Bearer customs_key')
      .send({ bUid: 'BZ-LOG-ABCDE', manifestId: 'MAN-1', declaredValue: 1200, hsCode: '8471' });

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      bUid: 'BZ-LOG-ABCDE',
      status: 'CUSTOMS_CLEARED',
      lane: 'GREEN_LANE',
      laneSource: 'BEZHAS_RISK_RULES',
      customsAuthorization: null,
      oracle: null,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/CHAINLINK|BZ-ASY-/);
    expect(res.body.billing).toMatchObject({ mode: 'METERED', listPriceBez: 5, chargedBez: 0, status: 'not_charged' });
    expect(res.body.blockchain.txHash).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE cargolink_transactions'), expect.anything());
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cargolink_events'),
      expect.arrayContaining(['/v1/customs/dispatch', 'POST', 'CustomsCleared']),
    );
  });

  it('customs/dispatch exige api-key: sin ella no toca la base (401)', async () => {
    seedDb({ tx: createdTx });
    const res = await request(createApp())
      .post('/api/cargolink/v1/customs/dispatch')
      .send({ bUid: 'BZ-LOG-ABCDE', manifestId: 'MAN-1', declaredValue: 1200 });
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE cargolink_transactions'), expect.anything());
  });

  it('customs/dispatch respeta el rol: una naviera no puede despachar (403)', async () => {
    seedDb({ role: 'carrier', tx: createdTx });
    const res = await request(createApp())
      .post('/api/cargolink/v1/customs/dispatch')
      .set('Authorization', 'Bearer carrier_key')
      .send({ bUid: 'BZ-LOG-ABCDE', manifestId: 'MAN-1', declaredValue: 1200 });
    expect(res.status).toBe(403);
  });

  it('exige bUid (400) en vez de rellenar uno de ejemplo', async () => {
    seedDb();
    const res = await request(createApp())
      .post('/api/cargolink/v1/audit/fingerprint')
      .set('Authorization', 'Bearer any_key')
      .send({ payloadHash: `0x${'a'.repeat(64)}` });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bUid is required/);
  });

  it('shipping/stowage calcula el centro de gravedad a partir de los bultos', async () => {
    const cleared = { ...createdTx, status: 'CUSTOMS_CLEARED' };
    seedDb({ role: 'carrier', tx: cleared, updated: { ...cleared, status: 'STOWED' } });

    const res = await request(createApp())
      .post('/api/cargolink/v1/shipping/stowage')
      .set('Authorization', 'Bearer carrier_key')
      .send({ bUid: 'BZ-LOG-ABCDE', items: [{ x: 6, y: 1.2, weight: 1000 }] });

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      status: 'STOWED',
      cog: { x: 6, y: 1.2 },
      stowageStatus: 'VERIFIED',
    });
  });

  it('logistics/route devuelve el estado real del B-UID y no un progreso inventado', async () => {
    seedDb({ role: 'logistics', tx: { ...createdTx, status: 'IN_TRANSIT' } });

    const res = await request(createApp())
      .get('/api/cargolink/v1/logistics/route?bUid=BZ-LOG-ABCDE')
      .set('Authorization', 'Bearer logistics_key');

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      bUid: 'BZ-LOG-ABCDE',
      status: 'IN_TRANSIT',
      currentPort: 'ESALG',
      etaRevisions: 1,
      transit: null,
      escrowState: 'LOCKED',
    });
    expect(res.body.result).not.toHaveProperty('progress');
    expect(res.body.result).not.toHaveProperty('routeId');
  });

  it('audit/fingerprint registra la huella sin afirmar que la carga esté verificada', async () => {
    seedDb({ role: 'logistics', tx: createdTx });
    const hash = `0x${'b'.repeat(64)}`;

    const res = await request(createApp())
      .post('/api/cargolink/v1/audit/fingerprint')
      .set('Authorization', 'Bearer logistics_key')
      .send({ bUid: 'BZ-LOG-ABCDE', payloadHash: hash });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({
      bUid: 'BZ-LOG-ABCDE',
      fingerprintHash: hash,
      integrity: 'RECORDED_OFF_CHAIN',
      escrowState: 'LOCKED',
    });
  });

  it('audit/fingerprint rechaza un payloadHash mal formado (400)', async () => {
    seedDb({ tx: createdTx });
    const res = await request(createApp())
      .post('/api/cargolink/v1/audit/fingerprint')
      .set('Authorization', 'Bearer any_key')
      .send({ bUid: 'BZ-LOG-ABCDE', payloadHash: 'not-a-hash' });
    expect(res.status).toBe(400);
  });

  it('audit/fingerprint devuelve 404 si el B-UID no existe', async () => {
    seedDb({ tx: null });
    const res = await request(createApp())
      .post('/api/cargolink/v1/audit/fingerprint')
      .set('Authorization', 'Bearer any_key')
      .send({ bUid: 'BZ-NOPE' });
    expect(res.status).toBe(404);
  });

  it('registers webhooks with a signing secret', async () => {
    // resolveIdentity: SELECT the role-scoped key -> binds the webhook to a BeZhas_ID.
    mockQuery.mockResolvedValueOnce({
      rows: [{ bezhas_id: 'BZ-ACME', role: 'pos', status: 'active' }],
      rowCount: 1,
    });
    // INSERT INTO cargolink_webhooks ... RETURNING
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 7,
        url: 'https://api.example.com/webhooks/bezhas',
        events: ['ON_CUSTOMS_CLEARED'],
        status: 'active',
        created_at: '2026-05-19T06:00:00.000Z',
      }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/webhooks/register')
      .set('Authorization', 'Bearer bz_test_key')
      .send({
        url: 'https://api.example.com/webhooks/bezhas',
        events: ['ON_CUSTOMS_CLEARED'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.webhook).toMatchObject({
      id: 7,
      url: 'https://api.example.com/webhooks/bezhas',
      events: ['ON_CUSTOMS_CLEARED'],
      status: 'active',
    });
    expect(res.body.signingSecret).toHaveLength(48);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cargolink_webhooks'),
      expect.arrayContaining([
        expect.any(String),
        'https://api.example.com/webhooks/bezhas',
        ['ON_CUSTOMS_CLEARED'],
        expect.any(String),
      ]),
    );
  });

  it('rechaza registrar un webhook hacia la red interna (SSRF)', async () => {
    for (const url of ['http://api.example.com/hook', 'https://169.254.169.254/computeMetadata/v1/']) {
      const res = await request(createApp())
        .post('/api/cargolink/v1/webhooks/register')
        .set('Authorization', 'Bearer bz_test_key')
        .send({ url, events: ['ON_CUSTOMS_CLEARED'] });
      expect(res.status).toBe(400);
    }
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cargolink_webhooks'), expect.anything());
  });
});
