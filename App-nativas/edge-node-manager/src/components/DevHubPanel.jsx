/**
 * DevHubPanel – Panel de SDK / API Keys / Webhooks del desarrollador.
 * Reutilizable en todas las sub-apps de BeZhas.
 *
 * Props:
 *   sector    – Identificador del sector para el catálogo de endpoints.
 *               Valores: 'wallet' | 'gas' | 'edge' | 'vision' | 'capital' | 'prestige' | 'cargo'
 *   onClose   – Callback para cerrar el panel.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Code2, Key, Webhook, Download, Copy, CheckCircle2, Globe, X, ChevronDown, ChevronRight } from 'lucide-react'

/* ─── Catálogo de Endpoints por sector ──────────────────────────────────── */
const ENDPOINTS = {
  wallet: [
    { method: 'GET',  path: '/v1/wallet/balance',      desc: 'Balance de BEZ-Coin y activos RWA.' },
    { method: 'POST', path: '/v1/wallet/send',          desc: 'Envía BEZ-Coin con firma L2.' },
    { method: 'GET',  path: '/v1/wallet/history',       desc: 'Historial de transacciones.' },
    { method: 'POST', path: '/v1/wallet/smart-execute', desc: 'Ejecuta lógica de Smart Wallet (AA).' },
  ],
  gas: [
    { method: 'GET',  path: '/v1/gas/balance',          desc: 'Saldo actual del Gas Tank.' },
    { method: 'POST', path: '/v1/gas/recharge',         desc: 'Recarga vía Stripe o cripto.' },
    { method: 'GET',  path: '/v1/gas/forecast',         desc: 'Predicción Aegis del costo óptimo de gas.' },
    { method: 'POST', path: '/v1/gas/sponsor',          desc: 'Patrocina fees de otro wallet.' },
  ],
  edge: [
    { method: 'GET',  path: '/v1/nodes/list',           desc: 'Lista de nodos activos del validador.' },
    { method: 'POST', path: '/v1/nodes/register',       desc: 'Registra un nuevo Edge Node en la red.' },
    { method: 'GET',  path: '/v1/nodes/rewards',        desc: 'Recompensas acumuladas de validación.' },
    { method: 'POST', path: '/v1/nodes/slash',          desc: 'Reporta un nodo por comportamiento malicioso.' },
  ],
  vision: [
    { method: 'POST', path: '/v1/vision/scan',          desc: 'Sube imagen para escaneo forense IA Oracle.' },
    { method: 'GET',  path: '/v1/vision/audits',        desc: 'Historial de auditorías registradas en L2.' },
    { method: 'POST', path: '/v1/vision/certify',       desc: 'Emite certificado de integridad (DID) en L2.' },
  ],
  capital: [
    { method: 'GET',  path: '/v1/capital/pools',        desc: 'Pools de liquidez disponibles (RWA + BEZ).' },
    { method: 'POST', path: '/v1/capital/stake',        desc: 'Bloquea activos para yield.' },
    { method: 'GET',  path: '/v1/capital/yields',       desc: 'Yields acumulados por período.' },
    { method: 'POST', path: '/v1/capital/withdraw',     desc: 'Retira activos de un pool.' },
  ],
  prestige: [
    { method: 'POST', path: '/v1/prestige/authenticate', desc: 'Valida autenticidad forense de un artículo.' },
    { method: 'POST', path: '/v1/prestige/transfer',     desc: 'Transfiere B-UID + ejecuta royalties EIP-2981.' },
    { method: 'GET',  path: '/v1/prestige/provenance',   desc: 'Historial clínico y de servicios del artículo.' },
    { method: 'POST', path: '/v1/prestige/blacklist',    desc: 'Marca un artículo como robado (Kill-Switch).' },
  ],
  cargo: [
    { method: 'POST', path: '/v1/customs/dispatch',     desc: 'Sincroniza manifiesto con ASYCUDA.' },
    { method: 'POST', path: '/v1/shipping/stowage',     desc: 'Valida COG del contenedor en buque.' },
    { method: 'GET',  path: '/v1/logistics/route',      desc: 'Coordenadas y métricas de última milla.' },
    { method: 'POST', path: '/v1/audit/fingerprint',    desc: 'Registra hash fotogramétrico de carga en L2.' },
  ],
}

const WEBHOOK_EVENTS = {
  wallet:   ['ON_BALANCE_CHANGE', 'ON_TX_CONFIRMED', 'ON_NFT_RECEIVED'],
  gas:      ['ON_GAS_LOW', 'ON_RECHARGE_SUCCESS', 'ON_SPONSOR_TX'],
  edge:     ['ON_NODE_DOWN', 'ON_REWARD_EARNED', 'ON_SLASH_EVENT'],
  vision:   ['ON_SCAN_COMPLETE', 'ON_CERT_ISSUED', 'ON_AUDIT_FAIL'],
  capital:  ['ON_STAKE_CONFIRMED', 'ON_YIELD_PAID', 'ON_POOL_REBALANCE'],
  prestige: ['ON_AUTH_VERIFIED', 'ON_ROYALTY_PAID', 'ON_ITEM_BLACKLISTED'],
  cargo:    ['ON_CUSTOMS_CLEARED', 'ON_VESSEL_DEPARTURE', 'ON_DELIVERY_PROOF'],
}

const SDK_INSTALLS = {
  wallet:   'npm install @bezhas/wallet-sdk',
  gas:      'npm install @bezhas/gas-sdk',
  edge:     'npm install @bezhas/edge-sdk',
  vision:   'npm install @bezhas/vision-sdk',
  capital:  'npm install @bezhas/capital-sdk',
  prestige: 'npm install @bezhas/prestige-sdk',
  cargo:    'npm install @bezhas/cargolink-sdk',
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const CopyButton = ({ value }) => {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#79ff5b' : '#555', display: 'flex', alignItems: 'center' }}>
      {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
    </button>
  )
}

const Section = ({ title, icon: Icon, color, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', color: '#fff' }}
      >
        {Icon && <Icon size={14} color={color || '#00f0ff'} />}
        <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, flex: 1, textAlign: 'left' }}>{title}</span>
        {open ? <ChevronDown size={14} color="#555" /> : <ChevronRight size={14} color="#555" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Componente Principal ──────────────────────────────────────────────── */
export default function DevHubPanel({ sector = 'wallet', onClose }) {
  const endpoints = ENDPOINTS[sector] || []
  const events = WEBHOOK_EVENTS[sector] || []
  const sdkCmd = SDK_INSTALLS[sector] || 'npm install @bezhas/sdk'
  const [webhookUrl, setWebhookUrl] = useState('')
  const [tab, setTab] = useState('api') // 'api' | 'webhooks' | 'sdk'

  const TABS = [
    { id: 'api',      label: 'API Keys',  icon: Key },
    { id: 'webhooks', label: 'Webhooks',  icon: Webhook },
    { id: 'sdk',      label: 'SDKs',      icon: Download },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 22 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, background: '#0c0c0c', borderRadius: '20px 20px 0 0', border: '1px solid #222', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Code2 size={18} color="#00f0ff" />
              <h3 style={{ fontSize: 16, fontWeight: 900 }}>Developer Hub</h3>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', background: 'rgba(0,240,255,0.1)', color: '#00f0ff', borderRadius: 4, border: '1px solid rgba(0,240,255,0.2)' }}>
                {sector.toUpperCase()}
              </span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => {
              const TIcon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 800, color: tab === t.id ? '#00f0ff' : '#555',
                    borderBottom: tab === t.id ? '2px solid #00f0ff' : '2px solid transparent'
                  }}
                >
                  <TIcon size={13} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>
          {/* API Tab */}
          {tab === 'api' && (
            <div>
              <p style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>
                Usa tu Bearer Token en el header <code style={{ color: '#00f0ff' }}>Authorization: Bearer [KEY]</code> para autenticar.
              </p>

              {/* Key field */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#0e0e0e', border: '1px solid #222', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                <input
                  readOnly value="bzk_live_9f8d7c6b5a41234567890abcdef"
                  type="password"
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
                />
                <div style={{ padding: '0 12px', borderLeft: '1px solid #222' }}>
                  <CopyButton value="bzk_live_9f8d7c6b5a41234567890abcdef" />
                </div>
              </div>

              {/* Endpoints */}
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 10 }}>Endpoints de este módulo ({sector})</p>
              <div style={{ border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                {endpoints.map((ep, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: i < endpoints.length - 1 ? '1px solid #111' : 'none' }}>
                    <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, background: ep.method === 'POST' ? 'rgba(121,255,91,0.1)' : 'rgba(0,240,255,0.1)', color: ep.method === 'POST' ? '#79ff5b' : '#00f0ff', flexShrink: 0 }}>
                      {ep.method}
                    </span>
                    <div style={{ flex: 1 }}>
                      <code style={{ fontSize: 11, color: '#ccc' }}>{ep.path}</code>
                      <p style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{ep.desc}</p>
                    </div>
                    <CopyButton value={ep.path} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Webhooks Tab */}
          {tab === 'webhooks' && (
            <div>
              <p style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>
                Registra la URL de tu servidor para recibir eventos en tiempo real desde la L2.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <input
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://api.tuempresa.com/webhooks/bezhas"
                  style={{ flex: 1, background: '#0e0e0e', border: '1px solid #222', color: '#fff', padding: '12px 16px', fontSize: 12, borderRadius: 10, outline: 'none' }}
                />
                <button style={{ padding: '12px 16px', background: '#00f0ff', color: '#000', borderRadius: 10, fontWeight: 900, fontSize: 11, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  SAVE
                </button>
              </div>

              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 10 }}>Eventos disponibles</p>
              <div style={{ border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
                {events.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < events.length - 1 ? '1px solid #111' : 'none' }}>
                    <code style={{ fontSize: 11, color: '#00f0ff', fontWeight: 800 }}>{ev}</code>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <CopyButton value={ev} />
                      <span style={{ fontSize: 9, padding: '3px 8px', border: '1px solid #222', borderRadius: 12, color: '#555', cursor: 'pointer' }}>SUBSCRIBE</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SDK Tab */}
          {tab === 'sdk' && (
            <div>
              <p style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>
                Nuestros SDKs manejan automáticamente la autenticación, firma criptográfica y WebSockets.
              </p>

              {/* NPM */}
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 8 }}>Node.js / NPM</p>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0e0e0e', border: '1px solid #222', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                <span style={{ flex: 1, padding: '12px 16px', color: '#f472b6', fontFamily: 'monospace', fontSize: 12 }}>{sdkCmd}</span>
                <div style={{ padding: '0 12px', borderLeft: '1px solid #222' }}>
                  <CopyButton value={sdkCmd} />
                </div>
              </div>

              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 8 }}>Otros lenguajes</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { lang: 'Python (PyPI)', cmd: `pip install bezhas-${sector}-sdk`, color: '#3b82f6' },
                  { lang: 'Java (Maven)', cmd: `<dependency>com.bezhas:${sector}-sdk:1.0.0</dependency>`, color: '#f59e0b' },
                  { lang: 'Go (pkg)', cmd: `go get github.com/bezhas/${sector}-sdk-go`, color: '#34d399' },
                ].map(item => (
                  <div key={item.lang} style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: item.color }}>{item.lang}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <CopyButton value={item.cmd} />
                        <span style={{ fontSize: 9, padding: '3px 8px', border: `1px solid ${item.color}30`, borderRadius: 8, color: item.color, cursor: 'pointer' }}>
                          <Download size={10} style={{ display: 'inline', marginRight: 3 }} />
                          Download
                        </span>
                      </div>
                    </div>
                    <code style={{ display: 'block', padding: '10px 14px', fontSize: 10, color: '#888', fontFamily: 'monospace', wordBreak: 'break-all' }}>{item.cmd}</code>
                  </div>
                ))}
              </div>

              {/* Full Docs */}
              <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, padding: '12px 16px', background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 10, textDecoration: 'none', color: '#00f0ff', fontSize: 12, fontWeight: 800 }}>
                <Globe size={14} />
                Ver documentación completa →
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
