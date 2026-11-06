import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildRoute } from './routePath';
import { buildFlow360 } from '../engine/flows';
import { LOCATIONS, TransitMode } from '../engine/types';

const MODES: TransitMode[] = ['sea', 'air'];

describe('routePath — el vehículo sigue la ruta dibujada', () => {
  it.each(MODES)('cada parada del flujo (%s) tiene su distancia sobre la ruta', (mode) => {
    const route = buildRoute(mode);
    for (const step of buildFlow360(mode)) {
      expect(route.distanceOf(step.locationIndex), `etapa ${step.id}`).toBeDefined();
    }
  });

  it.each(MODES)('las paradas se recorren en orden creciente de distancia (%s)', (mode) => {
    const route = buildRoute(mode);
    const d = buildFlow360(mode).map((s) => route.distanceOf(s.locationIndex)!);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1] - 1e-6);
    expect(d[0]).toBeCloseTo(0, 5);
    expect(d[d.length - 1]).toBeCloseTo(route.total, 3);
  });

  it.each(MODES)('a la distancia de cada parada, la ruta pasa por el edificio (%s)', (mode) => {
    const route = buildRoute(mode);
    const p = new THREE.Vector3();
    for (const step of buildFlow360(mode)) {
      route.pointAt(route.distanceOf(step.locationIndex)!, p);
      const [x, , z] = LOCATIONS[step.locationIndex].position;
      expect(Math.hypot(p.x - x, p.z - z), LOCATIONS[step.locationIndex].name).toBeLessThan(0.08);
    }
  });

  it.each(MODES)('la trayectoria es continua: sin saltos entre muestras consecutivas (%s)', (mode) => {
    const route = buildRoute(mode);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const N = 1500;
    const maxStep = (route.total / N) * 1.6;
    route.pointAt(0, a);
    for (let i = 1; i <= N; i++) {
      route.pointAt((route.total * i) / N, b);
      expect(a.distanceTo(b)).toBeLessThan(maxStep);
      a.copy(b);
    }
  });

  it('el avión sube y baja siguiendo la geometría; el barco va rasante', () => {
    const peak = (mode: TransitMode) => {
      const route = buildRoute(mode);
      const p = new THREE.Vector3();
      let max = 0;
      for (let i = 0; i <= 400; i++) { route.pointAt((route.total * i) / 400, p); max = Math.max(max, p.y); }
      return max;
    };
    expect(peak('air')).toBeGreaterThan(3.5);
    expect(peak('sea')).toBeLessThan(0.5);

    const air = buildRoute('air');
    const start = air.pointAt(air.distanceOf(11)!, new THREE.Vector3());
    const end = air.pointAt(air.distanceOf(12)!, new THREE.Vector3());
    expect(start.y).toBeLessThan(0.2);   // despega del suelo
    expect(end.y).toBeLessThan(0.2);     // aterriza
  });

  it('los tramos comparten el punto de unión (sin hueco entre origen, tránsito y destino)', () => {
    for (const mode of MODES) {
      const r = buildRoute(mode);
      const end0 = r.curves[0].getPointAt(1);
      const start1 = r.curves[1].getPointAt(0);
      const end1 = r.curves[1].getPointAt(1);
      const start2 = r.curves[2].getPointAt(0);
      expect(end0.distanceTo(start1)).toBeLessThan(1e-6);
      expect(end1.distanceTo(start2)).toBeLessThan(1e-6);
    }
  });
});
