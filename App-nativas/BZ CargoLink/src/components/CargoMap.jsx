/**
 * CargoMap — mapa real (Leaflet + teselas OpenStreetMap) de CargoLink.
 *
 * Capas: puertos (hubs), envíos con su posición (GPS real o estimada), rutas planificadas, rastro GPS del envío
 * seleccionado, geocercas (zonas autorizadas y corredores), y el borrador de ruta o de geocerca que se está creando.
 * Es un componente de PRESENTACIÓN: no llama a la API; recibe los datos y avisa con onSelect / onPick / onPortChoose.
 *
 * Teselas: OpenStreetMap (modo «Oscuro» = filtro CSS). Configurables con VITE_MAP_TILES_URL / VITE_MAP_TILES_ATTRIBUTION.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './cargo-map.css'

const env = (k) => { try { return import.meta.env[k] } catch { return undefined } }

// CARTO exige ahora API key (las teselas devuelven una marca «API KEY REQUIRED»), así que por defecto se usa
// OpenStreetMap y el modo «Oscuro» es el mismo mapa con un filtro CSS. Para producción con mucho tráfico, apunta
// VITE_MAP_TILES_URL a un proveedor propio/de pago (la política de OSM prohíbe el uso intensivo).
const TILES_URL = env('VITE_MAP_TILES_URL') || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILES_ATTR = env('VITE_MAP_TILES_ATTRIBUTION') || '© OpenStreetMap contributors'
export const BASES = {
  dark: { label: 'Oscuro', url: TILES_URL, attribution: TILES_ATTR, options: { maxZoom: 19, className: 'cm-tiles-dark' } },
  streets: { label: 'Calles', url: TILES_URL, attribution: TILES_ATTR, options: { maxZoom: 19 } },
}

export const STATUS_COLOR = {
  CREATED: '#9db2c6', CUSTOMS_CLEARED: '#b388ff', STOWED: '#ffd34d', DEPARTED: '#ff9f43', IN_TRANSIT: '#00f0ff', DELIVERED: '#2ff801',
}
export const FENCE_COLOR = { port: '#00f0ff', customs: '#b388ff', warehouse: '#ffd34d', route_corridor: '#2ff801' }
const MODE_ICON = { sea: '🚢', road: '🚚', rail: '🚆', air: '✈️' }

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag)
  Object.entries(props).forEach(([k, v]) => { if (k === 'style') Object.assign(n.style, v); else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v) })
  kids.forEach((k) => n.append(k))
  return n
}

export default function CargoMap({
  ports = [], shipments = [], fences = [], selectedBUid = null, draft = null, fenceDraft = null,
  pick = null, onPick, onSelect, onPortChoose, onFenceClick, onCancelPick, fitToken = 0, fitPoints = null, height = 340,
}) {
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const baseLayerRef = useRef(null)
  const groups = useRef({})
  const [base, setBase] = useState('dark')
  const [layers, setLayers] = useState({ ports: true, shipments: true, routes: true, fences: true })
  const cb = useRef({})
  cb.current = { onPick, onSelect, onPortChoose, onFenceClick, pick }

  // ── Mapa y capas (una sola vez) ────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !wrapRef.current) return undefined
    const map = L.map(wrapRef.current.querySelector('.cm-map'), { worldCopyJump: true, scrollWheelZoom: false, minZoom: 2, zoomSnap: 0.5, attributionControl: true })
    mapRef.current = map
    map.setView([30, 10], 2)
    for (const name of ['ports', 'routes', 'fences', 'shipments', 'draft']) groups.current[name] = L.layerGroup().addTo(map)
    // La rueda sólo hace zoom cuando el mapa tiene el foco (no secuestra el scroll de la página).
    map.on('focus', () => map.scrollWheelZoom.enable())
    map.on('blur', () => map.scrollWheelZoom.disable())
    map.on('click', (e) => { if (cb.current.pick) cb.current.onPick?.({ lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) }) })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null
    ro?.observe(wrapRef.current)
    setTimeout(() => map.invalidateSize(), 150)
    return () => { ro?.disconnect(); map.remove(); mapRef.current = null; groups.current = {}; baseLayerRef.current = null }
  }, [])

  // ── Capa base ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current)
    const b = BASES[base]
    baseLayerRef.current = L.tileLayer(b.url, { attribution: b.attribution, ...b.options }).addTo(map)
    baseLayerRef.current.bringToBack()
  }, [base])

  // ── Visibilidad de capas ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [name, on] of Object.entries(layers)) {
      const g = groups.current[name]
      if (!g) continue
      if (on && !map.hasLayer(g)) g.addTo(map)
      if (!on && map.hasLayer(g)) map.removeLayer(g)
    }
  }, [layers])

  // ── Puertos ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = groups.current.ports
    if (!g) return
    g.clearLayers()
    ports.forEach((p) => {
      const color = p.home ? '#2ff801' : '#00f0ff'
      const m = L.circleMarker([p.lat, p.lng], { radius: p.home ? 8 : 6, color, weight: 2, fillColor: color, fillOpacity: 0.55 })
      m.bindTooltip(p.name, { direction: 'top' })
      const box = el('div', { style: { minWidth: '200px', fontFamily: 'system-ui' } },
        Object.assign(el('strong', { style: { color: '#0a7d6b' } }), { textContent: p.name }),
        Object.assign(el('span', { style: { color: '#888', fontSize: '11px' } }), { textContent: ` · ${p.country}` }),
        el('br'),
        Object.assign(el('span', { style: { fontSize: '12px' } }), { textContent: p.address }),
        el('br'))
      if (/^https:\/\//.test(p.maps || '')) {
        box.append(Object.assign(el('a', { href: p.maps, target: '_blank', rel: 'noopener noreferrer', style: { fontSize: '12px', color: '#0a84ff' } }), { textContent: 'Ver en Google Maps ↗' }))
      }
      const acciones = el('div', { style: { marginTop: '6px', display: 'flex', gap: '6px' } })
      for (const [mode, label] of [['origin', 'Usar de origen'], ['destination', 'Usar de destino']]) {
        acciones.append(Object.assign(el('button', { type: 'button', style: { fontSize: '11px', padding: '3px 8px', cursor: 'pointer' }, onClick: () => { cb.current.onPortChoose?.(mode, p); m.closePopup() } }), { textContent: label }))
      }
      box.append(acciones)
      m.bindPopup(box)
      m.addTo(g)
    })
  }, [ports])

  // ── Envíos, rutas y rastro ─────────────────────────────────────────────────
  useEffect(() => {
    const gs = groups.current.shipments
    const gr = groups.current.routes
    if (!gs || !gr) return
    gs.clearLayers(); gr.clearLayers()
    shipments.forEach((s) => {
      const sel = s.bUid === selectedBUid
      const color = s.alerts.length ? '#ff4d4d' : (STATUS_COLOR[s.status] || '#00f0ff')
      if (s.route) {
        const latlngs = s.route.path.map((p) => [p.lat, p.lng])
        L.polyline(latlngs, { color, weight: sel ? 3 : 1.5, opacity: sel ? 0.95 : 0.35, dashArray: s.route.planned ? null : '6 6' }).addTo(gr)
        if (sel) {
          L.circleMarker([s.route.origin.lat, s.route.origin.lng], { radius: 5, color: '#9db2c6', fillColor: '#9db2c6', fillOpacity: 1 }).bindTooltip(`Origen: ${s.route.origin.name}`).addTo(gr)
          L.circleMarker([s.route.destination.lat, s.route.destination.lng], { radius: 5, color: '#2ff801', fillColor: '#2ff801', fillOpacity: 1 }).bindTooltip(`Destino: ${s.route.destination.name}`).addTo(gr)
          s.route.waypoints.forEach((w) => L.marker([w.lat, w.lng], { icon: L.divIcon({ className: '', html: '<div class="clm-wp"></div>', iconSize: [12, 12] }) }).addTo(gr))
        }
      }
      if (sel && s.track.length > 1) L.polyline(s.track.map((p) => [p.lat, p.lng]), { color: '#ffffff', weight: 2.5, opacity: 0.9 }).bindTooltip('Rastro GPS').addTo(gr)
      if (sel) s.track.filter((p) => p.tamper || p.breach || p.verified === false).forEach((p) => L.circleMarker([p.lat, p.lng], { radius: 6, color: '#ff4d4d', fillColor: '#ff4d4d', fillOpacity: 0.9 }).bindTooltip('Incidencia').addTo(gr))
      if (!s.position) return
      const icon = L.divIcon({
        className: '',
        html: `<div class="clm${sel ? ' is-sel' : ''}${s.position.source === 'estimada' ? ' is-est' : ''}${s.alerts.length ? ' has-alert' : ''}" style="--c:${color}">${MODE_ICON[s.route?.mode] || '📦'}</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      })
      const m = L.marker([s.position.lat, s.position.lng], { icon, zIndexOffset: sel ? 1000 : 0, keyboard: true, title: s.bUid })
      m.bindTooltip(`${s.bUid} · ${s.status}${s.position.source === 'estimada' ? ' (posición estimada)' : ''}`, { direction: 'top', offset: [0, -14] })
      m.on('click', () => cb.current.onSelect?.(s.bUid))
      m.addTo(gs)
    })
  }, [shipments, selectedBUid])

  // ── Geocercas ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = groups.current.fences
    if (!g) return
    g.clearLayers()
    fences.forEach((f) => {
      const color = FENCE_COLOR[f.kind] || '#9db2c6'
      const style = { color, weight: 2, fillColor: color, fillOpacity: 0.12, dashArray: f.kind === 'route_corridor' ? '8 6' : null }
      let shape = null
      if (Array.isArray(f.polygon) && f.polygon.length >= 3) shape = L.polygon(f.polygon.map(([la, lo]) => [Number(la), Number(lo)]), style)
      else if (f.center_lat !== null && f.center_lat !== undefined) shape = L.circle([Number(f.center_lat), Number(f.center_lng)], { ...style, radius: Number(f.radius_m) })
      if (!shape) return
      shape.bindTooltip(`${f.name} · ${f.kind}${f.enforce ? ' · vigilada' : ''}`, { sticky: true })
      shape.on('click', (e) => { L.DomEvent.stopPropagation(e); cb.current.onFenceClick?.(f) })
      shape.addTo(g)
    })
  }, [fences])

  // ── Borrador de ruta / geocerca ────────────────────────────────────────────
  useEffect(() => {
    const g = groups.current.draft
    if (!g) return
    g.clearLayers()
    const pin = (p, color, text) => L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<div class="clm-pin" style="--c:${color}"><span>${text}</span></div>`, iconSize: [22, 22], iconAnchor: [11, 22] }) })
    if (draft) {
      if (draft.corridor?.length >= 3) L.polygon(draft.corridor, { color: FENCE_COLOR.route_corridor, weight: 1.5, dashArray: '6 6', fillColor: FENCE_COLOR.route_corridor, fillOpacity: 0.1 }).addTo(g)
      if (draft.path?.length > 1) L.polyline(draft.path.map((p) => [p.lat, p.lng]), { color: '#ffd34d', weight: 3, dashArray: '10 8' }).addTo(g)
      if (draft.origin) pin(draft.origin, '#9db2c6', 'A').bindTooltip(draft.origin.name || 'Origen').addTo(g)
      if (draft.destination) pin(draft.destination, '#2ff801', 'B').bindTooltip(draft.destination.name || 'Destino').addTo(g)
      ;(draft.waypoints || []).forEach((w, i) => L.marker([w.lat, w.lng], { icon: L.divIcon({ className: '', html: '<div class="clm-wp"></div>', iconSize: [12, 12] }) }).bindTooltip(w.name || `Paso ${i + 1}`).addTo(g))
    }
    if (fenceDraft && Number.isFinite(fenceDraft.lat)) {
      const color = FENCE_COLOR[fenceDraft.kind] || '#ffd34d'
      L.circle([fenceDraft.lat, fenceDraft.lng], { radius: Number(fenceDraft.radiusM) || 1000, color, weight: 2, dashArray: '6 6', fillColor: color, fillOpacity: 0.18 }).addTo(g)
      L.circleMarker([fenceDraft.lat, fenceDraft.lng], { radius: 3, color: '#fff', fillOpacity: 1 }).addTo(g)
    }
  }, [draft, fenceDraft])

  // ── Encuadre ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pts = (fitPoints && fitPoints.length ? fitPoints : ports).filter((p) => p && Number.isFinite(p.lat))
    if (!pts.length) return
    const b = L.latLngBounds(pts.map((p) => [p.lat, p.lng]))
    map.fitBounds(b.pad(0.2), { maxZoom: 7, animate: fitToken > 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken, ports.length])

  const legend = useMemo(() => Object.entries({ CREATED: 'Creado', IN_TRANSIT: 'En tránsito', DELIVERED: 'Entregado' }), [])

  return (
    <div className="cm-wrap" style={{ height }} ref={wrapRef} data-testid="cargo-map">
      <div className={`cm-map${pick ? ' is-picking' : ''}`} tabIndex={0} aria-label="Mapa de envíos y rutas de CargoLink" />

      <div className="cm-legend" aria-hidden>
        <div className="cm-box">
          {legend.map(([k, label]) => <span key={k}><i className="cm-dot" style={{ background: STATUS_COLOR[k] }} />{label}</span>)}
          <span><i className="cm-dot" style={{ background: '#ff4d4d' }} />Incidencia</span>
        </div>
      </div>

      <div className="cm-tools">
        <div className="cm-box cm-seg" role="group" aria-label="Mapa base">
          {Object.entries(BASES).map(([k, b]) => <button type="button" key={k} className={base === k ? 'on' : ''} onClick={() => setBase(k)}>{b.label}</button>)}
        </div>
        <div className="cm-box" role="group" aria-label="Capas">
          {[['ports', 'Puertos'], ['shipments', 'Envíos'], ['routes', 'Rutas'], ['fences', 'Zonas']].map(([k, label]) => (
            <label key={k}><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />{label}</label>
          ))}
        </div>
      </div>

      {pick && (
        <div className="cm-hint" role="status">
          <span>{pick.label || 'Toca el mapa para elegir el punto'}</span>
          <button type="button" onClick={onCancelPick}>Cancelar</button>
        </div>
      )}
    </div>
  )
}
