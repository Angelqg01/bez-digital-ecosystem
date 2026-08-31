'use strict';

/**
 * telemetryAnchor (Phase 4) — merkle batching + on-chain anchor orchestration.
 * Pure SHA-256 logic (no ethers/anvil); a separate node script verifies the real
 * on-chain anchor against EnergyOracle.sol on Anvil.
 */

const anchor = require('../../services/telemetryAnchor');

const signed = (over = {}) => ({
  type: 'SOLAR', name: 'Array Alpha', status: 'ONLINE', protocol: 'SunSpec/Modbus-TCP',
  metrics: { output_kw: 18.42, energy_kwh: 1000, ...(over.metrics || {}) },
  ts: '2026-06-27T10:15:00.000Z', seq: over.seq || 1, keyId: 'edge-key-1', sig: over.sig || 'sigA',
});

beforeEach(() => anchor._reset());
afterEach(() => anchor._reset());

describe('merkle root', () => {
  test('empty batch → zero hash', () => {
    expect(anchor.merkleRoot([])).toBe('0x' + '0'.repeat(64));
  });
  test('deterministic for the same leaves', () => {
    const a = anchor.leafHash(signed());
    const b = anchor.leafHash(signed());
    expect(a).toBe(b);
    expect(anchor.merkleRoot([a, b])).toBe(anchor.merkleRoot([a, b]));
  });
  test('changes when any leaf changes (tamper-evident)', () => {
    const r1 = anchor.merkleRoot([anchor.leafHash(signed({ sig: 'sigA' })), anchor.leafHash(signed({ seq: 2, sig: 'sigB' }))]);
    const r2 = anchor.merkleRoot([anchor.leafHash(signed({ sig: 'sigA' })), anchor.leafHash(signed({ seq: 2, sig: 'TAMPERED' }))]);
    expect(r1).not.toBe(r2);
  });
  test('odd leaf count duplicates the last node', () => {
    const l = [anchor.leafHash(signed({ seq: 1 })), anchor.leafHash(signed({ seq: 2 })), anchor.leafHash(signed({ seq: 3 }))];
    expect(anchor.merkleRoot(l)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('observe + buildBatch', () => {
  test('accumulates accepted signed telemetry and computes kWh delta', () => {
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed({ seq: 1, metrics: { energy_kwh: 1000 } }) });
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed({ seq: 2, sig: 'sigB', metrics: { energy_kwh: 1015 } }) });
    const batch = anchor.buildBatch('n1');
    expect(batch.count).toBe(2);
    expect(batch.kWh).toBe(15); // 1015 - 1000
    expect(batch.period).toBe('2026-06-27');
    expect(batch.root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(anchor.buildBatch('n1')).toBeNull(); // cleared after build
  });

  test('ignores unsigned or rejected telemetry', () => {
    anchor.observe({ nodeId: 'n1', accepted: true, payload: { ...signed(), sig: undefined } });
    anchor.observe({ nodeId: 'n1', accepted: false, payload: signed() });
    expect(anchor.pendingNodes()).toHaveLength(0);
  });
});

describe('anchorPending', () => {
  test('skips when the oracle bridge is disabled', async () => {
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed({ metrics: { energy_kwh: 1000 } }) });
    const res = await anchor.anchorPending({ isOracleEnabled: () => false }, '0xabc');
    expect(res).toEqual([]);
  });

  test('calls the bridge to register + anchor each pending node', async () => {
    const calls = { register: [], anchor: [] };
    const bridge = {
      isOracleEnabled: () => true,
      registerNodeOnChain: async (nodeId, account) => { calls.register.push([nodeId, account]); return { ok: true }; },
      anchorTelemetryOnChain: async (proofId, nodeId, account, kWh, period, root) => { calls.anchor.push({ proofId, nodeId, account, kWh, period, root }); return { ok: true, hash: '0xdead' }; },
    };
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed({ seq: 1, metrics: { energy_kwh: 1000 } }) });
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed({ seq: 2, sig: 'sigB', metrics: { energy_kwh: 1020 } }) });

    const res = await anchor.anchorPending(bridge, '0xBEEF');
    expect(calls.register).toEqual([['n1', '0xBEEF']]);
    expect(calls.anchor).toHaveLength(1);
    expect(calls.anchor[0].kWh).toBe(20);
    expect(calls.anchor[0].root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(res[0].ok).toBe(true);
    expect(res[0].tx).toBe('0xdead');
  });

  test('skips a node whose batch has zero kWh (submitProof requires kWh>0)', async () => {
    const bridge = { isOracleEnabled: () => true, registerNodeOnChain: jest.fn(), anchorTelemetryOnChain: jest.fn() };
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed({ metrics: { output_kw: 5 } }) }); // no energy_kwh → kWh 0
    const res = await anchor.anchorPending(bridge, '0xBEEF');
    expect(res).toHaveLength(0);
    expect(bridge.anchorTelemetryOnChain).not.toHaveBeenCalled();
  });

  test('retains the leaves of a non-anchorable batch instead of discarding them', async () => {
    const bridge = { isOracleEnabled: () => true, registerNodeOnChain: jest.fn(), anchorTelemetryOnChain: jest.fn() };
    // A battery at rest: signed readings, energy counter flat at 10.
    for (const seq of [1, 2, 3]) {
      anchor.observe({ nodeId: 'bat-02', accepted: true, payload: signed({ seq, sig: `sig${seq}`, metrics: { energy_kwh: 10 } }) });
    }
    expect(anchor.pendingCounts()).toEqual({ 'bat-02': 3 });

    expect(await anchor.anchorPending(bridge, '0xBEEF')).toHaveLength(0);

    expect(anchor.pendingCounts()).toEqual({ 'bat-02': 3 }); // evidence survives
  });

  test('anchors the retained leaves once the counter finally advances', async () => {
    const anchored = [];
    const bridge = {
      isOracleEnabled: () => true,
      registerNodeOnChain: async () => ({ ok: true }),
      anchorTelemetryOnChain: async (proofId, nodeId, account, kWh, period, root) => { anchored.push({ kWh, root }); return { ok: true, hash: '0xdead' }; },
    };
    anchor.observe({ nodeId: 'bat-02', accepted: true, payload: signed({ seq: 1, sig: 'sig1', metrics: { energy_kwh: 10 } }) });
    anchor.observe({ nodeId: 'bat-02', accepted: true, payload: signed({ seq: 2, sig: 'sig2', metrics: { energy_kwh: 10 } }) });
    await anchor.anchorPending(bridge, '0xBEEF'); // interval 1: nothing to accredit

    anchor.observe({ nodeId: 'bat-02', accepted: true, payload: signed({ seq: 3, sig: 'sig3', metrics: { energy_kwh: 17 } }) });
    const res = await anchor.anchorPending(bridge, '0xBEEF'); // interval 2: 17 - 10

    expect(anchored).toHaveLength(1);
    expect(anchored[0].kWh).toBe(7);
    expect(res[0].count).toBe(3);      // all three readings under one root
    expect(res[0].dropped).toBe(0);
    expect(anchor.pendingCounts()).toEqual({}); // consumed only once anchored
  });

  test('bounds the retained buffer, dropping the oldest leaves and counting them', async () => {
    const prev = process.env.VPP_ANCHOR_MAX_PENDING_LEAVES;
    process.env.VPP_ANCHOR_MAX_PENDING_LEAVES = '4';
    try {
      for (let seq = 1; seq <= 6; seq++) {
        anchor.observe({ nodeId: 'bat-03', accepted: true, payload: signed({ seq, sig: `sig${seq}`, metrics: { energy_kwh: 10 } }) });
      }
      expect(anchor.pendingCounts()).toEqual({ 'bat-03': 4 });

      // The kWh window is unchanged, so the batch stays truthful about energy;
      // `dropped` tells the auditor the root covers fewer readings.
      const batch = anchor.buildBatch('bat-03', { consume: false });
      expect(batch.count).toBe(4);
      expect(batch.dropped).toBe(2);
    } finally {
      if (prev === undefined) delete process.env.VPP_ANCHOR_MAX_PENDING_LEAVES;
      else process.env.VPP_ANCHOR_MAX_PENDING_LEAVES = prev;
    }
  });
});
