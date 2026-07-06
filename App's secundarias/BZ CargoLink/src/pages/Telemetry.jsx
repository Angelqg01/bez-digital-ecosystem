import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Radio,
  Thermometer,
  Droplets,
  Zap,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Tag,
} from 'lucide-react'
import { useTransactions } from '../hooks/useTransaction'
import { cargoLinkApi } from '../services/cargoLinkApi'

function authKey() {
  return localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
}

const METRIC_ICON = {
  temperature: Thermometer,
  humidity: Droplets,
  shock: Zap,
  gps: MapPin,
  rfid: Tag,
}

const METRIC_COLOR = {
  temperature: '#3b82f6',
  humidity: '#06b6d4',
  shock: '#f59e0b',
  gps: '#a855f7',
  rfid: '#10b981',
}

const Telemetry = () => {
  const navigate = useNavigate()
  const { transactions, loading: txLoading } = useTransactions()
  const [selected, setSelected] = useState('')
  const [telemetry, setTelemetry] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const load = useCallback(async () => {
    if (!selected) return
    const key = authKey()
    if (!key) { setError('Sin autenticación'); return }
    setLoading(true)
    setError(null)
    try {
      const data = await cargoLinkApi.getTelemetry(key, { bUid: selected, limit: 100 })
      setTelemetry(data.telemetry || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!autoRefresh || !selected) return
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [autoRefresh, load, selected])

  const breaches = telemetry.filter(t => t.breach)
  const latest = {}
  for (const t of telemetry) {
    if (!latest[t.metric]) latest[t.metric] = t
  }
  const latestEntries = Object.values(latest)

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <Radio size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>IoT Telemetry Feed</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Telemetría</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Lecturas en tiempo real de sensores vinculados a tus B-UIDs.
        </p>
      </header>

      {/* B-UID selector */}
      <div className="card" style={{ padding: 16 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
          Selecciona B-UID
        </label>
        {txLoading ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Cargando...</p>
        ) : transactions.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>No hay B-UIDs disponibles.</p>
        ) : (
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setTelemetry([]); setError(null) }}
            style={selectStyle}
          >
            <option value="">— Elige un B-UID —</option>
            {transactions.map(t => (
              <option key={t.b_uid} value={t.b_uid}>
                {t.b_uid} · {t.status} {t.cargo?.type ? `· ${t.cargo.type}` : ''}
              </option>
            ))}
          </select>
        )}

        {selected && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn" onClick={load} disabled={loading}
              style={{ flex: 1, border: '1px solid var(--bz-border)', fontSize: 11 }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refrescar
            </button>
            <button
              className="btn"
              onClick={() => setAutoRefresh(v => !v)}
              style={{
                flex: 1, fontSize: 11,
                border: `1px solid ${autoRefresh ? 'var(--bz-secondary)' : 'var(--bz-border)'}`,
                color: autoRefresh ? 'var(--bz-secondary)' : 'var(--bz-text)',
              }}
            >
              <Radio size={14} /> {autoRefresh ? 'LIVE ●' : 'LIVE OFF'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="card" style={{ padding: 12, borderLeft: '3px solid #ef4444' }}>
          <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>
        </div>
      )}

      {/* Breach banner */}
      {selected && breaches.length > 0 && (
        <div className="card" style={{ padding: 14, borderLeft: '3px solid #ef4444', background: 'rgba(239,68,68,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={18} color="#ef4444" />
            <span style={{ fontSize: 14, fontWeight: 900, color: '#ef4444' }}>
              {breaches.some(b => b.metric === 'temperature') ? 'COLD CHAIN BREACH' : 'SHOCK ALERT'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginLeft: 'auto' }}>
              {breaches.length} alerta{breaches.length > 1 ? 's' : ''}
            </span>
          </div>
          {breaches.slice(0, 5).map((b, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--bz-text-muted)', padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(239,68,68,0.15)' : 'none' }}>
              <span style={{ color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>{b.metric}</span>
              {': '}
              {b.value != null ? `${b.value}${b.unit || ''}` : '—'} — {b.reason}
              <span style={{ float: 'right', fontSize: 9 }}>{new Date(b.recorded_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Latest readings dashboard */}
      {selected && latestEntries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {latestEntries.map(t => {
            const Icon = METRIC_ICON[t.metric] || Radio
            const color = METRIC_COLOR[t.metric] || 'var(--bz-primary)'
            return (
              <div key={t.metric} className="card" style={{ margin: 0, position: 'relative' }}>
                {t.breach && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Icon size={16} color={color} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>{t.metric}</span>
                </div>
                <p style={{ fontSize: 24, fontWeight: 900, fontFamily: 'Space Grotesk', color: t.breach ? '#ef4444' : '#fff' }}>
                  {t.value != null ? t.value : '—'}
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--bz-text-muted)', marginLeft: 4 }}>{t.unit || ''}</span>
                </p>
                <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', marginTop: 4 }}>
                  {t.device_id} · {new Date(t.recorded_at).toLocaleTimeString()}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Full telemetry log */}
      {selected && telemetry.length > 0 && (
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10, color: 'var(--bz-text-muted)' }}>
            Feed completo ({telemetry.length} lecturas)
          </h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: 400, overflowY: 'auto' }}>
            {telemetry.map((t, i) => {
              const Icon = METRIC_ICON[t.metric] || Radio
              const color = METRIC_COLOR[t.metric] || 'var(--bz-primary)'
              return (
                <div key={i} style={{
                  padding: '10px 16px', borderBottom: '1px solid var(--bz-border)',
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: t.breach ? 'rgba(239,68,68,0.04)' : 'transparent',
                }}>
                  <Icon size={14} color={t.breach ? '#ef4444' : color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.breach ? '#ef4444' : '#fff', textTransform: 'uppercase' }}>
                        {t.metric}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                        {t.value != null ? `${t.value}${t.unit || ''}` : '—'}
                      </span>
                      {t.breach && (
                        <span style={{ fontSize: 8, fontWeight: 900, background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>BREACH</span>
                      )}
                    </div>
                    {t.reason && <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', marginTop: 2 }}>{t.reason}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 9, color: 'var(--bz-text-muted)' }}>{t.device_id}</p>
                    <p style={{ fontSize: 8, color: 'var(--bz-text-muted)' }}>{new Date(t.recorded_at).toLocaleString()}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selected && !loading && telemetry.length === 0 && !error && (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <Radio size={32} color="var(--bz-text-muted)" style={{ opacity: 0.3, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>
            Sin telemetría para este B-UID. Registra un dispositivo en <strong>Operarios</strong> y envía datos.
          </p>
        </div>
      )}

      {/* Link to tx detail */}
      {selected && (
        <button
          className="btn"
          style={{ width: '100%', border: '1px solid var(--bz-border)', padding: 14 }}
          onClick={() => navigate(`/tx/${selected}`)}
        >
          Ver detalle del B-UID →
        </button>
      )}
    </div>
  )
}

const selectStyle = {
  width: '100%', padding: '10px 12px', background: '#090d16',
  border: '1px solid var(--bz-border)', borderRadius: 10, color: '#fff', fontSize: 13,
}

export default Telemetry
