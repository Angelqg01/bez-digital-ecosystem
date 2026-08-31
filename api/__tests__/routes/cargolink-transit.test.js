'use strict';

/**
 * Tránsito aduanero multipaís (TX020).
 *
 * El caso que lo motiva es la ruta del piloto: un contenedor Tánger→Algeciras→
 * Frankfurt cruza tres jurisdicciones que despachan por separado y a ritmos
 * distintos. Modelar UN despacho por envío hacía imposible representar el
 * estado real —«libre en España, retenido en Alemania»— justo en el corredor
 * que define el proyecto, porque el Estrecho es frontera exterior de la UE.
 *
 * Lo que más se vigila aquí es el ORDEN. Un envío despachado en Alemania
 * mientras sigue retenido en España no es un estado optimista: es una
 * secuencia de hechos imposible, y toda la utilidad de anclar esto depende de
 * que la secuencia sea creíble.
 */

const express = require('express');
const request = require('supertest');
const { mockQuery, makeAdminToken } = require('../helpers');

const cargoLinkRoutes = require('../../routes/cargolink');

jest.mock('../../services/cargoLinkOnChain', () => ({
  getChainShipmentId: jest.fn().mockResolvedValue(42),
  anchorIntegratedShipment: jest.fn().mockResolvedValue({
    anchored: true, txHash: '0xabc', mode: 'integrated_shipment',
    route: { anchored: true, txHash: '0xdef' },
  }),
  anchorCountryClearance: jest.fn().mockResolvedValue({
    anchored: true, txHash: '0x123', mode: 'country_clearance',
  }),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cargolink', cargoLinkRoutes);
  return app;
}

const AUTH = () => ({ Authorization: `Bearer ${makeAdminToken()}` });

/** resolveIdentity mira primero la clave por rol. */
function seedIdentity(role = 'customs') {
  mockQuery.mockResolvedValueOnce({
    rows: [{ bezhas_id: 'BZ_ID_ACME', role, status: 'active' }], rowCount: 1,
  });
}
function seedTransaction(bUid = 'BZ-TX-1') {
  mockQuery.mockResolvedValueOnce({
    rows: [{ b_uid: bUid, owner_bezhas_id: 'BZ_ID_ACME', status: 'IN_TRANSIT' }], rowCount: 1,
  });
}
/** Las patas tal y como las devolvería la base. */
function legRows(states) {
  return states.map((s, i) => ({
    id: i + 1, b_uid: 'BZ-TX-1', chain_shipment_id: 42,
    leg_index: i, country_code: s.c, status: s.st || 'PENDING',
  }));
}

describe('POST /v1/tx/:bUid/transit — alta del tránsito', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('un solo país no es un tránsito y se rechaza', async () => {
    seedIdentity(); seedTransaction();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit').set(AUTH())
      .send({ countries: ['ES'], hsCode: '8471.30' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/at least 2/i);
  });

  it('rechaza códigos de país que no son ISO 3166-1 alfa-2', async () => {
    seedIdentity(); seedTransaction();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit').set(AUTH())
      .send({ countries: ['ESP', 'DE'], hsCode: '8471.30' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/alpha-2/i);
  });

  it('rechaza un país repetido en la ruta', async () => {
    // Con ES dos veces, «todos despachados» dependería de cuál de las dos
    // filas se mire. No es un detalle cosmético.
    seedIdentity(); seedTransaction();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit').set(AUTH())
      .send({ countries: ['ES', 'DE', 'ES'], hsCode: '8471.30' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/repeated/i);
  });

  it('exige la partida arancelaria', async () => {
    seedIdentity(); seedTransaction();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit').set(AUTH())
      .send({ countries: ['MA', 'ES', 'DE'] });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/hsCode/);
  });

  it('un rol no autorizado no puede abrir un tránsito', async () => {
    seedIdentity('pos');
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit').set(AUTH())
      .send({ countries: ['MA', 'ES'], hsCode: '8471.30' });

    expect(res.status).toBe(403);
  });

  it('crea la ruta Tánger→Algeciras→Frankfurt con una pata por país', async () => {
    seedIdentity(); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });          // no existe ya
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, b_uid: 'BZ-TX-1' }], rowCount: 1 }); // cabecera
    for (const [i, c] of ['MA', 'ES', 'DE'].entries()) {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: i + 1, leg_index: i, country_code: c, status: 'PENDING' }], rowCount: 1,
      });
    }

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit').set(AUTH())
      .send({ countries: ['MA', 'ES', 'DE'], hsCode: '8471.30', cargoValue: 48500 });

    expect(res.status).toBe(201);
    expect(res.body.legs).toHaveLength(3);
    expect(res.body.legs.map((l) => l.country_code)).toEqual(['MA', 'ES', 'DE']);
    expect(res.body.anchor.anchored).toBe(true);
  });
});

describe('POST /v1/tx/:bUid/transit/clear — despacho país a país', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('no deja despachar Alemania con Marruecos y España pendientes', async () => {
    seedIdentity(); seedTransaction();
    mockQuery.mockResolvedValueOnce({
      rows: legRows([{ c: 'MA' }, { c: 'ES' }, { c: 'DE' }]), rowCount: 3,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit/clear').set(AUTH())
      .send({ country: 'DE' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/MA, ES/);
    expect(res.body.error).toMatch(/still pending/i);
  });

  it('rechaza un país que no está en la ruta', async () => {
    seedIdentity(); seedTransaction();
    mockQuery.mockResolvedValueOnce({
      rows: legRows([{ c: 'MA' }, { c: 'ES' }]), rowCount: 2,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit/clear').set(AUTH())
      .send({ country: 'FR' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/not part of the transit route/i);
  });

  it('no despacha dos veces el mismo país', async () => {
    seedIdentity(); seedTransaction();
    mockQuery.mockResolvedValueOnce({
      rows: legRows([{ c: 'MA', st: 'CLEARED' }, { c: 'ES' }]), rowCount: 2,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit/clear').set(AUTH())
      .send({ country: 'MA' });

    expect(res.status).toBe(409);
  });

  it('despacha el primer país y deja el tránsito abierto', async () => {
    seedIdentity(); seedTransaction();
    mockQuery.mockResolvedValueOnce({
      rows: legRows([{ c: 'MA' }, { c: 'ES' }, { c: 'DE' }]), rowCount: 3,
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, country_code: 'MA', status: 'CLEARED' }], rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: 'CLEARED' }, { status: 'PENDING' }, { status: 'PENDING' }], rowCount: 3,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit/clear').set(AUTH())
      .send({ country: 'MA' });

    expect(res.status).toBe(200);
    expect(res.body.allCountriesCleared).toBe(false);
    expect(res.body.pendingCountries).toBe(2);
  });

  it('con el último país despachado, el tránsito queda completo', async () => {
    seedIdentity(); seedTransaction();
    mockQuery.mockResolvedValueOnce({
      rows: legRows([{ c: 'MA', st: 'CLEARED' }, { c: 'ES', st: 'CLEARED' }, { c: 'DE' }]),
      rowCount: 3,
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 3, country_code: 'DE', status: 'CLEARED' }], rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: 'CLEARED' }, { status: 'CLEARED' }, { status: 'CLEARED' }], rowCount: 3,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit/clear').set(AUTH())
      .send({ country: 'DE' });

    expect(res.status).toBe(200);
    expect(res.body.allCountriesCleared).toBe(true);
    expect(res.body.pendingCountries).toBe(0);
  });

  it('un rechazo aduanero no se ancla como despacho', async () => {
    // Anclar un REJECTED con completeCountryClearance diría en la cadena lo
    // contrario de lo que pasó.
    const onChain = require('../../services/cargoLinkOnChain');
    seedIdentity(); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: legRows([{ c: 'MA' }, { c: 'ES' }]), rowCount: 2 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, country_code: 'MA', status: 'REJECTED' }], rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: 'REJECTED' }, { status: 'PENDING' }], rowCount: 2,
    });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/transit/clear').set(AUTH())
      .send({ country: 'MA', outcome: 'REJECTED' });

    expect(res.status).toBe(200);
    expect(res.body.anchor.mode).toBe('rejected_not_anchored');
    expect(onChain.anchorCountryClearance).not.toHaveBeenCalled();
    expect(res.body.allCountriesCleared).toBe(false);
  });
});

describe('GET /v1/tx/:bUid/transit — dónde está atascado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('señala la aduana concreta que frena el envío', async () => {
    // Es la pregunta que se hace de verdad un operador, y responderla exige
    // conservar el orden del itinerario.
    seedIdentity();
    mockQuery.mockResolvedValueOnce({ rows: [{ b_uid: 'BZ-TX-1' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [
        { leg_index: 0, country_code: 'MA', status: 'CLEARED' },
        { leg_index: 1, country_code: 'ES', status: 'PENDING' },
        { leg_index: 2, country_code: 'DE', status: 'PENDING' },
      ], rowCount: 3,
    });

    const res = await request(createApp())
      .get('/api/cargolink/v1/tx/BZ-TX-1/transit').set(AUTH());

    expect(res.status).toBe(200);
    expect(res.body.blockedAt).toBe('ES');
    expect(res.body.readyForRelease).toBe(false);
  });

  it('un rechazo impide la liberación aunque no queden pendientes', async () => {
    seedIdentity();
    mockQuery.mockResolvedValueOnce({ rows: [{ b_uid: 'BZ-TX-1' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [
        { leg_index: 0, country_code: 'MA', status: 'CLEARED' },
        { leg_index: 1, country_code: 'ES', status: 'REJECTED' },
      ], rowCount: 2,
    });

    const res = await request(createApp())
      .get('/api/cargolink/v1/tx/BZ-TX-1/transit').set(AUTH());

    expect(res.body.readyForRelease).toBe(false);
    expect(res.body.rejectedAt).toEqual(['ES']);
    expect(res.body.blockedAt).toBeNull();
  });
});
