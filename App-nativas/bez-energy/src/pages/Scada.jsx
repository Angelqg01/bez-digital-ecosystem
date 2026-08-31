import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sun, 
  Wind, 
  Droplets, 
  Factory, 
  Settings2, 
  ChevronDown, 
  ChevronUp,
  Activity,
  Cpu,
  Power,
  Zap,
  Leaf,
  ShieldCheck,
  Video
} from 'lucide-react'
import { getTelemetry, sendControlCommand } from '../api'
import useMe from '../hooks/useMe'

const Scada = () => {
  const [expandedAsset, setExpandedAsset] = useState('DER-SOL-001')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const { me } = useMe()
  const canControl = me.is_operator // operator or admin

  useEffect(() => {
    const fetch = async () => {
      try {
        const telemetry = await getTelemetry()
        if (telemetry) { setData(telemetry); setError(null) }
      } catch (err) {
        setError(err.message || 'SCADA telemetry backend unreachable')
      }
    }
    fetch()
    const interval = setInterval(fetch, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleCommand = async (nodeId, command) => {
    if (!canControl) {
      alert('Permiso denegado: el control SCADA requiere rol de operador. Solicítalo al administrador.')
      return
    }
    try {
      const result = await sendControlCommand(nodeId, command)
      if (result.success) {
        // Refresh data after command
        const telemetry = await getTelemetry()
        if (telemetry) setData(telemetry)
      } else {
        alert('Control Error: ' + result.error)
      }
    } catch (err) {
      // Backend rejected (e.g. 403 without operator role, or unreachable).
      alert('Control Error: ' + (err.message || 'comando rechazado'))
    }
  }

  if (error && !data) return (
    <div style={{ color: '#FF6B9D', padding: 40 }}>
      <strong>SCADA no disponible.</strong>
      <div style={{ color: '#9aa', marginTop: 8, fontSize: 14 }}>{error}</div>
      <div style={{ color: '#667', marginTop: 8, fontSize: 13 }}>Inicia sesión y comprueba el gateway. Reintentando cada 10s…</div>
    </div>
  )
  if (!data) return <div style={{ color: 'white', padding: 40 }}>Initializing SCADA Interface...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      
      {/* Header */}
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Settings2 size={16} color="var(--bez-secondary)" />
          <span style={{ fontSize: 10, color: 'var(--bez-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Asset Control Center</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700 }}>Physical Infrastructure Registry</h1>
            <p style={{ color: 'var(--bez-text-sec)', marginTop: 8, maxWidth: 600 }}>
              Real-time SCADA IoT monitoring and remote orchestration for distributed energy resources. Ensure 99.9% node uptime via Aegis protocol.
            </p>
          </div>
          <div style={{ background: 'var(--bez-surface)', border: '1px solid var(--bez-border)', borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bez-secondary)' }}></div>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: 'var(--bez-secondary)' }}>System Health: Optimal</span>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <BentoStat label="Total Output" val={data.global.totalOutput} unit="MW" trend="+2.4% vs last hr" color="var(--bez-primary-light)" />
        <BentoStat label="Active Nodes" val={data.nodes.filter(n => n.status === 'Online').length} unit={`/${data.nodes.length}`} trend={`${data.nodes.filter(n => n.status === 'Maintenance').length} in Maintenance`} color="var(--bez-text)" trendColor="var(--bez-aegis)" />
        <BentoStat label="Efficiency Ratio" val={data.global.efficiency} unit="%" trend="Global Aggregate" color="var(--bez-hydro)" />
        <BentoStat label="Carbon Offset" val={data.global.carbonOffset} unit="T" trend="Daily Reduction" color="var(--bez-solar)" icon={<Leaf size={48} />} />
      </section>

      {/* Asset List */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.nodes.map(node => (
          <AssetRow 
            key={node.id}
            id={node.id}
            name={node.name}
            icon={node.type === 'SOLAR' ? <Sun size={32} /> : (node.type === 'WIND' ? <Wind size={32} /> : <Droplets size={32} />)}
            output={`${node.output} ${node.unit}`}
            status={node.status}
            isExpanded={expandedAsset === node.id}
            onToggle={() => setExpandedAsset(expandedAsset === node.id ? null : node.id)}
            bg={node.type === 'SOLAR' ? 'rgba(245, 158, 11, 0.1)' : (node.type === 'WIND' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(99, 102, 241, 0.1)')}
            color={node.type === 'SOLAR' ? 'var(--bez-solar)' : (node.type === 'WIND' ? 'var(--bez-wind)' : 'var(--bez-hydro)')}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, padding: 32 }}>
              {/* Diagnostics */}
              <div>
                <h4 style={{ fontSize: 10, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 2, borderBottom: '1px solid var(--bez-border)', paddingBottom: 8, marginBottom: 16 }}>Diagnostic Parameters</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  {Object.entries(node.diagnostics).map(([key, val]) => (
                    <Diag key={key} val={val} label={key.toUpperCase()} progress={typeof val === 'number' ? (val / 1000) * 100 : undefined} />
                  ))}
                </div>
              </div>

              {/* Operational Logic */}
              <div style={{ borderLeft: '1px solid var(--bez-border)', borderRight: '1px solid var(--bez-border)', padding: '0 32px' }}>
                <h4 style={{ fontSize: 10, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 2, borderBottom: '1px solid var(--bez-border)', paddingBottom: 8, marginBottom: 16 }}>Operational Logic</h4>
                {!canControl && (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 11, color: 'var(--bez-solar)' }}>
                    🔒 Vista de solo lectura. El despacho de comandos requiere rol de <strong>operador</strong>.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: canControl ? 1 : 0.5, pointerEvents: canControl ? 'auto' : 'none' }}>
                  <ControlToggle
                    label="Node Execution" 
                    active={node.status === 'Online' ? 'Start' : 'Stop'} 
                    options={['Start', 'Stop']} 
                    onAction={(opt) => handleCommand(node.id, opt === 'Start' ? 'START' : 'STOP')}
                  />
                  <ControlToggle 
                    label="Grid Protocol" 
                    active="Grid" 
                    options={['Island', 'Grid']} 
                    onAction={(opt) => handleCommand(node.id, `MODE_${opt.toUpperCase()}`)}
                  />
                  
                  <div style={{ background: 'rgba(0, 98, 255, 0.05)', border: '1px solid rgba(0, 98, 255, 0.1)', padding: 12, borderRadius: 12, display: 'flex', gap: 12, marginTop: 12 }}>
                    <Cpu size={16} color="var(--bez-primary)" />
                    <p style={{ fontSize: 11, color: 'var(--bez-primary-light)', fontStyle: 'italic' }}>
                      Aegis AI Prediction: Maintain status to optimize rewards.
                    </p>
                  </div>
                </div>
              </div>

              {/* Site Visual Relay */}
              <div>
                <h4 style={{ fontSize: 10, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 2, borderBottom: '1px solid var(--bez-border)', paddingBottom: 8, marginBottom: 16 }}>Site Visual Relay</h4>
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 160, border: '1px solid var(--bez-border)' }}>
                  <img 
                    src={`https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=800&auto=format&fit=crop`} 
                    alt="Asset visual" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.2) opacity(0.5)' }} 
                  />
                  <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }}></div>
                    <span style={{ fontSize: 10, color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>LIVE: SENSOR_{node.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </AssetRow>
        ))}
      </section>
    </div>
  )
}

const BentoStat = ({ label, val, unit, trend, color, trendColor, icon }) => (
  <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <span style={{ fontSize: 10, color: 'var(--bez-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
    <div style={{ marginTop: 16, position: 'relative' }}>
      {icon && <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.1, color }}>{icon}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <h3 style={{ fontSize: 32, fontWeight: 700, color: color || 'white' }}>{val}</h3>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--bez-text-muted)' }}>{unit}</span>
      </div>
      <p style={{ fontSize: 12, color: trendColor || 'var(--bez-secondary)', fontFamily: 'monospace', marginTop: 4 }}>{trend}</p>
    </div>
  </div>
)

const AssetRow = ({ id, name, icon, output, status, children, isExpanded, onToggle, bg, color }) => (
  <div className="card" style={{ padding: 0, overflow: 'hidden', border: isExpanded ? `1px solid ${color}` : '1px solid var(--bez-border)' }}>
    <div 
      style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isExpanded ? 'rgba(0, 98, 255, 0.05)' : 'none', cursor: 'pointer' }}
      onClick={onToggle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {React.cloneElement(icon, { color: 'currentColor' })}
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>{name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ 
              fontSize: 10, 
              fontWeight: 800, 
              textTransform: 'uppercase', 
              color: status === 'Online' ? 'var(--bez-secondary)' : (status === 'Offline' ? 'var(--bez-aegis)' : 'var(--bez-solar)'),
              background: 'rgba(255,255,255,0.05)',
              padding: '2px 8px',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>
              {status}
            </span>
            <span style={{ fontSize: 10, color: 'var(--bez-text-muted)', fontFamily: 'monospace' }}>ID: {id}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 10, color: 'var(--bez-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Current Output</span>
          <span style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: 'var(--bez-primary-light)' }}>{output}</span>
        </div>
        <button 
          className="btn" 
          style={{ 
            background: isExpanded ? 'var(--bez-primary)' : 'var(--bez-surface-3)', 
            color: isExpanded ? 'white' : 'var(--bez-text-sec)',
            padding: '10px 20px',
            fontSize: 12
          }}
        >
          {isExpanded ? <><Power size={16} /> REMOTE CONTROL</> : <><ChevronDown size={16} /> DETAILS</>}
        </button>
      </div>
    </div>

    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{ overflow: 'hidden', borderTop: '1px solid var(--bez-border)' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)

const Diag = ({ val, label, progress, color }) => (
  <div>
    <span style={{ fontSize: 11, color: 'var(--bez-text-muted)', display: 'block', marginBottom: 4 }}>{label}</span>
    <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{val}</span>
    {progress !== undefined && (
      <div style={{ height: 4, width: '100%', background: 'var(--bez-surface-3)', borderRadius: 2, marginTop: 8 }}>
        <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: color || 'var(--bez-primary)', borderRadius: 2 }}></div>
      </div>
    )}
  </div>
)

const ControlToggle = ({ label, active, options, onAction }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bez-surface-2)', borderRadius: 12, border: '1px solid var(--bez-border)' }}>
    <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
    <div style={{ background: '#0b0e16', padding: 4, borderRadius: 8, display: 'flex', gap: 4 }}>
      {options.map(opt => (
        <button 
          key={opt}
          onClick={() => onAction && onAction(opt)}
          style={{ 
            padding: '4px 12px', 
            borderRadius: 6, 
            fontSize: 10, 
            fontWeight: 700, 
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
            background: opt === active ? (opt === 'Start' ? 'var(--bez-secondary)' : (opt === 'Stop' ? 'var(--bez-aegis)' : 'var(--bez-primary)')) : 'none',
            color: opt === active ? 'white' : 'var(--bez-text-muted)'
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
)

export default Scada
