// Modo Sandbox del Simulador 360°: cada etapa ejecuta de verdad las llamadas de
// sdkMap.ts contra una API de BeZhas de PRUEBAS, con claves de rol de prueba, y
// la simulación refleja la respuesta real. El modo Demo no hace ninguna llamada.
//
// Salvaguardas:
//  - Sólo entornos de prueba (localhost, *.localhost, *.test o un host con una
//    etiqueta staging/sandbox/dev/test/qa/preview). Producción se rechaza.
//  - Las claves viven en sessionStorage (se borran al cerrar la pestaña), nunca
//    en localStorage ni en logs, y sólo se envían a la URL base comprobada.
//  - Cada ejecución crea datos nuevos (posRef y deviceId únicos): la API exige
//    unicidad y así no se pisa nada de ejecuciones anteriores.

import { SDK_BY_STEP, SDK_BREACH, SdkCall, CargoRole } from './sdkMap';

export type SandboxRole = Exclude<CargoRole, 'device'>;
export const SANDBOX_ROLES: SandboxRole[] = ['pos', 'customs', 'carrier', 'logistics', 'lastmile'];

export interface SandboxConfig {
  baseUrl: string; // p. ej. http://localhost:3001/api/cargolink
  keys: Partial<Record<SandboxRole, string>>;
}

// ── Entorno permitido ───────────────────────────────────────────────────────

const TEST_LABELS = new Set(['staging', 'sandbox', 'dev', 'test', 'qa', 'preview']);

export function checkTestEnvironment(baseUrl: string, origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'): { ok: boolean; reason: string } {
  let u: URL;
  try { u = new URL(baseUrl, origin); } catch { return { ok: false, reason: 'URL no válida' }; }
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost') || host.endsWith('.test');
  if (isLocal) return { ok: true, reason: 'entorno local' };
  if (u.protocol !== 'https:') return { ok: false, reason: 'un entorno remoto debe usar https' };
  const labels = host.split('.');
  // La última etiqueta (el TLD) no cuenta: «algo.dev» no es un entorno de pruebas.
  if (labels.length >= 3 && labels.slice(0, -1).some((l) => TEST_LABELS.has(l))) return { ok: true, reason: 'entorno de pruebas' };
  return { ok: false, reason: `«${host}» no parece un entorno de pruebas (localhost, *.test o un host con staging/sandbox/dev/test/qa/preview)` };
}

// ── Configuración en sessionStorage ─────────────────────────────────────────

const STORE = 'bz-sim-sandbox-v1';
export const defaultBaseUrl = () => (typeof window !== 'undefined' ? `${window.location.origin}/api/cargolink` : 'http://localhost:3001/api/cargolink');

export function loadSandboxConfig(): SandboxConfig {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORE) : null;
    if (raw) {
      const c = JSON.parse(raw) as SandboxConfig;
      return { baseUrl: c.baseUrl || defaultBaseUrl(), keys: c.keys || {} };
    }
  } catch { /* configuración corrupta: se ignora */ }
  return { baseUrl: defaultBaseUrl(), keys: {} };
}

export function saveSandboxConfig(c: SandboxConfig) {
  try { sessionStorage.setItem(STORE, JSON.stringify(c)); } catch { /* almacenamiento bloqueado */ }
}

export function clearSandboxConfig() {
  try { sessionStorage.removeItem(STORE); } catch { /* nada */ }
}

// ── Resultados ──────────────────────────────────────────────────────────────

export interface SandboxCallResult {
  label: string;
  method: 'GET' | 'POST';
  path: string;
  status: number | null;
  ok: boolean;
  summary: string;
  skipped?: boolean;
}

export interface SandboxStepResult {
  stepId: number;
  ok: boolean;
  skipped: boolean;
  calls: SandboxCallResult[];
}

const hex = (b: ArrayBuffer) => '0x' + Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

const FETCH_TIMEOUT_MS = 10_000;

export class SandboxSession {
  bUid: string | null = null;
  private deviceKey: string | null = null;
  private breachInjected = false;
  readonly runId = Date.now().toString(36);

  constructor(private cfg: SandboxConfig, private doFetch: typeof fetch = (input, init) => fetch(input, init)) {}

  /** Sustituye marcadores del mapa SDK por valores reales de esta ejecución. */
  private async fill(value: unknown, stepId: number): Promise<unknown> {
    if (typeof value === 'string') {
      if (value === ':bUid') return this.bUid;
      if (value === '<ISO>') return new Date().toISOString();
      if (value.startsWith('0x…')) return sha256Hex(`sandbox-pod-${this.bUid}-${this.runId}`);
      return value;
    }
    if (Array.isArray(value)) return Promise.all(value.map((v) => this.fill(v, stepId)));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === 'posRef') out[k] = `POS-SBX-${this.runId}`;
        else if (k === 'deviceId') out[k] = `EDGE-SBX-${this.runId}`;
        else if (k === 'newEta') out[k] = new Date(Date.now() + 86_400_000).toISOString();
        else out[k] = await this.fill(v, stepId);
      }
      return out;
    }
    return value;
  }

  private async exec(call: SdkCall, label: string, stepId: number): Promise<SandboxCallResult> {
    const path = call.path.replace(':bUid', this.bUid ?? ':bUid');
    const base = { label, method: call.method, path } as const;

    if (path.includes(':bUid')) {
      return { ...base, status: null, ok: false, summary: 'sin B-UID: la etapa 1 (POST /v1/tx) no se pudo ejecutar' };
    }
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (call.role === 'device') {
      if (!this.deviceKey) return { ...base, status: null, ok: false, skipped: true, summary: 'sin clave de dispositivo: la etapa 2 (POST /v1/iot/devices) no se pudo ejecutar' };
      headers['x-device-key'] = this.deviceKey;
    } else {
      const key = this.cfg.keys[call.role as SandboxRole];
      if (!key) return { ...base, status: null, ok: false, skipped: true, summary: `falta la clave del rol «${call.role}»` };
      headers['x-api-key'] = key;
    }

    try {
      const res = await this.doFetch(this.cfg.baseUrl.replace(/\/$/, '') + path, {
        method: call.method,
        headers,
        body: call.body ? JSON.stringify(await this.fill(call.body, stepId)) : undefined,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const text = await res.text();
      let j: any = {};
      try { j = JSON.parse(text); } catch { /* respuesta no JSON */ }

      if (res.ok) {
        if (path === '/v1/tx' && call.method === 'POST') this.bUid = j.transaction?.b_uid ?? this.bUid;
        if (path === '/v1/iot/devices') this.deviceKey = j.deviceKey ?? this.deviceKey;
      }
      const anchor = j.anchor?.mode ? ` · ancla: ${j.anchor.mode}` : j.anchor?.txHash ? ` · tx ${String(j.anchor.txHash).slice(0, 12)}…` : '';
      const summary = res.ok
        ? `${j.transaction?.status ? `→ ${j.transaction.status}` : j.result?.mode === 'preview' ? 'vista previa' : 'ok'}${anchor}`
        : (j.error || j.message || `HTTP ${res.status}`).toString().slice(0, 140);
      return { ...base, status: res.status, ok: res.ok, summary };
    } catch (e) {
      const timeout = (e as Error).name === 'TimeoutError';
      return { ...base, status: null, ok: false, summary: timeout ? 'tiempo de espera agotado' : `sin respuesta de la API (${(e as Error).message})` };
    }
  }

  /** Ejecuta las llamadas reales de una etapa (previas + principal) y, si procede, la rotura de frío. */
  async runStep(stepId: number, opts: { breached?: boolean } = {}): Promise<SandboxStepResult> {
    const main = SDK_BY_STEP[stepId];
    if (!main) return { stepId, ok: true, skipped: true, calls: [] };

    const calls: SandboxCallResult[] = [];
    if (main.skipInSandbox) {
      calls.push({ label: 'principal', method: main.method, path: main.path.replace(':bUid', this.bUid ?? ':bUid'), status: null, ok: false, skipped: true, summary: main.skipInSandbox });
    } else {
      for (const b of main.before ?? []) calls.push(await this.exec(b, 'previa', stepId));
      calls.push(await this.exec(main, 'principal', stepId));
    }

    // Rotura de frío: una lectura fuera de rango del Edge Node; el Dispute Oracle de la API
    // abre la disputa. Se inyecta una sola vez, en la primera etapa en que está activa.
    if (opts.breached && stepId >= 11 && !this.breachInjected) {
      this.breachInjected = true;
      calls.push(await this.exec(SDK_BREACH, 'rotura de frío', stepId));
      const d = await this.exec({ method: 'GET', path: '/v1/disputes', role: 'pos', products: [] }, 'disputas', stepId);
      calls.push(d);
    }

    const real = calls.filter((c) => !c.skipped);
    return { stepId, skipped: real.length === 0, ok: real.every((c) => c.ok), calls };
  }
}

export async function pingSandbox(baseUrl: string, doFetch: typeof fetch = (input, init) => fetch(input, init)): Promise<{ ok: boolean; detail: string }> {
  const env = checkTestEnvironment(baseUrl);
  if (!env.ok) return { ok: false, detail: env.reason };
  try {
    const r = await doFetch(baseUrl.replace(/\/$/, '') + '/health', { signal: AbortSignal.timeout(5000) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, detail: `${j.service ?? 'cargolink'} · cadena ${j.blockchain?.contractsConfigured ? 'configurada' : 'sin configurar (los anclajes quedan en not_configured)'}` } : { ok: false, detail: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detail: `sin respuesta (${(e as Error).message})` };
  }
}
