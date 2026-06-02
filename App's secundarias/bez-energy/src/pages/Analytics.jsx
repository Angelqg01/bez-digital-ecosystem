import React from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  CloudRain, 
  Timer, 
  BarChart3, 
  Sparkles,
  Zap,
  ArrowUpRight,
  Search,
  ExternalLink,
  Leaf
} from 'lucide-react'

const Analytics = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      
      {/* Header */}
      <header>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>Efficiency & Nega-watts</h1>
        <p style={{ color: 'var(--bez-text-sec)', marginTop: 8 }}>
          Real-time performance metrics and historical ledger of your energy contribution to the BeZhas 4.0 decentralized grid.
        </p>
      </header>

      {/* Metrics Bento Grid */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MetricBox 
          icon={<Leaf size={20} color="var(--bez-secondary)" />} 
          label="Autoconsumption" 
          val="84.2" 
          unit="%" 
          status="OPTIMAL" 
          color="var(--bez-secondary)" 
          progress={84.2} 
        />
        <MetricBox 
          icon={<CloudRain size={20} color="var(--bez-wind)" />} 
          label="CO2 Saved" 
          val="1.42" 
          unit="tons" 
          status="+12% vs LY" 
          color="var(--bez-wind)" 
          sub="Equivalent to 64 trees planted." 
        />
        <MetricBox 
          icon={<Timer size={20} color="var(--bez-solar)" />} 
          label="Hardware ROI" 
          val="4.2" 
          unit="years" 
          status="Estimated" 
          color="var(--bez-solar)" 
          sub="Payback accelerated by NegaW rewards." 
        />
        <MetricBox 
          icon={<BarChart3 size={20} color="white" />} 
          label="Nega-watts Earned" 
          val="1,280" 
          unit="BZ_NW" 
          status="ACTIVE HARVEST" 
          color="var(--bez-primary)" 
          sub="≈ 0.45 ETH equivalent" 
          isPrimary
        />
      </section>

      {/* Charts & Insights */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        
        {/* Grid Balance Chart */}
        <div className="card" style={{ gridColumn: 'span 2', padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Grid Balance History</h2>
              <p style={{ fontSize: 13, color: 'var(--bez-text-muted)', marginTop: 4 }}>Hourly Production (Solar) vs Local Consumption</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['24H', '7D', '30D'].map(t => (
                <button 
                  key={t}
                  style={{ 
                    padding: '8px 16px', 
                    borderRadius: 8, 
                    fontSize: 11, 
                    fontWeight: 700, 
                    background: t === '7D' ? 'var(--bez-primary)' : 'var(--bez-surface-3)',
                    color: t === '7D' ? 'white' : 'var(--bez-text-muted)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, padding: '0 8px' }}>
            {[0.4, 0.55, 0.75, 0.65, 0.9, 0.85, 0.6, 0.45, 0.3, 0.5, 0.7, 0.95].map((h, i) => (
              <motion.div 
                key={i} 
                style={{ flex: 1, position: 'relative' }}
                initial={{ height: 0 }}
                animate={{ height: `${h * 100}%` }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 98, 255, 0.1)', borderTop: '2px solid var(--bez-primary)', borderRadius: '4px 4px 0 0' }} />
              </motion.div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 11, color: 'var(--bez-text-muted)', fontFamily: 'monospace' }}>
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>

          <div style={{ display: 'flex', gap: 24, marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--bez-primary)' }}></div>
              <span>Solar Production</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--bez-text-muted)' }}></div>
              <span>Consumption</span>
            </div>
          </div>
        </div>

        {/* Aegis Oracle */}
        <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} color="var(--bez-reputation)" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Aegis Oracle</h2>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ padding: 16, borderRadius: 16, background: 'rgba(0, 98, 255, 0.05)', border: '1px solid rgba(0, 98, 255, 0.1)' }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--bez-primary-light)', textTransform: 'uppercase', marginBottom: 8 }}>Predictive Reward</p>
              <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>Peak demand surge predicted for tomorrow 18:00 - 20:00.</p>
              <button className="btn" style={{ width: '100%', background: 'rgba(0, 98, 255, 0.1)', color: 'var(--bez-primary-light)', border: '1px solid rgba(0, 98, 255, 0.2)', fontSize: 12 }}>
                Opt-in for +25% Reward
              </button>
            </div>

            <div>
              <h4 style={{ fontSize: 10, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Historical Nega-watts</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <HistItem label="Demand Response #42" val="+240 NW" />
                <HistItem label="HVAC Curtailment Event" val="+185 NW" />
                <HistItem label="EV Smart Charge Sync" val="+410 NW" />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--bez-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>Global Sync Rank</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bez-reputation)' }}>Top 4%</span>
          </div>
        </div>
      </section>

      {/* Efficiency Logs */}
      <section className="card" style={{ padding: 0 }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--bez-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Efficiency Logs</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--bez-surface-2)', borderRadius: 12, border: '1px solid var(--bez-border)' }}>
            <Search size={14} color="var(--bez-text-muted)" />
            <input type="text" placeholder="Filter node events..." style={{ background: 'none', border: 'none', color: 'white', fontSize: 13, outline: 'none', width: 200 }} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--bez-border)', background: 'var(--bez-surface-high)' }}>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>TIMESTAMP</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>RESOURCE NODE</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>ACTION</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>IMPACT</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600, textAlign: 'right' }}>BURN (1%)</th>
              </tr>
            </thead>
            <tbody>
              <LogRow time="2023.10.24 14:22:01" node="Solar_Node_Alpha" action="Grid Injection" impact="+14.2 kWh" burn="0.142 BZ" color="var(--bez-secondary)" />
              <LogRow time="2023.10.24 16:45:12" node="NegaW_Aegis_Smart" action="Peak Curtailment" impact="+85.0 NegaW" burn="0.850 BZ" color="var(--bez-primary-light)" />
              <LogRow time="2023.10.24 18:10:55" node="Battery_Storage_01" action="Local Discharge" impact="-5.2 kWh" burn="0.052 BZ" color="var(--bez-solar)" />
              <LogRow time="2023.10.24 21:30:10" node="Ledger_Consensus" action="Validation Reward" impact="12.0 BZ_REP" burn="0.120 BZ" color="var(--bez-reputation)" />
            </tbody>
          </table>
        </div>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--bez-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto' }}>
            View Full Global Ledger <ExternalLink size={14} />
          </button>
        </div>
      </section>

    </div>
  )
}

const MetricBox = ({ icon, label, val, unit, status, color, progress, sub, isPrimary }) => (
  <div className="card" style={{ padding: 24, background: isPrimary ? 'var(--bez-primary)' : 'var(--bez-surface)', color: isPrimary ? 'var(--bez-bg)' : 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      {icon}
      <span style={{ fontSize: 10, fontWeight: 900, background: isPrimary ? 'rgba(0,0,0,0.1)' : `${color}15`, color: isPrimary ? 'rgba(0,0,0,0.6)' : color, padding: '2px 8px', borderRadius: 20 }}>{status}</span>
    </div>
    <div>
      <p style={{ fontSize: 10, color: isPrimary ? 'rgba(0,0,0,0.6)' : 'var(--bez-text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <h3 style={{ fontSize: 32, fontWeight: 800 }}>{val}</h3>
        <span style={{ fontSize: 18, fontWeight: 700, color: isPrimary ? 'rgba(0,0,0,0.5)' : color }}>{unit}</span>
      </div>
      {progress && (
        <div style={{ height: 6, width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: color }}></div>
        </div>
      )}
      {sub && <p style={{ fontSize: 11, color: isPrimary ? 'rgba(0,0,0,0.6)' : 'var(--bez-text-muted)', marginTop: 8 }}>{sub}</p>}
    </div>
  </div>
)

const HistItem = ({ label, val }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: 13 }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--bez-secondary)', fontFamily: 'monospace' }}>{val}</span>
  </div>
)

const LogRow = ({ time, node, action, impact, burn, color }) => (
  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
    <td style={{ padding: 16, color: 'var(--bez-text-muted)', opacity: 0.6 }}>{time}</td>
    <td style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }}></div>
        {node}
      </div>
    </td>
    <td style={{ padding: 16 }}>{action}</td>
    <td style={{ padding: 16, fontWeight: 700, color }}>{impact}</td>
    <td style={{ padding: 16, textAlign: 'right', color: 'var(--bez-aegis)' }}>{burn}</td>
  </tr>
)

export default Analytics
