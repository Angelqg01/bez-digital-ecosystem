const express = require('express');
const request = require('supertest');
const { mockQuery, makeAdminToken } = require('../helpers');

const cargoLinkRoutes = require('../../routes/cargolink');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cargolink', cargoLinkRoutes);
  return app;
}

// resolveIdentity looks up the role-scoped key first; helper to seed that row.
function seedKey(role, bezhasId = 'BZ_ID_ACME') {
  mockQuery.mockResolvedValueOnce({
    rows: [{ bezhas_id: bezhasId, role, status: 'active' }],
    rowCount: 1,
  });
}

describe('Routes: /api/cargolink lifecycle (B-UID object model)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('issues a role-scoped key bound to a BeZhas_ID (admin only)', async () => {
    // requireRole('admin') first looks up the caller's role in the DB...
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
    // ...then issueKey inserts the new key.
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, bezhas_id: 'BZ_ID_ACME', role: 'customs', label: 'customs key', created_at: 'now' }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/keys')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ bezhasId: 'BZ_ID_ACME', role: 'customs' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('customs');
    expect(res.body.apiKey).toMatch(/^bzk_live_/);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cargolink_api_keys'),
      expect.arrayContaining([expect.any(String), 'BZ_ID_ACME', 'customs']),
    );
  });

  it('rejects key issuance without an admin token', async () => {
    const res = await request(createApp())
      .post('/api/cargolink/v1/keys')
      .send({ bezhasId: 'BZ_ID_ACME', role: 'customs' });

    expect(res.status).toBe(401);
  });

  it('lets the POS role create a B-UID transaction', async () => {
    seedKey('pos');
    mockQuery.mockResolvedValueOnce({  // INSERT transaction RETURNING *
      rows: [{ b_uid: 'BZ-LOG-ABCDE', owner_bezhas_id: 'BZ_ID_ACME', status: 'CREATED', escrow_status: 'NONE' }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx')
      .set('Authorization', 'Bearer pos_key')
      .send({ posRef: 'POS-9001', destination: 'Madrid', cargo: { weight: 450 } });

    expect(res.status).toBe(201);
    expect(res.body.transaction.status).toBe('CREATED');
    expect(res.body.transaction.b_uid).toBe('BZ-LOG-ABCDE');
  });

  it('rejects a non-POS role trying to create a transaction', async () => {
    seedKey('carrier');
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx')
      .set('Authorization', 'Bearer carrier_key')
      .send({ posRef: 'POS-9001' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot create transactions/);
  });

  it('gates a transition by role: carrier cannot clear customs', async () => {
    seedKey('carrier');
    mockQuery.mockResolvedValueOnce({  // SELECT transaction
      rows: [{ b_uid: 'BZ-LOG-ABCDE', status: 'CREATED', escrow_status: 'NONE', owner_bezhas_id: 'BZ_ID_ACME' }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-LOG-ABCDE/advance')
      .set('Authorization', 'Bearer carrier_key')
      .send({ payload: {} });

    expect(res.status).toBe(403);
    // Desde CREATED hay dos ramas legítimas —gate-in (logistics) o despacho
    // directo sin almacén (customs)—, así que el error las enumera en vez de
    // nombrar una sola. `carrier` no es ninguna de las dos.
    expect(res.body.error).toMatch(/Role 'carrier' cannot advance CREATED/);
    expect(res.body.error).toMatch(/GATE_IN \(role 'logistics'\)/);
    expect(res.body.error).toMatch(/CUSTOMS_CLEARED \(role 'customs'\)/);
  });

  it('advances CREATED -> CUSTOMS_CLEARED for the customs role and fans out the event', async () => {
    seedKey('customs');
    mockQuery
      .mockResolvedValueOnce({  // SELECT transaction
        rows: [{ b_uid: 'BZ-LOG-ABCDE', status: 'CREATED', escrow_status: 'NONE', owner_bezhas_id: 'BZ_ID_ACME' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({  // UPDATE ... RETURNING *
        rows: [{ b_uid: 'BZ-LOG-ABCDE', status: 'CUSTOMS_CLEARED', escrow_status: 'NONE', owner_bezhas_id: 'BZ_ID_ACME', pos_ref: 'POS-9001' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // INSERT transition
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT webhooks (none)

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-LOG-ABCDE/advance')
      .set('Authorization', 'Bearer customs_key')
      .send({ payload: { manifestId: 'MAN-1', declaredValue: 1200, hsCode: '8471' } });

    expect(res.status).toBe(200);
    expect(res.body.transition).toMatchObject({ from: 'CREATED', to: 'CUSTOMS_CLEARED', role: 'customs' });
    expect(res.body.transaction.status).toBe('CUSTOMS_CLEARED');
    expect(res.body.validation.result.lane).toBe('GREEN_LANE');
  });

  it('blocks a customs transition when required manifest data is missing (422)', async () => {
    seedKey('customs');
    mockQuery.mockResolvedValueOnce({  // SELECT transaction (no pos_ref, no cargo value)
      rows: [{ b_uid: 'BZ-LOG-ABCDE', status: 'CREATED', escrow_status: 'NONE', owner_bezhas_id: 'BZ_ID_ACME', cargo: {} }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-LOG-ABCDE/advance')
      .set('Authorization', 'Bearer customs_key')
      .send({ payload: {} });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Validation failed for CUSTOMS_CLEARED/);
  });
});
