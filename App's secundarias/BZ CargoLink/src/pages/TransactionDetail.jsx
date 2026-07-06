import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  Package,
  Shield,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Anchor,
  Globe,
  Fingerprint,
  Box,
  MapPin,
  ExternalLink,
  Lock,
  Unlock,
} from 'lucide-react'
import { useTransaction, stageIndex, stageProgress } from '../hooks/useTransaction'
import { cargoLinkApi, LIFECYCLE_STAGES } from '../services/cargoLinkApi'
import { useAuth } from '../context/AuthProvider'

const CHAIN_ID = 2708
const EXPLORER_URL = 'https://explorer.bez.digital'
function txLink(hash) {
  return hash ? `${EXPLORER_URL}/tx/${hash}` : null
}

const STAGE_LABELS = {
  CREATED: 'Creado',
  CUSTOMS_CLEARED: 'Aduana',
  STOWED: 'Estibado',
  DEPARTED: 'Zarpe',
  IN_TRANSIT: 'En tránsito',
  DELIVERED: 'Entregado',
}

const STAGE_ICONS = {
  CREATED: Package,
  CUSTOMS_CLEARED: Globe,
  STOWED: Box,
  DEPARTED: Anchor,
  IN_TRANSIT: Truck,
  DELIVERED: CheckCircle2,
}

const ROLE_FOR_STAGE = {
  CUSTOMS_CLEARED: 'customs',
  STOWED: 'carrier',
  DEPARTED: 'carrier',
  IN_TRANSIT: 'logistics',
  DELIVERED: 'lastmile',
}

const TransactionDetail = () => {
  const { bUid } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { transaction, history, loading, error, refresh, advance } = useTransaction(bUid)
  const [advancing, setAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState(null)
  const [advanceResult, setAdvanceResult] = useState(null)
  const [telemetry, setTelemetry] = useState(null)
  const [telemetryLoading, setTelemetryLoading] = useState(false)

  const tx = transaction
  const currentIdx = tx ? stageIndex(tx.status) : 0
  const progress = tx ? stageProgress(tx.status) : 0
  const nextStage = currentIdx < LIFECYCLE_STAGES.length - 1 ? LIFECYCLE_STAGES[currentIdx + 1] : null

  const loadTelemetry = async () => {
    const key = localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
    if (!key || !bUid) return
    setTelemetryLoading(true)
    try {
      const data = await cargoLinkApi.getTelemetry(key, { bUid, limit: 20 })
      setTelemetry(data)
    } catch { /* telemetry may not be available */ }
    finally { setTelemetryLoading(false) }
  }

  React.useEffect(() => { if (tx) loadTelemetry() }, [tx?.b_uid])

  const handleAdvance = async () => {
    setAdvancing(true)
    setAdvanceError(null)
    setAdvanceResult(null)
    try {
      const res = await advance({})
      setAdvanceResult(res)
    } catch (err) {
      setAdvanceError(err.message)
    } finally {
      setAdvancing(false)
    }
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <Clock size={32} color="var(--bz-primary)" className="animate-pulse" />
      <p style={{ marginTop: 12, color: 'var(--bz-text-muted)', fontSize: 13 }}>Cargando B-UID...</p>
    </div>
  )

  if (error || !tx) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <AlertTriangle size={32} color="#ef4444" />
      <p style={{ marginTop: 12, color: '#ef4444', fontSize: 13 }}>{error || 'Transacción no encontrada'}</p>
      <button className="btn" onClick={() => navigate('/')} style={{ marginTop: 16, border: '1px solid var(--bz-border)' }}>
        <ArrowLeft size={16} /> Volver
      </button>
    </div>
  )

  const breaches = telemetry?.telemetry?.filter(t => t.breach) || []

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--bz-text-muted)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>{tx.b_uid}</h1>
          <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginTop: 2 }}>
            {tx.origin || '—'} → {tx.destination || '—'}
          </p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 20,
          background: tx.status === 'DELIVERED' ? 'rgba(47,248,1,0.12)' : 'rgba(0,240,255,0.1)',
          color: tx.status === 'DELIVERED' ? 'var(--bz-secondary)' : 'var(--bz-primary)',
          border: `1px solid ${tx.status === 'DELIVERED' ? 'var(--bz-secondary)' : 'var(--bz-primary)'}`,
        }}>{STAGE_LABELS[tx.status] || tx.status}</span>
      </div>

      {/* Progress Bar */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Progreso</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--bz-primary)', fontFamily: 'Space Grotesk' }}>{progress}%</span>
        </div>
        <div style={{ height: 8, background: '#1a1a2e', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--bz-primary), #a855f7)', borderRadius: 4, transition: 'width 0.5s ease' }} />
        </div>
        {/* Stage dots */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          {LIFECYCLE_STAGES.map((stage, i) => {
            const Icon = STAGE_ICONS[stage]
            const done = i <= currentIdx
            return (
              <div key={stage} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--bz-primary)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${done ? 'var(--bz-primary)' : 'var(--bz-border)'}`,
                }}>
                  <Icon size={14} color={done ? '#000' : 'var(--bz-text-muted)'} />
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, color: done ? 'var(--bz-primary)' : 'var(--bz-text-muted)', textTransform: 'uppercase' }}>
                  {STAGE_LABELS[stage]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cargo info */}
      {tx.cargo && Object.keys(tx.cargo).length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10, color: 'var(--bz-text-muted)' }}>Carga</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {tx.cargo.weight && <InfoCell label="Peso" value={`${tx.cargo.weight} kg`} />}
            {tx.cargo.type && <InfoCell label="Tipo" value={tx.cargo.type} />}
            {tx.cargo.value && <InfoCell label="Valor" value={`$${tx.cargo.value}`} />}
            {tx.cargo.items?.length && <InfoCell label="Bultos" value={tx.cargo.items.length} />}
          </div>
        </div>
      )}

      {/* Escrow */}
      {tx.escrow_status !== 'NONE' && (() => {
        const isReleased = tx.escrow_status === 'RELEASED'
        const color = isReleased ? 'var(--bz-secondary)' : '#f59e0b'
        const EscrowIcon = isReleased ? Unlock : Lock
        const lockAnchor = history.find(h => h.payload?.anchor?.escrow?.anchored)?.payload?.anchor?.escrow
        const releaseAnchor = history.find(h => h.to_status === 'DELIVERED' && h.payload?.anchor?.escrow?.anchored)?.payload?.anchor?.escrow
        return (
          <div className="card" style={{ padding: 14, borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <EscrowIcon size={16} color={color} />
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Escrow</span>
                  <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2 }}>{tx.escrow_amount_bez} BEZ</p>
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 12,
                background: isReleased ? 'rgba(47,248,1,0.1)' : 'rgba(245,158,11,0.1)',
                color,
              }}>{tx.escrow_status}</span>
            </div>
            {lockAnchor?.txHash && (
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--bz-text-muted)' }}>
                <span style={{ fontWeight: 700 }}>Lock tx: </span>
                <a href={txLink(lockAnchor.txHash)} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--bz-primary)', textDecoration: 'none', fontFamily: 'var(--bz-mono, monospace)' }}>
                  {lockAnchor.txHash.slice(0, 10)}...{lockAnchor.txHash.slice(-8)}
                  <ExternalLink size={10} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                </a>
              </div>
            )}
            {releaseAnchor?.txHash && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--bz-text-muted)' }}>
                <span style={{ fontWeight: 700 }}>Release tx: </span>
                <a href={txLink(releaseAnchor.txHash)} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--bz-secondary)', textDecoration: 'none', fontFamily: 'var(--bz-mono, monospace)' }}>
                  {releaseAnchor.txHash.slice(0, 10)}...{releaseAnchor.txHash.slice(-8)}
                  <ExternalLink size={10} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                </a>
              </div>
            )}
          </div>
        )
      })()}

      {/* IoT Telemetry */}
      {telemetry?.telemetry?.length > 0 && (
        <div className="card" style={{ padding: 14, borderLeft: `3px solid ${breaches.length > 0 ? '#ef4444' : 'var(--bz-primary)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Thermometer size={16} color={breaches.length > 0 ? '#ef4444' : 'var(--bz-primary)'} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>IoT Sensores ({telemetry.telemetry.length})</span>
            {breaches.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 4, marginLeft: 'auto',
                background: '#ef4444', color: '#fff',
              }}>
                {breaches.some(b => b.metric === 'temperature') ? 'COLD CHAIN BREACH' : 'SHOCK ALERT'}
              </span>
            )}
          </div>
          {breaches.length > 0 && breaches.slice(0, 3).map((b, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--bz-text-muted)', padding: '4px 0', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
              <span style={{ color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>{b.metric}</span>
              {': '}{b.value != null ? `${b.value}${b.unit || ''}` : '—'} — {b.reason}
              <span style={{ float: 'right', fontSize: 9 }}>{new Date(b.recorded_at).toLocaleString()}</span>
            </div>
          ))}
          <button
            className="btn"
            style={{ width: '100%', marginTop: 10, border: '1px solid var(--bz-border)', fontSize: 11 }}
            onClick={() => navigate(`/telemetry`)}
          >
            Ver telemetría completa →
          </button>
        </div>
      )}

      {/* Advance action */}
      {nextStage && (
        <div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: 18 }}
            onClick={handleAdvance}
            disabled={advancing}
          >
            <ChevronRight size={20} />
            {advancing ? 'VALIDANDO...' : `AVANZAR A ${STAGE_LABELS[nextStage]?.toUpperCase() || nextStage}`}
          </button>
          <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--bz-text-muted)', marginTop: 6 }}>
            Rol requerido: <strong>{ROLE_FOR_STAGE[nextStage] || 'admin'}</strong>
          </p>
          {advanceResult && (
            <div className="card" style={{ padding: 12, marginTop: 10, borderLeft: '3px solid var(--bz-secondary)' }}>
              <span style={{ fontSize: 10, color: 'var(--bz-secondary)', fontWeight: 800 }}>Transición exitosa</span>
              {advanceResult.anchor?.txHash && (
                <div style={{ marginTop: 6, fontSize: 10 }}>
                  <a href={txLink(advanceResult.anchor.txHash)} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--bz-primary)', textDecoration: 'none', fontFamily: 'var(--bz-mono, monospace)' }}>
                    <Anchor size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    On-chain: {advanceResult.anchor.txHash.slice(0, 10)}...{advanceResult.anchor.txHash.slice(-8)}
                    <ExternalLink size={10} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                  </a>
                </div>
              )}
              <pre style={{ fontSize: 10, color: 'var(--bz-text-muted)', marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(advanceResult.validation || advanceResult.result, null, 2)}
              </pre>
            </div>
          )}
          {advanceError && <p style={{ textAlign: 'center', fontSize: 11, color: '#ef4444', marginTop: 8 }}>{advanceError}</p>}
        </div>
      )}

      {/* Transition history */}
      <div>
        <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12, color: 'var(--bz-text-muted)' }}>
          Historial de validaciones ({history.length})
        </h3>
        {history.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Sin transiciones todavía.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {history.map((h, i) => (
              <div key={h.id || i} style={{ padding: '12px 16px', borderBottom: i < history.length - 1 ? '1px solid var(--bz-border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={14} color="var(--bz-primary)" />
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                      {h.from_status || '—'} → {h.to_status}
                    </span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--bz-primary)', padding: '2px 8px', background: 'rgba(0,240,255,0.08)', borderRadius: 10 }}>
                    {h.role}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--bz-text-muted)' }}>
                  <span>{h.actor_bezhas_id || 'system'}</span>
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                </div>
                {h.payload?.anchor?.txHash && (
                  <div style={{ marginTop: 4, fontSize: 10 }}>
                    <a href={txLink(h.payload.anchor.txHash)} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--bz-primary)', textDecoration: 'none', fontFamily: 'var(--bz-mono, monospace)' }}>
                      <Anchor size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {h.payload.anchor.txHash.slice(0, 10)}...{h.payload.anchor.txHash.slice(-8)}
                      <ExternalLink size={10} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* POS ref */}
      {tx.pos_ref && (
        <div style={{ fontSize: 11, color: 'var(--bz-text-muted)', textAlign: 'center' }}>
          POS ref: <code style={{ color: 'var(--bz-primary)' }}>{tx.pos_ref}</code>
          {tx.pos_provider && <> · {tx.pos_provider}</>}
        </div>
      )}
    </div>
  )
}

const InfoCell = ({ label, value }) => (
  <div>
    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>{label}</span>
    <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{value}</p>
  </div>
)

export default TransactionDetail
