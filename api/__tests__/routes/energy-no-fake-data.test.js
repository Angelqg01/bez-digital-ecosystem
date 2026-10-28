'use strict';
/**
 * BEZ Energy en producción no inventa datos: sin feed OMIE/REE responde 503,
 * sin batería conectada el agente no se inventa un estado de carga, y sin
 * contratos desplegados no se publican direcciones de relleno.
 */
jest.mock('../../services/energyFeedService', () => {
  const real = jest.requireActual('../../services/energyFeedService');
  return { ...real, getOmiePrice: jest.fn(), getReeGrid: jest.fn(), getEsiosIndicators: jest.fn() };
});

const request = require('supertest');
const { mockQuery, makeToken } = require('../helpers');
const energyFeed = require('../../services/energyFeedService');
const energyArbitrage = require('../../services/energyArbitrageAgent');

const app = require('../../index');
const auth = () => ({ Authorization: `Bearer ${makeToken({ bezhas_id: 'BZ-OWNER1' })}` });

beforeEach(() => {
  mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  energyFeed.getOmiePrice.mockReset().mockResolvedValue(null);
  energyFeed.getReeGrid.mockReset().mockResolvedValue(null);
  energyFeed.getEsiosIndicators.mockReset().mockResolvedValue(null);
});

describe('mercado sin feed', () => {
  it('GET /market/omie → 503 OMIE_UNAVAILABLE, sin precio aleatorio', async () => {
    const res = await request(app).get('/api/energy/market/omie').set(auth());
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('OMIE_UNAVAILABLE');
    expect(res.body.price_eur_mwh).toBeUndefined();
  });

  it('GET /market/omie con feed real lo devuelve tal cual', async () => {
    energyFeed.getOmiePrice.mockResolvedValue({ price_eur_mwh: 61.2, source: 'OMIE' });
    const res = await request(app).get('/api/energy/market/omie').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ price_eur_mwh: 61.2, simulated: false });
  });

  it('GET /market/esios sin REE ni ESIOS → 503 GRID_UNAVAILABLE', async () => {
    const res = await request(app).get('/api/energy/market/esios').set(auth());
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('GRID_UNAVAILABLE');
    expect(res.body.mix).toBeUndefined();
  });
});

describe('arbitraje sin batería', () => {
  it('no inventa estado de carga ni rendimiento', async () => {
    jest.spyOn(energyArbitrage, 'runOnce').mockResolvedValueOnce({
      strategy: 'HOLD', powerKw: 0, reason: 'x', priceEurMwh: 55, socPct: null, nodeId: null, priceSource: 'OMIE',
    });
    const res = await request(app).get('/api/energy/arbitrage/status').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.current_strategy).toBe('NO_BATTERY');
    expect(res.body.battery_soc_pct).toBeNull();
    expect(res.body.estimated_yield_eur).toBeNull();
    expect(res.body.omie_price).toBe(55);
  });
});

describe('contratos sin desplegar', () => {
  it('GET /demand-response: sin ahorros aleatorios ni nodos de demo', async () => {
    const res = await request(app).get('/api/energy/demand-response').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.savings_today_eur).toBeNull();
    expect(res.body.incentive_pending_eur).toBeNull();
    expect(res.body.eligible_nodes).toEqual([]);
  });

  it('GET /staking/rewards no publica la QualityEscrow como contrato de staking', async () => {
    const res = await request(app).get('/api/energy/staking/rewards').set(auth());
    expect(JSON.stringify(res.body)).not.toMatch(/0x3EfC42095E8503d41Ad8001328FC23388E00e8a3/i);
    expect(JSON.stringify(res.body)).not.toMatch(/0x0{39}[123]/);
  });
});
