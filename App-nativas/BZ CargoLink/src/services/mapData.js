/**
 * Datos del mapa de CargoLink: une cada B-UID (api/routes/cargolink.js → /v1/tx) con su telemetría GPS
 * (/v1/iot/telemetry) y con su ruta planificada, y calcula posición, progreso, ETA restante y alertas.
 *
 * Posición: la REAL es el último punto GPS de la telemetría; si el envío todavía no ha emitido GPS se coloca una posición
 * ESTIMADA sobre su ruta según la etapa del ciclo de vida, y se marca como tal (source: 'estimada'): nunca se presenta
 * una estimación como si fuera una lectura.
 */
import { etaHours, formatKm, isPoint, nearestOnPath, pathLengthKm, positionAlong, pt, routeOf, STAGE_FRACTION } from '../utils/geo.js'

const time = (r) => Date.parse(r.recorded_at || r.recordedAt || '') || 0

/** Filas de telemetría con posición, de la más antigua a la más reciente. */
export function trackOf(telemetry = []) {
  return telemetry
    .filter((r) => (r.metric === 'gps' || r.metric === 'event' || r.metric === 'seal') && isPoint({ lat: r.lat, lng: r.lng }) && r.lat !== null)
    .sort((a, b) => time(a) - time(b))
    .map((r) => ({ ...pt(r), at: r.recorded_at || r.recordedAt, tamper: !!r.tamper, breach: !!r.breach, verified: r.geofence_verified }))
}

export function latestGps(telemetry = []) {
  const t = trackOf(telemetry)
  return t.length ? t[t.length - 1] : null
}

/** Última lectura de cada sensor (temperatura, humedad, golpes, sello…). */
export function sensorsOf(telemetry = []) {
  const out = {}
  for (const r of [...telemetry].sort((a, b) => time(a) - time(b))) {
    if (!r.metric || r.metric === 'gps' || r.metric === 'event') continue
    out[r.metric] = { value: r.value, unit: r.unit, at: r.recorded_at || r.recordedAt, breach: !!r.breach }
  }
  return out
}

/** Incidencias visibles: umbral superado, manipulación del precinto o fuera de geocerca. */
export function alertsOf(telemetry = []) {
  const out = []
  for (const r of telemetry) {
    const at = r.recorded_at || r.recordedAt
    if (r.tamper) out.push({ kind: 'tamper', text: 'Precinto manipulado', at })
    if (r.breach) out.push({ kind: 'breach', text: r.reason || `Umbral superado (${r.metric})`, at })
    if (r.geofence_verified === false) out.push({ kind: 'geofence', text: 'Fuera de las zonas autorizadas', at })
  }
  return out.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
}

export function buildShipment(tx, telemetry = [], ports = []) {
  const route = routeOf(tx, ports)
  const track = trackOf(telemetry)
  const gps = track.length ? track[track.length - 1] : null
  const stage = STAGE_FRACTION[tx.status] ?? 0
  const pathKm = route ? pathLengthKm(route.path) : 0

  let position = null
  let fraction = stage
  let offRouteKm = null
  if (gps) {
    position = { lat: gps.lat, lng: gps.lng, source: 'gps', at: gps.at }
    if (route) {
      const n = nearestOnPath(route.path, gps)
      fraction = n.fraction
      offRouteKm = n.distanceKm
    }
  } else if (route) {
    const p = positionAlong(route.path, stage)
    position = { lat: p.lat, lng: p.lng, source: 'estimada', at: null }
  }
  if (tx.status === 'DELIVERED') fraction = 1
  const remainingKm = route ? Math.max(0, pathKm * (1 - fraction)) : null
  return {
    bUid: tx.b_uid,
    status: tx.status,
    tx,
    route,
    position,
    track,
    sensors: sensorsOf(telemetry),
    alerts: alertsOf(telemetry),
    progress: Math.round(fraction * 100),
    pathKm,
    remainingKm,
    etaHours: route && remainingKm !== null ? etaHours(remainingKm, route.mode) : null,
    offRouteKm,
    summary: route ? `${route.origin.name} → ${route.destination.name} · ${formatKm(pathKm)}` : `${tx.origin || '?'} → ${tx.destination || '?'}`,
  }
}

/**
 * Carga los envíos y su telemetría. `api` es cargoLinkApi (inyectable para probar). Los envíos entregados no piden
 * telemetría (su posición es el destino); el resto, hasta `limit`, en paralelo y tolerando fallos individuales.
 */
export async function loadShipments(api, key, { ports = [], limit = 12 } = {}) {
  const data = await api.listTransactions(key, {})
  const txs = data.transactions || []
  const activos = txs.filter((t) => t.status !== 'DELIVERED').slice(0, limit)
  const telem = new Map()
  await Promise.all(activos.map(async (t) => {
    try {
      const r = await api.getTelemetry(key, { bUid: t.b_uid, limit: 120 })
      telem.set(t.b_uid, r.telemetry || [])
    } catch { telem.set(t.b_uid, []) }
  }))
  return txs.map((t) => buildShipment(t, telem.get(t.b_uid) || [], ports))
}

export async function loadFences(api, key, bUid) {
  const r = await api.listGeofences(key, bUid ? { bUid } : {})
  return r.geofences || []
}
