import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, ShieldCheck, Fingerprint, Lock, Zap, FileSearch, ShieldAlert, BadgeCheck, Wrench } from 'lucide-react'

const Authenticator = () => {
  const [scanStatus, setScanStatus] = useState('IDLE') // IDLE, SCANNING, SUCCESS
  const [currentStep, setCurrentStep] = useState(0)
  const [result, setResult] = useState(null)

  const validationSteps = [
    { id: 'nfc', label: 'Verificando firma MAC NFC (SUN)', icon: Scan },
    { id: 'ai', label: 'Contrastando IA Micro-Patrones L2', icon: Fingerprint },
    { id: 'provenance', label: 'Cotejando Historial de Procedencia (ERC-6551)', icon: FileSearch },
    { id: 'forensic', label: 'Validando Estado Forense (Kill-Switch Anti-Robo)', icon: ShieldAlert }
  ]

  const handleScan = () => {
    setScanStatus('SCANNING')
    setCurrentStep(0)
    setResult(null)
  }

  useEffect(() => {
    if (scanStatus === 'SCANNING') {
      if (currentStep < validationSteps.length) {
        const timer = setTimeout(() => {
          setCurrentStep(prev => prev + 1)
        }, 1500) // 1.5 seconds per step
        return () => clearTimeout(timer)
      } else {
        // All steps finished
        setTimeout(() => {
          setScanStatus('SUCCESS')
          setResult({
            id: 'BZ-LUX-ROX-26-9A8B7C',
            brand: 'ROLEX',
            model: 'Cosmograph Daytona',
            materials: 'Oystersteel, Cerachrom',
            status: 'AUTHENTIC & CLEAN',
            owner: '0x882...99a',
            services: [
              { date: '2024-05-12', action: 'Mantenimiento Oficial (Calibre 4130)', center: 'Rolex Geneva' },
              { date: '2026-01-20', action: 'Pulido de Brazalete Oyster', center: 'Rolex Madrid' }
            ]
          })
        }, 500)
      }
    }
  }, [scanStatus, currentStep, validationSteps.length])

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Forensic Authenticator</h2>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Auditoría de 4 capas: Criptografía, Fotogrametría, Historial y Forense.
        </p>
      </header>

      {/* Scanner UI */}
      <div 
        style={{ 
          minHeight: 300, 
          background: '#080808', 
          border: scanStatus === 'SCANNING' ? '2px solid var(--bz-secondary)' : '1px solid var(--bz-border)', 
          borderRadius: 16, 
          position: 'relative', 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          padding: 24,
          transition: 'all 0.3s'
        }}
      >
        <AnimatePresence mode="wait">
          {scanStatus === 'SCANNING' ? (
            <motion.div 
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  style={{ position: 'absolute', inset: 0, border: '2px dashed var(--bz-secondary)', borderRadius: '50%', opacity: 0.5 }}
                />
                <Scan size={40} color="var(--bz-secondary)" className="animate-pulse" />
              </div>
              
              <div style={{ width: '100%', maxWidth: 300 }}>
                {validationSteps.map((step, idx) => {
                  const isActive = idx === currentStep
                  const isDone = idx < currentStep
                  const Icon = step.icon
                  return (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, opacity: isActive || isDone ? 1 : 0.2 }}>
                      <div style={{ 
                        width: 24, height: 24, borderRadius: '50%', 
                        background: isDone ? 'var(--bz-secondary)' : (isActive ? 'rgba(47, 248, 1, 0.2)' : 'transparent'),
                        border: isDone ? 'none' : (isActive ? '1px solid var(--bz-secondary)' : '1px solid var(--bz-text-muted)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDone ? '#000' : 'var(--bz-secondary)'
                      }}>
                        {isDone ? <ShieldCheck size={14} /> : <Icon size={12} />}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: isActive ? 800 : 500, color: isActive || isDone ? 'var(--bz-text)' : 'var(--bz-text-muted)' }}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ) : scanStatus === 'SUCCESS' && result ? (
            <motion.div 
              key="success"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ textAlign: 'center' }}
            >
              <BadgeCheck size={80} color="var(--bz-secondary)" style={{ margin: '0 auto' }} />
              <h3 style={{ fontSize: 24, fontWeight: 900, color: 'var(--bz-secondary)', marginTop: 16 }}>ACTIVO ÍNTEGRO</h3>
              <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>Validación Forense L2 Superada</p>
            </motion.div>
          ) : (
            <motion.div 
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', color: 'var(--bz-text-muted)' }}
            >
               <Fingerprint size={64} style={{ margin: '0 auto', opacity: 0.3 }} />
               <p style={{ marginTop: 16, fontSize: 14, fontWeight: 800 }}>Apunta al artículo físico</p>
               <p style={{ marginTop: 4, fontSize: 10 }}>Coloca el escáner sobre el chip NFC o el micro-patrón.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button 
        className="btn btn-primary" 
        style={{ width: '100%', padding: 20, marginBottom: 24, fontSize: 14, background: scanStatus === 'SCANNING' ? 'transparent' : 'var(--bz-primary)', border: scanStatus === 'SCANNING' ? '1px solid var(--bz-primary)' : 'none', color: scanStatus === 'SCANNING' ? 'var(--bz-primary)' : '#000' }}
        onClick={handleScan}
        disabled={scanStatus === 'SCANNING'}
      >
        {scanStatus === 'SCANNING' ? 'ANALIZANDO CAPAS FORENSES...' : (scanStatus === 'SUCCESS' ? 'REALIZAR NUEVA AUDITORÍA' : 'INICIAR ESCANEO FORENSE')}
      </button>

      {/* Result Card */}
      {scanStatus === 'SUCCESS' && result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Metadata */}
          <div className="card" style={{ border: '1px solid var(--bz-secondary)', background: 'rgba(47, 248, 1, 0.05)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--bz-secondary)' }}>B-UID Verified Data</h3>
              <div style={{ padding: '2px 8px', background: 'var(--bz-secondary)', color: '#000', fontSize: 9, fontWeight: 900, borderRadius: 12 }}>
                {result.status}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12 }}>
              <div>
                <p style={{ color: 'var(--bz-text-muted)', marginBottom: 2, fontSize: 10 }}>Marca</p>
                <p style={{ fontWeight: 800 }}>{result.brand}</p>
              </div>
              <div>
                <p style={{ color: 'var(--bz-text-muted)', marginBottom: 2, fontSize: 10 }}>Modelo</p>
                <p style={{ fontWeight: 800 }}>{result.model}</p>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <p style={{ color: 'var(--bz-text-muted)', marginBottom: 2, fontSize: 10 }}>Materiales Homologados</p>
                <p style={{ fontWeight: 800 }}>{result.materials}</p>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <p style={{ color: 'var(--bz-text-muted)', marginBottom: 2, fontSize: 10 }}>Propietario Actual (Wallet L2)</p>
                <p style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--bz-primary)' }}>{result.owner}</p>
              </div>
            </div>
          </div>

          {/* Provenance History (ERC-6551) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bz-surface-container)', borderBottom: '1px solid var(--bz-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={16} color="var(--bz-primary)" />
              <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Historial Clínico (TBA ERC-6551)</h3>
            </div>
            
            <div>
              {result.services.map((service, idx) => (
                <div key={idx} style={{ padding: '16px 20px', borderBottom: '1px solid var(--bz-border)', display: 'flex', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0, 240, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bz-primary)', flexShrink: 0 }}>
                    <Wrench size={14} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 800 }}>{service.action}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: 'var(--bz-text-muted)' }}>
                      <span>{service.date}</span>
                      <span>•</span>
                      <span style={{ color: 'var(--bz-primary)' }}>{service.center}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default Authenticator
