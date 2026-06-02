import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ShieldAlert, 
  Cpu, 
  Zap, 
  History, 
  Calendar, 
  Info,
  ExternalLink,
  Play,
  RotateCcw,
  Pause
} from 'lucide-react'
import { getAlerts } from '../api'

const Aegis = () => {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    const fetch = async () => {
      const data = await getAlerts()
      setAlerts(data)
    }
    fetch()
    const interval = setInterval(fetch, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      
      {/* Header */}
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <ShieldAlert size={16} color="var(--bez-primary)" />
          <span style={{ fontSize: 10, color: 'var(--bez-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Aegis Intelligence System</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>Alerts & Maintenance</h1>
        <p style={{ color: 'var(--bez-text-sec)', marginTop: 8 }}>
          Real-time predictive diagnostics and hardware health ledger for Node 01.
        </p>
      </header>

      {/* Main Grid */}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>
        
        {/* Urgent Alerts Panel */}
        <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 4, height: 24, background: 'var(--bez-aegis)', borderRadius: 2 }}></div>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Active Aegis Alerts</h3>
          </div>

          {alerts.length > 0 ? alerts.map(alert => (
            <AlertCard 
              key={alert.id}
              id={alert.id}
              level={alert.level}
              title={alert.title}
              time={alert.timeRemaining || alert.retryIn}
              diagnosis={alert.diagnosis}
              color={alert.level === 'Critical' ? 'var(--bez-aegis)' : 'var(--bez-solar)'}
              actions={alert.level === 'Critical' ? ['ISOLATE NODE', 'INITIATE REPAIR'] : ['BYPASS GEN', 'ACTIVATE HEATER']}
            />
          )) : (
            <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>
              <ShieldAlert size={48} style={{ margin: '0 auto 16px' }} />
              <p>No active threats detected. Aegis protection is active.</p>
            </div>
          )}

          {/* Static Predictive Card */}
          <AlertCard 
            id="BATT-CYC-850"
            level="Predictive"
            title="Predictive Maintenance: Battery Cycle 850/1000"
            time="HEALTH: 82%"
            diagnosis="Lithium-ion degradation curve accelerating. Expected EOL in 150 cycles. Recommend depth-of-discharge limitation to 70% to extend operational lifespan."
            color="var(--bez-hydro)"
            progress={85}
          />
        </div>

        {/* Sidebar: Stats & Schedule */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Hardware Stats */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Hardware Stats</h3>
              <History size={18} color="var(--bez-text-muted)" />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <HardwareItem name="Wind Turbine Alpha-7" status="ONLINE" hours="12,450 hrs" progress={65} color="var(--bez-secondary)" />
              <HardwareItem name="Solar Array Nexus" status="OPTIMAL" hours="8,120 hrs" progress={40} color="var(--bez-secondary)" />
              
              <div style={{ marginTop: 8, padding: 16, background: '#0b0e16', borderRadius: 12, border: '1px solid var(--bez-border)' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--bez-primary)', textTransform: 'uppercase', letterSpacing: 2 }}>Global Ledger Sync</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: 11 }}>
                  <span style={{ color: 'var(--bez-text-muted)' }}>Transaction Burn (1%)</span>
                  <span style={{ color: 'var(--bez-aegis)', fontFamily: 'monospace' }}>-0.0042 BZS</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <LedgerMiniTx id="#0x4F...2E" val="+12.4 BZS" />
                  <LedgerMiniTx id="#0x9A...7B" val="+8.1 BZS" />
                </div>
              </div>
            </div>
          </div>

          {/* Scheduled Services */}
          <div style={{ background: 'rgba(10, 11, 18, 0.5)', border: '1px solid var(--bez-border)', borderRadius: 24, padding: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>Scheduled Services</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ServiceItem date="12" month="OCT" title="HVAC Filter Exchange" sub="Node Cooling System - Unit 4" />
              <ServiceItem date="15" month="OCT" title="Inverter Recalibration" sub="PV Array Secondary Link" />
            </div>
          </div>
        </div>
      </div>

      {/* Facility Overview */}
      <section style={{ position: 'relative', borderRadius: 32, overflow: 'hidden', height: 320 }}>
        <img 
          src="https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?q=80&w=1200&auto=format&fit=crop" 
          alt="Facility" 
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.4)' }} 
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bez-bg), transparent)', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'rgba(0, 98, 255, 0.1)', border: '1px solid rgba(0, 98, 255, 0.2)', backdropFilter: 'blur(8px)', padding: '8px 16px', borderRadius: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bez-primary-light)', textTransform: 'uppercase', letterSpacing: 1 }}>Facility Overview: Node 01</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--bez-text-muted)', fontFamily: 'monospace' }}>LAT: 34.0522° N, LON: 118.2437° W</span>
          </div>
        </div>
      </section>

    </div>
  )
}

const AlertCard = ({ id, level, title, time, diagnosis, color, actions, progress }) => (
  <motion.div 
    className="card" 
    style={{ padding: 24, borderLeft: `4px solid ${color}`, background: 'rgba(17, 19, 28, 0.7)' }}
    whileHover={{ background: 'rgba(17, 19, 28, 0.9)' }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ background: `${color}15`, color, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{level}</span>
          <span style={{ fontSize: 11, color: 'var(--bez-text-muted)', fontFamily: 'monospace' }}>ID: {id}</span>
        </div>
        <h4 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h4>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>{time}</span>
    </div>

    <div style={{ background: '#0b0e16', padding: 12, borderRadius: 12, border: '1px solid var(--bez-border)', display: 'flex', gap: 12, marginBottom: 20 }}>
      <Cpu size={16} color="var(--bez-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--bez-primary-light)', textTransform: 'uppercase', letterSpacing: 1 }}>AI Diagnosis</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--bez-text-sec)', fontStyle: 'italic', lineHeight: 1.5 }}>"{diagnosis}"</p>
      </div>
    </div>

    {progress && (
      <div style={{ width: '100%', height: 6, background: '#191b24', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: color }}></div>
      </div>
    )}

    {actions && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        {actions.map((act, i) => (
          <button 
            key={act} 
            className="btn"
            style={{ 
              background: i === 1 ? 'var(--bez-primary)' : 'none', 
              border: i === 1 ? 'none' : '1px solid var(--bez-border)',
              padding: '8px 16px',
              fontSize: 12
            }}
          >
            {act}
          </button>
        ))}
      </div>
    )}
  </motion.div>
)

const HardwareItem = ({ name, status, hours, progress, color }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
      <span style={{ fontSize: 10, fontWeight: 900, color, fontFamily: 'monospace' }}>{status}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--bez-text-muted)', marginBottom: 4 }}>
      <span>Running Hours</span>
      <span style={{ color: 'white' }}>{hours}</span>
    </div>
    <div style={{ width: '100%', height: 4, background: '#191b24', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${progress}%`, height: '100%', background: color }}></div>
    </div>
  </div>
)

const LedgerMiniTx = ({ id, val }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 10, fontFamily: 'monospace' }}>
    <span style={{ color: 'var(--bez-text-muted)' }}>{id}</span>
    <span style={{ color: 'var(--bez-secondary)' }}>{val}</span>
  </div>
)

const ServiceItem = ({ date, month, title, sub }) => (
  <div style={{ display: 'flex', gap: 16 }}>
    <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bez-surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--bez-border)' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--bez-text-muted)' }}>{month}</span>
      <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{date}</span>
    </div>
    <div>
      <p style={{ fontSize: 13, fontWeight: 700 }}>{title}</p>
      <p style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>{sub}</p>
    </div>
  </div>
)

export default Aegis
