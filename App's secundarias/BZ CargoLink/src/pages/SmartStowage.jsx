import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Box, 
  Move, 
  Target, 
  AlertCircle, 
  CheckCircle2, 
  Package,
  Activity
} from 'lucide-react'
import { usePlatformState } from '../hooks/usePlatformState'
import { cargoGateway } from '../services/cargoGateway'
import { blockchainStatusText, blockNumberText, shortHash } from '../utils/blockchainDisplay'

const SmartStowage = () => {
  const { platformState } = usePlatformState()
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState(null)
  const [error, setError] = useState('')
  const [items, setItems] = useState([
    { id: 'BZ-LOG-ES-01', weight: 450, x: 20, y: 30 },
    { id: 'BZ-LOG-ES-02', weight: 820, x: 60, y: 40 }
  ])

  // Formula: COG = sum(m * r) / sum(m)
  const calculateCOG = () => {
    const totalMass = items.reduce((acc, item) => acc + item.weight, 0)
    const cogX = items.reduce((acc, item) => acc + (item.weight * item.x), 0) / totalMass
    const cogY = items.reduce((acc, item) => acc + (item.weight * item.y), 0) / totalMass
    return { x: cogX, y: cogY, total: totalMass }
  }

  const cog = calculateCOG()

  const validateStowage = async () => {
    try {
      setError('')
      setLoading(true)
      const response = await cargoGateway.validateStowage(
        {
          bUid: 'BZ-LOG-ES-17148',
          shipmentId: 'TRX-9921-X',
          items,
          cog: { x: Number(cog.x.toFixed(2)), y: Number(cog.y.toFixed(2)), total: cog.total },
        },
        platformState.apiKey,
      )
      setValidation(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <Box size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Physical Layout v1.0</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Smart Stowage</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          ARCore 3D Mesh & dynamic Center of Gravity (COG).
        </p>
      </header>

      {/* Container Visualization (Top View) */}
      <div className="card" style={{ padding: 0, height: 350, position: 'relative', background: '#0e0e0e', border: '2px solid var(--bz-border)', marginBottom: 24 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'linear-gradient(var(--bz-border) 1px, transparent 1px), linear-gradient(90deg, var(--bz-border) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        
        {/* Container Outline */}
        <div style={{ position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 }}>
          {/* Pallets */}
          {items.map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ 
                position: 'absolute', 
                top: `${item.y}%`, 
                left: `${item.x}%`, 
                width: 60, 
                height: 60, 
                background: 'rgba(0, 240, 255, 0.2)', 
                border: '1px solid var(--bz-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 900
              }}
            >
              ID-{i+1}
            </motion.div>
          ))}

          {/* COG Marker */}
          <motion.div 
            animate={{ 
              top: `${cog.y}%`, 
              left: `${cog.x}%`,
            }}
            style={{ position: 'absolute', transform: 'translate(-50%, -50%)', zIndex: 20 }}
          >
            <div style={{ position: 'relative' }}>
               <Target size={32} color="#ffb4ab" className="animate-pulse" />
               <div style={{ position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 10, fontWeight: 900, color: '#ffb4ab', background: 'rgba(0,0,0,0.8)', padding: '2px 6px' }}>
                  COG CRITICAL
               </div>
            </div>
          </motion.div>
        </div>

        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} color="var(--bz-primary)" />
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--bz-primary)' }}>ARCORE_MESH_ACTIVE</span>
        </div>
      </div>

      {/* Physics Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ margin: 0 }}>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Payload</p>
          <h4 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{cog.total} kg</h4>
          <span style={{ fontSize: 10, color: 'var(--bz-text-muted)' }}>Max: 24,000kg</span>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Moment Sum</p>
          <h4 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk', color: '#ffb4ab' }}>{Math.round(cog.x * cog.total / 100)}kN</h4>
          <span style={{ fontSize: 10, color: '#ffb4ab' }}>Offset: 12% L</span>
        </div>
      </div>

      {/* Scan Action */}
      <button className="btn btn-primary" style={{ width: '100%', padding: 20, marginBottom: 12 }} onClick={validateStowage} disabled={loading}>
        <Package size={20} />
        {loading ? 'VALIDANDO ESTIBA...' : 'VALIDAR ESTIBA EN L2'}
      </button>
      {validation && (
        <p style={{ fontSize: 10, color: 'var(--bz-primary)', marginBottom: 20, textAlign: 'center', fontFamily: 'monospace' }}>
          {validation.blockchain.event}: {blockchainStatusText(validation.blockchain)} / {validation.billing.mode}
          {validation.realBlockchain?.ok ? ` / REAL ${shortHash(validation.realBlockchain.txHash, 14)}` : ` / ${validation.source.toUpperCase()}`}
        </p>
      )}
      {error && <p style={{ fontSize: 11, color: 'var(--bz-error)', marginBottom: 20, textAlign: 'center' }}>{error}</p>}

      {/* Stowage Checklist */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, textTransform: 'uppercase' }}>Validation Checklist</h3>
        <div className="card" style={{ padding: 0 }}>
          <CheckItem label="Load Balancing" status="WARNING" detail="COG offset slightly left of centerline." />
          <CheckItem label="B-UID Consensus" status="VERIFIED" detail="All 2 items match Fingerprint Manifest." />
          <CheckItem label="dNFT Sync" status={validation ? 'SUCCESS' : 'PENDING'} detail={validation ? `Asset state updated on BeZhas L2 block ${blockNumberText(validation.blockchain)}.` : 'Waiting for L2 validation.'} />
        </div>
      </div>
    </div>
  )
}

const CheckItem = ({ label, status, detail }) => (
  <div style={{ padding: '16px', borderBottom: '1px solid var(--bz-border)', display: 'flex', gap: 16 }}>
    <div style={{ flexShrink: 0, marginTop: 2 }}>
      {status === 'SUCCESS' || status === 'VERIFIED' ? <CheckCircle2 size={18} color="var(--bz-secondary)" /> : <AlertCircle size={18} color="#f59e0b" />}
    </div>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <p style={{ fontSize: 12, fontWeight: 800 }}>{label}</p>
        <span style={{ fontSize: 9, fontWeight: 900, color: status === 'SUCCESS' || status === 'VERIFIED' ? 'var(--bz-secondary)' : '#f59e0b' }}>{status}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginTop: 2 }}>{detail}</p>
    </div>
  </div>
)

export default SmartStowage
