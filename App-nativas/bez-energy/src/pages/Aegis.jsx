import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, Cpu, History } from 'lucide-react'
import { getAlerts, getTelemetry, getOmie, sendControlCommand } from '../api'
import useMe from '../hooks/useMe'
import SourceBadge from '../components/SourceBadge'

const COLOR = { Critical: 'var(--bez-aegis)', Warning: 'var(--bez-solar)', Info: 'var(--bez-primary-light)' }
const CMD_LABEL = { CHARGE_BATTERY: 'Cargar batería', DISCHARGE_BATTERY: 'Descargar / vender', SHED_LOAD: 'Reducir carga' }
// Parámetro por defecto del comando (el backend exige límites de seguridad; no se manda un valor mayor).
const defaultParams = (a) => ({ ...(a.powerKw ? { powerKw: Math.min(a.powerKw, 500) } : {}), ...(a.durationMin ? { durationMin: Math.min(a.durationMin, 120) } : {}),
  ...(a.command === 'CHARGE_BATTERY' || a.command === 'DISCHARGE_BATTERY' ? { powerKw: a.powerKw || 50 } : {}), ...(a.command === 'SHED_LOAD' ? { durationMin: a.durationMin || 60 } : {}) })

const Aegis = () => {
  const [alerts, setAlerts] = useState(null)
  const [telemetry, setTelemetry] = useState(null)
  const [omie, setOmie] = useState(null)
  const { me } = useMe()

  const load = useCallback(async () => {
    const [a, t, o] = await Promise.all([getAlerts().catch(() => null), getTelemetry().catch(() => null), getOmie()])
    setAlerts(a); setTelemetry(t); setOmie(o)
  }, [])
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i) }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <ShieldAlert size={16} color="var(--bez-primary)" />
          <span style={{ fontSize: 10, color: 'var(--bez-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Aegis Intelligence System</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>Alerts & Maintenance</h1>
        <p style={{ color: 'var(--bez-text-sec)', marginTop: 8 }}>
          Alertas calculadas con los precios publicados por OMIE, el estado de tus nodos y los eventos de integridad de la telemetría.
        </p>
      </header>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div style={{ gridColumn: 'span 2', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 4, height: 24, background: 'var(--bez-aegis)', borderRadius: 2 }}></div>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Active Aegis Alerts</h3>
          </div>

          {alerts === null && <p style={{ color: 'var(--bez-text-muted)' }}>Cargando alertas…</p>}
          {alerts && alerts.length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.7 }}>
              <ShieldAlert size={48} style={{ margin: '0 auto 16px' }} />
              <p>No hay alertas activas: precios normales y sin anomalías de integridad.</p>
            </div>
          )}
          {alerts && alerts.map((alert) => <AlertCard key={alert.id} alert={alert} canControl={me.is_operator} />)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Calidad de los datos</h3>
              <History size={18} color="var(--bez-text-muted)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
              <Row label="Telemetría de nodos">{telemetry ? <SourceBadge simulated={telemetry.simulated} source={telemetry.source} /> : '—'}</Row>
              <Row label="Precio de mercado">
                <strong style={{ color: omie && !omie.simulated ? 'var(--bez-secondary)' : '#f59e0b' }}>{omie ? (omie.simulated ? 'Simulado' : 'OMIE (publicado)') : 'Sin datos'}</strong>
              </Row>
              <Row label="Nodos con lectura">
                <strong>{telemetry ? `${telemetry.nodes.filter((n) => n.status === 'Online').length}/${telemetry.nodes.length}` : '—'}</strong>
              </Row>
              {telemetry?.simulated && (
                <p style={{ fontSize: 11, color: 'var(--bez-text-muted)', lineHeight: 1.5 }}>
                  Estás viendo nodos de demostración. Conecta tu planta en <a href="/scada" style={{ color: 'var(--bez-primary)' }}>SCADA</a> para que Aegis vigile lecturas reales.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Row = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
    <span style={{ color: 'var(--bez-text-muted)' }}>{label}</span>{children}
  </div>
)

function AlertCard({ alert, canControl }) {
  const color = COLOR[alert.level] || COLOR.Info
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const act = alert.action

  const apply = async () => {
    setBusy(true); setResult(null)
    try {
      const r = await sendControlCommand(act.nodeId, act.command, defaultParams(act))
      if (r.hitl_pending) setResult({ kind: 'pending', text: 'En cola de aprobación humana. No se ha ejecutado.' })
      else if (r.delivered) setResult({ kind: 'ok', text: 'Comando firmado y entregado.' })
      else setResult({ kind: 'warn', text: r.warning || 'Firmado y auditado, pero no entregado.' })
    } catch (err) { setResult({ kind: 'error', text: err.message }) } finally { setBusy(false) }
  }
  const tone = { ok: 'var(--bez-secondary)', pending: 'var(--bez-primary)', warn: '#f59e0b', error: '#FF6B9D' }

  return (
    <motion.div className="card" style={{ padding: 24, borderLeft: `4px solid ${color}`, background: 'rgba(17, 19, 28, 0.7)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ background: `${color}22`, color, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{alert.level}</span>
            <span style={{ fontSize: 11, color: 'var(--bez-text-muted)', fontFamily: 'monospace' }}>{alert.source}</span>
          </div>
          <h4 style={{ fontSize: 20, fontWeight: 700 }}>{alert.title}</h4>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>{alert.timeRemaining}</span>
      </div>
      <div style={{ background: '#0b0e16', padding: 12, borderRadius: 12, border: '1px solid var(--bez-border)', display: 'flex', gap: 12, marginBottom: act ? 16 : 0 }}>
        <Cpu size={16} color="var(--bez-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, color: 'var(--bez-text-sec)', lineHeight: 1.5 }}>{alert.diagnosis}</p>
      </div>
      {act && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {!canControl && <span style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>🔒 requiere rol de operador</span>}
          <button type="button" className="btn btn-primary" disabled={busy || !canControl} onClick={apply} style={{ padding: '8px 16px', fontSize: 12 }}>
            {busy ? 'Enviando…' : `${CMD_LABEL[act.command] || act.command} · ${act.nodeId}`}
          </button>
        </div>
      )}
      {result && <p role="status" data-testid="command-result" style={{ marginTop: 12, fontSize: 12, textAlign: "right", color: tone[result.kind] }}>{result.text}</p>}
    </motion.div>
  )
}

export default Aegis
