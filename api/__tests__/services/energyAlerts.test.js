'use strict';

const { buildAlerts, hourlyCurve } = require('../../services/energyAlerts');

const day = (fn) => Array.from({ length: 24 }, (_, h) => ({ hour: h + 1, price_es: fn(h) }));
// Hora de Madrid (CEST, UTC+2 en octubre): el servidor puede ir en UTC y no debe importar.
const at = (h) => new Date(Date.UTC(2026, 9, 16, h - 2, 10));

describe('hourlyCurve', () => {
  it('promedia los cuartos de hora de una curva de 96 períodos', () => {
    const c = Array.from({ length: 96 }, (_, i) => ({ hour: i + 1, price_es: Math.floor(i / 4) * 10 }));
    const h = hourlyCurve(c);
    expect(h).toHaveLength(24); expect(h[5]).toEqual({ hour: 5, price: 50 });
  });
  it('curva vacía → vacío', () => expect(hourlyCurve([])).toEqual([]));
});

describe('buildAlerts con datos reales', () => {
  const nodes = [{ id: 'nd-1', type: 'BATTERY' }, { id: 'nd-2', type: 'LOAD' }];

  it('precio actual alto → ventana de descarga con el nodo de batería', () => {
    const omie = { price_eur_mwh: 120, curve: day(() => 120) };
    const a = buildAlerts({ omie, nodes, now: at(10) }).find((x) => x.type === 'ARBITRAGE_DISCHARGE');
    expect(a.message).toMatch(/120\.00/); expect(a.message).toMatch(/batería/); expect(a.action).toMatchObject({ command: 'DISCHARGE_BATTERY', nodeId: 'nd-1' });
  });
  it('precio negativo publicado dentro de 3 h → aviso con su hora', () => {
    const curve = day((h) => (h === 13 ? -4 : 50)); const omie = { price_eur_mwh: 50, curve };
    const a = buildAlerts({ omie, nodes, now: at(10) }).find((x) => x.type === 'NEGATIVE_PRICE_IMMINENT');
    expect(a.message).toContain('13:00'); expect(a.severity).toBe('WARNING');
  });
  it('mínimo barato en las próximas 6 h → carga; sin batería la acción es null', () => {
    const omie = { price_eur_mwh: 60, curve: day((h) => (h === 14 ? 12 : 60)) };
    const a = buildAlerts({ omie, nodes: [], now: at(10) }).find((x) => x.type === 'ARBITRAGE_CHARGE');
    expect(a.message).toContain('14:00'); expect(a.action).toBeNull();
  });
  it('pico por encima de la media → ventana de respuesta a la demanda', () => {
    const omie = { price_eur_mwh: 60, curve: day((h) => (h === 14 ? 200 : 60)) };
    const a = buildAlerts({ omie, nodes, now: at(10) }).find((x) => x.type === 'DEMAND_RESPONSE_WINDOW');
    expect(a.action).toMatchObject({ command: 'SHED_LOAD', nodeId: 'nd-2' });
  });
  it('precio plano y normal → ninguna alerta de mercado', () => {
    const omie = { price_eur_mwh: 55, curve: day(() => 55) };
    expect(buildAlerts({ omie, nodes, now: at(10) })).toEqual([]);
  });
  it('no inventa nada: sin OMIE ni eventos no hay alertas, y con demo avisa de que es demo', () => {
    expect(buildAlerts({ omie: null, now: at(10) })).toEqual([]);
    const a = buildAlerts({ omie: null, simulated: true, now: at(10) });
    expect(a).toHaveLength(1); expect(a[0].type).toBe('TELEMETRY_SIMULATED');
  });
  it('los fallos de Aegis se cuentan y los PASS no generan alerta', () => {
    const ev = [{ result: 'FAIL', type: 'REPLAY' }, { result: 'FAIL', type: 'SPOOFING_ATTEMPT' }, { result: 'PASS', type: 'TELEMETRY_VALIDATED' }];
    const a = buildAlerts({ omie: null, aegisEvents: ev, now: at(10) });
    expect(a).toHaveLength(1); expect(a[0]).toMatchObject({ severity: 'HIGH', type: 'AEGIS_ANOMALY' }); expect(a[0].message).toMatch(/2 evento/);
  });
});

describe('zona horaria', () => {
  it('con el reloj del servidor en UTC se usa la hora de Madrid', () => {
    const { madridParts } = require('../../services/energyFeedService');
    expect(madridParts(new Date(Date.UTC(2026, 9, 16, 6, 8))).hour).toBe(8);
    expect(madridParts(new Date(Date.UTC(2026, 9, 16, 23, 30)))).toMatchObject({ day: '17', hour: 1 });   // cambio de día
  });
});

describe('texto según los nodos del titular', () => {
  it('sin batería no habla de descargarla', () => {
    const omie = { price_eur_mwh: 120, curve: Array.from({ length: 24 }, (_, h) => ({ hour: h + 1, price_es: 120 })) };
    const a = buildAlerts({ omie, nodes: [{ id: 'nd-1', type: 'SOLAR' }], now: new Date(Date.UTC(2026, 9, 16, 8, 10)) }).find((x) => x.type === 'ARBITRAGE_DISCHARGE');
    expect(a.message).toMatch(/excedentes/); expect(a.message).not.toMatch(/batería/); expect(a.action).toBeNull();
  });
});
