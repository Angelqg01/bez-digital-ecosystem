/**
 * Webhook MoonPay (routes/moonpay.routes.js) — verificación de firma.
 *
 * Antes cualquiera podía POSTear eventos falsos (el TODO de verificación
 * llevaba abierto desde la v1). Ahora:
 *  - Sin MOONPAY_WEBHOOK_KEY configurada → 503 (fail closed).
 *  - Firma inválida o ausente → 401.
 *  - Firma v2 (Moonpay-Signature-V2: t=..,s=hex de HMAC(t.body)) → 200.
 *  - Firma legacy (Moonpay-Signature: base64 de HMAC(body)) → 200.
 */

jest.mock('../middleware/auth.middleware', () => ({
  protect: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const moonpayRoutes = require('../routes/moonpay.routes');

const app = express();
// Igual que en producción: el webhook se monta ANTES de express.json().
app.use('/api/moonpay', moonpayRoutes);
app.use(express.json());

const WEBHOOK_KEY = 'wk_test_secret';
const EVENT = { type: 'transaction_completed', data: { id: 'tx_1', status: 'completed' } };
const RAW = JSON.stringify(EVENT);

function signV2(raw, key, t = '1700000000') {
  const s = crypto.createHmac('sha256', key).update(`${t}.${raw}`).digest('hex');
  return `t=${t},s=${s}`;
}

function signLegacy(raw, key) {
  return crypto.createHmac('sha256', key).update(raw).digest('base64');
}

describe('POST /api/moonpay/webhook', () => {
  beforeEach(() => {
    delete process.env.MOONPAY_WEBHOOK_KEY;
    delete process.env.MOONPAY_SECRET_KEY;
  });

  it('responde 503 si no hay clave de firma configurada (fail closed)', async () => {
    const res = await request(app)
      .post('/api/moonpay/webhook')
      .set('Content-Type', 'application/json')
      .send(RAW);
    expect(res.status).toBe(503);
  });

  it('rechaza 401 sin firma', async () => {
    process.env.MOONPAY_WEBHOOK_KEY = WEBHOOK_KEY;
    const res = await request(app)
      .post('/api/moonpay/webhook')
      .set('Content-Type', 'application/json')
      .send(RAW);
    expect(res.status).toBe(401);
  });

  it('rechaza 401 con firma inválida', async () => {
    process.env.MOONPAY_WEBHOOK_KEY = WEBHOOK_KEY;
    const res = await request(app)
      .post('/api/moonpay/webhook')
      .set('Content-Type', 'application/json')
      .set('Moonpay-Signature-V2', signV2(RAW, 'wrong-key'))
      .send(RAW);
    expect(res.status).toBe(401);
  });

  it('acepta la firma v2 correcta', async () => {
    process.env.MOONPAY_WEBHOOK_KEY = WEBHOOK_KEY;
    const res = await request(app)
      .post('/api/moonpay/webhook')
      .set('Content-Type', 'application/json')
      .set('Moonpay-Signature-V2', signV2(RAW, WEBHOOK_KEY))
      .send(RAW);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('acepta la firma legacy (base64) correcta', async () => {
    process.env.MOONPAY_WEBHOOK_KEY = WEBHOOK_KEY;
    const res = await request(app)
      .post('/api/moonpay/webhook')
      .set('Content-Type', 'application/json')
      .set('Moonpay-Signature', signLegacy(RAW, WEBHOOK_KEY))
      .send(RAW);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
