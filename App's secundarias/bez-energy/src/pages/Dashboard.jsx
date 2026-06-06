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
import { getTelemetry } from '../api'

const Dashboard = () => {
  const [data, setData] = React.useState(null)

  React.useEffect(() => {
    const fetch = async () => {
      const telemetry = await getTelemetry()
      if (telemetry) setData(telemetry)
    }
    fetch()
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [])

  if (!data) return <div style={{ color: 'white', padding: 40 }}>Synchronizing with Node...</div>

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
            <div style={{ background: 'var(--bez-surface-2)', padding: '8px 16px', borderRadius: 20, border: '1px solid var(--bez-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bez-secondary)' }}></span>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>LIVE FEED</span>
            </div>
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
                  val={`${node.output} MW`} 
                  label={node.name.split(' ')[0]} 
                  pos={positions[index]} 
                  bg={colors[node.type].bg}
                  borderColor={colors[node.type].border}
                />
              )
            })}
            
            <EnergyNode 
              icon={<BatteryCharging size={28} color="var(--bez-secondary)" />} 
              val="85%" 
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
                <h4 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>4,892.50</h4>
                <span style={{ fontSize: 14, color: 'var(--bez-secondary)', fontWeight: 700, fontFamily: 'monospace' }}>BEZ</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="stat-card">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>Yield %</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--bez-secondary)', fontFamily: 'monospace' }}>+12.4%</p>
              </div>
              <div className="stat-card">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>Node Rep</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--bez-reputation)', fontFamily: 'monospace' }}>98/100</p>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: 'var(--bez-text-muted)' }}>Self-Sufficiency Index</span>
                <span style={{ fontWeight: 700 }}>92%</span>
              </div>
              <div style={{ height: 8, background: 'var(--bez-surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '92%', background: 'var(--bez-primary)' }}></div>
              </div>
            </div>

            <div style={{ background: 'rgba(0, 98, 255, 0.05)', border: '1px solid rgba(0, 98, 255, 0.1)', borderRadius: 16, padding: 16, display: 'flex', gap: 12 }}>
              <Zap size={20} color="var(--bez-primary)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700 }}>AI Oracle Insight</p>
                <p style={{ fontSize: 11, color: 'var(--bez-text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                  95% solar yield predicted. Recommend battery charge prior to 18:00 UTC grid spike.
                </p>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 32, width: '100%' }}>
            <Wallet size={18} />
            Manage Assets
          </button>
        </div>
      </section>

      {/* Secondary Metrics */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <MetricCard icon={<Zap size={20} />} label="Consumption" val="8.2 kW" color="var(--bez-primary-light)" />
        <MetricCard icon={<ArrowUpRight size={20} />} label="Grid Export" val={`${data.global.totalOutput} MW`} color="var(--bez-secondary)" sub="+2.45 BEZ/hr" />
        <MetricCard icon={<ShieldCheck size={20} />} label="Aegis Protection" val="ENCRYPTED" color="var(--bez-secondary)" sub="No threats detected" />
        <MetricCard icon={<Settings size={20} />} label="Node Health" val="OPTIMAL" color="var(--bez-solar)" sub="Next sync in 12 min" />
      </section>

      {/* Transactions Table */}
      <section className="card" style={{ padding: 0 }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--bez-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Recent Ledger Events</h3>
          <button style={{ background: 'none', border: 'none', color: 'var(--bez-primary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
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
              <TableRow id="0x8a2...3f1c" type="ENERGY_SALE" val="+12.45 BEZ" status="PoA Verified" time="2m ago" typeColor="var(--bez-secondary)" />
              <TableRow id="0x2d1...99e8" type="PROTOCOL_BURN" val="-0.12 BEZ" status="System Sync" time="15m ago" typeColor="var(--bez-aegis)" />
              <TableRow id="0x7f4...c4a1" type="NODE_STAKING" val="500.00 BEZ" status="Validated" time="1h ago" typeColor="var(--bez-primary-light)" />
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
