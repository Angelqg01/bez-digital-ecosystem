/**
 * CargoMapHub — mapa de CargoLink con sus tres herramientas: Seguimiento (B-UIDs en el mapa), Crear ruta (origen, destino,
 * pasos, modo, corredor → B-UID) y Zonas (geocercas). Datos reales de la API de CargoLink (tx, telemetría IoT, geofences).
 * Crear B-UIDs y geocercas exige rol pos/admin: si la clave no lo permite, la API responde 403 y se muestra el motivo.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CargoMap, { STATUS_COLOR, FENCE_COLOR } from './CargoMap'
import { PORTS } from '../data/ports'
import { cargoLinkApi } from '../services/cargoLinkApi'
import { loadShipments, loadFences } from '../services/mapData'
import { CHOKEPOINTS, MODES, buildPath, pathLengthKm, etaHours, corridorPolygon, formatKm, formatDuration, ago, haversineKm } from '../utils/geo'
import { authKey, hasActorKey } from '../services/actorKey'
import ActorKeyCard from './ActorKeyCard'

const MODE_LABEL = { sea: '🚢 Marítimo', road: '🚚 Carretera', rail: '🚆 Ferrocarril', air: '✈️ Aéreo' }
const STATUS_LABEL = { CREATED: 'Creado', CUSTOMS_CLEARED: 'Aduana OK', STOWED: 'Estibado', DEPARTED: 'Zarpó', IN_TRANSIT: 'En tránsito', DELIVERED: 'Entregado' }
const KIND_LABEL = { port: 'Puerto', customs: 'Aduana', warehouse: 'Almacén', route_corridor: 'Corredor' }

const field = { width: '100%', padding: '8px 10px', background: '#090d16', border: '1px solid var(--bz-border)', borderRadius: 8, color: '#fff', fontSize: 12 }
const lbl = { display: 'block', fontSize: 9, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase', margin: '10px 0 4px' }
const smallBtn = { background: 'transparent', border: '1px solid var(--bz-border)', color: 'var(--bz-primary)', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }
const portPoint = (p) => ({ lat: p.lat, lng: p.lng, name: p.name })

export default function CargoMapHub({ selectedBUid, onSelect, height = 340 }) {
  const [tab, setTab] = useState('track')
  const [shipments, setShipments] = useState([])
  const [fences, setFences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pick, setPick] = useState(null)
  const [fitToken, setFitToken] = useState(0)

  // Borrador de ruta
  const [mode, setMode] = useState('sea')
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [waypoints, setWaypoints] = useState([])
  const [corridorKm, setCorridorKm] = useState(0)
  const [weight, setWeight] = useState('')
  const [desc, setDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Borrador de geocerca
  const [fence, setFence] = useState({ name: '', kind: 'warehouse', radiusM: 2000, enforce: false, lat: null, lng: null })

  const fencesRef = useRef({ global: [], sel: [] })
  const selRef = useRef(selectedBUid)
  selRef.current = selectedBUid

  const refresh = useCallback(async () => {
    const key = authKey()
    if (!key) { setLoading(false); return }
    try {
      // Sin bUid la API sólo devuelve las zonas globales; los corredores de ruta son de un B-UID concreto: se piden aparte.
      const sel = selRef.current
      // Los envíos son imprescindibles; las zonas son accesorias: si fallan (p. ej. un corte puntual de la BD) no se pierde el resto.
      const [s, f, fSel] = await Promise.all([
        loadShipments(cargoLinkApi, key, { ports: PORTS }),
        loadFences(cargoLinkApi, key).catch(() => null),
        sel ? loadFences(cargoLinkApi, key, sel).catch(() => null) : Promise.resolve([]),
      ])
      const byId = new Map([...(f || fencesRef.current.global), ...(fSel || fencesRef.current.sel)].map((z) => [z.id, z]))
      fencesRef.current = { global: f || fencesRef.current.global, sel: fSel || fencesRef.current.sel }
      setShipments(s); setFences([...byId.values()]); setError('')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t) }, [refresh])

  const selected = shipments.find((s) => s.bUid === selectedBUid) || null
  useEffect(() => { if (selected) setFitToken((n) => n + 1) }, [selected?.bUid])
  useEffect(() => { if (selectedBUid) refresh() }, [selectedBUid, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const draftPath = useMemo(() => (origin && destination ? buildPath([origin, ...waypoints, destination]) : []), [origin, destination, waypoints])
  const draftKm = draftPath.length ? pathLengthKm(draftPath) : 0
  const draft = useMemo(() => (origin || destination ? {
    origin, destination, waypoints, path: draftPath,
    corridor: corridorKm > 0 && draftPath.length ? corridorPolygon(draftPath, corridorKm) : [],
  } : null), [origin, destination, waypoints, draftPath, corridorKm])

  const fitPoints = useMemo(() => {
    if (tab === 'route' && (origin || destination)) return [origin, destination, ...waypoints].filter(Boolean)
    if (selected?.route) return selected.route.path
    const pts = shipments.map((s) => s.position).filter(Boolean)
    return pts.length ? pts : null
  }, [tab, origin, destination, waypoints, selected, shipments])

  // Al fijar origen/destino/pasos, encuadra el mapa en la ruta que se está dibujando.
  useEffect(() => { if (tab === 'route' && origin && destination) setFitToken((n) => n + 1) }, [tab, origin, destination, waypoints.length])

  const handlePick = (p) => {
    if (!pick) return
    if (pick.kind === 'origin') setOrigin({ ...p, name: `Punto ${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}` })
    else if (pick.kind === 'destination') setDestination({ ...p, name: `Punto ${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}` })
    else if (pick.kind === 'waypoint') setWaypoints((w) => [...w, { ...p, name: `Paso ${w.length + 1}` }])
    else if (pick.kind === 'fence') setFence((f) => ({ ...f, lat: p.lat, lng: p.lng }))
    setPick(null)
  }
  const startPick = (kind, label) => setPick({ kind, label })
  const portChoose = (kind, port) => { setTab('route'); (kind === 'origin' ? setOrigin : setDestination)(portPoint(port)) }

  const create = async () => {
    setError(''); setNotice('')
    if (!origin || !destination) { setError('Elige origen y destino'); return }
    setCreating(true)
    try {
      const key = authKey()
      const body = {
        origin: origin.name, destination: destination.name,
        cargo: {
          description: desc || undefined, weight: weight ? Number(weight) : undefined,
          route: { mode, origin, destination, waypoints, distanceKm: Math.round(draftKm) },
        },
      }
      const res = await cargoLinkApi.createTransaction(key, body)
      const bUid = res.transaction?.b_uid || res.b_uid || res.bUid
      let extra = ''
      if (corridorKm > 0 && bUid) {
        try {
          await cargoLinkApi.createGeofence(key, { name: `Corredor ${bUid}`, kind: 'route_corridor', polygon: corridorPolygon(draftPath, corridorKm), bUid, enforce: true })
          extra = ` y corredor de ±${corridorKm} km vigilado`
        } catch (e) { extra = ` (el corredor no se creó: ${e.message})` }
      }
      setNotice(`B-UID ${bUid || ''} creado${extra}.`)
      setOrigin(null); setDestination(null); setWaypoints([]); setCorridorKm(0); setDesc(''); setWeight('')
      await refresh()
      if (bUid) { onSelect?.(bUid); setTab('track') }
    } catch (e) { setError(e.message) } finally { setCreating(false) }
  }

  const createFence = async () => {
    setError(''); setNotice('')
    if (!fence.name.trim() || !Number.isFinite(fence.lat)) { setError('Pon nombre y elige el centro en el mapa'); return }
    try {
      await cargoLinkApi.createGeofence(authKey(), { name: fence.name.trim(), kind: fence.kind, centerLat: fence.lat, centerLng: fence.lng, radiusM: Number(fence.radiusM), enforce: fence.enforce })
      setNotice('Zona creada.'); setFence({ name: '', kind: 'warehouse', radiusM: 2000, enforce: false, lat: null, lng: null }); await refresh()
    } catch (e) { setError(e.message) }
  }
  const removeFence = async (f) => {
    try { await cargoLinkApi.deleteGeofence(authKey(), f.id); await refresh() } catch (e) { setError(e.message) }
  }

  const tabBtn = (id, text) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setPick(null) }}
      style={{ flex: 1, padding: '10px 4px', background: tab === id ? 'rgba(0,240,255,.12)' : 'transparent', border: 0, borderBottom: `2px solid ${tab === id ? 'var(--bz-primary)' : 'transparent'}`, color: tab === id ? 'var(--bz-primary)' : 'var(--bz-text-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}>{text}</button>
  )

  const fenceDraft = tab === 'zones' && Number.isFinite(fence.lat) ? fence : null
  const wpOptions = CHOKEPOINTS.filter((c) => !waypoints.some((w) => w.name === c.name))

  return (
    <div data-testid="cargo-map-hub">
      <CargoMap ports={PORTS} shipments={shipments} fences={fences} selectedBUid={selectedBUid} draft={tab === 'route' ? draft : null} fenceDraft={fenceDraft}
        pick={pick} onPick={handlePick} onCancelPick={() => setPick(null)} onSelect={(b) => { onSelect?.(b); setTab('track') }} onPortChoose={portChoose}
        onFenceClick={(f) => setNotice(`${f.name} · ${KIND_LABEL[f.kind] || f.kind}${f.enforce ? ' · vigilada' : ''}`)}
        fitToken={fitToken} fitPoints={fitPoints} height={height} />
      <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--bz-border)', background: '#0a0e14' }}>
        {tabBtn('track', 'Seguimiento')}{tabBtn('route', 'Crear ruta')}{tabBtn('zones', 'Zonas')}
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--bz-bg)' }}>
        {error && <p role="alert" style={{ color: '#ef4444', fontSize: 11, margin: '0 0 8px' }}>{error}</p>}
        {(!hasActorKey() || /api key/i.test(error)) && <ActorKeyCard compact onChange={refresh} />}
        {notice && <p role="status" style={{ color: 'var(--bz-secondary)', fontSize: 11, margin: '0 0 8px' }}>{notice}</p>}

        {tab === 'track' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{loading ? 'Cargando…' : `${shipments.length} envío(s)`}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={smallBtn} onClick={() => setFitToken((n) => n + 1)}>Encuadrar</button>
                <button type="button" style={smallBtn} onClick={refresh}>Actualizar</button>
              </span>
            </div>
            {!loading && shipments.length === 0 && <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 10 }}>Aún no hay envíos. Crea el primero en «Crear ruta».</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 8 }}>
              {shipments.map((s) => (
                <li key={s.bUid}>
                  <button type="button" onClick={() => onSelect?.(s.bUid)} aria-pressed={s.bUid === selectedBUid}
                    style={{ width: '100%', textAlign: 'left', background: s.bUid === selectedBUid ? 'rgba(0,240,255,.08)' : '#0e1218', border: `1px solid ${s.bUid === selectedBUid ? 'var(--bz-primary)' : 'var(--bz-border)'}`, borderRadius: 10, padding: 10, color: '#fff', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ fontSize: 12, fontFamily: 'Space Grotesk' }}>{s.bUid}</strong>
                      <span style={{ fontSize: 10, fontWeight: 800, color: s.alerts.length ? '#ff4d4d' : STATUS_COLOR[s.status] }}>{s.alerts.length ? `⚠ ${s.alerts.length} alerta(s)` : STATUS_LABEL[s.status] || s.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--bz-text-muted)', margin: '3px 0 6px' }}>{s.summary}</div>
                    <div style={{ height: 5, background: '#2a2a2a', borderRadius: 3 }}><div style={{ height: '100%', width: `${s.progress}%`, background: STATUS_COLOR[s.status], borderRadius: 3 }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--bz-text-muted)', marginTop: 5 }}>
                      <span>{s.progress}%{s.etaHours !== null && s.status !== 'DELIVERED' ? ` · ETA ${formatDuration(s.etaHours)}` : ''}</span>
                      <span>{s.position ? (s.position.source === 'gps' ? `GPS ${ago(s.position.at)}` : 'posición estimada') : 'sin posición'}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="card" style={{ marginTop: 12, padding: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--bz-primary)', textTransform: 'uppercase', margin: 0 }}>{selected.bUid}</p>
                <p style={{ fontSize: 11, margin: '4px 0' }}>{selected.summary}</p>
                {selected.remainingKm !== null && <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', margin: '2px 0' }}>Restan {formatKm(selected.remainingKm)}{selected.offRouteKm !== null && selected.offRouteKm > 25 ? ` · ⚠ a ${formatKm(selected.offRouteKm)} de la ruta` : ''}</p>}
                {Object.keys(selected.sensors).length > 0 && (
                  <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', margin: '2px 0' }}>
                    {Object.entries(selected.sensors).map(([k, v]) => `${k}: ${v.value}${v.unit ? ` ${v.unit}` : ''}${v.breach ? ' ⚠' : ''}`).join(' · ')}
                  </p>
                )}
                {selected.alerts.slice(0, 4).map((a, i) => <p key={i} style={{ fontSize: 11, color: '#ff4d4d', margin: '2px 0' }}>⚠ {a.text || a.type || 'Incidencia'} {a.at ? `· ${ago(a.at)}` : ''}</p>)}
                {!selected.route && <p style={{ fontSize: 11, color: 'var(--bz-text-muted)' }}>Este B-UID no tiene ruta en el mapa (origen/destino no reconocidos). Las rutas nuevas se guardan con coordenadas.</p>}
              </div>
            )}
          </div>
        )}

        {tab === 'route' && (
          <div>
            <label style={lbl} htmlFor="cm-mode">Modo de transporte</label>
            <div id="cm-mode" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.keys(MODES).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} style={{ ...smallBtn, background: mode === m ? 'rgba(0,240,255,.14)' : 'transparent' }}>{MODE_LABEL[m]}</button>
              ))}
            </div>

            {[['origin', 'Origen', origin, setOrigin], ['destination', 'Destino', destination, setDestination]].map(([kind, label, val, set]) => (
              <div key={kind}>
                <label style={lbl} htmlFor={`cm-${kind}`}>{label}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select id={`cm-${kind}`} style={field} value={PORTS.find((p) => val && p.name === val.name)?.id || (val ? 'custom' : '')}
                    onChange={(e) => { const p = PORTS.find((x) => x.id === e.target.value); if (p) set(portPoint(p)) }}>
                    <option value="">— Elige un puerto —</option>
                    {val && !PORTS.some((p) => p.name === val.name) && <option value="custom">{val.name}</option>}
                    {PORTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="button" style={smallBtn} onClick={() => startPick(kind, `Toca el mapa para fijar el ${label.toLowerCase()}`)}>📍 Mapa</button>
                </div>
              </div>
            ))}

            <label style={lbl}>Pasos intermedios ({waypoints.length})</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <select style={{ ...field, flex: 1 }} value="" aria-label="Añadir paso o canal" onChange={(e) => { const c = CHOKEPOINTS.find((x) => x.id === e.target.value); if (c) setWaypoints((w) => [...w, { lat: c.lat, lng: c.lng, name: c.name }]) }}>
                <option value="">+ Canal o estrecho…</option>
                {wpOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" style={smallBtn} onClick={() => startPick('waypoint', 'Toca el mapa para añadir un paso')}>📍 Paso</button>
            </div>
            {waypoints.map((w, i) => (
              <div key={`${w.name}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, color: '#dbe7f3' }}>
                <span>{i + 1}. {w.name}</span>
                <button type="button" style={{ ...smallBtn, padding: '2px 8px', color: '#ff6b6b' }} aria-label={`Quitar ${w.name}`} onClick={() => setWaypoints((ws) => ws.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}

            <label style={lbl} htmlFor="cm-corr">Corredor vigilado (± km, 0 = sin corredor)</label>
            <input id="cm-corr" type="number" min="0" max="200" style={field} value={corridorKm} onChange={(e) => setCorridorKm(Math.max(0, Math.min(200, Number(e.target.value) || 0)))} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={lbl} htmlFor="cm-desc">Mercancía</label><input id="cm-desc" style={field} maxLength={80} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. Contenedor 40' HC" /></div>
              <div><label style={lbl} htmlFor="cm-w">Peso (kg)</label><input id="cm-w" type="number" min="0" style={field} value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
            </div>

            <div className="card" style={{ marginTop: 12, padding: 10, fontSize: 12 }}>
              {draftPath.length ? (
                <>
                  <strong>{formatKm(draftKm)}</strong> · ETA {formatDuration(etaHours(draftKm, mode))} <span style={{ color: 'var(--bz-text-muted)' }}>({MODES[mode].kmh} km/h de media)</span>
                  {origin && destination && haversineKm(origin, destination) < 1 && <p style={{ color: '#ffd34d', margin: '4px 0 0' }}>Origen y destino coinciden.</p>}
                  {mode === 'sea' && <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', margin: '4px 0 0' }}>Ruta orientativa (círculo máximo con tus pasos). Añade canales/estrechos para evitar tierra.</p>}
                </>
              ) : <span style={{ color: 'var(--bz-text-muted)' }}>Elige origen y destino para ver distancia y ETA.</span>}
            </div>
            <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: 14 }} disabled={creating || !origin || !destination} onClick={create}>
              {creating ? 'CREANDO…' : 'CREAR B-UID Y RUTA'}
            </button>
            <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', textAlign: 'center', marginTop: 8 }}>Requiere clave con rol POS o admin.</p>
          </div>
        )}

        {tab === 'zones' && (
          <div>
            <label style={lbl} htmlFor="cm-fname">Nueva zona</label>
            <input id="cm-fname" style={field} maxLength={60} placeholder="Nombre (ej. Almacén Algeciras)" value={fence.name} onChange={(e) => setFence((f) => ({ ...f, name: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={lbl} htmlFor="cm-fkind">Tipo</label>
                <select id="cm-fkind" style={field} value={fence.kind} onChange={(e) => setFence((f) => ({ ...f, kind: e.target.value }))}>
                  {['port', 'customs', 'warehouse'].map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select></div>
              <div><label style={lbl} htmlFor="cm-frad">Radio (m)</label>
                <input id="cm-frad" type="number" min="100" max="500000" style={field} value={fence.radiusM} onChange={(e) => setFence((f) => ({ ...f, radiusM: e.target.value }))} /></div>
            </div>
            <label style={{ ...lbl, display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', fontSize: 11 }}>
              <input type="checkbox" checked={fence.enforce} onChange={(e) => setFence((f) => ({ ...f, enforce: e.target.checked }))} /> Vigilar (alerta si un envío sale de la zona)
            </label>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" style={smallBtn} onClick={() => startPick('fence', 'Toca el mapa para fijar el centro de la zona')}>📍 Elegir centro</button>
              <span style={{ fontSize: 11, alignSelf: 'center', color: 'var(--bz-text-muted)' }}>{Number.isFinite(fence.lat) ? `${fence.lat.toFixed(3)}, ${fence.lng.toFixed(3)}` : 'sin centro'}</span>
            </div>
            <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: 12 }} onClick={createFence}>CREAR ZONA</button>

            <p style={{ ...lbl, marginTop: 16 }}>Zonas activas ({fences.length})</p>
            {fences.length === 0 && <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Sin zonas todavía.</p>}
            {fences.map((f) => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--bz-border)', fontSize: 12 }}>
                <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: FENCE_COLOR[f.kind], marginRight: 6 }} />{f.name} <span style={{ color: 'var(--bz-text-muted)' }}>· {KIND_LABEL[f.kind] || f.kind}{f.enforce ? ' · vigilada' : ''}</span></span>
                <button type="button" style={{ ...smallBtn, color: '#ff6b6b', padding: '3px 8px' }} aria-label={`Eliminar ${f.name}`} onClick={() => removeFence(f)}>Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
