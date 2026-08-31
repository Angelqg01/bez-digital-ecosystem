'use strict';

/**
 * Incidencia reportada (TX014) y cierre de operación (TX020).
 *
 * Los dos últimos eventos del piloto de Algeciras que no tenían implementación.
 *
 * Lo que más se vigila:
 *   - que la severidad la fije el ORACLE y no quien reporta, y
 *   - que el cierre COMPRUEBE en vez de creerse lo que le dicen.
 */

const express = require('express');
const request = require('supertest');
const { mockQuery, makeAdminToken } = require('../helpers');

const cargoLinkRoutes = require('../../routes/cargolink');

jest.mock('../../services/cargoLinkOnChain', () => ({
  anchorTransition: jest.fn().mockResolvedValue({ anchored: true, txHash: '0xaa', mode: 'anchored' }),
  getChainShipmentId: jest.fn().mockResolvedValue(1),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cargolink', cargoLinkRoutes);
  return app;
}
const AUTH = () => ({ Authorization: `Bearer ${makeAdminToken()}` });

function seedIdentity(role = 'logistics') {
  mockQuery.mockResolvedValueOnce({
    rows: [{ bezhas_id: 'BZ_ID_ACME', role, status: 'active' }], rowCount: 1,
  });
}
function seedTransaction(over = {}) {
  mockQuery.mockResolvedValueOnce({
    rows: [{
      b_uid: 'BZ-TX-1', owner_bezhas_id: 'BZ_ID_ACME', status: 'DELIVERED',
      escrow_status: 'RELEASED', escrow_amount_bez: 1000, ...over,
    }], rowCount: 1,
  });
}

describe('TX014 — incidencia reportada por una persona', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('rechaza un tipo de incidencia desconocido', async () => {
    seedIdentity(); seedTransaction();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/incidents').set(AUTH())
      .send({ kind: 'ALIENS', description: 'algo raro ha pasado aqui' });
    expect(res.status).toBe(422);
  });

  it('exige una descripción con contenido', async () => {
    // Una incidencia sin descripción no se puede graduar, ni disputar, ni
    // defender dentro de dos años.
    seedIdentity(); seedTransaction();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/incidents').set(AUTH())
      .send({ kind: 'CARGO_DAMAGE', description: 'roto' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/description/);
  });

  it('rechaza una incidencia fechada en el futuro', async () => {
    // Error de reloj o de dedo; aceptarla rompe la reconstrucción cronológica.
    seedIdentity(); seedTransaction();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/incidents').set(AUTH())
      .send({
        kind: 'DELAY', description: 'el buque llega con dos dias de retraso',
        occurredAt: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/future/i);
  });

  it('el robo escala a crítico aunque se reporte como leve', async () => {
    // La severidad la fija el oracle. Si la fijase quien reporta, la escala no
    // significaría nada — y quien tiene incentivo para minimizarla es
    // precisamente quien suele estar reportando.
    seedIdentity(); seedTransaction({ escrow_status: 'LOCKED' });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });                      // UPDATE escrow
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 9, severity: 3 }], rowCount: 1 }); // INSERT disputa
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, reference: 'INC-X' }], rowCount: 1 });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/incidents').set(AUTH())
      .send({ kind: 'THEFT', severity: 'MINOR', description: 'faltan seis palets en la descarga' });

    expect(res.status).toBe(201);
    expect(res.body.verdict.severity).toBe(3);
    expect(res.body.verdict.reportedSeverity).toBe('MINOR');
    expect(res.body.verdict.escalated).toBe(true);
  });

  it('un daño accidental no se trata como intencional', async () => {
    // Puede costar más dinero que un robo pequeño y aun así no es lo mismo:
    // uno es un accidente y el otro es alguien actuando.
    const { toBreach } = require('../../services/cargoLinkClosure');
    expect(toBreach('THEFT', 'x', 'MINOR').tamper).toBe(true);
    expect(toBreach('MISDECLARATION', 'x', 'MINOR').tamper).toBe(true);
    expect(toBreach('CARGO_DAMAGE', 'x', 'CRITICAL').tamper).toBe(false);
    expect(toBreach('HANDLING_ERROR', 'x', 'MINOR').tamper).toBe(false);
  });
});

describe('TX020 — cierre de operación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  /** Las cinco consultas de comprobación, en el orden en que las hace el servicio. */
  function seedChecks({ pendingPay = 0, disputes = 0, incidents = 0, legs = 0 } = {}) {
    mockQuery.mockResolvedValueOnce({
      rows: pendingPay ? [{ status: 'PENDING', n: pendingPay }] : [], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ n: disputes }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ n: incidents }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ n: legs }], rowCount: 1 });
  }

  it('no cierra un envío que aún no se ha entregado', async () => {
    seedIdentity('admin'); seedTransaction({ status: 'IN_TRANSIT' });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // no cerrado ya
    seedChecks();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH()).send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/IN_TRANSIT/);
  });

  it('no cierra con facturas sin liquidar', async () => {
    seedIdentity('admin'); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedChecks({ pendingPay: 2 });
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH()).send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/2 obligación/);
  });

  it('no cierra con una aduana del tránsito sin despachar', async () => {
    seedIdentity('admin'); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedChecks({ legs: 1 });
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH()).send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/aduana/);
  });

  it('no cierra con el escrow retenido', async () => {
    // Dinero de alguien parado: el expediente sigue contablemente abierto por
    // mucho que ponga "cerrado".
    seedIdentity('admin'); seedTransaction({ escrow_status: 'LOCKED' });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedChecks();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH()).send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/escrow/);
  });

  it('cierra cuando de verdad no queda nada pendiente', async () => {
    seedIdentity('admin'); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedChecks();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, reference: 'CLS-X', forced: false }], rowCount: 1 });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH()).send({});
    expect(res.status).toBe(201);
    expect(res.body.forced).toBe(false);
    expect(res.body.checks.every((c) => c.ok)).toBe(true);
  });

  it('forzar exige un motivo', async () => {
    // Sin motivo, la comprobación sería decorativa.
    seedIdentity('admin'); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedChecks({ disputes: 1 });
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH()).send({ force: true });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/forceReason/);
  });

  it('no se puede forzar un cierre que no está bloqueado', async () => {
    // Marcar como forzado un cierre limpio ensuciaría el propio indicador que
    // sirve para encontrar los cierres dudosos.
    seedIdentity('admin'); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedChecks();
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH())
      .send({ force: true, forceReason: 'porque si' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/not applicable/i);
  });

  it('forzado con motivo queda marcado para siempre', async () => {
    seedIdentity('admin'); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedChecks({ disputes: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, reference: 'CLS-Y', forced: true, forced_reason: 'acuerdo extrajudicial' }],
      rowCount: 1 });

    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH())
      .send({ force: true, forceReason: 'acuerdo extrajudicial' });

    expect(res.status).toBe(201);
    expect(res.body.forced).toBe(true);
    expect(res.body.closure.forced_reason).toBe('acuerdo extrajudicial');
  });

  it('no cierra dos veces', async () => {
    seedIdentity('admin'); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [{ reference: 'CLS-VIEJA' }], rowCount: 1 });
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH()).send({});
    expect(res.status).toBe(409);
  });

  it('sólo pos/admin cierran', async () => {
    seedIdentity('carrier'); 
    const res = await request(createApp())
      .post('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH()).send({});
    expect(res.status).toBe(403);
  });

  it('el estado dice qué falta, no sólo que no se puede', async () => {
    seedIdentity('admin'); seedTransaction();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    seedChecks({ pendingPay: 1, incidents: 2 });
    const res = await request(createApp())
      .get('/api/cargolink/v1/tx/BZ-TX-1/close').set(AUTH());

    expect(res.status).toBe(200);
    expect(res.body.canClose).toBe(false);
    expect(res.body.blockers).toEqual(
      expect.arrayContaining(['obligations_settled', 'no_open_incidents']));
    expect(res.body.checks).toHaveLength(6);
  });
});
