require('../helpers');

const geo = require('../../services/cargoGeofence');

// Puerto de Algeciras (approx) — used as the authorized customs zone.
const ALGECIRAS = { lat: 36.1408, lng: -5.4386 };

const circleFence = (over = {}) => ({
  id: 1, name: 'Aduana Algeciras', kind: 'customs',
  center_lat: ALGECIRAS.lat, center_lng: ALGECIRAS.lng, radius_m: 2000,
  polygon: null, enforce: false, status: 'active', ...over,
});

describe('cargoGeofence — geometry', () => {
  it('haversine distance is ~0 for the same point and grows with separation', () => {
    expect(geo.distanceM(36.14, -5.43, 36.14, -5.43)).toBeCloseTo(0, 5);
    const d = geo.distanceM(36.1408, -5.4386, 36.5298, -6.2925); // Algeciras → Cádiz ~80km
    expect(d).toBeGreaterThan(70000);
    expect(d).toBeLessThan(95000);
  });

  it('pointInCircle: inside within radius, outside beyond it', () => {
    const fence = circleFence();
    expect(geo.pointInCircle(36.1410, -5.4380, fence)).toBe(true);
    expect(geo.pointInCircle(36.5298, -6.2925, fence)).toBe(false);
  });

  it('pointInPolygon: ray casting over a square', () => {
    const square = [[0, 0], [0, 10], [10, 10], [10, 0]];
    expect(geo.pointInPolygon(5, 5, square)).toBe(true);
    expect(geo.pointInPolygon(15, 5, square)).toBe(false);
    expect(geo.pointInPolygon(-1, -1, square)).toBe(false);
  });
});

describe('cargoGeofence — evaluatePoint', () => {
  it('returns verified=null when no fences are configured', () => {
    const r = geo.evaluatePoint(36.14, -5.43, []);
    expect(r.verified).toBeNull();
    expect(r.authorizedForUnseal).toBe(false);
    expect(r.corridorExit).toBe(false);
  });

  it('flags authorizedForUnseal inside a customs zone', () => {
    const r = geo.evaluatePoint(36.1410, -5.4380, [circleFence()]);
    expect(r.verified).toBe(true);
    expect(r.authorizedForUnseal).toBe(true);
    expect(r.matched).toContain('Aduana Algeciras');
  });

  it('a route_corridor fence with enforce=true triggers corridorExit outside it', () => {
    const corridor = circleFence({ id: 2, name: 'Corredor A-7', kind: 'route_corridor', enforce: true });
    const inside = geo.evaluatePoint(36.1410, -5.4380, [corridor]);
    const outside = geo.evaluatePoint(37.38, -5.98, [corridor]); // Sevilla
    expect(inside.corridorExit).toBe(false);
    expect(outside.corridorExit).toBe(true);
  });

  it('route corridors do NOT authorize unsealing', () => {
    const corridor = circleFence({ kind: 'route_corridor', enforce: true });
    const r = geo.evaluatePoint(36.1410, -5.4380, [corridor]);
    expect(r.authorizedForUnseal).toBe(false);
  });

  it('ignores non-active fences', () => {
    const r = geo.evaluatePoint(36.1410, -5.4380, [circleFence({ status: 'deleted' })]);
    expect(r.verified).toBeNull();
  });
});
