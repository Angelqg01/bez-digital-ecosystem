import { describe, it, expect } from 'vitest';
import { SDK_BY_STEP, SDK_BREACH, sdkCallFor, toCurl } from './sdkMap';
import { buildFlow360 } from './flows';

describe('sdkMap — llamadas reales por etapa', () => {
  it('cada etapa del flujo 360° (mar y aire) tiene su llamada a /api/cargolink', () => {
    for (const mode of ['sea', 'air'] as const) {
      for (const step of buildFlow360(mode)) {
        const call = SDK_BY_STEP[step.id];
        expect(call, `etapa ${step.id}`).toBeDefined();
        expect(call.path.startsWith('/v1/')).toBe(true);
      }
    }
  });

  it('no anuncia oráculos ni redes que BeZhas no usa', () => {
    const all = JSON.stringify([SDK_BY_STEP, SDK_BREACH]);
    expect(all).not.toMatch(/chainlink|polygon/i);
  });

  it('con la cadena de frío rota, el tránsito y el destino pasan al Dispute Oracle', () => {
    expect(sdkCallFor(5, true)).toBe(SDK_BY_STEP[5]);     // origen: sin cambio
    expect(sdkCallFor(12, true)).toBe(SDK_BREACH);
    expect(sdkCallFor(12, false)).toBe(SDK_BY_STEP[12]);
  });

  it('el curl sustituye el B-UID y usa la cabecera correcta según el rol', () => {
    const curl = toCurl(SDK_BY_STEP[16], 'TC-1');
    expect(curl).toContain('/api/cargolink/v1/tx/TC-1/advance');
    expect(curl).toContain('x-api-key: $LASTMILE_KEY');
    expect(curl).not.toContain(':bUid');
    expect(toCurl(SDK_BY_STEP[3], 'TC-1')).toContain('x-device-key: $DEVICE_KEY');
  });
});
