import React, { useState, useEffect, useCallback } from 'react'
import { Cpu, Globe2, MapPinned, Copy, CheckCircle2, ShieldCheck } from 'lucide-react'
import { cargoLinkApi } from '../services/cargoLinkApi'

/**
 * IotHubPanel — Hub de Ingestión Unificado (Developer Hub).
 *
 * Tres registros contra la API real (rol pos/admin con clave de actor bzk_):
 *   1. Dispositivos IoT propios (e-seal, reefer, GPS…) → devuelve la device key una vez.
 *   2. Proveedores externos (DHL, autoridad portuaria…) → secreto HMAC + URL de ingesta.
 *   3. Geocercas (zonas autorizadas + corredores de ruta).
 */

const DEVICE_TYPES = ['multi', 'gps', 'temp', 'humidity', 'shock', 'rfid', 'eseal', 'light', 'baro', 'ble']
const PROVIDER_KINDS = ['carrier', 'port_authority', 'customs', 'forwarder', 'network_server']
const FENCE_KINDS = ['port', 'customs', 'warehouse', 'route_corridor']

const inputStyle = {
  width: '100%', padding: '10px 12px', background: '#0e0e0e',
  border: '1px solid var(--bz-border)', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: 9, fontWeight: 800, color: 'var(--bz-text-muted)',
  textTransform: 'uppercase', margin: '10px 0 4px',
}

const SecretReveal = ({ title, entries }) => {
  const [copied, setCopied] = useState(null)
  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* manual selection fallback */ }
  }
  return (
    <div style={{ marginTop: 12, padding: 12, background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.25)', borderRadius: 8 }}>
      <p style={{ fontSize: 10, fontWeight: 900, color: '#39ff14', marginBottom: 6 }}>{title} — guárdalo ahora, no se vuelve a mostrar</p>
      {entries.filter(([, v]) => v).map(([label, value]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
          <span style={{ fontSize: 9, color: 'var(--bz-text-muted)', minWidth: 80 }}>{label}</span>
          <code style={{ flex: 1, fontSize: 10, color: '#fff', wordBreak: 'break-all' }}>{value}</code>
          <button onClick={() => copy(value, label)} style={{ background: 'none', border: 'none', color: copied === label ? '#39ff14' : 'var(--bz-primary)' }}>
            {copied === label ? <CheckCircle2 size={13} /> : <Copy size={13} />}
          </button>
        </div>
      ))}
    </div>
  )
}

const IotHubPanel = () => {
  const [actorKey, setActorKey] = useState(() => localStorage.getItem('cargolink_actor_key') || '')
  const [tab, setTab] = useState('device')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // Device form
  const [devType, setDevType] = useState('multi')
  const [devBuid, setDevBuid] = useState('')
  const [devSigner, setDevSigner] = useState('')
  const [devResult, setDevResult] = useState(null)

  // Provider form
  const [provName, setProvName] = useState('')
  const [provKind, setProvKind] = useState('carrier')
  const [provMapping, setProvMapping] = useState(
    '{\n  "buidField": "shipment.reference",\n  "eventField": "status",\n  "events": { "SEAL_OPEN": "CONTAINER_UNSEALED", "POD": "CHECKPOINT_DELIVERED" },\n  "telemetryFields": { "location.lat": "lat", "location.lng": "lng", "sensors.temp_c": "temperature" }\n}'
  )
  const [provResult, setProvResult] = useState(null)
  const [providers, setProviders] = useState([])

  // Geofence form
  const [fenceName, setFenceName] = useState('')
  const [fenceKind, setFenceKind] = useState('customs')
  const [fenceBuid, setFenceBuid] = useState('')
  const [fenceLat, setFenceLat] = useState('')
  const [fenceLng, setFenceLng] = useState('')
  const [fenceRadius, setFenceRadius] = useState('2000')
  const [fenceEnforce, setFenceEnforce] = useState(false)
  const [fences, setFences] = useState([])

  useEffect(() => { localStorage.setItem('cargolink_actor_key', actorKey) }, [actorKey])

  const refreshLists = useCallback(async () => {
    if (!actorKey) return
    const [prov, geo] = await Promise.allSettled([
      cargoLinkApi.listProviders(actorKey),
      cargoLinkApi.listGeofences(actorKey),
    ])
    if (prov.status === 'fulfilled') setProviders(prov.value.providers || [])
    if (geo.status === 'fulfilled') setFences(geo.value.geofences || [])
  }, [actorKey])

  useEffect(() => { refreshLists() }, [refreshLists])

  const guard = (fn) => async () => {
    if (!actorKey) { setNotice('Introduce tu clave de actor (rol pos/admin, prefijo bzk_).'); return }
    setBusy(true)
    setNotice('')
    try { await fn() } catch (err) { setNotice(err.message) } finally { setBusy(false) }
  }

  const registerDevice = guard(async () => {
    const body = { type: devType, ...(devBuid ? { bUid: devBuid } : {}), ...(devSigner ? { signerAddress: devSigner } : {}) }
    const res = await cargoLinkApi.registerDevice(actorKey, body)
    setDevResult(res)
    setNotice(`Dispositivo ${res.device.device_id} registrado.`)
  })

  const registerProvider = guard(async () => {
    let mapping
    try { mapping = JSON.parse(provMapping) } catch { throw new Error('El mapping no es JSON válido.') }
    const res = await cargoLinkApi.registerProvider(actorKey, { name: provName, kind: provKind, mapping })
    setProvResult(res)
    setNotice(`Proveedor ${res.provider.name} registrado.`)
    refreshLists()
  })

  const registerFence = guard(async () => {
    const res = await cargoLinkApi.createGeofence(actorKey, {
      name: fenceName, kind: fenceKind,
      ...(fenceBuid ? { bUid: fenceBuid } : {}),
      centerLat: Number(fenceLat), centerLng: Number(fenceLng), radiusM: Number(fenceRadius),
      enforce: fenceEnforce,
    })
    setNotice(`Geocerca "${res.geofence.name}" creada (#${res.geofence.id}).`)
    refreshLists()
  })

  const tabBtn = (id, label, Icon) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '8px 0', fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
        background: tab === id ? 'var(--bz-surface-container)' : 'transparent',
        border: 'none', borderBottom: `2px solid ${tab === id ? 'var(--bz-primary)' : 'transparent'}`,
        color: tab === id ? 'var(--bz-primary)' : 'var(--bz-text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      <Icon size={13} /> {label}
    </button>
  )

  return (
    <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bz-border)', background: 'var(--bz-surface-container)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Hub de Ingestión IoT</h3>
        <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Hardware propio y sistemas externos entran por el mismo pipeline: reglas → geocercas → oráculo de disputas → webhooks.
        </p>
      </div>

      <div style={{ padding: '12px 20px 0' }}>
        <label style={labelStyle}>Clave de actor (pos/admin)</label>
        <input
          type="password"
          value={actorKey}
          onChange={e => setActorKey(e.target.value.trim())}
          placeholder="bzk_live_…"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--bz-border)', marginTop: 12 }}>
        {tabBtn('device', 'Dispositivo', Cpu)}
        {tabBtn('provider', 'Proveedor', Globe2)}
        {tabBtn('geofence', 'Geocerca', MapPinned)}
      </div>

      <div style={{ padding: '4px 20px 20px' }}>
        {tab === 'device' && (
          <>
            <label style={labelStyle}>Tipo de sensor</label>
            <select value={devType} onChange={e => setDevType(e.target.value)} style={inputStyle}>
              {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={labelStyle}>B-UID (opcional — envío al que se vincula)</label>
            <input value={devBuid} onChange={e => setDevBuid(e.target.value)} placeholder="BZ-LOG-…" style={inputStyle} />
            <label style={labelStyle}>
              Signer address (opcional) <ShieldCheck size={10} style={{ verticalAlign: -1 }} /> — exige firma secp256k1 en cada payload
            </label>
            <input value={devSigner} onChange={e => setDevSigner(e.target.value)} placeholder="0x…" style={inputStyle} />
            <button className="btn btn-primary" disabled={busy} onClick={registerDevice} style={{ width: '100%', marginTop: 14 }}>
              REGISTRAR DISPOSITIVO
            </button>
            {devResult && (
              <SecretReveal
                title="Device key"
                entries={[['deviceId', devResult.device.device_id], ['deviceKey', devResult.deviceKey]]}
              />
            )}
          </>
        )}

        {tab === 'provider' && (
          <>
            <label style={labelStyle}>Nombre del sistema externo</label>
            <input value={provName} onChange={e => setProvName(e.target.value)} placeholder="DHL_API · PORT_AUTHORITY_ALGECIRAS" style={inputStyle} />
            <label style={labelStyle}>Tipo</label>
            <select value={provKind} onChange={e => setProvKind(e.target.value)} style={inputStyle}>
              {PROVIDER_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <label style={labelStyle}>Mapping declarativo (payload del proveedor → evento canónico)</label>
            <textarea value={provMapping} onChange={e => setProvMapping(e.target.value)} rows={7}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 10, resize: 'vertical' }} />
            <button className="btn btn-primary" disabled={busy} onClick={registerProvider} style={{ width: '100%', marginTop: 14 }}>
              REGISTRAR PROVEEDOR
            </button>
            {provResult && (
              <SecretReveal
                title="Credenciales HMAC del proveedor"
                entries={[
                  ['providerId', provResult.provider.provider_id],
                  ['secret', provResult.secret],
                  ['ingest URL', provResult.ingestUrl],
                ]}
              />
            )}
            {providers.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ ...labelStyle, margin: '0 0 6px' }}>Proveedores activos</p>
                {providers.map(p => (
                  <div key={p.provider_id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--bz-border)', fontSize: 10 }}>
                    <code style={{ color: 'var(--bz-primary)' }}>{p.provider_id}</code>
                    <span style={{ fontWeight: 800 }}>{p.name}</span>
                    <span style={{ color: 'var(--bz-text-muted)' }}>{p.kind}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--bz-text-muted)' }}>
                      {p.last_event_at ? `último evento ${new Date(p.last_event_at).toLocaleString()}` : 'sin eventos'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'geofence' && (
          <>
            <label style={labelStyle}>Nombre</label>
            <input value={fenceName} onChange={e => setFenceName(e.target.value)} placeholder="Aduana Algeciras" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={fenceKind} onChange={e => setFenceKind(e.target.value)} style={inputStyle}>
                  {FENCE_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>B-UID (opcional)</label>
                <input value={fenceBuid} onChange={e => setFenceBuid(e.target.value)} placeholder="global si vacío" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Lat centro</label>
                <input value={fenceLat} onChange={e => setFenceLat(e.target.value)} placeholder="36.1408" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Lng centro</label>
                <input value={fenceLng} onChange={e => setFenceLng(e.target.value)} placeholder="-5.4386" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Radio (m)</label>
                <input value={fenceRadius} onChange={e => setFenceRadius(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--bz-text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={fenceEnforce} onChange={e => setFenceEnforce(e.target.checked)} />
                  Corredor forzoso (GEOFENCE_EXIT fuera de él)
                </label>
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={registerFence} style={{ width: '100%', marginTop: 14 }}>
              CREAR GEOCERCA
            </button>
            {fences.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ ...labelStyle, margin: '0 0 6px' }}>Geocercas activas</p>
                {fences.map(f => (
                  <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--bz-border)', fontSize: 10 }}>
                    <span style={{ fontWeight: 800 }}>{f.name}</span>
                    <span style={{ color: 'var(--bz-text-muted)' }}>{f.kind}{f.enforce ? ' · enforce' : ''}</span>
                    <span style={{ color: 'var(--bz-text-muted)' }}>{f.b_uid || 'global'}</span>
                    <button
                      onClick={guard(async () => { await cargoLinkApi.deleteGeofence(actorKey, f.id); refreshLists() })}
                      style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--bz-border)', borderRadius: 4, color: '#f87171', fontSize: 9, padding: '2px 8px' }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {notice && <p style={{ fontSize: 11, color: 'var(--bz-primary)', marginTop: 12 }}>{notice}</p>}
      </div>
    </div>
  )
}

export default IotHubPanel
