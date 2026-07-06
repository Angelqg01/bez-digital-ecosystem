'use strict';

/**
 * energyTelemetryStore (Phase 3) — verifies capture → batch → flush and the
 * history/analytics queries against a MOCK query fn. No live Postgres needed;
 * a follow-up integration test covers a real TimescaleDB instance.
 */

const store = require('../../services/energyTelemetryStore');

function mockQuery() {
  const calls = [];
  const fn = async (text, params) => {
    calls.push({ text, params });
    // Emulate SELECT results for the read paths.
    if (/FROM telemetry_logs/.test(text) && /COUNT\(\*\)/.test(text)) {
      return { rows: [{ samples: 3, avg_output_kw: '18.4', peak_output_kw: '19.5' }] };
    }
    if (/FROM telemetry_logs/.test(text)) return { rows: [{ ts: 't', output_kw: '18.4' }] };
    if (/FROM aegis_events/.test(text)) return { rows: [{ type: 'SPOOFING_ATTEMPT' }] };
    return { rows: [] };
  };
  fn.calls = calls;
  return fn;
}

const signedPayload = () => ({
  type: 'SOLAR', name: 'Array Alpha', status: 'ONLINE', protocol: 'SunSpec/Modbus-TCP',
  metrics: { output_kw: 18.42, voltage_v: 231.4, grid_frequency: 50.01, energy_kwh: 1234.5 },
  ts: '2026-06-27T10:15:00.000Z', seq: 11, keyId: 'edge-key-1', sig: 'abc',
});

beforeEach(() => store.__reset());
afterEach(() => store.__reset());

describe('capture + flush', () => {
  test('accepted signed telemetry queues a row + a TELEMETRY_VALIDATED event', () => {
    store.capture({ nodeId: 'n1', payload: signedPayload(), verdict: { anomalies: [] }, accepted: true });
    expect(store.__queueLengths()).toEqual({ telemetry: 1, events: 1 });
  });

  test('rejected telemetry queues the anomaly event but NO telemetry row', () => {
    store.capture({
      nodeId: 'n1', payload: signedPayload(), accepted: false,
      verdict: { anomalies: [{ ts: 't', type: 'SPOOFING_ATTEMPT', severity: 'HIGH', result: 'FAIL', message: 'bad sig' }] },
    });
    expect(store.__queueLengths()).toEqual({ telemetry: 0, events: 1 });
  });

  test('flush issues batched INSERTs with correct params and clears the queue', async () => {
    const q = mockQuery();
    store.__setQueryForTests(q);
    store.capture({ nodeId: 'n1', payload: signedPayload(), verdict: { anomalies: [] }, accepted: true });
    store.capture({ nodeId: 'n2', payload: signedPayload(), verdict: { anomalies: [] }, accepted: true });

    const res = await store.flush();
    expect(res.telemetry).toBe(2);

    const tInsert = q.calls.find((c) => /INSERT INTO telemetry_logs/.test(c.text));
    expect(tInsert).toBeTruthy();
    // 2 rows × 15 cols = 30 bind params.
    expect(tInsert.params).toHaveLength(30);
    expect(tInsert.text).toMatch(/\$30/);
    // First row, output_kw column (5th of 15).
    expect(tInsert.params[4]).toBe(18.42);
    expect(store.__queueLengths()).toEqual({ telemetry: 0, events: 0 });
  });

  test('flush is a no-op when queues are empty', async () => {
    const q = mockQuery();
    store.__setQueryForTests(q);
    const res = await store.flush();
    expect(res).toEqual({ telemetry: 0, events: 0 });
    expect(q.calls).toHaveLength(0);
  });

  test('a flush DB error drops rows without throwing', async () => {
    store.__setQueryForTests(async () => { throw new Error('db down'); });
    store.capture({ nodeId: 'n1', payload: signedPayload(), verdict: { anomalies: [] }, accepted: true });
    await expect(store.flush()).resolves.toBeDefined();
    expect(store.__queueLengths()).toEqual({ telemetry: 0, events: 0 });
  });
});

describe('bulkInsert SQL builder', () => {
  test('builds positional placeholders for N rows', () => {
    const { text, params } = store.bulkInsert('t', 'a, b', [[1, 2], [3, 4]], 2);
    expect(text).toBe('INSERT INTO t (a, b) VALUES ($1,$2),($3,$4)');
    expect(params).toEqual([1, 2, 3, 4]);
  });
});

describe('reads', () => {
  test('getHistory queries telemetry_logs with node + window', async () => {
    const q = mockQuery();
    store.__setQueryForTests(q);
    const rows = await store.getHistory('n1', { hours: 12, limit: 50 });
    expect(rows).toHaveLength(1);
    const call = q.calls[0];
    expect(call.text).toMatch(/FROM telemetry_logs/);
    expect(call.params).toEqual(['n1', '12', 50]);
  });

  test('getAnalytics aggregates over the window', async () => {
    const q = mockQuery();
    store.__setQueryForTests(q);
    const stats = await store.getAnalytics('n1', { hours: 24 });
    expect(stats.samples).toBe(3);
    expect(q.calls[0].text).toMatch(/COUNT\(\*\)/);
  });
});
