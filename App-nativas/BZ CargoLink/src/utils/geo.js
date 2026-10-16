/**
 * Utilidades geoespaciales del mapa de CargoLink. Funciones PURAS (sin React ni Leaflet) para poder probarlas con
 * `node --test` (ver tests/geo.test.mjs). Los puntos son { lat, lng } en grados.
 *
 * Las rutas que se dibujan son PLANIFICADAS: círculo máximo entre los puntos (más los pasos intermedios que elija el
 * usuario). No son una ruta náutica ni de carretera calculada por un motor de rutas; la posición real de un envío sale
 * de su telemetría GPS (api/routes/cargolink.js → /v1/iot/telemetry).
 */

export const EARTH_KM = 6371.0088
const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

/** Modos de transporte con su velocidad media de planificación (km/h). */
export const MODES = {
  sea: { label: 'Marítimo', kmh: 35 },
  road: { label: 'Carretera', kmh: 65 },
  rail: { label: 'Ferrocarril', kmh: 55 },
  air: { label: 'Aéreo', kmh: 750 },
}

/** Pasos y canales frecuentes: ayudan a que una ruta marítima no atraviese tierra. */
export const CHOKEPOINTS = [
  { id: 'gibraltar', name: 'Estrecho de Gibraltar', lat: 35.96, lng: -5.6 },
  { id: 'suez', name: 'Canal de Suez', lat: 30.46, lng: 32.35 },
  { id: 'babelmandeb', name: 'Bab el-Mandeb', lat: 12.6, lng: 43.3 },
  { id: 'ormuz', name: 'Estrecho de Ormuz', lat: 26.57, lng: 56.25 },
  { id: 'malaca', name: 'Estrecho de Malaca', lat: 2.5, lng: 101.3 },
  { id: 'panama', name: 'Canal de Panamá', lat: 9.08, lng: -79.68 },
  { id: 'mancha', name: 'Canal de la Mancha', lat: 50.4, lng: 0.4 },
  { id: 'buenaesperanza', name: 'Cabo de Buena Esperanza', lat: -34.36, lng: 18.47 },
]

export const isPoint = (p) => !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180
export const pt = (p) => ({ lat: Number(p.lat), lng: Number(p.lng) })

/** Distancia de círculo máximo en km (haversine). */
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Rumbo inicial de a hacia b, en grados 0–360. */
export function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng))
  return (deg(Math.atan2(y, x)) + 360) % 360
}

/** Punto a `km` de distancia desde `p` siguiendo el rumbo `bearing`. */
export function destinationPoint(p, bearing, km) {
  const d = km / EARTH_KM
  const br = rad(bearing)
  const lat1 = rad(p.lat)
  const lng1 = rad(p.lng)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br))
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: deg(lat2), lng: ((deg(lng2) + 540) % 360) - 180 }
}

/** Puntos intermedios del círculo máximo entre a y b (incluye ambos extremos). */
export function greatCircle(a, b, steps = 48) {
  const d = haversineKm(a, b) / EARTH_KM
  if (d < 1e-9) return [a, b]
  const out = []
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lng)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng))
    const y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lng)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng))
    const z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat))
    out.push({ lat: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: deg(Math.atan2(y, x)) })
  }
  out[0] = a
  out[out.length - 1] = b
  return out
}

/** Ruta planificada: origen → pasos → destino, cada tramo por círculo máximo. */
export function buildPath(points, stepsPerLeg = 40) {
  const pts = (points || []).filter(isPoint).map(pt)
  if (pts.length < 2) return pts
  const path = []
  for (let i = 0; i < pts.length - 1; i += 1) {
    const leg = greatCircle(pts[i], pts[i + 1], stepsPerLeg)
    path.push(...(i === 0 ? leg : leg.slice(1)))
  }
  return path
}

export function pathLengthKm(path) {
  let km = 0
  for (let i = 1; i < (path || []).length; i += 1) km += haversineKm(path[i - 1], path[i])
  return km
}

/** Horas de viaje estimadas a la velocidad media del modo. */
export function etaHours(km, mode = 'sea') {
  const v = (MODES[mode] || MODES.sea).kmh
  return km / v
}

/** Punto situado a la fracción `f` (0–1) de la longitud de la ruta. */
export function positionAlong(path, f) {
  if (!path || path.length === 0) return null
  if (path.length === 1 || f <= 0) return { ...path[0], index: 0 }
  const total = pathLengthKm(path)
  if (f >= 1 || total === 0) return { ...path[path.length - 1], index: path.length - 1 }
  let target = total * f
  for (let i = 1; i < path.length; i += 1) {
    const seg = haversineKm(path[i - 1], path[i])
    if (target <= seg) {
      const t = seg === 0 ? 0 : target / seg
      return { lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t, lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t, index: i }
    }
    target -= seg
  }
  return { ...path[path.length - 1], index: path.length - 1 }
}

/**
 * Punto de la ruta más cercano a `p`: { distanceKm (a la ruta), fraction (0–1 recorrida), point }.
 * Proyección equirectangular por tramo: suficiente para tramos cortos (las rutas se densifican).
 */
export function nearestOnPath(path, p) {
  if (!path || path.length === 0) return null
  if (path.length === 1) return { distanceKm: haversineKm(path[0], p), fraction: 0, point: path[0] }
  const total = pathLengthKm(path) || 1
  let best = null
  let acc = 0
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]
    const b = path[i]
    const seg = haversineKm(a, b)
    const k = Math.cos(rad((a.lat + b.lat) / 2))
    const ax = a.lng * k; const ay = a.lat
    const dx = b.lng * k - ax; const dy = b.lat - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.lng * k - ax) * dx + (p.lat - ay) * dy) / len2))
    const q = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
    const dist = haversineKm(q, p)
    if (!best || dist < best.distanceKm) best = { distanceKm: dist, fraction: (acc + seg * t) / total, point: q }
    acc += seg
  }
  return best
}

/**
 * Polígono [[lat,lng], …] alrededor de la ruta (corredor de ± halfWidthKm) para crear una geocerca `route_corridor`.
 * Simplifica la ruta a como máximo `maxPoints` puntos por lado para que el polígono sea manejable.
 */
export function corridorPolygon(path, halfWidthKm = 25, maxPoints = 60) {
  if (!path || path.length < 2) return []
  const step = Math.max(1, Math.ceil(path.length / maxPoints))
  const pts = path.filter((_, i) => i % step === 0)
  if (pts[pts.length - 1] !== path[path.length - 1]) pts.push(path[path.length - 1])
  const left = []
  const right = []
  for (let i = 0; i < pts.length; i += 1) {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(pts.length - 1, i + 1)]
    const br = bearingDeg(prev, next)
    left.push(destinationPoint(pts[i], br - 90, halfWidthKm))
    right.push(destinationPoint(pts[i], br + 90, halfWidthKm))
  }
  return [...left, ...right.reverse()].map((p) => [Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5))])
}

/** Fracción de la ruta que corresponde a cada etapa del ciclo de vida (posición ESTIMADA si no hay GPS). */
export const STAGE_FRACTION = { CREATED: 0, CUSTOMS_CLEARED: 0.05, STOWED: 0.08, DEPARTED: 0.12, IN_TRANSIT: 0.5, DELIVERED: 1 }

export function formatKm(km) {
  if (!Number.isFinite(km)) return '—'
  return km >= 100 ? `${Math.round(km).toLocaleString('es-ES')} km` : `${km.toFixed(1)} km`
}

export function formatDuration(hours) {
  if (!Number.isFinite(hours)) return '—'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `${hours.toFixed(1).replace('.', ',')} h`
  return `${Math.round(hours / 24)} días`
}

/** Antigüedad legible de una fecha ISO. */
export function ago(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 90) return 'hace un momento'
  if (s < 5400) return `hace ${Math.round(s / 60)} min`
  if (s < 172800) return `hace ${Math.round(s / 3600)} h`
  return `hace ${Math.round(s / 86400)} días`
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Ruta de un B-UID. Prioridad: `cargo.route` (la guarda el planificador del mapa) → origen y destino que coincidan con
 * un puerto conocido → null. Devuelve { origin, destination, waypoints, mode, path, planned:boolean }.
 */
export function routeOf(tx, ports = []) {
  if (!tx) return null
  const r = tx.cargo && typeof tx.cargo === 'object' ? tx.cargo.route : null
  if (r && isPoint(r.origin) && isPoint(r.destination)) {
    const wps = (r.waypoints || []).filter(isPoint).map(pt)
    const origin = { ...pt(r.origin), name: r.origin.name || tx.origin || 'Origen' }
    const destination = { ...pt(r.destination), name: r.destination.name || tx.destination || 'Destino' }
    return { origin, destination, waypoints: wps, mode: MODES[r.mode] ? r.mode : 'sea', path: buildPath([origin, ...wps, destination]), planned: true }
  }
  const find = (text) => {
    const t = norm(text)
    if (!t) return null
    return ports.find((p) => t.includes(norm(p.id)) || t.includes(norm(p.name).replace(/^(port of|puerto de)\s+/, '')) || norm(p.name).includes(t)) || null
  }
  const o = find(tx.origin)
  const d = find(tx.destination)
  if (o && d && o.id !== d.id) {
    const origin = { ...pt(o), name: o.name }
    const destination = { ...pt(d), name: d.name }
    return { origin, destination, waypoints: [], mode: 'sea', path: buildPath([origin, destination]), planned: false }
  }
  return null
}
