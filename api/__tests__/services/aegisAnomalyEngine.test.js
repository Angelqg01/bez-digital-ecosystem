'use strict';

/**
 * Aegis anomaly engine + telemetry signature verification (Phase 2).
 * Pure / in-memory — no broker, DB, or network.
 */

const crypto = require('crypto');
const aegis = require('../../services/aegisAnomalyEngine');
const security = require('../../services/telemetrySecurity');

/** Build a P-256 keypair + sign a payload the way the Edge Gateway does. */
function makeSigner(keyId) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    keyId, publicKeyPem: publicKey,
    sign(payload) {
      const full = { ...payload, keyId };
      return crypto.sign('sha256', security.signingMessage(full), privateKey).toString('base64');
    },
  };
}

function telemetry(extra = {}) {
  return {
    type: 'SOLAR', name: 'Array Alpha', status: 'ONLINE', protocol: 'SunSpec/Modbus-TCP',
    metrics: { output_kw: 18.42, voltage_v: 231.4, grid_frequency: 50.01 },
    ts: '2026-06-27T10:15:00.000Z', seq: 10, ...extra,
  };
}

beforeEach(() => { aegis._reset(); security._reset(); delete process.env.VPP_REQUIRE_SIGNED_TELEMETRY; });

describe('telemetrySecurity.verifyPayload', () => {
  test('valid signature verifies', () => {
    const s = makeSigner('k1'); security.registerKey('k1', s.publicKeyPem);
    const p = telemetry(); p.keyId = 'k1'; p.sig = s.sign(p);
    expect(security.verifyPayload(p)).toMatchObject({ signed: true, valid: true });
  });

  test('tampered payload fails', () => {
    const s = makeSigner('k1'); security.registerKey('k1', s.publicKeyPem);
    const p = telemetry(); p.keyId = 'k1'; p.sig = s.sign(p);
    p.metrics.output_kw = 999;
    expect(security.verifyPayload(p)).toMatchObject({ signed: true, valid: false, reason: 'bad_signature' });
  });

  test('unknown keyId fails', () => {
    const s = makeSigner('k1');
    const p = telemetry(); p.keyId = 'k1'; p.sig = s.sign(p);
    expect(security.verifyPayload(p)).toMatchObject({ signed: true, valid: false, reason: 'unknown_key' });
  });

  test('unsigned reported as not-signed', () => {
    expect(security.verifyPayload(telemetry())).toMatchObject({ signed: false, valid: false });
  });
});

describe('aegis.evaluate', () => {
  test('accepts a valid signed payload', () => {
    const s = makeSigner('k1'); security.registerKey('k1', s.publicKeyPem);
    const p = telemetry(); p.keyId = 'k1'; p.sig = s.sign(p);
    const v = aegis.evaluate({ nodeId: 'n1', payload: p, lastSeq: 9 });
    expect(v.accept).toBe(true);
    expect(v.anomalies).toHaveLength(0);
  });

  test('rejects a spoofed (bad-signature) payload', () => {
    const s = makeSigner('k1'); security.registerKey('k1', s.publicKeyPem);
    const p = telemetry(); p.keyId = 'k1'; p.sig = s.sign(p);
    p.metrics.output_kw = 999;
    const v = aegis.evaluate({ nodeId: 'n1', payload: p, lastSeq: 9 });
    expect(v.accept).toBe(false);
    expect(v.anomalies[0]).toMatchObject({ type: 'SPOOFING_ATTEMPT', severity: 'HIGH' });
  });

  test('rejects a replayed sequence', () => {
    const v = aegis.evaluate({ nodeId: 'n1', payload: telemetry({ seq: 5 }), lastSeq: 5 });
    expect(v.accept).toBe(false);
    expect(v.anomalies[0].type).toBe('REPLAY');
  });

  test('flags a large sequence gap but still accepts', () => {
    const v = aegis.evaluate({ nodeId: 'n1', payload: telemetry({ seq: 200 }), lastSeq: 10 });
    expect(v.accept).toBe(true);
    expect(v.status).toBe('DEGRADED');
    expect(v.anomalies[0].type).toBe('SEQUENCE_GAP');
  });

  test('flags an implausible grid frequency', () => {
    const v = aegis.evaluate({ nodeId: 'n1', payload: telemetry({ metrics: { grid_frequency: 75 } }), lastSeq: 9 });
    expect(v.anomalies.some((a) => a.type === 'IMPLAUSIBLE_VALUE')).toBe(true);
    expect(v.status).toBe('DEGRADED');
  });

  test('rejects unsigned telemetry when signing is enforced', () => {
    process.env.VPP_REQUIRE_SIGNED_TELEMETRY = 'true';
    const v = aegis.evaluate({ nodeId: 'n1', payload: telemetry(), lastSeq: 9 });
    expect(v.accept).toBe(false);
    expect(v.anomalies[0].type).toBe('SPOOFING_ATTEMPT');
  });

  test('accepts unsigned telemetry by default (simulator compatibility)', () => {
    const v = aegis.evaluate({ nodeId: 'n1', payload: telemetry(), lastSeq: 9 });
    expect(v.accept).toBe(true);
    expect(v.anomalies).toHaveLength(0);
  });
});

describe('aegis event log + stats', () => {
  test('records anomalies and surfaces stats', () => {
    const v = aegis.evaluate({ nodeId: 'n1', payload: telemetry({ seq: 5 }), lastSeq: 5 });
    aegis.record(v.anomalies);
    const s = aegis.stats();
    expect(s.replay_attempts).toBe(1);
    expect(s.telemetry_integrity).toBe('FAIL');
    expect(aegis.recentEvents(10)[0].type).toBe('REPLAY');
  });
});
