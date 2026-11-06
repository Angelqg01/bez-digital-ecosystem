// Evidencias criptográficas de cada etapa, calculadas en el navegador con el
// MISMO algoritmo que la API y el contrato:
//   - payload_hash: sha256 del JSON canónico, como cargolink_transitions.payload_hash
//     (api/services/cargoLinkLifecycle.js → recordTransition).
//   - Raíz Merkle de telemetría: hoja = sha256 de la fila canónica separada por «|»
//     y pares ordenados con sha256, idéntico a api/services/cargoTelemetryAnchor.js
//     y a TelemetryAnchor.verify (smart-contracts/src/supplychain/TelemetryAnchor.sol).
// Los datos son de la simulación; la criptografía es la real: cualquiera puede
// recalcular la raíz y verificar la prueba de inclusión.

import { SimulationStep } from './types';
import { SdkCall } from './sdkMap';

const enc = new TextEncoder();

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export const toHex = (b: Uint8Array) => '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function compare(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export async function hashPair(a: Uint8Array, b: Uint8Array): Promise<Uint8Array> {
  return compare(a, b) <= 0 ? sha256(concat(a, b)) : sha256(concat(b, a));
}

/** JSON con claves ordenadas, para que el hash no dependa del orden de inserción. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface TelemetryRow {
  id: number;
  device_id: string;
  metric: string;
  value: number | null;
  unit: string;
  lat: number | null;
  lng: number | null;
  breach: boolean;
  event_type: string;
  recorded_at: string;
}

/** Hoja canónica de una lectura: mismo orden y formato que leafFor() de la API. */
export async function leafFor(row: TelemetryRow): Promise<Uint8Array> {
  const canonical = [
    row.id, row.device_id, row.metric,
    row.value === null ? '' : String(Number(row.value)),
    row.unit || '', row.lat === null ? '' : String(Number(row.lat)),
    row.lng === null ? '' : String(Number(row.lng)),
    row.breach ? '1' : '0', row.event_type || '', new Date(row.recorded_at).toISOString(),
  ].join('|');
  return sha256(enc.encode(canonical));
}

export async function merkleRoot(leaves: Uint8Array[]): Promise<Uint8Array | null> {
  if (!leaves.length) return null;
  let level = leaves.slice();
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(await hashPair(level[i], level[i + 1] ?? level[i]));
    level = next;
  }
  return level[0];
}

export async function merkleProof(leaves: Uint8Array[], index: number): Promise<Uint8Array[]> {
  const proof: Uint8Array[] = [];
  let level = leaves.slice();
  let i = index;
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let j = 0; j < level.length; j += 2) next.push(await hashPair(level[j], level[j + 1] ?? level[j]));
    proof.push(level[i % 2 === 0 ? Math.min(i + 1, level.length - 1) : i - 1]);
    i = Math.floor(i / 2);
    level = next;
  }
  return proof;
}

export async function verifyProof(leaf: Uint8Array, proof: Uint8Array[], root: Uint8Array): Promise<boolean> {
  let acc = leaf;
  for (const sibling of proof) acc = await hashPair(acc, sibling);
  return compare(acc, root) === 0;
}

// Etapas cuya llamada produce un lote de telemetría anclable.
const TELEMETRY_STEPS = new Set([3, 11]);

/** Lote determinista de lecturas del Edge Node a partir de la telemetría de la etapa. */
export function telemetryBatch(step: SimulationStep, breached: boolean): TelemetryRow[] {
  const t0 = Date.UTC(2026, 10, 6, 8, 0, 0) + step.id * 3_600_000;
  const temp = parseFloat(step.telemetry?.temp ?? '5') || 5;
  const hum = parseFloat(step.telemetry?.humidity ?? '80') || 80;
  const rows: TelemetryRow[] = [];
  for (let i = 0; i < 8; i++) {
    const metric = i % 2 === 0 ? 'temperature' : 'humidity';
    const value = metric === 'temperature' ? Math.round((temp + Math.sin(i) * 0.3) * 10) / 10 : Math.round(hum + Math.cos(i));
    rows.push({
      id: step.id * 100 + i,
      device_id: 'EDGE-8842',
      metric,
      value,
      unit: metric === 'temperature' ? 'C' : '%',
      lat: 36.13 + i * 0.01,
      lng: -5.45 + i * 0.02,
      breach: breached && metric === 'temperature',
      event_type: 'READING',
      recorded_at: new Date(t0 + i * 120_000).toISOString(),
    });
  }
  return rows;
}

export interface StepEvidence {
  payloadHash: string;
  merkle?: { root: string; leaves: number; proofLength: number; leafIndex: number; verified: boolean };
}

export async function evidenceForStep(step: SimulationStep, call: SdkCall | undefined, bUid: string, breached: boolean): Promise<StepEvidence> {
  const payload = { bUid, stage: step.bUidStage, step: step.id, request: call ? { method: call.method, path: call.path, body: call.body ?? null } : null };
  const payloadHash = toHex(await sha256(enc.encode(canonicalJson(payload))));
  if (!TELEMETRY_STEPS.has(step.id)) return { payloadHash };

  const leaves = await Promise.all(telemetryBatch(step, breached).map(leafFor));
  const root = (await merkleRoot(leaves))!;
  const leafIndex = 0;
  const proof = await merkleProof(leaves, leafIndex);
  return {
    payloadHash,
    merkle: { root: toHex(root), leaves: leaves.length, proofLength: proof.length, leafIndex, verified: await verifyProof(leaves[leafIndex], proof, root) },
  };
}

export interface TelemetryProof {
  rows: TelemetryRow[];
  root: string;
  leafIndex: number;
  leaf: string;
  proof: string[];
  verified: boolean;
}

/**
 * Prueba de inclusión de la última lectura del lote actual del vehículo: lo que
 * devolvería GET /v1/iot/proof y lo que comprobaría TelemetryAnchor.verify.
 */
export async function telemetryProof(step: SimulationStep, breached: boolean): Promise<TelemetryProof> {
  const rows = telemetryBatch(step, breached);
  const leaves = await Promise.all(rows.map(leafFor));
  const root = (await merkleRoot(leaves))!;
  const leafIndex = rows.length - 1;
  const proof = await merkleProof(leaves, leafIndex);
  return {
    rows,
    root: toHex(root),
    leafIndex,
    leaf: toHex(leaves[leafIndex]),
    proof: proof.map(toHex),
    verified: await verifyProof(leaves[leafIndex], proof, root),
  };
}
