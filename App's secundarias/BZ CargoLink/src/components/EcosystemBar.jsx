/**
 * EcosystemBar – Barra flotante de servicios cross-app del ecosistema BeZhas.
 * Úsala en cualquier app con:
 *   <EcosystemBar appName="bez-wallet" />
 *
 * Props:
 *   appName  – Nombre de la app host, para excluirla de los accesos cruzados.
 */

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutGrid, X, Wallet, Zap, Server, Eye, TrendingUp, 
  Diamond, Ship, Scan, CreditCard, ShieldCheck, Gift
} from 'lucide-react'
import { bezhasPlatform } from '../services/bezhasPlatform'
import { usePlatformState } from '../hooks/usePlatformState'

/* ─── Servicios del ecosistema ─────────────────────────────────────────── */
const ECOSYSTEM_SERVICES = [
  {
    id: 'buy-bez',
    icon: CreditCard,
    title: 'Comprar BEZ-Coin',
    desc: 'Adquiere créditos BEZ con tarjeta o cripto en segundos.',
    color: '#00f0ff',
    action: 'BUY'
  },
  {
    id: 'scanner',
    icon: Scan,
    title: 'Escanear Producto',
    desc: 'Valida autenticidad y cotejo forense de cualquier activo físico.',
    color: '#79ff5b',
    action: 'SCAN'
  },
  {
    id: 'subscription',
    icon: Gift,
    title: 'Suscripciones BeZhas',
    desc: 'Activa un plan de acceso a todos los módulos del ecosistema.',
    color: '#a855f7',
    action: 'SUBSCRIBE'
  },
  {
    id: 'validate-contract',
    icon: ShieldCheck,
    title: 'Validar Contrato',
    desc: 'Coteja un Smart Contract en la L2 antes de firmar.',
    color: '#f59e0b',
    action: 'VALIDATE'
  },
  {
    id: 'gas-tank',
    icon: Zap,
    title: 'Recargar Gas Tank',
    desc: 'Recarga tu saldo para cubrir fees de transacción.',
    color: '#fb923c',
    action: 'REFUEL'
  },
  {
    id: 'staking',
    icon: TrendingUp,
    title: 'Staking Rápido',
    desc: 'Bloquea BEZ y activos RWA para generar rendimientos.',
    color: '#34d399',
    action: 'STAKE'
  }
]

/* ─── Modal de servicio interno ─────────────────────────────────────────── */
function ServiceModal({ service, onClose }) {
  const Icon = service.icon
  const { platformState } = usePlatformState()
  const [status, setStatus] = useState('IDLE') // IDLE | PROCESSING | DONE
  const [amount, setAmount] = useState(service.action === 'BUY' ? 500 : 100)
  const [contractAddress, setContractAddress] = useState('0x8f3a1234')
  const [selectedPlan, setSelectedPlan] = useState('business')
  const [message, setMessage] = useState('')

  const handleAction = () => {
    try {
      setStatus('PROCESSING')
      if (service.action === 'BUY') bezhasPlatform.buyBezCredits(amount)
      if (service.action === 'SUBSCRIBE') bezhasPlatform.subscribe(selectedPlan)
      if (service.action === 'VALIDATE') bezhasPlatform.validateContract(contractAddress)
      if (service.action === 'REFUEL') bezhasPlatform.rechargeGas(amount)
      if (service.action === 'STAKE') bezhasPlatform.stakeBez(amount)
      if (service.action === 'SCAN') {
        bezhasPlatform.callApi({
          method: 'POST',
          endpoint: '/v1/audit/fingerprint',
          apiKey: platformState.apiKey,
          payload: { bUid: 'BZ-LUX-ROX-26-9A8B7C', source: 'ecosystem-scan' },
        })
      }
      setStatus('DONE')
    } catch (error) {
      setStatus('IDLE')
      setMessage(error.message)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: '#111', borderRadius: 20,
          border: `1px solid ${service.color}40`,
          padding: 24
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${service.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={24} color={service.color} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900 }}>{service.title}</h3>
            <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{service.desc}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content by action type */}
        {status === 'DONE' ? (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ textAlign: 'center', padding: '24px 0' }}>
            <ShieldCheck size={48} color="#79ff5b" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: 16, fontWeight: 900, color: '#79ff5b' }}>¡Operación Completada!</h4>
            <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>La transacción fue procesada en la BeZhas L2.</p>
            <button onClick={onClose} style={{ marginTop: 20, padding: '12px 32px', background: '#79ff5b', color: '#000', borderRadius: 10, fontWeight: 900, border: 'none', cursor: 'pointer' }}>
              Cerrar
            </button>
          </motion.div>
        ) : (
          <>
            {service.action === 'BUY' && (
              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>Cantidad de BEZ-Coin</label>
                <input value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', background: '#0e0e0e', border: '1px solid #333', color: '#fff', padding: '12px 16px', fontSize: 18, fontWeight: 800, borderRadius: 10, marginBottom: 12 }} />
                <div style={{ padding: 12, background: '#0a0a0a', borderRadius: 8, fontSize: 11, color: '#888', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Precio BEZ:</span><span style={{ color: '#00f0ff', fontWeight: 800 }}>$0.148 USD</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>Total:</span><span style={{ fontWeight: 800 }}>${(Number(amount || 0) * 0.148).toFixed(2)} USD</span></div>
                </div>
              </div>
            )}
            {service.action === 'SCAN' && (
              <div style={{ padding: '20px', background: '#0a0a0a', borderRadius: 12, textAlign: 'center', marginBottom: 16, border: '1px dashed #333' }}>
                <Scan size={40} color="#79ff5b" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: '#888' }}>Simulando escaneo NFC/Fotogramétrico...</p>
                <code style={{ fontSize: 10, color: '#79ff5b', display: 'block', marginTop: 8 }}>BZ-LUX-ROX-26-9A8B7C — AUTHENTIC</code>
              </div>
            )}
            {service.action === 'SUBSCRIBE' && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                {[{ id: 'starter', name: 'Starter', price: '$9.99/mo', items: ['3 Apps', '500 API calls/day'] }, { id: 'business', name: 'Business', price: '$49.99/mo', items: ['All Apps', '10k API calls/day', 'Webhooks'] }].map(plan => (
                  <div key={plan.name} onClick={() => setSelectedPlan(plan.id)} style={{ padding: 14, background: '#0a0a0a', border: `1px solid ${selectedPlan === plan.id ? '#a855f7' : '#333'}`, borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800 }}>{plan.name}</span>
                      <span style={{ fontWeight: 900, color: '#a855f7' }}>{plan.price}</span>
                    </div>
                    {plan.items.map(i => <p key={i} style={{ fontSize: 10, color: '#666' }}>✓ {i}</p>)}
                  </div>
                ))}
              </div>
            )}
            {service.action === 'VALIDATE' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>Address del Contrato (L2)</label>
                <input value={contractAddress} onChange={e => setContractAddress(e.target.value)} style={{ width: '100%', background: '#0e0e0e', border: '1px solid #333', color: '#00f0ff', padding: '12px 16px', fontSize: 14, fontFamily: 'monospace', borderRadius: 10, marginBottom: 12 }} />
              </div>
            )}
            {(service.action === 'REFUEL' || service.action === 'STAKE') && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>Cantidad (BEZ)</label>
                <input value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', background: '#0e0e0e', border: '1px solid #333', color: '#fff', padding: '12px 16px', fontSize: 18, fontWeight: 800, borderRadius: 10, marginBottom: 12 }} />
              </div>
            )}
            {message && <p style={{ color: '#ffb4ab', fontSize: 11, marginBottom: 12 }}>{message}</p>}

            <button
              onClick={handleAction}
              disabled={status === 'PROCESSING'}
              style={{ width: '100%', padding: 16, background: status === 'PROCESSING' ? 'transparent' : service.color, border: status === 'PROCESSING' ? `1px solid ${service.color}` : 'none', color: status === 'PROCESSING' ? service.color : '#000', borderRadius: 12, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
            >
              {status === 'PROCESSING' ? 'PROCESANDO EN L2...' : service.action}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

/* ─── Componente Principal ──────────────────────────────────────────────── */
export default function EcosystemBar({ appName = '' }) {
  const [open, setOpen] = useState(false)
  const [activeService, setActiveService] = useState(null)

  return (
    <>
      {/* Floating Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 90, right: 20, zIndex: 900,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,240,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        title="Servicios BeZhas"
      >
        <LayoutGrid size={22} color="#000" />
      </motion.button>

      {/* Panel Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 22 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: 320, background: '#0c0c0c',
                borderLeft: '1px solid #222', overflowY: 'auto', zIndex: 960
              }}
            >
              {/* Header */}
              <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0c0c0c', zIndex: 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LayoutGrid size={16} color="#00f0ff" />
                    <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Ecosystem Hub</span>
                  </div>
                  <p style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Servicios rápidos sin salir de {appName || 'la app'}</p>
                </div>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Services Grid */}
              <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>Servicios Disponibles</p>
                {ECOSYSTEM_SERVICES.map(service => {
                  const Icon = service.icon
                  return (
                    <motion.div
                      key={service.id}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setActiveService(service); setOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px', background: '#111', borderRadius: 12,
                        border: `1px solid ${service.color}20`, cursor: 'pointer'
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${service.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color={service.color} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 2 }}>{service.title}</p>
                        <p style={{ fontSize: 10, color: '#555' }}>{service.desc}</p>
                      </div>
                    </motion.div>
                  )
                })}

                {/* App Links */}
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#555', marginTop: 8, marginBottom: 4 }}>Otras Apps del Ecosistema</p>
                {[
                  { label: 'BEZ Wallet', port: 3010, icon: Wallet, color: '#3b82f6' },
                  { label: 'Gas Tank', port: 3011, icon: Zap, color: '#f59e0b' },
                  { label: 'Edge Nodes', port: 3012, icon: Server, color: '#10b981' },
                  { label: 'Vision Scan', port: 3013, icon: Eye, color: '#ec4899' },
                  { label: 'BZ Capital', port: 3014, icon: TrendingUp, color: '#a855f7' },
                  { label: 'BZ Prestige', port: 3015, icon: Diamond, color: '#eab308' },
                  { label: 'BZ CargoLink', port: 3016, icon: Ship, color: '#06b6d4' },
                ].map(app => {
                  const Icon = app.icon
                  return (
                    <a
                      key={app.port}
                      href={`http://localhost:${app.port}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', background: '#0a0a0a', borderRadius: 10,
                        border: '1px solid #1a1a1a', textDecoration: 'none', color: '#fff'
                      }}
                    >
                      <Icon size={16} color={app.color} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{app.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace', color: '#444' }}>:{app.port}</span>
                    </a>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Service Modals */}
      <AnimatePresence>
        {activeService && (
          <ServiceModal service={activeService} onClose={() => setActiveService(null)} />
        )}
      </AnimatePresence>
    </>
  )
}
