'use strict';

const nodes = require('../../services/energyNodes');

function fakeDb() {
  const state = { nodes: [], logs: [] };
  const fn = jest.fn(async (sql, p = []) => {
    if (/INSERT INTO vpp_nodes/.test(sql)) {
      const r = { id: p[0], owner_bezhas_id: p[1], name: p[2], type: p[3], location: p[4], capacity_kw: p[5], protocol: p[6], key_hash: p[7], status: 'ACTIVE', created_at: new Date(), last_seen: null };
      state.nodes.push(r); return { rows: [r] };
    }
    if (/FROM vpp_nodes WHERE owner_bezhas_id/.test(sql)) return { rows: state.nodes.filter((n) => n.owner_bezhas_id === p[0] && n.status === 'ACTIVE') };
    if (/UPDATE vpp_nodes SET status/.test(sql)) {
      const n = state.nodes.find((x) => x.id === p[0] && x.owner_bezhas_id === p[1] && x.status === 'ACTIVE');
      if (n) n.status = 'REVOKED'; return { rows: n ? [{ id: n.id }] : [] };
    }
    if (/FROM vpp_nodes WHERE key_hash/.test(sql)) return { rows: state.nodes.filter((n) => n.key_hash === p[0] && n.status === 'ACTIVE') };
    if (/INSERT INTO telemetry_logs/.test(sql)) { state.logs.push(p); return { rows: [] }; }
    if (/UPDATE vpp_nodes SET last_seen/.test(sql)) return { rows: [] };
    if (/FROM telemetry_logs/.test(sql)) return { rows: state.logs.map((l) => ({ node_id: l[0], ts: l[1], output_kw: l[3], consumption_kw: l[4], voltage_v: l[5], grid_frequency: l[6], soc_pct: l[7], temp_c: l[8] })) };
    return { rows: [] };
  });
  return { fn, state };
}

let db;
beforeEach(() => { db = fakeDb(); nodes.__setQueryForTests(db.fn); });
afterAll(() => nodes.__setQueryForTests(null));

describe('registerNode', () => {
  it('crea el nodo y devuelve la clave una sola vez; sólo guarda el hash', async () => {
    const r = await nodes.registerNode('BZ-1', { name: 'Planta Solar Norte', type: 'solar', capacityKw: 500, location: 'Cádiz' });
    expect(r.nodeKey).toMatch(/^bzn_[a-f0-9]{40}$/);
    expect(r.node).toMatchObject({ name: 'Planta Solar Norte', type: 'SOLAR', capacity_kw: 500 });
    expect(JSON.stringify(r.node)).not.toContain(r.nodeKey);
    expect(db.state.nodes[0].key_hash).not.toBe(r.nodeKey);
  });
  it.each([
    [{ name: 'x', type: 'SOLAR', capacityKw: 10 }, 'INVALID_NAME'],
    [{ name: 'Planta', type: 'NUCLEAR', capacityKw: 10 }, 'INVALID_TYPE'],
    [{ name: 'Planta', type: 'SOLAR', capacityKw: -1 }, 'INVALID_CAPACITY'],
    [{ name: 'Planta', type: 'SOLAR', capacityKw: 10, protocol: 'FAX' }, 'INVALID_PROTOCOL'],
  ])('rechaza %j', async (input, code) => {
    await expect(nodes.registerNode('BZ-1', input)).rejects.toMatchObject({ code, status: 422 });
  });
  it('exige titular', async () => {
    await expect(nodes.registerNode(null, { name: 'Planta', type: 'SOLAR', capacityKw: 1 })).rejects.toMatchObject({ status: 401 });
  });
});

describe('authenticate / ingest', () => {
  async function solar() { return nodes.registerNode('BZ-1', { name: 'Planta Solar', type: 'SOLAR', capacityKw: 100 }); }

  it('la clave del nodo autentica y una inválida o revocada no', async () => {
    const { node, nodeKey } = await solar();
    expect((await nodes.authenticate(nodeKey)).id).toBe(node.id);
    expect(await nodes.authenticate('bzn_' + 'a'.repeat(40))).toBeNull();
    expect(await nodes.authenticate('x')).toBeNull();
    await nodes.revokeNode('BZ-1', node.id);
    expect(await nodes.authenticate(nodeKey)).toBeNull();
  });
  it('un titular ajeno no puede revocar el nodo', async () => {
    const { node } = await solar();
    await expect(nodes.revokeNode('BZ-2', node.id)).rejects.toMatchObject({ status: 404 });
  });
  it('guarda una lectura plausible', async () => {
    const { nodeKey } = await solar(); const n = await nodes.authenticate(nodeKey);
    const r = await nodes.ingest(n, { output_kw: 80, voltage_v: 400, grid_frequency: 50.01 });
    expect(r.stored).toBe(true); expect(db.state.logs).toHaveLength(1);
  });
  it.each([
    [{ output_kw: 500 }, /fuera de rango/],             // más potencia que la capacidad declarada
    [{ output_kw: -5 }, /fuera de rango/],              // una planta solar no consume
    [{ output_kw: 10, grid_frequency: 61 }, /grid_frequency/],
    [{ voltage_v: 400 }, /no trae output_kw/],
    [{ output_kw: 10, recordedAt: new Date(Date.now() + 3_600_000).toISOString() }, /futuro/],
    [{ output_kw: 10, recordedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }, /24 h/],
  ])('rechaza la lectura imposible %j', async (body, re) => {
    const { nodeKey } = await solar(); const n = await nodes.authenticate(nodeKey);
    await expect(nodes.ingest(n, body)).rejects.toMatchObject({ code: 'IMPLAUSIBLE_READING', message: expect.stringMatching(re) });
    expect(db.state.logs).toHaveLength(0);
  });
  it('una batería puede tener potencia negativa (cargando)', async () => {
    const { nodeKey } = await nodes.registerNode('BZ-1', { name: 'BESS 1', type: 'BATTERY', capacityKw: 100 });
    const n = await nodes.authenticate(nodeKey);
    await expect(nodes.ingest(n, { output_kw: -60, soc_pct: 55 })).resolves.toMatchObject({ stored: true });
  });
});

describe('buildTelemetry / latestFor', () => {
  it('suma generación, batería y carga; los nodos sin lectura reciente salen OFFLINE', () => {
    const now = new Date();
    const list = [
      { id: 'a', type: 'SOLAR', name: 'S', protocol: 'HTTPS', capacity_kw: 100 },
      { id: 'b', type: 'BATTERY', name: 'B', protocol: 'HTTPS', capacity_kw: 50 },
      { id: 'c', type: 'LOAD', name: 'L', protocol: 'HTTPS', capacity_kw: 80 },
      { id: 'd', type: 'WIND', name: 'W', protocol: 'HTTPS', capacity_kw: 80 },
    ];
    const reads = [
      { node_id: 'a', ts: now, output_kw: 60, grid_frequency: 50.02 },
      { node_id: 'b', ts: now, output_kw: -10 },
      { node_id: 'c', ts: now, consumption_kw: 30 },
      { node_id: 'd', ts: new Date(now - 3_600_000), output_kw: 40 },
    ];
    const t = nodes.buildTelemetry(list, reads, now);
    expect(t.simulated).toBe(false);
    expect(t.nodes.find((n) => n.id === 'd').status).toBe('OFFLINE');
    expect(t.global.total_output_kw).toBe(60);
    expect(t.global.net_flow_kw).toBe(20);       // 60 - 10 - 30
    expect(t.global.grid_frequency).toBe(50.02);
    expect(t.global.self_sufficiency_pct).toBe(100);
  });
  it('sin nodos no hay telemetría propia', async () => {
    expect(await nodes.latestFor('BZ-9')).toEqual({ nodes: [], telemetry: null });
  });
});
