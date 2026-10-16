'use strict';
/** Conectar una planta: alta de nodo, clave, ingesta HTTPS y marcado de datos simulados. */
const request = require('supertest');
const { mockQuery, makeToken } = require('../helpers');

const app = require('../../index');
const auth = () => ({ Authorization: `Bearer ${makeToken({ bezhas_id: 'BZ-OWNER1' })}` });

beforeEach(() => mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 }));

describe('POST /api/energy/nodes', () => {
  it('exige sesión', async () => {
    expect((await request(app).post('/api/energy/nodes').send({})).status).toBe(401);
  });

  it('da de alta el nodo y devuelve la clave una sola vez', async () => {
    mockQuery.mockImplementationOnce(async (_sql, p) => ({ rows: [{ id: p[0], owner_bezhas_id: p[1], name: p[2], type: p[3], location: p[4], capacity_kw: p[5], protocol: p[6], status: 'ACTIVE', created_at: new Date() }] }));
    const res = await request(app).post('/api/energy/nodes').set(auth()).send({ name: 'Parque Solar Sur', type: 'SOLAR', capacityKw: 1200 });
    expect(res.status).toBe(201);
    expect(res.body.nodeKey).toMatch(/^bzn_[a-f0-9]{40}$/);
    expect(res.body.node).toMatchObject({ name: 'Parque Solar Sur', capacity_kw: 1200 });
    expect(JSON.stringify(mockQuery.mock.calls[0][1])).not.toContain(res.body.nodeKey);   // sólo se guarda el hash
    expect(res.body.ingest.path).toBe('/api/energy/telemetry/ingest');
  });

  it('rechaza un tipo inventado con 422', async () => {
    const res = await request(app).post('/api/energy/nodes').set(auth()).send({ name: 'Central', type: 'FUSION', capacityKw: 10 });
    expect(res.status).toBe(422); expect(res.body.code).toBe('INVALID_TYPE');
  });
});

describe('POST /api/energy/telemetry/ingest', () => {
  it('sin clave o con clave desconocida → 401', async () => {
    expect((await request(app).post('/api/energy/telemetry/ingest').send({ output_kw: 1 })).status).toBe(401);
    const res = await request(app).post('/api/energy/telemetry/ingest').set('Authorization', `Bearer bzn_${'b'.repeat(40)}`).send({ output_kw: 1 });
    expect(res.status).toBe(401); expect(res.body.code).toBe('INVALID_NODE_KEY');
  });

  it('con clave válida guarda la lectura (201) y rechaza una imposible (422)', async () => {
    const node = { id: 'nd-0a0b0c0d', type: 'SOLAR', capacity_kw: 100 };
    mockQuery.mockImplementation(async (sql) => (/FROM vpp_nodes WHERE key_hash/.test(sql) ? { rows: [node] } : { rows: [] }));
    const key = `Bearer bzn_${'c'.repeat(40)}`;
    const ok = await request(app).post('/api/energy/telemetry/ingest').set('Authorization', key).send({ output_kw: 70, grid_frequency: 50 });
    expect(ok.status).toBe(201); expect(ok.body).toMatchObject({ stored: true, node_id: 'nd-0a0b0c0d' });

    const node2 = { id: 'nd-1a1b1c1d', type: 'SOLAR', capacity_kw: 100 };
    mockQuery.mockImplementation(async (sql) => (/FROM vpp_nodes WHERE key_hash/.test(sql) ? { rows: [node2] } : { rows: [] }));
    const bad = await request(app).post('/api/energy/telemetry/ingest').set('Authorization', key).send({ output_kw: 9000 });
    expect(bad.status).toBe(422); expect(bad.body.code).toBe('IMPLAUSIBLE_READING');
  });
});

describe('datos de demostración marcados', () => {
  it('GET /nodes sin nodos propios devuelve la demo con simulated:true', async () => {
    const res = await request(app).get('/api/energy/nodes').set(auth());
    expect(res.status).toBe(200); expect(res.body.simulated).toBe(true);
  });
  it('GET /nodes con nodos propios devuelve sólo los suyos, simulated:false', async () => {
    mockQuery.mockImplementation(async (sql) => (/FROM vpp_nodes WHERE owner_bezhas_id/.test(sql)
      ? { rows: [{ id: 'nd-aabbccdd', name: 'Mi planta', type: 'WIND', capacity_kw: 300, protocol: 'HTTPS', status: 'ACTIVE', created_at: new Date() }] } : { rows: [] }));
    const res = await request(app).get('/api/energy/nodes').set(auth());
    expect(res.body).toMatchObject({ simulated: false, total: 1 }); expect(res.body.nodes[0].id).toBe('nd-aabbccdd');
  });
});

describe('POST /api/energy/control sobre nodos propios', () => {
  const op = () => ({ Authorization: `Bearer ${makeToken({ role: 'operator', bezhas_id: 'BZ-OWNER1' })}` });
  // requireRole consulta users.role en la BD: el operador existe; los nodos propios se parametrizan.
  const db = (ownNodes = []) => mockQuery.mockImplementation(async (sql) => {
    if (/FROM users WHERE wallet_address/.test(sql)) return { rows: [{ role: 'operator' }] };
    if (/FROM vpp_nodes WHERE owner_bezhas_id/.test(sql)) return { rows: ownNodes };
    return { rows: [] };
  });
  const bess = { id: 'nd-aabbccdd', name: 'BESS', type: 'BATTERY', capacity_kw: 100, protocol: 'HTTPS', status: 'ACTIVE', created_at: new Date() };

  it('un operador no puede mandar a un nodo de otro titular (404)', async () => {
    db([]);
    const res = await request(app).post('/api/energy/control').set(op()).send({ nodeId: 'nd-deadbeef', command: 'CHARGE_BATTERY' });
    expect(res.status).toBe(404); expect(res.body.code).toBe('NODE_NOT_FOUND');
  });

  it('un comando que no existe en SCADA se rechaza (START/STOP ya no son comandos)', async () => {
    db([]);
    const res = await request(app).post('/api/energy/control').set(op()).send({ nodeId: 'n1', command: 'START' });
    expect(res.status).toBe(422);
  });

  it('con nodo propio el comando se firma, pero dice que no se entregó si no hay edge MQTT', async () => {
    db([bess]);
    const res = await request(app).post('/api/energy/control').set(op()).send({ nodeId: 'nd-aabbccdd', command: 'CHARGE_BATTERY', params: { powerKw: 50 } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, signed: true, delivered: false });
    expect(res.body.warning).toMatch(/Ningún equipo/);
  });

  it('un comando que exige aprobación humana se encola (202) y no se despacha', async () => {
    db([{ ...bess, type: 'LOAD' }]);
    const res = await request(app).post('/api/energy/control').set(op()).send({ nodeId: 'nd-aabbccdd', command: 'SHED_LOAD', params: { durationMin: 30 } });
    expect(res.status).toBe(202); expect(res.body.hitl_pending).toBe(true);
  });
});

describe('el histórico y la analítica de un nodo propio no se filtran a otros titulares', () => {
  it.each(['/api/energy/telemetry/nd-deadbeef/history', '/api/energy/analytics?nodeId=nd-deadbeef'])('GET %s → 404 si el nodo no es mío', async (url) => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get(url).set(auth());
    expect(res.status).toBe(404);
  });
  it('y lo lee quien es su titular', async () => {
    mockQuery.mockImplementation(async (sql) => (/FROM vpp_nodes WHERE owner_bezhas_id/.test(sql)
      ? { rows: [{ id: 'nd-deadbeef', name: 'X', type: 'SOLAR', capacity_kw: 10, protocol: 'HTTPS', status: 'ACTIVE', created_at: new Date() }] } : { rows: [] }));
    const res = await request(app).get('/api/energy/analytics?nodeId=nd-deadbeef').set(auth());
    expect(res.status).toBe(200);
  });
});
