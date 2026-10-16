/** Utilidades geoespaciales del mapa de CargoLink. Ejecutar: node --test tests/geo.test.mjs */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  haversineKm, bearingDeg, destinationPoint, greatCircle, buildPath, pathLengthKm, etaHours, positionAlong, nearestOnPath,
  corridorPolygon, formatKm, formatDuration, ago, routeOf, isPoint, MODES, CHOKEPOINTS, STAGE_FRACTION,
} from '../src/utils/geo.js'
import { PORTS } from '../src/data/ports.js'

const ALG = { lat: 36.1281, lng: -5.4366 }
const RTM = { lat: 51.9052, lng: 4.4869 }
const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} no está a ${tol} de ${b}`)

test('haversine: Algeciras–Rotterdam ≈ 1.921 km y es simétrica', () => {
  close(haversineKm(ALG, RTM), 1921, 5)
  close(haversineKm(ALG, RTM), haversineKm(RTM, ALG), 1e-9)
  assert.equal(haversineKm(ALG, ALG), 0)
})

test('haversine: un grado de latitud ≈ 111,2 km', () => {
  close(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111.19, 0.1)
})

test('rumbo: norte, este, sur y oeste', () => {
  close(bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 0, 0.01)
  close(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 90, 0.01)
  close(bearingDeg({ lat: 1, lng: 0 }, { lat: 0, lng: 0 }), 180, 0.01)
  close(bearingDeg({ lat: 0, lng: 1 }, { lat: 0, lng: 0 }), 270, 0.01)
})

test('destinationPoint: ida y vuelta por el rumbo recupera la distancia', () => {
  const p = destinationPoint(ALG, 45, 300)
  close(haversineKm(ALG, p), 300, 0.01)
})

test('círculo máximo: extremos exactos, monótono y de longitud ≈ haversine', () => {
  const g = greatCircle(ALG, RTM, 60)
  assert.deepEqual(g[0], ALG)
  assert.deepEqual(g[g.length - 1], RTM)
  assert.equal(g.length, 61)
  close(pathLengthKm(g), haversineKm(ALG, RTM), 1)
  const mid = g[30]
  assert.ok(mid.lat > ALG.lat && mid.lat < RTM.lat)
})

test('buildPath: con pasos intermedios la ruta es más larga que la directa', () => {
  const directa = pathLengthKm(buildPath([PORTS[0], PORTS[4]]))
  const porSuez = pathLengthKm(buildPath([PORTS[0], CHOKEPOINTS.find((c) => c.id === 'suez'), PORTS[4]]))
  assert.ok(porSuez > directa)
  assert.deepEqual(buildPath([ALG]), [ALG])
  assert.deepEqual(buildPath([]), [])
  assert.deepEqual(buildPath([ALG, { lat: 'x', lng: 1 }]).length, 1) // punto inválido descartado
})

test('ETA: depende del modo; el aéreo es el más rápido', () => {
  const km = 1800
  assert.ok(etaHours(km, 'air') < etaHours(km, 'road'))
  assert.ok(etaHours(km, 'road') < etaHours(km, 'sea'))
  close(etaHours(700, 'sea'), 700 / MODES.sea.kmh, 1e-9)
  assert.equal(etaHours(100, 'inventado'), 100 / MODES.sea.kmh) // modo desconocido → marítimo
})

test('positionAlong: 0, 0,5 y 1 de la ruta', () => {
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 0, lng: 2 }]
  assert.deepEqual({ lat: positionAlong(path, 0).lat, lng: positionAlong(path, 0).lng }, { lat: 0, lng: 0 })
  close(positionAlong(path, 0.5).lng, 1, 1e-6)
  close(positionAlong(path, 0.25).lng, 0.5, 1e-6)
  assert.deepEqual({ lat: positionAlong(path, 1).lat, lng: positionAlong(path, 1).lng }, { lat: 0, lng: 2 })
  assert.equal(positionAlong([], 0.5), null)
})

test('nearestOnPath: distancia a la ruta y fracción recorrida', () => {
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 2 }]
  const n = nearestOnPath(path, { lat: 0.5, lng: 1 })
  close(n.fraction, 0.5, 1e-3)
  close(n.distanceKm, haversineKm({ lat: 0, lng: 1 }, { lat: 0.5, lng: 1 }), 0.5)
  const sobre = nearestOnPath(path, { lat: 0, lng: 0.5 })
  close(sobre.distanceKm, 0, 0.01)
  close(sobre.fraction, 0.25, 1e-3)
})

test('corredor: polígono cerrado a ±ancho de la ruta y punto de la ruta dentro', () => {
  const path = buildPath([ALG, RTM])
  const poly = corridorPolygon(path, 30)
  assert.ok(poly.length >= 6)
  assert.ok(poly.every(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo)))
  // Una esquina del polígono está a ≈ 30 km del punto de la ruta que le corresponde
  const left0 = { lat: poly[0][0], lng: poly[0][1] }
  close(haversineKm(left0, path[0]), 30, 0.5)
  assert.deepEqual(corridorPolygon([ALG], 30), [])
})

test('isPoint valida rangos y tipos', () => {
  assert.equal(isPoint({ lat: 36, lng: -5 }), true)
  assert.equal(isPoint({ lat: '36.1', lng: '-5.4' }), true)
  assert.equal(isPoint({ lat: 91, lng: 0 }), false)
  assert.equal(isPoint({ lat: 0, lng: 181 }), false)
  assert.equal(isPoint(null), false)
  assert.equal(isPoint({ lat: 'a', lng: 0 }), false)
})

test('formato de distancias, duraciones y antigüedad', () => {
  assert.match(formatKm(1830.4), /^1\.?830 km$/) // Node sin ICU completo no agrupa los miles de 4 cifras
  assert.equal(formatKm(12.34), '12.3 km')
  assert.equal(formatKm(NaN), '—')
  assert.equal(formatDuration(0.5), '30 min')
  assert.equal(formatDuration(5.5), '5,5 h')
  assert.equal(formatDuration(100), '4 días')
  const ahora = Date.parse('2026-10-15T12:00:00Z')
  assert.equal(ago('2026-10-15T11:59:30Z', ahora), 'hace un momento')
  assert.equal(ago('2026-10-15T11:00:00Z', ahora), 'hace 60 min')
  assert.equal(ago('2026-10-15T06:00:00Z', ahora), 'hace 6 h')
  assert.equal(ago('basura', ahora), '—')
})

test('routeOf: cargo.route manda; si no, puertos reconocibles; si no, null', () => {
  const planificada = routeOf({ cargo: { route: { origin: { lat: 36.1281, lng: -5.4366, name: 'Algeciras' }, destination: { lat: 51.9, lng: 4.48, name: 'Rotterdam' }, waypoints: [{ lat: 43, lng: -9 }], mode: 'sea' } } }, PORTS)
  assert.equal(planificada.planned, true)
  assert.equal(planificada.waypoints.length, 1)
  assert.ok(planificada.path.length > 40)

  const porNombre = routeOf({ origin: 'Port of Shanghai', destination: 'Puerto de Algeciras' }, PORTS)
  assert.equal(porNombre.planned, false)
  assert.equal(porNombre.origin.name, 'Port of Shanghai')
  assert.equal(porNombre.destination.name, 'Puerto de Algeciras')

  assert.equal(routeOf({ origin: 'Almacén 7', destination: 'Tienda' }, PORTS), null)
  assert.equal(routeOf({ origin: 'Rotterdam', destination: 'Rotterdam' }, PORTS), null)
  assert.equal(routeOf(null, PORTS), null)
  assert.equal(routeOf({ cargo: { route: { origin: { lat: 999, lng: 0 }, destination: { lat: 0, lng: 0 } } }, origin: 'x', destination: 'y' }, PORTS), null)
})

test('etapas: fracciones crecientes y DELIVERED = 1', () => {
  const orden = ['CREATED', 'CUSTOMS_CLEARED', 'STOWED', 'DEPARTED', 'IN_TRANSIT', 'DELIVERED']
  for (let i = 1; i < orden.length; i += 1) assert.ok(STAGE_FRACTION[orden[i]] >= STAGE_FRACTION[orden[i - 1]])
  assert.equal(STAGE_FRACTION.DELIVERED, 1)
})
