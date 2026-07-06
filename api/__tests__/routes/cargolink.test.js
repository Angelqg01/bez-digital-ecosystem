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

describe('Routes: /api/cargolink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({
      rows: [{ id: 42, created_at: '2026-05-19T06:00:00.000Z' }],
      rowCount: 1,
    });
  });

  it('records a CargoLink operation in the BEZ credit ledger without fake txHash', async () => {
    const res = await request(createApp())
      .post('/api/cargolink/v1/audit/fingerprint')
      .set('Authorization', 'Bearer bz_test_key')
      .send({ bUid: 'BZ-LOG-ES-17148', shipmentId: 'TRX-9921-X' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.source).toBe('api');
    expect(res.body.billing).toMatchObject({
      mode: 'BEZ_CREDIT_LEDGER',
      chargedBez: 3,
      status: 'recorded',
    });
    expect(res.body.blockchain.txHash).toBeNull();
    expect(res.body.blockchain.mode).toBe('pending_contract_config');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cargolink_events'),
      expect.arrayContaining([
        expect.any(String),
        '/v1/audit/fingerprint',
        'POST',
        'FingerprintAnchored',
      ]),
    );
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
});
