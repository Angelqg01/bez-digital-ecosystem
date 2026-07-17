require('../helpers');

const anchor = require('../../services/cargoTelemetryAnchor');

const row = (id, over = {}) => ({
  id, device_id: 'dev_abc', metric: 'temperature', value: 5, unit: '°C',
  lat: null, lng: null, breach: false, event_type: 'READING',
  recorded_at: '2026-07-17T09:00:00.000Z', ...over,
});

describe('cargoTelemetryAnchor — merkle (sorted-pair sha256)', () => {
  it('leafFor is deterministic and sensitive to the reading contents', () => {
    const a = anchor.leafFor(row(1));
    const b = anchor.leafFor(row(1));
    const c = anchor.leafFor(row(1, { value: 6 }));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('single-leaf root equals the leaf', () => {
    const leaf = anchor.leafFor(row(1));
    expect(anchor.merkleRoot([leaf]).equals(leaf)).toBe(true);
  });

  it('every leaf of a batch verifies against the root; a forged leaf fails', () => {
    const rows = [row(1), row(2, { value: 7 }), row(3, { metric: 'shock', value: 1 }), row(4, { breach: true }), row(5, { metric: 'gps', lat: 36.1, lng: -5.4 })];
    const leaves = rows.map(anchor.leafFor);
    const root = anchor.merkleRoot(leaves);

    for (let i = 0; i < leaves.length; i++) {
      const proof = anchor.merkleProof(leaves, i);
      expect(anchor.verifyProof(leaves[i], proof, root)).toBe(true);
    }

    const forged = anchor.leafFor(row(2, { value: 99 })); // tampered reading
    const proof = anchor.merkleProof(leaves, 1);
    expect(anchor.verifyProof(forged, proof, root)).toBe(false);
  });

  it('odd-sized batches (duplicate last leaf) still verify', () => {
    const rows = [row(1), row(2), row(3)];
    const leaves = rows.map(anchor.leafFor);
    const root = anchor.merkleRoot(leaves);
    for (let i = 0; i < 3; i++) {
      expect(anchor.verifyProof(leaves[i], anchor.merkleProof(leaves, i), root)).toBe(true);
    }
  });
});
