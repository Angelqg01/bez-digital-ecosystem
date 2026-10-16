'use strict';

/**
 * energyNodes — «conectar mi planta» a la VPP de BeZhas.
 *
 *   registerNode  → alta de un nodo (solar, eólica, hidráulica, batería o carga controlable) y su clave bzn_… (una sola vez)
 *   authenticate  → clave del nodo → nodo activo
 *   ingest        → lectura enviada por el nodo (HTTPS) → telemetry_logs, con validación de plausibilidad
 *   latestFor     → última lectura reciente de cada nodo del titular, con la forma de /telemetry
 *
 * La telemetría real nunca se mezcla con la simulada: si el titular no tiene lecturas recientes, la ruta lo dice.
 */

const crypto = require('crypto');

let _query = null;
const q = () => _query || require('../db/pool').query;
const __setQueryForTests = (fn) => { _query = fn; };

const NODE_TYPES = ['SOLAR', 'WIND', 'HYDRO', 'BATTERY', 'LOAD'];
const PROTOCOLS = ['HTTPS', 'MQTT', 'MODBUS', 'OPC-UA', 'IEC-104'];
const MAX_CAPACITY_KW = 2_000_000;
const STALE_MIN = 15;

class NodeError extends Error {
  constructor(message, status = 400, code = 'NODE_ERROR') { super(message); this.status = status; this.code = code; }
}

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

function publicNode(r) {
  return {
    id: r.id, name: r.name, type: r.type, location: r.location, capacity_kw: Number(r.capacity_kw),
    protocol: r.protocol, status: r.status, registered: r.created_at, last_seen: r.last_seen || null,
  };
}

async function registerNode(ownerBezhasId, input = {}) {
  if (!ownerBezhasId) throw new NodeError('Sesión sin BeZhas_ID', 401, 'NO_OWNER');
  const name = String(input.name || '').trim();
  if (name.length < 2 || name.length > 80) throw new NodeError('name debe tener entre 2 y 80 caracteres', 422, 'INVALID_NAME');
  const type = String(input.type || '').toUpperCase();
  if (!NODE_TYPES.includes(type)) throw new NodeError(`type debe ser uno de ${NODE_TYPES.join(', ')}`, 422, 'INVALID_TYPE');
  const capacity = num(input.capacityKw ?? input.capacity_kw);
  if (!Number.isFinite(capacity) || capacity <= 0 || capacity > MAX_CAPACITY_KW) {
    throw new NodeError(`capacityKw debe estar entre 0 y ${MAX_CAPACITY_KW}`, 422, 'INVALID_CAPACITY');
  }
  const protocol = String(input.protocol || 'HTTPS').toUpperCase();
  if (!PROTOCOLS.includes(protocol)) throw new NodeError(`protocol debe ser uno de ${PROTOCOLS.join(', ')}`, 422, 'INVALID_PROTOCOL');
  const location = input.location ? String(input.location).trim().slice(0, 120) : null;

  const id = `nd-${crypto.randomBytes(4).toString('hex')}`;
  const key = `bzn_${crypto.randomBytes(20).toString('hex')}`;
  const { rows } = await q()(
    `INSERT INTO vpp_nodes (id, owner_bezhas_id, name, type, location, capacity_kw, protocol, key_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, ownerBezhasId, name, type, location, capacity, protocol, sha256(key)]
  );
  return { node: publicNode(rows[0]), nodeKey: key };
}

async function listNodes(ownerBezhasId) {
  const { rows } = await q()(
    `SELECT * FROM vpp_nodes WHERE owner_bezhas_id = $1 AND status = 'ACTIVE' ORDER BY created_at`, [ownerBezhasId]
  );
  return rows.map(publicNode);
}

async function revokeNode(ownerBezhasId, id) {
  const { rows } = await q()(
    `UPDATE vpp_nodes SET status = 'REVOKED' WHERE id = $1 AND owner_bezhas_id = $2 AND status = 'ACTIVE' RETURNING id`,
    [id, ownerBezhasId]
  );
  if (!rows.length) throw new NodeError('Nodo no encontrado', 404, 'NODE_NOT_FOUND');
  return { id: rows[0].id, status: 'REVOKED' };
}

async function authenticate(key) {
  if (!key || !/^bzn_[a-f0-9]{40}$/.test(key)) return null;
  const { rows } = await q()(`SELECT * FROM vpp_nodes WHERE key_hash = $1 AND status = 'ACTIVE'`, [sha256(key)]);
  return rows[0] || null;
}

/** Lectura plausible para este nodo. Devuelve la lista de problemas (vacía si vale). Pura. */
function validateReading(node, r, now = Date.now()) {
  const problems = [];
  const cap = Number(node.capacity_kw);
  const bounded = (name, v, lo, hi) => { if (v !== null && (!Number.isFinite(v) || v < lo || v > hi)) problems.push(`${name} fuera de rango [${lo}, ${hi}]`); };
  if (node.type === 'LOAD') bounded('consumption_kw', r.consumption_kw, 0, cap * 1.2);
  else if (node.type === 'BATTERY') bounded('output_kw', r.output_kw, -cap * 1.2, cap * 1.2);
  else bounded('output_kw', r.output_kw, 0, cap * 1.2);
  bounded('grid_frequency', r.grid_frequency, 45, 55);
  bounded('voltage_v', r.voltage_v, 0, 1_000_000);
  bounded('soc_pct', r.soc_pct, 0, 100);
  bounded('temp_c', r.temp_c, -60, 200);
  bounded('energy_kwh', r.energy_kwh, 0, 1e12);
  if (r.output_kw === null && r.consumption_kw === null && r.soc_pct === null) problems.push('la lectura no trae output_kw, consumption_kw ni soc_pct');
  if (r.ts.getTime() > now + 5 * 60_000) problems.push('recordedAt está en el futuro');
  if (r.ts.getTime() < now - 24 * 3_600_000) problems.push('recordedAt tiene más de 24 h');
  return problems;
}

async function ingest(node, body = {}, now = Date.now()) {
  const ts = body.recordedAt ? new Date(body.recordedAt) : new Date(now);
  if (Number.isNaN(ts.getTime())) throw new NodeError('recordedAt no es una fecha válida', 422, 'INVALID_TIMESTAMP');
  const reading = {
    ts,
    output_kw: num(body.output_kw ?? body.outputKw), consumption_kw: num(body.consumption_kw ?? body.consumptionKw),
    voltage_v: num(body.voltage_v ?? body.voltageV), grid_frequency: num(body.grid_frequency ?? body.gridFrequency),
    soc_pct: num(body.soc_pct ?? body.socPct), temp_c: num(body.temp_c ?? body.tempC), energy_kwh: num(body.energy_kwh ?? body.energyKwh),
  };
  const problems = validateReading(node, reading, now);
  if (problems.length) throw Object.assign(new NodeError(`Lectura rechazada: ${problems.join('; ')}`, 422, 'IMPLAUSIBLE_READING'), { problems });

  await q()(
    `INSERT INTO telemetry_logs (node_id, ts, type, status, output_kw, consumption_kw, voltage_v, grid_frequency, soc_pct, temp_c, energy_kwh, metrics, signed)
     VALUES ($1,$2,$3,'ONLINE',$4,$5,$6,$7,$8,$9,$10,$11,FALSE)`,
    [node.id, ts, node.type, reading.output_kw, reading.consumption_kw, reading.voltage_v, reading.grid_frequency,
      reading.soc_pct, reading.temp_c, reading.energy_kwh, JSON.stringify({ source: 'https-node' })]
  );
  await q()(`UPDATE vpp_nodes SET last_seen = NOW() WHERE id = $1`, [node.id]);
  return { stored: true, node_id: node.id, recorded_at: ts.toISOString() };
}

/** Forma de /telemetry a partir de nodos y su última lectura. Pura. */
function buildTelemetry(nodes, readings, now = new Date()) {
  const byNode = new Map(readings.map((r) => [r.node_id, r]));
  const out = nodes.map((n) => {
    const r = byNode.get(n.id);
    const fresh = r && (now.getTime() - new Date(r.ts).getTime()) <= STALE_MIN * 60_000;
    const base = { id: n.id, type: n.type, name: n.name, protocol: n.protocol, capacity_kw: n.capacity_kw, status: fresh ? 'ONLINE' : 'OFFLINE', last_reading_at: r ? new Date(r.ts).toISOString() : null };
    if (!fresh) return base;
    const f = (v) => (v === null || v === undefined ? undefined : Number(v));
    if (n.type === 'LOAD') return { ...base, consumption_kw: f(r.consumption_kw), voltage_v: f(r.voltage_v) };
    return { ...base, output_kw: f(r.output_kw), voltage_v: f(r.voltage_v), soc_pct: f(r.soc_pct), temp_c: f(r.temp_c) };
  });
  const gen = out.filter((n) => n.output_kw !== undefined && n.type !== 'BATTERY').reduce((a, n) => a + n.output_kw, 0);
  const bess = out.filter((n) => n.type === 'BATTERY' && n.output_kw !== undefined).reduce((a, n) => a + n.output_kw, 0);
  const load = out.filter((n) => n.type === 'LOAD' && n.consumption_kw !== undefined).reduce((a, n) => a + n.consumption_kw, 0);
  const freqs = readings.filter((r) => r.grid_frequency !== null && r.grid_frequency !== undefined).map((r) => Number(r.grid_frequency)).filter(Number.isFinite);
  return {
    timestamp: now.toISOString(),
    simulated: false,
    source: 'nodos propios (HTTPS)',
    global: {
      net_flow_kw: parseFloat((gen + bess - load).toFixed(2)),
      total_output_kw: parseFloat((gen + Math.max(bess, 0)).toFixed(2)),
      grid_frequency: freqs.length ? freqs[freqs.length - 1] : null,
      self_sufficiency_pct: load > 0 ? parseFloat(Math.min(100, ((gen + Math.max(bess, 0)) / load) * 100).toFixed(1)) : null,
    },
    nodes: out,
  };
}

async function latestFor(ownerBezhasId, now = new Date()) {
  const nodes = await listNodes(ownerBezhasId);
  if (!nodes.length) return { nodes: [], telemetry: null };
  const { rows } = await q()(
    `SELECT DISTINCT ON (node_id) node_id, ts, output_kw, consumption_kw, voltage_v, grid_frequency, soc_pct, temp_c
       FROM telemetry_logs WHERE node_id = ANY($1::text[]) AND ts > NOW() - INTERVAL '24 hours'
      ORDER BY node_id, ts DESC`, [nodes.map((n) => n.id)]
  );
  return { nodes, telemetry: buildTelemetry(nodes, rows, now) };
}

module.exports = { NODE_TYPES, PROTOCOLS, NodeError, registerNode, listNodes, revokeNode, authenticate, validateReading, ingest, buildTelemetry, latestFor, __setQueryForTests };
