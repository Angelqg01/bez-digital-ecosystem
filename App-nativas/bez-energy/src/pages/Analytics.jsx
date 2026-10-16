import React, { useEffect, useState } from 'react'
import { BarChart3, Timer, Leaf, Zap } from 'lucide-react'
import { getNodes, getNodeAnalytics } from '../api'
import { fmtPower } from '../utils/units'

const WINDOWS = [['24H', 24], ['7D', 168], ['30D', 720]]

/**
 * Analítica de tus nodos con las lecturas guardadas. Antes eran cifras fijas (84,2 % de autoconsumo, 1,42 t de CO2,
 * 1.280 «nega-watts», «Top 4 %»…) que no salían de ningún dato. Ahora: muestras, media, pico y energía del nodo elegido y
 * la serie de potencia; sin plantas conectadas se explica cómo conectar una.
 */
const Analytics = () => {
  const [nodes, setNodes] = useState(null)
  const [selected, setSelected] = useState('')
  const [hours, setHours] = useState(24)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getNodes().then((d) => {
      const own = d.simulated ? [] : d.nodes
      setNodes(own)
      if (own.length) setSelected(own[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    setResult(null); setError('')
    getNodeAnalytics(selected, hours).then(setResult).catch((e) => setError(e.message))
  }, [selected, hours])

  const node = nodes && nodes.find((n) => n.id === selected)
  const samples = (result?.samples || []).map((s) => Number(s.output_kw ?? s.consumption_kw)).filter(Number.isFinite)
  const max = samples.length ? Math.max(...samples.map(Math.abs), 1) : 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <header>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>Efficiency & Analytics</h1>
        <p style={{ color: 'var(--bez-text-sec)', marginTop: 8 }}>Rendimiento de tus nodos calculado con las lecturas que han enviado.</p>
      </header>

      {nodes === null && <p style={{ color: 'var(--bez-text-muted)' }}>Cargando…</p>}
      {nodes && nodes.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <BarChart3 size={44} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ fontWeight: 700 }}>Aún no hay datos que analizar</p>
          <p style={{ color: 'var(--bez-text-muted)', fontSize: 13, marginTop: 6 }}>
            Conecta una planta en <a href="/scada" style={{ color: 'var(--bez-primary)' }}>SCADA → Conectar planta</a> y envía lecturas: aquí verás media, picos y energía.
          </p>
        </div>
      )}

      {nodes && nodes.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select aria-label="Nodo" value={selected} onChange={(e) => setSelected(e.target.value)} style={sel}>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.id})</option>)}
            </select>
            <div role="group" aria-label="Ventana" style={{ display: 'flex', gap: 6 }}>
              {WINDOWS.map(([label, h]) => (
                <button key={label} type="button" aria-pressed={hours === h} onClick={() => setHours(h)}
                  style={{ ...sel, cursor: 'pointer', fontWeight: 700, background: hours === h ? 'var(--bez-primary)' : '#090d16', color: hours === h ? '#fff' : 'var(--bez-text-muted)' }}>{label}</button>
              ))}
            </div>
          </div>

          {error && <p role="alert" style={{ color: '#FF6B9D' }}>{error}</p>}
          {result && (
            <>
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <Metric icon={<Zap size={20} color="var(--bez-solar)" />} label="Potencia media" val={fmtPower(result.stats.avg_output_kw)} sub={node ? `capacidad ${fmtPower(node.capacity_kw)}` : ''} />
                <Metric icon={<BarChart3 size={20} color="var(--bez-primary)" />} label="Pico" val={fmtPower(result.stats.peak_output_kw)} sub={node && result.stats.peak_output_kw ? `${Math.round((Number(result.stats.peak_output_kw) / Number(node.capacity_kw)) * 100)} % de la capacidad` : ''} />
                <Metric icon={<Leaf size={20} color="var(--bez-secondary)" />} label="Energía en la ventana" val={result.stats.energy_kwh_delta == null ? '—' : `${Number(result.stats.energy_kwh_delta).toLocaleString()} kWh`} sub="si el nodo envía energy_kwh" />
                <Metric icon={<Timer size={20} color="var(--bez-wind)" />} label="Lecturas" val={String(result.stats.samples ?? 0)} sub={result.stats.until ? `última ${new Date(result.stats.until).toLocaleString()}` : 'sin lecturas'} />
              </section>

              <section className="card" style={{ padding: 28 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Potencia en la ventana</h2>
                {samples.length === 0 ? <p style={{ color: 'var(--bez-text-muted)' }}>Sin lecturas en esta ventana.</p> : (
                  <div role="img" aria-label="Serie de potencia" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
                    {samples.map((v, i) => <div key={i} title={fmtPower(v)} style={{ flex: 1, minWidth: 1, height: `${Math.max(2, (Math.abs(v) / max) * 100)}%`, background: v < 0 ? 'var(--bez-aegis)' : 'var(--bez-primary)', borderRadius: 1 }} />)}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

const sel = { padding: '10px 14px', background: '#090d16', border: '1px solid var(--bez-border)', borderRadius: 8, color: '#fff', fontSize: 13 }
const Metric = ({ icon, label, val, sub }) => (
  <div className="card" style={{ padding: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>{icon}<span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>{label}</span></div>
    <h3 style={{ fontSize: 26, fontWeight: 800, fontFamily: 'monospace' }}>{val}</h3>
    {sub && <p style={{ fontSize: 11, color: 'var(--bez-text-muted)', marginTop: 6 }}>{sub}</p>}
  </div>
)

export default Analytics
