import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { checkTestEnvironment, SandboxSession, SANDBOX_ROLES, SandboxConfig } from './sandbox';
import { SDK_BY_STEP } from './sdkMap';

const require = createRequire(import.meta.url);
// Los validadores reales de la API (módulo puro, sin base de datos).
const { validateTransition } = require('../../../../../../../../api/services/cargoLinkValidators.js');

describe('checkTestEnvironment — el sandbox nunca apunta a producción', () => {
  it.each([
    'http://localhost:3001/api/cargolink',
    'http://127.0.0.1:3101/api/cargolink',
    'http://[::1]:3001/api/cargolink',
    'http://hub.localhost/api/cargolink',
    'http://api.bezhas.test/api/cargolink',
    'https://staging.bezhas.com/api/cargolink',
    'https://api.sandbox.bezhas.com/api/cargolink',
    '/api/cargolink', // relativa: se resuelve contra el origen (aquí localhost)
  ])('permite %s', (u) => expect(checkTestEnvironment(u, 'http://localhost:5173').ok).toBe(true));

  it.each([
    'https://api.bezhas.com/api/cargolink',
    'https://bezhas.com/api/cargolink',
    'https://energy.bezhas.com/api/cargolink',
    'https://example.dev/api/cargolink',        // «.dev» es un TLD, no una etiqueta de entorno
    'http://staging.bezhas.com/api/cargolink',  // remoto sin https
    'not a url',
  ])('rechaza %s', (u) => expect(checkTestEnvironment(u, 'https://hub.bezhas.com').ok).toBe(false));

  it('una URL relativa en una página de producción se rechaza', () => {
    expect(checkTestEnvironment('/api/cargolink', 'https://hub.bezhas.com').ok).toBe(false);
  });
});

// API simulada: registra cada llamada y responde como lo haría la real.
function fakeApi() {
  const calls: { method: string; url: string; headers: Record<string, string>; body: any }[] = [];
  let n = 0;
  const fetchImpl = (async (url: string, init: any) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, url, headers: init.headers, body });
    const path = url.replace('http://localhost:3101/api/cargolink', '');
    const json = (status: number, o: unknown) => ({ ok: status < 400, status, text: async () => JSON.stringify(o) });
    if (path === '/v1/tx') return json(201, { success: true, transaction: { b_uid: 'BZ-LOG-TEST000001', status: 'CREATED' } });
    if (path === '/v1/iot/devices') return json(201, { success: true, deviceKey: 'bzd_test', device: { device_id: 'x' } });
    if (path.endsWith('/advance')) return json(200, { transaction: { status: body.to }, anchor: { anchored: false, mode: 'not_configured' } });
    if (path === '/v1/disputes') return json(200, { disputes: [{ id: ++n }] });
    return json(200, { success: true });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const KEYS: SandboxConfig['keys'] = Object.fromEntries(SANDBOX_ROLES.map((r) => [r, `k_${r}`]));
const cfg = (keys = KEYS): SandboxConfig => ({ baseUrl: 'http://localhost:3101/api/cargolink', keys });

describe('SandboxSession — ejecuta las llamadas reales de cada etapa', () => {
  it('la etapa 1 crea el B-UID con posRef único y las siguientes lo usan', async () => {
    const { calls, fetchImpl } = fakeApi();
    const s = new SandboxSession(cfg(), fetchImpl);
    const r1 = await s.runStep(1);
    expect(r1.ok).toBe(true);
    expect(s.bUid).toBe('BZ-LOG-TEST000001');
    expect(calls[0].body.posRef).toBe(`POS-SBX-${s.runId}`);
    expect(calls[0].headers['x-api-key']).toBe('k_pos');

    await s.runStep(4);
    expect(calls[1].url).toContain('/v1/tx/BZ-LOG-TEST000001/advance');
    expect(calls[1].headers['x-api-key']).toBe('k_logistics');
    expect(calls[1].body).toMatchObject({ to: 'GATE_IN', payload: { quantityKg: 900 } });
  });

  it('dos ejecuciones no reutilizan posRef ni deviceId', async () => {
    const a = new SandboxSession(cfg(), fakeApi().fetchImpl);
    await new Promise((r) => setTimeout(r, 3));
    const b = new SandboxSession(cfg(), fakeApi().fetchImpl);
    expect(a.runId).not.toBe(b.runId);
  });

  it('la etapa 2 registra el dispositivo y la 3 envía la telemetría con su clave', async () => {
    const { calls, fetchImpl } = fakeApi();
    const s = new SandboxSession(cfg(), fetchImpl);
    await s.runStep(1); await s.runStep(2);
    const r3 = await s.runStep(3);
    expect(r3.ok).toBe(true);
    const tel = calls.find((c) => c.url.endsWith('/v1/iot/telemetry'))!;
    expect(tel.headers['x-device-key']).toBe('bzd_test');
    expect(tel.headers['x-api-key']).toBeUndefined();
    expect(tel.body.bUid).toBe('BZ-LOG-TEST000001');
    expect(tel.body.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('la etapa 11 avanza a IN_TRANSIT ANTES de anclar la telemetría', async () => {
    const { calls, fetchImpl } = fakeApi();
    const s = new SandboxSession(cfg(), fetchImpl);
    await s.runStep(1);
    const n0 = calls.length;
    await s.runStep(11);
    const made = calls.slice(n0).map((c) => `${c.method} ${c.url.split('/api/cargolink')[1]}`);
    expect(made).toEqual(['POST /v1/tx/BZ-LOG-TEST000001/advance', 'POST /v1/iot/anchor/BZ-LOG-TEST000001']);
  });

  it('la etapa 16 envía un hash real de la firma de entrega', async () => {
    const { calls, fetchImpl } = fakeApi();
    const s = new SandboxSession(cfg(), fetchImpl);
    await s.runStep(1); await s.runStep(16);
    const d = calls.at(-1)!;
    expect(d.body.to).toBe('DELIVERED');
    expect(d.body.payload.signatureHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('sin la clave de un rol, la etapa se salta explicando por qué (no falla ni llama)', async () => {
    const { calls, fetchImpl } = fakeApi();
    const s = new SandboxSession(cfg({ pos: 'k_pos' }), fetchImpl);
    await s.runStep(1);
    const r = await s.runStep(4);
    expect(r.skipped).toBe(true);
    expect(r.calls[0].summary).toContain('falta la clave del rol «logistics»');
    expect(calls).toHaveLength(1);
  });

  it('si la etapa 1 falla, las demás no lanzan llamadas con «:bUid»', async () => {
    const failing = (async () => ({ ok: false, status: 500, text: async () => JSON.stringify({ error: 'boom' }) })) as unknown as typeof fetch;
    const s = new SandboxSession(cfg(), failing);
    const r1 = await s.runStep(1);
    expect(r1.ok).toBe(false);
    expect(r1.calls[0].summary).toBe('boom');
    const r4 = await s.runStep(4);
    expect(r4.ok).toBe(false);
    expect(r4.calls[0].summary).toContain('sin B-UID');
  });

  it('la custodia final se salta: sólo el custodio actual puede cederla', async () => {
    const { fetchImpl } = fakeApi();
    const s = new SandboxSession(cfg(), fetchImpl);
    await s.runStep(1);
    const r = await s.runStep(15);
    expect(r.skipped).toBe(true);
    expect(r.calls[0].summary).toContain('custodio actual');
  });

  it('la rotura de frío se inyecta una sola vez, como telemetría fuera de rango, y consulta las disputas', async () => {
    const { calls, fetchImpl } = fakeApi();
    const s = new SandboxSession(cfg(), fetchImpl);
    await s.runStep(1); await s.runStep(2);
    const r11 = await s.runStep(11, { breached: true });
    const r12 = await s.runStep(12, { breached: true });
    const breach = calls.filter((c) => c.url.endsWith('/v1/iot/telemetry') && c.body?.temperature === 22.8);
    expect(breach).toHaveLength(1);
    expect(r11.calls.map((c) => c.label)).toContain('rotura de frío');
    expect(r11.calls.map((c) => c.path)).toContain('/v1/disputes');
    expect(r12.calls.map((c) => c.label)).not.toContain('rotura de frío');
  });
});

describe('contrato con la API real — los cuerpos del mapa SDK pasan sus validadores', () => {
  const advances = Object.entries(SDK_BY_STEP).filter(([, c]) => c.path.endsWith('/advance'));
  const baseTx = { b_uid: 'BZ-LOG-X', pos_ref: 'POS-1', cargo: { value: 18500, weight: 900, items: [{ x: 6, y: 1.2, weight: 900 }] }, escrow_status: 'LOCKED' };

  it.each(advances)('etapa %s: avance válido para el validador de la API', (_id, call) => {
    const body = call.body as { to: string; payload: Record<string, unknown> };
    // Mismos marcadores que sustituye el Sandbox.
    const payload = JSON.parse(JSON.stringify(body.payload).replace(/"0x…[^"]*"/, `"0x${'ab'.repeat(32)}"`));
    const v = validateTransition(body.to, baseTx, payload);
    expect(v.reasons.filter(() => !v.valid), `${body.to}: ${v.reasons.join('; ')}`).toEqual([]);
    expect(v.valid).toBe(true);
  });

  it('el despacho aduanero y la estiba (que pasan por los validadores) son válidos', () => {
    const customs = SDK_BY_STEP[6].body as Record<string, unknown>;
    expect(validateTransition('CUSTOMS_CLEARED', baseTx, customs).valid).toBe(true);
    const stow = SDK_BY_STEP[8].body as Record<string, unknown>;
    expect(validateTransition('STOWED', baseTx, stow).valid).toBe(true);
  });
});
