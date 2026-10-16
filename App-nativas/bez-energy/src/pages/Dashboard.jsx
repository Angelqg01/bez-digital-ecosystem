import React from 'react'
import { motion } from 'framer-motion'
import {
  Sun,
  Wind,
  Droplets,
  BatteryCharging,
  Factory,
  Grid3X3,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  Zap,
  Info,
  Wallet,
  FileText,
  Download,
  Settings
} from 'lucide-react'
import { getTelemetry, getAlerts, getWalletStats, getWalletHistory, getOmie, getGridIndicators } from '../api'
import { fmtPower, fmtGridMw, fmtEur, fmtPct } from '../utils/units'
import MarketPanel from '../components/MarketPanel'
import SourceBadge from '../components/SourceBadge'

const Dashboard = () => {
  const [data, setData] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [wallet, setWallet] = React.useState(null)
  const [alerts, setAlerts] = React.useState([])
  const [history, setHistory] = React.useState([])
  const [omie, setOmie] = React.useState(null)
  const [grid, setGrid] = React.useState(null)

  // Datos que cambian despacio (cartera, alertas, mercado): cada 60 s. La telemetría, cada 5 s.
  React.useEffect(() => {
    let alive = true
    // Cada fuente pinta cuando llega: una lenta (REE puede tardar 10 s) no bloquea el resto.
    const load = () => {
      getWalletStats().then((w) => alive && setWallet(w))
      getAlerts().then((a) => alive && setAlerts(a || [])).catch(() => {})
      getWalletHistory(5).then((h) => alive && setHistory(h))
      getOmie().then((o) => alive && setOmie(o))
      getGridIndicators().then((g) => alive && setGrid(g))
    }
    load()
    const t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  React.useEffect(() => {
    const fetch = async () => {
      try {
        const telemetry = await getTelemetry()
        if (telemetry) { setData(telemetry); setError(null) }
      } catch (err) {
        // With the simulated fallback disabled (production), surface the real
        // backend/auth failure instead of leaving the panel stuck loading.
        setError(err.message || 'Telemetry backend unreachable')
      }
    }
    fetch()
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [])

  if (error && !data) return (
    <div style={{ color: '#FF6B9D', padding: 40 }}>
      <strong>VPP telemetry unavailable.</strong>
      <div style={{ color: '#9aa', marginTop: 8, fontSize: 14 }}>{error}</div>
      <div style={{ color: '#667', marginTop: 8, fontSize: 13 }}>
        Sign in with your wallet and confirm the API gateway is reachable. Retrying every 5s…
      </div>
    </div>
  )
  if (!data) return <div style={{ color: 'white', padding: 40 }}>Synchronizing with Node...</div>

  const battery = data.nodes.find((n) => n.type === 'BATTERY')
  const batterySoc = battery && battery.soc != null ? battery.soc : null
  const loadNodes = data.nodes.filter((n) => n.type === 'LOAD')
  const consumptionKw = loadNodes.length ? loadNodes.reduce((a, n) => a + n.output, 0) : null
  const online = data.nodes.filter((n) => n.status === 'Online').length
  const aegisAlerts = alerts.filter((a) => a.type === 'AEGIS_ANOMALY')
  const topAlert = alerts.find((a) => a.type !== 'TELEMETRY_SIMULATED')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Documentation Banner */}
      <section className="card" style={{ padding: '20px 24px', background: 'linear-gradient(90deg, rgba(0, 240, 255, 0.1), transparent)', borderLeft: '4px solid var(--bez-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} color="var(--bez-primary)" />
            BeZhas Autonomous Infrastructure Energy
          </h3>
          <p style={{ fontSize: 13, color: 'var(--bez-text-muted)', marginTop: 4 }}>
            Descubre cómo funciona la VPP de BeZhas y los rendimientos pasivos que puedes obtener tokenizando tu energía.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <a href="/docs" className="btn btn-primary" style={{ textDecoration: 'none', fontSize: 13 }}>Saber Más</a>
          <a href="/BeZhas_Autonomous_Infrastructure_Energy.pdf" target="_blank" className="btn" style={{ textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> PDF
          </a>
        </div>
      </section>

      {/* Hero Section: Energy Flow & Economic Sovereignty */}
      <section className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>
        
        {/* Energy Flow Graph */}
        <div className="card" style={{ gridColumn: 'span 8', padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>Hybrid Energy Flow</h2>
              <p style={{ fontSize: 12, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
                Real-Time Distribution Graph
              </p>
            </div>
            <SourceBadge simulated={data.simulated} source={data.source} />
          </div>

          <div className="flow-container">
            {/* Central Hub */}
            <motion.div 
              className="hub-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <Grid3X3 size={32} color="var(--bez-primary-light)" />
              <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, marginTop: 4 }}>{data.global.netFlow}</div>
              <div style={{ fontSize: 10, color: 'var(--bez-text-muted)', fontWeight: 700 }}>kW NET</div>
            </motion.div>

            {/* Orbiting Nodes (generation sources only — battery/load rendered separately) */}
            {data.nodes
              .filter((n) => ['SOLAR', 'WIND', 'HYDRO'].includes(n.type))
              .slice(0, 3)
              .map((node, index) => {
              const positions = [
                { top: 0, left: '20%' },
                { top: 0, right: '20%' },
                { bottom: 0, left: '20%' }
              ]
              const icons = {
                'SOLAR': <Sun size={28} color="var(--bez-solar)" />,
                'WIND': <Wind size={28} color="var(--bez-wind)" />,
                'HYDRO': <Droplets size={28} color="var(--bez-hydro)" />
              }
              const colors = {
                'SOLAR': { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' },
                'WIND': { bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.3)' },
                'HYDRO': { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)' }
              }
              return (
                <EnergyNode 
                  key={node.id}
                  icon={icons[node.type]} 
                  val={fmtPower(node.output)} 
                  label={node.name.split(' ')[0]} 
                  pos={positions[index]} 
                  bg={colors[node.type].bg}
                  borderColor={colors[node.type].border}
                />
              )
            })}
            
            <EnergyNode 
              icon={<BatteryCharging size={28} color="var(--bez-secondary)" />} 
              val={batterySoc == null ? '—' : `${Math.round(batterySoc)}%`} 
              label="Storage" 
              pos={{ bottom: 0, right: '20%' }} 
              bg="rgba(78, 222, 163, 0.1)"
              borderColor="rgba(78, 222, 163, 0.3)"
            />
            
            {/* Backup (Inactive) */}
            <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bez-surface-3)', border: '1px solid var(--bez-border)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                <Factory size={24} color="#8c90a2" />
              </div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', marginTop: 4 }}>OFFLINE</div>
            </div>

            {/* SVG Lines (Simplified representation) */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', opacity: 0.2 }}>
               <line x1="25%" y1="20%" x2="50%" y2="50%" stroke="var(--bez-primary-light)" strokeDasharray="4 4" />
               <line x1="75%" y1="20%" x2="50%" y2="50%" stroke="var(--bez-primary-light)" strokeDasharray="4 4" />
               <line x1="25%" y1="80%" x2="50%" y2="50%" stroke="var(--bez-primary-light)" strokeDasharray="4 4" />
               <line x1="75%" y1="80%" x2="50%" y2="50%" stroke="var(--bez-primary-light)" strokeDasharray="4 4" />
            </svg>
          </div>
        </div>

        {/* Economic Sovereignty Card */}
        <div className="card" style={{ gridColumn: 'span 4', borderLeft: '4px solid var(--bez-primary)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Economic Sovereignty</h3>
            <ShieldCheck size={24} color="var(--bez-reputation)" />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ borderBottom: '1px solid var(--bez-border)', paddingBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Global Ledger Balance</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <h4 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{wallet ? Number(wallet.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</h4>
                <span style={{ fontSize: 14, color: 'var(--bez-secondary)', fontWeight: 700, fontFamily: 'monospace' }}>BEZ</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="stat-card">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>Yield %</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--bez-secondary)', fontFamily: 'monospace' }}>{wallet ? `${Number(wallet.yieldPercentage) >= 0 ? '+' : ''}${wallet.yieldPercentage}%` : '—'}</p>
              </div>
              <div className="stat-card">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>Node Rep</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--bez-reputation)', fontFamily: 'monospace' }}>{wallet ? `${wallet.reputation}/100` : '—'}</p>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: 'var(--bez-text-muted)' }}>Self-Sufficiency Index</span>
                <span style={{ fontWeight: 700 }}>{fmtPct(data.global.selfSufficiency)}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bez-surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, Number(data.global.selfSufficiency) || 0))}%`, background: 'var(--bez-primary)' }}></div>
              </div>
            </div>

            <div style={{ background: 'rgba(0, 98, 255, 0.05)', border: '1px solid rgba(0, 98, 255, 0.1)', borderRadius: 16, padding: 16, display: 'flex', gap: 12 }}>
              <Zap size={20} color="var(--bez-primary)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{topAlert ? topAlert.title : 'Sin alertas de mercado'}</p>
                <p style={{ fontSize: 11, color: 'var(--bez-text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                  {topAlert ? topAlert.diagnosis : 'No hay ventanas de precio relevantes en las próximas horas.'}
                </p>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 32, width: '100%' }} onClick={() => { window.location.assign('/wallet') }}>
            <Wallet size={18} />
            Manage Assets
          </button>
        </div>
      </section>

      {/* Mercado y red (datos reales: OMIE + REE) */}
      <MarketPanel omie={omie} grid={grid} />

      {/* Secondary Metrics */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <MetricCard icon={<Zap size={20} />} label="Consumption" val={fmtPower(consumptionKw)} color="var(--bez-primary-light)" sub={consumptionKw == null ? 'sin carga conectada' : undefined} />
        <MetricCard icon={<ArrowUpRight size={20} />} label={data.global.netFlow >= 0 ? 'Grid Export' : 'Grid Import'} val={fmtPower(Math.abs(data.global.netFlow))} color="var(--bez-secondary)" sub={`generación ${fmtPower(data.global.totalOutput)}`} />
        <MetricCard icon={<ShieldCheck size={20} />} label="Aegis Integrity" val={aegisAlerts.length ? `${aegisAlerts.length} ALERT` : 'CLEAR'} color={aegisAlerts.length ? '#FF6B9D' : 'var(--bez-secondary)'} sub={aegisAlerts.length ? 'revisa Aegis' : 'sin anomalías en 24 h'} />
        <MetricCard icon={<Settings size={20} />} label="Node Health" val={`${online}/${data.nodes.length} ONLINE`} color={online === data.nodes.length ? 'var(--bez-solar)' : '#FF6B9D'} sub={data.simulated ? 'nodos de demostración' : 'lecturas de tus nodos'} />
      </section>

      {/* Transactions Table */}
      <section className="card" style={{ padding: 0 }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--bez-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Recent Ledger Events</h3>
          <button onClick={() => window.location.assign('/wallet')} style={{ background: 'none', border: 'none', color: 'var(--bez-primary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            View Registry <ArrowUpRight size={14} />
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--bez-border)' }}>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>TX ID</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>TYPE</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>VALUE</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>CONSENSUS</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>TIME</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, color: 'var(--bez-text-muted)', textAlign: 'center' }}>Aún no hay movimientos en tu cuenta de energía.</td></tr>
              )}
              {history.map((h, i) => (
                <TableRow key={h.id || i} id={String(h.tx_hash || h.id || '—').slice(0, 12)} type={h.type || 'TX'} val={`${Number(h.amount_bzhs ?? 0) >= 0 ? '+' : ''}${Number(h.amount_bzhs ?? 0).toFixed(2)} BEZ`} status={h.status || '—'} time={h.created_at ? new Date(h.created_at).toLocaleString() : '—'} typeColor="var(--bez-secondary)" />
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}

const EnergyNode = ({ icon, val, label, pos, bg, borderColor }) => (
  <motion.div 
    className="energy-node" 
    style={{ ...pos }}
    whileHover={{ scale: 1.1 }}
  >
    <div className="node-icon" style={{ background: bg, border: `1px solid ${borderColor}` }}>
      {icon}
    </div>
    <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{val}</div>
    <div style={{ fontSize: 10, color: 'var(--bez-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
  </motion.div>
)

const MetricCard = ({ icon, label, val, color, sub }) => (
  <div className="card" style={{ padding: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bez-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color || 'var(--bez-text-muted)' }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>{label}</p>
        <h4 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{val}</h4>
      </div>
    </div>
    {sub && (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--bez-text-muted)' }}>
        <span>Status</span>
        <span style={{ color: color, fontWeight: 700 }}>{sub}</span>
      </div>
    )}
  </div>
)

const TableRow = ({ id, type, val, status, time, typeColor }) => (
  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
    <td style={{ padding: 16, color: 'var(--bez-primary-light)' }}>{id}</td>
    <td style={{ padding: 16 }}>
      <span style={{ 
        padding: '2px 8px', 
        borderRadius: 4, 
        background: `${typeColor}15`, 
        color: typeColor, 
        border: `1px solid ${typeColor}30`,
        fontSize: 10,
        fontWeight: 700
      }}>
        {type}
      </span>
    </td>
    <td style={{ padding: 16, fontWeight: 700 }}>{val}</td>
    <td style={{ padding: 16, color: 'var(--bez-text-muted)' }}>{status}</td>
    <td style={{ padding: 16, color: 'var(--bez-text-muted)', opacity: 0.6 }}>{time}</td>
  </tr>
)

export default Dashboard
