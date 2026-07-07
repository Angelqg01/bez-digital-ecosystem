/**
 * Contratación de plan vía plugin-bridge — gateada por pago verificado.
 *
 * Antes /subscribe activaba el plan con solo pedirlo ("liquida en $BEZ" era
 * una nota de confianza). Ahora:
 *   - Plan gratuito (total 0) → activa directo.
 *   - Plan de pago → queda pending_payment con importe BEZ cotizado.
 *   - /subscribe/confirm verifica on-chain (receipt OK + Transfer BEZ→Treasury
 *     + importe suficiente + txHash sin reusar) antes de activar.
 */

jest.mock('../middleware/apiKeyTenant', () => ({
  apiKeyTenant: () => (req, res, next) => {
    req.apiKeyId = 'key-uuid-1';
    req.apiKeyRecord = { id: 'key-uuid-1' };
    next();
  },
}));

jest.mock('../models/pg/ApiKey', () => ({
  setPlan: jest.fn(),
  setPendingPlan: jest.fn(),
  getPendingPlan: jest.fn(),
  confirmPendingPlan: jest.fn(),
  isPlanTxUsed: jest.fn(),
  setSubappScope: jest.fn(),
}));

const TREASURY = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
jest.mock('../services/bezpay.service', () => ({
  getBezPriceUSD: jest.fn(),
  TREASURY_ADDR: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
}));

// ethers se requiere inline en /subscribe/confirm — mock de provider + utils.
const mockGetTransactionReceipt = jest.fn();
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(() => ({ getTransactionReceipt: mockGetTransactionReceipt })),
    formatUnits: (v, d = 18) => String(Number(v) / 10 ** d),
  },
}));

jest.mock('../control-plane/policy', () => ({ getSubappRegistry: () => [] }));

const express = require('express');
const request = require('supertest');
const ApiKey = require('../models/pg/ApiKey');
const bezpay = require('../services/bezpay.service');
const pluginBridge = require('../routes/plugin-bridge.routes');

const app = express();
app.use(express.json());
app.use('/api/plugin-bridge', pluginBridge);

const BEZ_POLYGON = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TX = '0x' + 'a'.repeat(64);

const pad32 = (addr) => '0x' + addr.toLowerCase().replace('0x', '').padStart(64, '0');
const bezToData = (bez) => '0x' + BigInt(Math.round(bez * 1e6) * 1e12).toString(16);

function transferLog({ token = BEZ_POLYGON, to = TREASURY, bez = 200 } = {}) {
  return {
    address: token,
    topics: [TRANSFER_TOPIC, pad32('0x' + '1'.repeat(40)), pad32(to)],
    data: bezToData(bez),
  };
}

beforeEach(() => {
  // resetMocks:true limpia las implementaciones → fijarlas aquí.
  const { ethers } = require('ethers');
  ethers.JsonRpcProvider.mockImplementation(() => ({ getTransactionReceipt: mockGetTransactionReceipt }));
  bezpay.getBezPriceUSD.mockResolvedValue(1.0); // 1 BEZ = 1 USD ≈ 1 EUR (aritmética simple)
  ApiKey.setPlan.mockResolvedValue({ id: 'key-uuid-1' });
  ApiKey.setPendingPlan.mockResolvedValue({ id: 'key-uuid-1' });
  ApiKey.getPendingPlan.mockResolvedValue(null);
  ApiKey.confirmPendingPlan.mockResolvedValue({ id: 'key-uuid-1' });
  ApiKey.isPlanTxUsed.mockResolvedValue(false);
  mockGetTransactionReceipt.mockResolvedValue(null);
});

describe('POST /api/plugin-bridge/subscribe', () => {
  it('activa directo los planes gratuitos (starter)', async () => {
    const res = await request(app).post('/api/plugin-bridge/subscribe').send({ planId: 'starter' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(ApiKey.setPlan).toHaveBeenCalledWith('key-uuid-1', 'starter');
    expect(ApiKey.setPendingPlan).not.toHaveBeenCalled();
  });

  it('deja los planes de pago como pending_payment con importe BEZ cotizado', async () => {
    const res = await request(app).post('/api/plugin-bridge/subscribe').send({ planId: 'creator_pro' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending_payment');
    // creator_pro mensual: 99 + IVA = 119.79 EUR → a 1 USD/BEZ ≈ 119.79 BEZ
    expect(res.body.payment.expectedBez).toBeCloseTo(119.79, 2);
    expect(res.body.payment.to).toBe(TREASURY);
    expect(ApiKey.setPlan).not.toHaveBeenCalled();
    expect(ApiKey.setPendingPlan).toHaveBeenCalledWith('key-uuid-1', expect.objectContaining({
      planId: 'creator_pro',
      amountEUR: 119.79,
    }));
  });
});

describe('POST /api/plugin-bridge/subscribe/confirm', () => {
  const PENDING = { planId: 'creator_pro', amountEUR: 119.79, expectedBez: 119.79, quotedAt: '2026-01-01T00:00:00Z' };

  it('404 si no hay contratación pendiente', async () => {
    const res = await request(app).post('/api/plugin-bridge/subscribe/confirm').send({ txHash: TX });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_PENDING_PLAN');
  });

  it('activa el plan cuando la tx contiene un Transfer BEZ→Treasury suficiente', async () => {
    ApiKey.getPendingPlan.mockResolvedValue(PENDING);
    mockGetTransactionReceipt.mockResolvedValue({ status: 1, logs: [transferLog({ bez: 120 })] });
    const res = await request(app).post('/api/plugin-bridge/subscribe/confirm').send({ txHash: TX });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.plan).toBe('creator_pro');
    expect(ApiKey.confirmPendingPlan).toHaveBeenCalledWith('key-uuid-1', expect.objectContaining({ txHash: TX, chainId: 137 }));
  });

  it('rechaza UNDERPAID por debajo de la tolerancia', async () => {
    ApiKey.getPendingPlan.mockResolvedValue(PENDING);
    mockGetTransactionReceipt.mockResolvedValue({ status: 1, logs: [transferLog({ bez: 50 })] });
    const res = await request(app).post('/api/plugin-bridge/subscribe/confirm').send({ txHash: TX });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNDERPAID');
    expect(ApiKey.confirmPendingPlan).not.toHaveBeenCalled();
  });

  it('rechaza si la transferencia no va al Treasury o no es BEZ', async () => {
    ApiKey.getPendingPlan.mockResolvedValue(PENDING);
    mockGetTransactionReceipt.mockResolvedValue({
      status: 1,
      logs: [transferLog({ to: '0x' + '9'.repeat(40), bez: 200 })],
    });
    const res = await request(app).post('/api/plugin-bridge/subscribe/confirm').send({ txHash: TX });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_BEZ_TRANSFER');
  });

  it('409 si el txHash ya activó otro plan (anti-reuso global)', async () => {
    ApiKey.getPendingPlan.mockResolvedValue(PENDING);
    ApiKey.isPlanTxUsed.mockResolvedValue(true);
    const res = await request(app).post('/api/plugin-bridge/subscribe/confirm').send({ txHash: TX });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TX_REUSED');
  });

  it('informa pending si la tx aún no está minada (sin activar)', async () => {
    ApiKey.getPendingPlan.mockResolvedValue(PENDING);
    mockGetTransactionReceipt.mockResolvedValue(null);
    const res = await request(app).post('/api/plugin-bridge/subscribe/confirm').send({ txHash: TX });
    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(false);
    expect(ApiKey.confirmPendingPlan).not.toHaveBeenCalled();
  });

  it('400 en red no soportada', async () => {
    ApiKey.getPendingPlan.mockResolvedValue(PENDING);
    const res = await request(app).post('/api/plugin-bridge/subscribe/confirm').send({ txHash: TX, chainId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_CHAIN');
  });
});
