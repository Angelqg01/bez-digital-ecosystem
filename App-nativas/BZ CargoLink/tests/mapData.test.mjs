/** Datos del mapa de CargoLink (posición real vs estimada, ETA, alertas). Ejecutar: node --test tests/mapData.test.mjs */
import test from 'node:test'
import assert from 'node:assert/strict'
import { alertsOf, buildShipment, latestGps, loadShipments, sensorsOf, trackOf } from '../src/services/mapData.js'
import { PORTS } from '../src/data/ports.js'

const ROUTE = { origin: { lat: 36.1281, lng: -5.4366, name: 'Algeciras' }, destination: { lat: 51.9052, lng: 4.4869, name: 'Rotterdam' }, mode: 'sea' }
const tx = (status, extra = {}) => ({ b_uid: 'BZ-LOG-1', status, origin: 'Algeciras', destination: 'Rotterdam', cargo: { route: ROUTE }, ...extra })
const gps = (lat, lng, at, extra = {}) => ({ metric: 'gps', lat, lng, recorded_at: at, ...extra })

test('trackOf ordena de antiguo a reciente y descarta filas sin posición', () => {
  const t = trackOf([gps(40, -5, '2026-10-15T10:00:00Z'), gps(38, -5, '2026-10-15T08:00:00Z'), { metric: 'temperature', value: 4, lat: null, lng: null }, gps(null, null, '2026-10-15T09:00:00Z')])
  assert.deepEqual(t.map((p) => p.lat), [38, 40])
  assert.equal(latestGps([gps(38, -5, '2026-10-15T08:00:00Z'), gps(40, -5, '2026-10-15T10:00:00Z')]).lat, 40)
  assert.equal(latestGps([]), null)
})

test('sin GPS: posición ESTIMADA sobre la ruta según la etapa, y marcada como tal', () => {
  const s = buildShipment(tx('IN_TRANSIT'), [], PORTS)
  assert.equal(s.position.source, 'estimada')
  assert.equal(s.position.at, null)
  assert.ok(s.position.lat > 36 && s.position.lat < 52)
  assert.equal(s.progress, 50)
  assert.ok(s.remainingKm > 900 && s.remainingKm < 1000)
})

test('con GPS: posición REAL, progreso por proyección y desvío respecto a la ruta', () => {
  const s = buildShipment(tx('IN_TRANSIT'), [gps(44, -6.4, '2026-10-15T10:00:00Z')], PORTS)
  assert.equal(s.position.source, 'gps')
  assert.equal(s.position.at, '2026-10-15T10:00:00Z')
  assert.ok(s.progress > 20 && s.progress < 80)
  assert.ok(Number.isFinite(s.offRouteKm))
  assert.ok(s.etaHours > 0)
})

test('un GPS lejos de la ruta se reporta como desvío grande', () => {
  const cerca = buildShipment(tx('IN_TRANSIT'), [gps(44.0, -6.2, '2026-10-15T10:00:00Z')], PORTS)
  const lejos = buildShipment(tx('IN_TRANSIT'), [gps(30, 20, '2026-10-15T10:00:00Z')], PORTS)
  assert.ok(lejos.offRouteKm > cerca.offRouteKm + 500)
})

test('entregado: 100 % y nada que recorrer', () => {
  const s = buildShipment(tx('DELIVERED'), [], PORTS)
  assert.equal(s.progress, 100)
  assert.equal(s.remainingKm, 0)
  assert.equal(s.etaHours, 0)
})

test('sin ruta conocida: no inventa posición ni ETA', () => {
  const s = buildShipment({ b_uid: 'BZ-LOG-2', status: 'IN_TRANSIT', origin: 'Almacén 7', destination: 'Tienda', cargo: {} }, [], PORTS)
  assert.equal(s.route, null)
  assert.equal(s.position, null)
  assert.equal(s.remainingKm, null)
  assert.equal(s.etaHours, null)
  assert.match(s.summary, /Almacén 7 → Tienda/)
})

test('sensores: última lectura de cada métrica; alertas por precinto, umbral y geocerca', () => {
  const rows = [
    { metric: 'temperature', value: 4.1, unit: '°C', recorded_at: '2026-10-15T08:00:00Z' },
    { metric: 'temperature', value: 9.8, unit: '°C', recorded_at: '2026-10-15T10:00:00Z', breach: true, reason: 'Temperatura fuera de rango' },
    { metric: 'seal', value: 1, unit: 'state', recorded_at: '2026-10-15T09:00:00Z', tamper: true, lat: 41, lng: -7, geofence_verified: false },
  ]
  assert.equal(sensorsOf(rows).temperature.value, 9.8)
  const a = alertsOf(rows)
  assert.deepEqual(a.map((x) => x.kind).sort(), ['breach', 'geofence', 'tamper'])
  assert.equal(a[0].at, '2026-10-15T10:00:00Z') // la más reciente primero
  assert.match(a.find((x) => x.kind === 'breach').text, /Temperatura/)
})

test('loadShipments: pide telemetría sólo de los no entregados y tolera fallos individuales', async () => {
  const pedidas = []
  const api = {
    listTransactions: async () => ({ transactions: [tx('IN_TRANSIT', { b_uid: 'A' }), tx('DELIVERED', { b_uid: 'B' }), tx('STOWED', { b_uid: 'C' })] }),
    getTelemetry: async (_k, q) => { pedidas.push(q.bUid); if (q.bUid === 'C') throw new Error('sin red'); return { telemetry: [gps(44, -6.4, '2026-10-15T10:00:00Z')] } },
  }
  const out = await loadShipments(api, 'KEY', { ports: PORTS })
  assert.deepEqual(pedidas.sort(), ['A', 'C'])
  assert.equal(out.length, 3)
  assert.equal(out.find((s) => s.bUid === 'A').position.source, 'gps')
  assert.equal(out.find((s) => s.bUid === 'C').position.source, 'estimada') // falló su telemetría → estimada
  assert.equal(out.find((s) => s.bUid === 'B').progress, 100)
})
