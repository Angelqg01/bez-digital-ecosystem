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

describe('Routes: /api/cargolink POS connector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    global.fetch = jest.fn();
  });

  it('links a POS adapter and masks the API key in the response', async () => {
    seedKey('pos');
    mockQuery.mockResolvedValueOnce({  // upsert pos_link RETURNING *
      rows: [{ bezhas_id: 'BZ_ID_ACME', provider: 'shopify', base_url: 'https://shop.acme.com', orders_path: '/orders', api_key: 'sk_live_secret_1234', status: 'active' }],
      rowCount: 1,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/pos/link')
      .set('Authorization', 'Bearer pos_key')
      .send({ provider: 'shopify', baseUrl: 'https://shop.acme.com', apiKey: 'sk_live_secret_1234' });

    expect(res.status).toBe(201);
    expect(res.body.posLink.provider).toBe('shopify');
    expect(res.body.posLink.apiKeyMasked).toBe('sk_l…1234');
    expect(res.body.posLink.api_key).toBeUndefined(); // raw key never returned
  });

  it('rejects a non-POS role from linking a POS', async () => {
    seedKey('customs');
    const res = await request(createApp())
      .post('/api/cargolink/v1/pos/link')
      .set('Authorization', 'Bearer customs_key')
      .send({ baseUrl: 'https://shop.acme.com' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot link a POS/);
  });

  it('pulls orders from the POS API and creates one B-UID per order', async () => {
    seedKey('pos');
    mockQuery.mockResolvedValueOnce({  // SELECT active pos_link
      rows: [{ bezhas_id: 'BZ_ID_ACME', provider: 'shopify', base_url: 'https://shop.acme.com', orders_path: '/orders', api_key: 'sk', status: 'active' }],
      rowCount: 1,
    });
    // POS API returns two orders.
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ orders: [
        { id: 'POS-1', destination: 'Madrid', weight: 12 },
        { id: 'POS-2', destination: 'Sevilla', weight: 30 },
      ] }),
    });
    // For each createTransactionWith: INSERT tx RETURNING *, INSERT transition, SELECT webhooks.
    mockQuery
      .mockResolvedValueOnce({ rows: [{ b_uid: 'BZ-LOG-AAA', owner_bezhas_id: 'BZ_ID_ACME', status: 'CREATED', escrow_status: 'NONE' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ b_uid: 'BZ-LOG-BBB', owner_bezhas_id: 'BZ_ID_ACME', status: 'CREATED', escrow_status: 'NONE' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_sync

    const res = await request(createApp())
      .post('/api/cargolink/v1/pos/sync')
      .set('Authorization', 'Bearer pos_key')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.pulled).toBe(2);
    expect(res.body.created).toHaveLength(2);
    expect(res.body.created[0]).toMatchObject({ bUid: 'BZ-LOG-AAA', posRef: 'POS-1' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://shop.acme.com/orders',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk' }) }),
    );
  });

  it('fails sync with a clear error when no POS is linked', async () => {
    seedKey('pos');
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT pos_link -> none

    const res = await request(createApp())
      .post('/api/cargolink/v1/pos/sync')
      .set('Authorization', 'Bearer pos_key')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No active POS link/);
  });
});
