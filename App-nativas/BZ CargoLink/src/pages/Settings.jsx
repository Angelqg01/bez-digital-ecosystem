import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  Cpu,
  Radio,
  ShieldCheck,
  Globe2,
  MapPinned,
  Anchor,
  Scale,
  PlayCircle,
  ChevronRight,
} from 'lucide-react'
import IotHubPanel from '../components/IotHubPanel'
import { cargoLinkApi } from '../services/cargoLinkApi'

function authKey() {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
}

const SENSOR_CAPABILITIES = [
  { icon: Radio, color: '#3b82f6', title: 'Telemetría en vivo', desc: 'Temperatura, humedad, shock, luz, presión, GPS, RFID y balizas BLE por B-UID.' },
  { icon: MapPinned, color: '#a855f7', title: 'Geocercas', desc: 'Zonas aduaneras/portuarias autorizadas y corredores de ruta con detección de salida.' },
  { icon: ShieldCheck, color: '#39ff14', title: 'Firmas edge', desc: 'Precintos con secure element firman la telemetría (secp256k1) — inviolable.' },
  { icon: Globe2, color: '#06b6d4', title: 'Ingesta de terceros', desc: 'Carriers, aduanas y network servers LoRaWAN entran por webhook HMAC al mismo pipeline.' },
  { icon: Scale, color: '#fb923c', title: 'Oráculo de disputas', desc: 'Una brecha grave retiene el escrow BEZ (DISPUTED) y propone la liquidación.' },
  { icon: Anchor, color: '#eab308', title: 'Anclaje merkle', desc: 'La telemetría se consolida en una prueba criptográfica verificable on-chain.' },
]

const Section = ({ icon: Icon, color, title, subtitle, children, id }) => (
  <section id={id} style={{ marginBottom: 28 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Space Grotesk' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--bz-text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
)

const Settings = () => {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ devices: null, providers: null, geofences: null })

  const loadCounts = useCallback(async () => {
    const key = authKey()
    if (!key) return
    const [prov, geo] = await Promise.allSettled([
      cargoLinkApi.listProviders(key),
      cargoLinkApi.listGeofences(key),
    ])
    setCounts({
      providers: prov.status === 'fulfilled' ? (prov.value.providers || []).length : null,
      geofences: geo.status === 'fulfilled' ? (geo.value.geofences || []).length : null,
      devices: null, // devices no tienen listado por dueño (clave de una sola vez); se ven en Operarios
    })
  }, [])

  useEffect(() => { loadCounts() }, [loadCounts])

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <SettingsIcon size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Panel de Configuración</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Configuración</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Ajusta el ecosistema logístico: sensores IoT, geocercas, integraciones y accesos.
        </p>
      </header>

      {/* Recorrido guiado */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('cargolink:start-tour'))}
        className="btn"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 28,
          border: '1px solid var(--bz-primary)', background: 'linear-gradient(135deg, rgba(0,240,255,0.08), rgba(168,85,247,0.08))',
        }}
      >
        <PlayCircle size={22} color="var(--bz-primary)" />
        <div style={{ textAlign: 'left', flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 900 }}>Cómo usar BZ CargoLink</p>
          <p style={{ fontSize: 11, color: 'var(--bz-text-muted)' }}>Recorrido animado por cada función de la app.</p>
        </div>
        <ChevronRight size={18} color="var(--bz-text-muted)" />
      </button>

      {/* ── SECCIÓN DE SENSORES ── */}
      <Section
        id="sensores"
        icon={Cpu}
        color="var(--bz-primary)"
        title="Sensores IoT"
        subtitle="Hub de ingestión unificado — hardware propio y sistemas externos entran por el mismo pipeline."
      >
        {/* Capacidades */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
          {SENSOR_CAPABILITIES.map(cap => {
            const Icon = cap.icon
            return (
              <div key={cap.title} className="card" style={{ margin: 0, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon size={15} color={cap.color} />
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{cap.title}</span>
                </div>
                <p style={{ fontSize: 10.5, color: 'var(--bz-text-muted)', lineHeight: 1.5 }}>{cap.desc}</p>
              </div>
            )
          })}
        </div>

        {/* Resumen rápido */}
        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Proveedores externos</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--bz-primary)' }}>{counts.providers ?? '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Geocercas activas</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#a855f7' }}>{counts.geofences ?? '—'}</p>
          </div>
        </div>

        {/* El panel real de registro (dispositivos / proveedores / geocercas) */}
        <IotHubPanel />

        {/* Accesos rápidos */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ flex: 1, minWidth: 180 }} onClick={() => navigate('/telemetry')}>
            <Radio size={15} /> Ver telemetría en vivo
          </button>
          <button className="btn" style={{ flex: 1, minWidth: 180, border: '1px solid var(--bz-border)' }} onClick={() => navigate('/integration')}>
            <Globe2 size={15} /> API & Webhooks
          </button>
        </div>
      </Section>
    </div>
  )
}

export default Settings
