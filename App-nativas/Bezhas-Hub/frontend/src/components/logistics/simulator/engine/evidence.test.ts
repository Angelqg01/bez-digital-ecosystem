import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  leafFor, merkleRoot, merkleProof, verifyProof, toHex, telemetryBatch, evidenceForStep, canonicalJson, TelemetryRow,
} from './evidence';
import { buildFlow360 } from './flows';
import { SDK_BY_STEP } from './sdkMap';

// Copia literal del algoritmo de api/services/cargoTelemetryAnchor.js (node:crypto).
// Si alguien cambia uno de los dos lados sin el otro, este test falla.
const sha = (b: Buffer) => createHash('sha256').update(b).digest();
const apiLeaf = (row: TelemetryRow) => sha(Buffer.from([
  row.id, row.device_id, row.metric,
  row.value === null ? '' : String(Number(row.value)),
  row.unit || '', row.lat === null ? '' : String(Number(row.lat)),
  row.lng === null ? '' : String(Number(row.lng)),
  row.breach ? '1' : '0', row.event_type || '', new Date(row.recorded_at).toISOString(),
].join('|'), 'utf8'));
const apiPair = (a: Buffer, b: Buffer) => (Buffer.compare(a, b) <= 0 ? sha(Buffer.concat([a, b])) : sha(Buffer.concat([b, a])));
const apiRoot = (leaves: Buffer[]) => {
  let level = leaves.slice();
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(apiPair(level[i], level[i + 1] ?? level[i]));
    level = next;
  }
  return level[0];
};

const step11 = buildFlow360('sea').find((s) => s.id === 11)!;

describe('evidence — misma criptografía que la API y TelemetryAnchor', () => {
  it('la hoja y la raíz coinciden con las de la API', async () => {
    const rows = telemetryBatch(step11, false);
    const leaves = await Promise.all(rows.map(leafFor));
    expect(leaves.map(toHex)).toEqual(rows.map((r) => '0x' + apiLeaf(r).toString('hex')));
    expect(toHex((await merkleRoot(leaves))!)).toBe('0x' + apiRoot(rows.map(apiLeaf)).toString('hex'));
  });

  it('la prueba de inclusión verifica cada lectura y rechaza una alterada', async () => {
    const leaves = await Promise.all(telemetryBatch(step11, false).map(leafFor));
    const root = (await merkleRoot(leaves))!;
    for (let i = 0; i < leaves.length; i++) {
      expect(await verifyProof(leaves[i], await merkleProof(leaves, i), root)).toBe(true);
    }
    const tampered = await leafFor({ ...telemetryBatch(step11, false)[0], value: 9.9 });
    expect(await verifyProof(tampered, await merkleProof(leaves, 0), root)).toBe(false);
  });

  it('la rotura de frío cambia la raíz (la evidencia no se puede maquillar)', async () => {
    const a = await evidenceForStep(step11, SDK_BY_STEP[11], 'TC-1', false);
    const b = await evidenceForStep(step11, SDK_BY_STEP[11], 'TC-1', true);
    expect(a.merkle?.verified).toBe(true);
    expect(a.merkle?.root).not.toBe(b.merkle?.root);
  });

  it('el payload_hash es determinista e independiente del orden de las claves', async () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    const s1 = buildFlow360('sea')[0];
    const x = await evidenceForStep(s1, SDK_BY_STEP[1], 'TC-1', false);
    const y = await evidenceForStep(s1, SDK_BY_STEP[1], 'TC-1', false);
    expect(x.payloadHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(x.payloadHash).toBe(y.payloadHash);
    expect(x.merkle).toBeUndefined();
  });
});

describe('telemetryProof — ficha del vehículo', () => {
  it('prueba la última lectura contra la raíz del lote y coincide con la API', async () => {
    const { telemetryProof } = await import('./evidence');
    const p = await telemetryProof(step11, false);
    expect(p.verified).toBe(true);
    expect(p.leafIndex).toBe(p.rows.length - 1);
    expect(p.root).toBe('0x' + apiRoot(p.rows.map(apiLeaf)).toString('hex'));
    expect(p.leaf).toBe('0x' + apiLeaf(p.rows[p.leafIndex]).toString('hex'));
  });
});
