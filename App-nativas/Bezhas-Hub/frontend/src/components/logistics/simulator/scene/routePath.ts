import * as THREE from 'three';
import { LOCATIONS, TransitMode } from '../engine/types';

/**
 * Ruta del envío como una única trayectoria continua.
 *
 * Antes cada tramo se dibujaba con una curva y el vehículo iba en línea recta
 * hacia la siguiente parada (el barco cruzaba tierra y el avión usaba una
 * distancia fija de 15 para su arco). Ahora las líneas dibujadas y el vehículo
 * comparten estas mismas curvas: el vehículo se coloca por «distancia
 * recorrida» sobre la ruta, así que nunca se sale del camino y el arco del
 * avión sale de la propia geometría del tramo internacional.
 */

export const ROUTE_STOPS: Record<TransitMode, { land: number[]; transit: number[]; dest: number[] }> = {
  sea: { land: [0, 1, 2, 3, 4, 5, 6], transit: [6, 7], dest: [7, 8, 9, 10] },
  air: { land: [0, 1, 2, 3, 4, 5, 11], transit: [11, 12], dest: [12, 8, 9, 10] },
};

const GROUND_Y = 0.06;
// Altura del punto medio del tramo internacional: arco alto (avión) o rasante (barco).
const TRANSIT_LIFT: Record<TransitMode, number> = { sea: 0.25, air: 4.5 };
const DIVISIONS_PER_SPAN = 100;

export interface Route {
  mode: TransitMode;
  /** Curvas por tramo: origen, tránsito internacional, destino. */
  curves: [THREE.CatmullRomCurve3, THREE.CatmullRomCurve3, THREE.CatmullRomCurve3];
  /** Longitud de cada tramo y total. */
  lengths: [number, number, number];
  total: number;
  /** Distancia desde el inicio de la ruta hasta cada parada (índice de LOCATIONS). */
  distanceOf: (locationIndex: number) => number | undefined;
  /** Posición en la ruta a la distancia d (se limita a [0, total]). */
  pointAt: (d: number, out: THREE.Vector3) => THREE.Vector3;
  /** Índice de tramo (0 origen, 1 internacional, 2 destino) a la distancia d. */
  segmentAt: (d: number) => 0 | 1 | 2;
}

function makeCurve(stops: number[], lift = 0): THREE.CatmullRomCurve3 {
  const pts = stops.map((i) => new THREE.Vector3(LOCATIONS[i].position[0], GROUND_Y, LOCATIONS[i].position[2]));
  if (lift && pts.length === 2) {
    // El tramo internacional sólo tiene dos paradas: se añade un punto intermedio elevado.
    pts.splice(1, 0, pts[0].clone().lerp(pts[1], 0.5).setY(lift));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
}

/** Distancia (longitud de arco) a la que cada punto de control queda sobre la curva. */
function controlDistances(curve: THREE.CatmullRomCurve3): number[] {
  const n = curve.points.length;
  const spans = n - 1;
  const divisions = spans * DIVISIONS_PER_SPAN;
  curve.arcLengthDivisions = divisions;
  curve.updateArcLengths();
  const cum = curve.getLengths(divisions);
  // El punto de control i está en el parámetro u = i / spans, es decir en el índice i·DIVISIONS_PER_SPAN.
  return Array.from({ length: n }, (_, i) => cum[i * DIVISIONS_PER_SPAN]);
}

const cache = new Map<TransitMode, Route>();

export function buildRoute(mode: TransitMode): Route {
  const hit = cache.get(mode);
  if (hit) return hit;

  const s = ROUTE_STOPS[mode];
  const curves: Route['curves'] = [makeCurve(s.land), makeCurve(s.transit, TRANSIT_LIFT[mode]), makeCurve(s.dest)];
  const cd = curves.map(controlDistances);
  const lengths = cd.map((c) => c[c.length - 1]) as Route['lengths'];
  const total = lengths[0] + lengths[1] + lengths[2];
  const starts: [number, number, number] = [0, lengths[0], lengths[0] + lengths[1]];

  const dist = new Map<number, number>();
  s.land.forEach((loc, i) => { if (!dist.has(loc)) dist.set(loc, starts[0] + cd[0][i]); });
  // El tramo internacional tiene un punto de control intermedio: sus paradas son el primero y el último.
  dist.set(s.transit[0], starts[1]);
  dist.set(s.transit[1], starts[1] + lengths[1]);
  s.dest.forEach((loc, i) => { if (!dist.has(loc)) dist.set(loc, starts[2] + cd[2][i]); });

  const segmentAt = (d: number): 0 | 1 | 2 => (d <= starts[1] ? 0 : d <= starts[2] ? 1 : 2);
  const pointAt = (d: number, out: THREE.Vector3) => {
    const dd = Math.max(0, Math.min(total, d));
    const seg = segmentAt(dd);
    const local = lengths[seg] > 0 ? (dd - starts[seg]) / lengths[seg] : 0;
    return curves[seg].getPointAt(Math.max(0, Math.min(1, local)), out);
  };

  const route: Route = { mode, curves, lengths, total, distanceOf: (i) => dist.get(i), pointAt, segmentAt };
  cache.set(mode, route);
  return route;
}
