/**
 * Prometheus metrics for the VPP/energy domain.
 *
 * Guards the two properties that make these numbers trustworthy:
 *   • counters survive the truncation of the lossy in-memory sources
 *     (Aegis ring buffer = 500 events, arbitrage log = 500 decisions);
 *   • pull gauges report live state at scrape time, never a stale zero.
 */
const { register, energy } = require('../../middleware/metrics');
const broker = require('../../services/vppMqttBroker');
const anchor = require('../../services/telemetryAnchor');
const aegis = require('../../services/aegisAnomalyEngine');

/**
 * Value of one series, or undefined if absent. Accepts histogram suffixes
 * (`_count`, `_sum`), which prom-client reports under the base metric name.
 */
async function series(name, labels = {}) {
  const all = await register.getMetricsAsJSON();
  const m = all.find((x) => x.name === name)
         || all.find((x) => name.startsWith(`${x.name}_`));
  if (!m) return undefined;
  const hit = m.values.find((v) =>
    (v.metricName ? v.metricName === name : m.name === name) &&
    Object.entries(labels).every(([k, val]) => String(v.labels[k]) === String(val)));
  return hit ? hit.value : undefined;
}

const signed = (seq, metrics) => ({ type: 'SOLAR', seq, sig: '0xabc', keyId: 'k1', metrics });

beforeEach(() => { broker._reset(); anchor._reset(); aegis._reset(); });

describe('telemetry ingest counters', () => {
  it('counts accepted and rejected payloads separately, labelled by node', async () => {
    const before = await series('bezhas_energy_telemetry_total',
      { node_id: 'n-ing', signed: 'false', accepted: 'true' }) || 0;

    broker.ingest('n-ing', { type: 'SOLAR', seq: 1, metrics: { output_kw: 5 } });

    expect(await series('bezhas_energy_telemetry_total',
      { node_id: 'n-ing', signed: 'false', accepted: 'true' })).toBe(before + 1);
  });

  it('counts a replayed payload as rejected, not accepted', async () => {
    broker.ingest('n-replay', { type: 'SOLAR', seq: 5, metrics: { output_kw: 1 } });
    const acceptedBefore = await series('bezhas_energy_telemetry_total',
      { node_id: 'n-replay', signed: 'false', accepted: 'true' });

    broker.ingest('n-replay', { type: 'SOLAR', seq: 5, metrics: { output_kw: 1 } }); // replay

    expect(await series('bezhas_energy_telemetry_total',
      { node_id: 'n-replay', signed: 'false', accepted: 'false' })).toBe(1);
    // the rejected one must not have inflated the accepted series
    expect(await series('bezhas_energy_telemetry_total',
      { node_id: 'n-replay', signed: 'false', accepted: 'true' })).toBe(acceptedBefore);
  });

  it('records the signature status, which is what DMR-001 is derived from', async () => {
    // An unverifiable signature is a spoofing attempt, not a valid reading:
    // it must land in the signed+rejected bucket, and raise the anomaly.
    broker.ingest('n-sig', signed(1, { output_kw: 3 }));

    expect(await series('bezhas_energy_telemetry_total',
      { node_id: 'n-sig', signed: 'true', accepted: 'false' })).toBe(1);
    expect(await series('bezhas_energy_anomalies_total',
      { node_id: 'n-sig', type: 'SPOOFING_ATTEMPT', severity: 'HIGH' })).toBe(1);
  });
});

describe('anomaly counters', () => {
  it('labels anomalies by type and severity', async () => {
    broker.ingest('n-anom', { type: 'SOLAR', seq: 1, metrics: { grid_frequency: 99 } });

    expect(await series('bezhas_energy_anomalies_total',
      { node_id: 'n-anom', type: 'IMPLAUSIBLE_VALUE', severity: 'WARNING' })).toBe(1);
  });

  it('outlives the Aegis ring buffer — the whole point of exporting them', async () => {
    // stats() reads a 500-event ring buffer; the counter must not follow it down.
    for (let i = 0; i < 3; i++) {
      aegis.record([{ id: `x${i}`, ts: new Date().toISOString(), node: 'n-ring',
        type: 'REPLAY', severity: 'HIGH', message: 'm', result: 'FAIL' }]);
    }
    aegis._reset(); // buffer wiped, as truncation would eventually do

    expect(aegis.stats().replay_attempts).toBe(0);        // source forgot
    expect(await series('bezhas_energy_anomalies_total',
      { node_id: 'n-ring', type: 'REPLAY', severity: 'HIGH' })).toBe(3); // counter did not
  });
});

describe('anchor counters', () => {
  const bridge = (ok) => ({
    isOracleEnabled: () => true,
    registerNodeOnChain: async () => ({ ok: true }),
    anchorTelemetryOnChain: async () => ({ ok, hash: ok ? '0xfeed' : null }),
  });

  it('adds the batch kWh only when the anchor actually succeeded', async () => {
    anchor.observe({ nodeId: 'n-ok', accepted: true, payload: signed(1, { energy_kwh: 100 }) });
    anchor.observe({ nodeId: 'n-ok', accepted: true, payload: signed(2, { energy_kwh: 142 }) });
    await anchor.anchorPending(bridge(true), '0xabc');

    expect(await series('bezhas_energy_kwh_anchored_total', { node_id: 'n-ok' })).toBe(42);
    expect(await series('bezhas_energy_anchor_batches_total', { status: 'ok' })).toBe(1);
  });

  it('does not credit kWh for a failed submission', async () => {
    anchor.observe({ nodeId: 'n-fail', accepted: true, payload: signed(1, { energy_kwh: 10 }) });
    anchor.observe({ nodeId: 'n-fail', accepted: true, payload: signed(2, { energy_kwh: 60 }) });
    await anchor.anchorPending(bridge(false), '0xabc');

    expect(await series('bezhas_energy_kwh_anchored_total', { node_id: 'n-fail' })).toBeUndefined();
    expect(await series('bezhas_energy_anchor_batches_total', { status: 'failed' })).toBe(1);
  });

  it('observes anchor latency', async () => {
    anchor.observe({ nodeId: 'n-lat', accepted: true, payload: signed(1, { energy_kwh: 1 }) });
    anchor.observe({ nodeId: 'n-lat', accepted: true, payload: signed(2, { energy_kwh: 9 }) });
    const before = await series('bezhas_energy_anchor_latency_seconds_count') || 0;

    await anchor.anchorPending(bridge(true), '0xabc');

    expect(await series('bezhas_energy_anchor_latency_seconds_count')).toBe(before + 1);
  });
});

describe('pull gauges', () => {
  it('reports node count and per-node staleness from live broker state', async () => {
    broker.ingest('g-1', { type: 'SOLAR', seq: 1, metrics: { output_kw: 1 } });
    broker.ingest('g-2', { type: 'BATTERY', seq: 1, metrics: { soc_pct: 50 } });

    expect(await series('bezhas_energy_nodes_known')).toBe(2);
    expect(await series('bezhas_energy_telemetry_staleness_seconds', { node_id: 'g-1' }))
      .toBeGreaterThanOrEqual(0);
  });

  it('drops the staleness series for a node that no longer exists', async () => {
    broker.ingest('g-gone', { type: 'SOLAR', seq: 1, metrics: { output_kw: 1 } });
    expect(await series('bezhas_energy_telemetry_staleness_seconds', { node_id: 'g-gone' }))
      .toBeDefined();

    broker._reset(); // node disappears

    // must go absent, not freeze at its last value and keep looking healthy
    expect(await series('bezhas_energy_telemetry_staleness_seconds', { node_id: 'g-gone' }))
      .toBeUndefined();
  });

  it('exposes readings buffered and not yet anchored', async () => {
    anchor.observe({ nodeId: 'g-pend', accepted: true, payload: signed(1, { energy_kwh: 5 }) });
    anchor.observe({ nodeId: 'g-pend', accepted: true, payload: signed(2, { energy_kwh: 7 }) });

    expect(await series('bezhas_energy_pending_readings', { node_id: 'g-pend' })).toBe(2);
  });
});

describe('arbitrage decision counter', () => {
  it('separates outcome from strategy', async () => {
    energy.arbitrage('DISCHARGE_SELL', 'blocked');
    energy.arbitrage('DISCHARGE_SELL', 'dispatched');

    expect(await series('bezhas_energy_arbitrage_decisions_total',
      { strategy: 'DISCHARGE_SELL', outcome: 'blocked' })).toBe(1);
    expect(await series('bezhas_energy_arbitrage_decisions_total',
      { strategy: 'DISCHARGE_SELL', outcome: 'dispatched' })).toBe(1);
  });
});
