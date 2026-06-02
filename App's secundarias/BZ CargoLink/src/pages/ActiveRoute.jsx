import React from 'react'
import { motion } from 'framer-motion'
import { 
  Navigation, 
  Map as MapIcon, 
  Layers, 
  ChevronRight, 
  QrCode,
  MessageSquare,
  Zap,
  Info
} from 'lucide-react'
import { useState } from 'react'
import { usePlatformState } from '../hooks/usePlatformState'
import { cargoGateway } from '../services/cargoGateway'
import { blockchainStatusText, shortHash } from '../utils/blockchainDisplay'

const ActiveRoute = () => {
  const { platformState } = usePlatformState()
  const [loading, setLoading] = useState(false)
  const [proof, setProof] = useState(null)
  const [error, setError] = useState('')
  const [mapMode, setMapMode] = useState('route')
  const [trackingNotice, setTrackingNotice] = useState('')

  const generateProof = async () => {
    try {
      setError('')
      setLoading(true)
      const response = await cargoGateway.getActiveRoute(
        { routeId: 'TRX-9921-X', proofType: 'DELIVERY_QR' },
        platformState.apiKey,
      )
      setProof(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status Bar */}
      <div style={{ padding: '8px 20px', background: '#0e0e0e', borderBottom: '1px solid var(--bz-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bz-secondary)', boxShadow: '0 0 8px #2ff801' }}></span>
          <span style={{ fontSize: 10, color: 'var(--bz-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>ESTADO: EN TRÁNSITO</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontFamily: 'Space Grotesk', letterSpacing: 1 }}>ID: #TRX-9921-X</span>
      </div>

      {/* Map View */}
      <div style={{ height: 350, position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--bz-border)' }}>
        <img 
          src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop" 
          alt="Map" 
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.5) brightness(0.5)' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 240, 255, 0.05)', mixBlendMode: 'overlay' }} />
        
        {/* Map Controls */}
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            title="Centrar ruta"
            onClick={() => setTrackingNotice('Ruta centrada en TRX-9921-X. ETA recalculada: 11 min.')}
            style={{ width: 40, height: 40, background: '#0c0c0c', border: '1px solid var(--bz-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}
          >
            <Navigation size={18} />
          </button>
          <button
            title="Cambiar capa"
            onClick={() => {
              const nextMode = mapMode === 'route' ? 'traffic' : 'route'
              setMapMode(nextMode)
              setTrackingNotice(`Capa activa: ${nextMode === 'traffic' ? 'tráfico y temperatura' : 'ruta logística'}.`)
            }}
            style={{ width: 40, height: 40, background: mapMode === 'traffic' ? 'var(--bz-primary)' : '#0c0c0c', border: '1px solid var(--bz-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mapMode === 'traffic' ? '#00363a' : 'white' }}
          >
            <Layers size={18} />
          </button>
        </div>

        {/* Navigation Cue */}
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: '90%', background: 'rgba(30, 30, 30, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid var(--bz-border)', padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, background: 'var(--bz-primary)', color: '#00363a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={32} style={{ transform: 'rotate(-90deg)' }} />
          </div>
          <div>
            <p style={{ fontSize: 10, color: 'var(--bz-primary)', fontWeight: 800, textTransform: 'uppercase' }}>Giro a la derecha en 250m</p>
            <p style={{ fontSize: 18, fontWeight: 800, textTransform: 'uppercase', fontFamily: 'Space Grotesk' }}>Calle de la Victoria</p>
          </div>
        </div>
      </div>

      {/* Logic Panel */}
      <div style={{ padding: 20, flex: 1, background: 'var(--bz-bg)' }}>
        {/* Progress Bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--bz-primary)', textTransform: 'uppercase' }}>Progreso de Entrega</h3>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--bz-primary)', fontFamily: 'Space Grotesk' }}>82%</span>
          </div>
          <div style={{ height: 12, width: '100%', background: '#2a2a2a', border: '1px solid var(--bz-border)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '82%', background: 'var(--bz-primary)', boxShadow: '0 0 12px rgba(0,240,255,0.4)' }}></div>
            <div className="scanline" style={{ position: 'absolute', inset: 0, opacity: 0.2 }}></div>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ gridColumn: 'span 2', position: 'relative' }}>
             <span style={{ position: 'absolute', top: 8, right: 12, fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700 }}>MANIFEST_V2.4</span>
             <div style={{ borderLeft: '2px solid var(--bz-primary)', paddingLeft: 16 }}>
               <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Destino Final</p>
               <h4 style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Apartamento 402, Torre Norte</h4>
               <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Calle Goya 45, Madrid</p>
             </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Zap size={24} color="var(--bz-primary)" />
              <Info size={14} color="var(--bz-text-muted)" />
            </div>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Entrega sin contacto</p>
            <div style={{ height: 4, background: '#2d2d2d', marginTop: 'auto', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '50%', background: 'var(--bz-primary)' }}></div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <MessageSquare size={24} color="var(--bz-primary)" />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffb4ab' }} className="animate-pulse"></span>
            </div>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Mensaje Cliente</p>
            <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"Dejar en la puerta..."</p>
          </div>
        </div>

        {/* Action Button */}
        <button className="btn btn-primary" style={{ width: '100%', padding: '20px 0' }} onClick={generateProof} disabled={loading}>
          <QrCode size={20} />
          {loading ? 'GENERANDO PRUEBA...' : 'GENERAR PRUEBA DE ENTREGA'}
        </button>
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: -0.5 }}>
          Pulse una vez haya llegado al destino para validar smart contract
        </p>
        {proof && (
          <p style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: 'var(--bz-primary)', fontFamily: 'monospace' }}>
            {proof.blockchain.event}: {blockchainStatusText(proof.blockchain)} / {proof.billing.mode}
            {proof.realBlockchain?.ok ? ` / REAL ${shortHash(proof.realBlockchain.txHash, 14)}` : ` / ${proof.source.toUpperCase()}`}
          </p>
        )}
        {trackingNotice && <p style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: 'var(--bz-secondary)' }}>{trackingNotice}</p>}
        {error && <p style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--bz-error)' }}>{error}</p>}
      </div>
    </div>
  )
}

export default ActiveRoute
