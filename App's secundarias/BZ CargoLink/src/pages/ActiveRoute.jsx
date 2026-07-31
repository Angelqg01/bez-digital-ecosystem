import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  QrCode,
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useTransactions, stageProgress } from '../hooks/useTransaction'
import { cargoLinkApi } from '../services/cargoLinkApi'
import PermissionPrime from '../../../_shared/PermissionPrime.jsx'

// Ubicación en tiempo real es una función de plan de pago: sin suscripción
// Profesional/Enterprise, ni siquiera se le pide el permiso al navegador.
const REQUIRED_TIERS = ['professional', 'enterprise']
import PortsMap from '../components/PortsMap'
import { PORTS } from '../data/ports'

function authKey() {
  return localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
}

const ActiveRoute = () => {
  const navigate = useNavigate()
  const { transactions, loading: txLoading } = useTransactions({ status: 'IN_TRANSIT' })
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [trackingNotice, setTrackingNotice] = useState('')
  const [showPrime, setShowPrime] = useState(false)

  const tx = transactions.find(t => t.b_uid === selected)
  const progress = tx ? stageProgress(tx.status) : 0

  const submitProof = async (coords) => {
    if (!selected) { setError('Selecciona un B-UID'); return }
    try {
      setError('')
      setLoading(true)
      const key = authKey()
      const payload = coords
        ? { lat: coords.latitude, lng: coords.longitude, geoVerified: true }
        : { geoVerified: false }
      const res = await cargoLinkApi.advanceTransaction(key, selected, payload)
      setResult(res)
      setTrackingNotice(coords
        ? 'Punto de entrega verificado con tu ubicación. B-UID avanzado a DELIVERED.'
        : 'Prueba generada sin verificación GPS. B-UID avanzado a DELIVERED.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateProof = () => {
    if (!selected) { setError('Selecciona un B-UID'); return }
    setError('')
    setShowPrime(true)
  }

  const handleGeoGranted = (position) => {
    setShowPrime(false)
    submitProof(position.coords)
  }

  const handleGeoDenied = () => {
    setShowPrime(false)
    submitProof(null)
  }

  return (
    <div className="flex flex-col h-full">
      <PermissionPrime
        tool="geolocation"
        open={showPrime}
        onGranted={handleGeoGranted}
        onCancel={() => setShowPrime(false)}
        onDenied={handleGeoDenied}
        requiredTiers={REQUIRED_TIERS}
      />

      {/* Status Bar */}
      <div style={{ padding: '8px 20px', background: '#0e0e0e', borderBottom: '1px solid var(--bz-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: tx ? 'var(--bz-secondary)' : 'var(--bz-text-muted)', boxShadow: tx ? '0 0 8px #2ff801' : 'none' }} />
          <span style={{ fontSize: 10, color: tx ? 'var(--bz-secondary)' : 'var(--bz-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
            {tx ? 'EN TRÁNSITO' : 'SIN RUTA ACTIVA'}
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontFamily: 'Space Grotesk', letterSpacing: 1 }}>
          {tx ? tx.b_uid : '—'}
        </span>
      </div>

      {/* Map */}
      <div style={{ height: 300, position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--bz-border)' }}>
        <PortsMap />
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 500, background: 'rgba(10,14,20,0.82)', border: '1px solid var(--bz-border)', borderRadius: 8, padding: '6px 12px', pointerEvents: 'none' }}>
          <p style={{ fontSize: 9, color: 'var(--bz-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Red Global de Puertos</p>
          <p style={{ fontSize: 11, color: '#fff', fontWeight: 700, margin: 0 }}>{PORTS.length} hubs · settlement on-chain BeZhas</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 20, flex: 1, background: 'var(--bz-bg)' }}>
        {/* B-UID selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Selecciona B-UID en tránsito
          </label>
          {txLoading ? (
            <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Cargando...</p>
          ) : transactions.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>
              No hay B-UIDs en tránsito. Completa los pasos previos (Customs → Stowage → Departure → In Transit).
            </p>
          ) : (
            <select
              value={selected}
              onChange={e => { setSelected(e.target.value); setResult(null); setError(''); setTrackingNotice('') }}
              style={{
                width: '100%', padding: '10px 12px', background: '#090d16',
                border: '1px solid var(--bz-border)', borderRadius: 10, color: '#fff', fontSize: 13,
              }}
            >
              <option value="">— Elige un B-UID —</option>
              {transactions.map(t => (
                <option key={t.b_uid} value={t.b_uid}>
                  {t.b_uid} → {t.destination || '?'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selected tx info */}
        {tx && (
          <>
            {/* Progress Bar */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--bz-primary)', textTransform: 'uppercase' }}>Progreso de Entrega</h3>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--bz-primary)', fontFamily: 'Space Grotesk' }}>{progress}%</span>
              </div>
              <div style={{ height: 12, width: '100%', background: '#2a2a2a', border: '1px solid var(--bz-border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--bz-primary)', boxShadow: '0 0 12px rgba(0,240,255,0.4)' }} />
              </div>
            </div>

            {/* Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div className="card" style={{ gridColumn: 'span 2' }}>
                <div style={{ borderLeft: '2px solid var(--bz-primary)', paddingLeft: 16 }}>
                  <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Destino</p>
                  <h4 style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{tx.destination || 'Sin destino especificado'}</h4>
                  {tx.origin && <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Origen: {tx.origin}</p>}
                </div>
              </div>
              <div className="card">
                <Truck size={20} color="var(--bz-primary)" />
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginTop: 6 }}>Carga</p>
                <p style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{tx.cargo?.weight ? `${tx.cargo.weight} kg` : '—'}</p>
              </div>
              <div className="card">
                <MapPin size={20} color="var(--bz-primary)" />
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginTop: 6 }}>POS ref</p>
                <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.pos_ref || '—'}</p>
              </div>
            </div>
          </>
        )}

        {/* Result */}
        {result && (
          <div className="card" style={{ padding: 14, marginBottom: 20, borderLeft: '3px solid var(--bz-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="var(--bz-secondary)" />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bz-secondary)' }}>ENTREGADO</span>
            </div>
            {result.validation && (
              <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginTop: 6 }}>
                Prueba: {result.validation.proof} {result.validation.geoVerified ? '(GPS verificado)' : ''}
              </p>
            )}
          </div>
        )}

        {error && <p style={{ color: '#ef4444', fontSize: 11, marginBottom: 16, textAlign: 'center' }}>{error}</p>}

        {/* Action Button */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: 20 }}
          onClick={generateProof}
          disabled={loading || !selected || !!result}
        >
          <QrCode size={20} />
          {loading ? 'GENERANDO PRUEBA...' : (result ? 'ENTREGADO' : 'GENERAR PRUEBA DE ENTREGA')}
        </button>
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
          Pulse una vez en destino para confirmar entrega (avanza a DELIVERED)
        </p>
        {trackingNotice && <p style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: 'var(--bz-secondary)' }}>{trackingNotice}</p>}

        {result && (
          <button
            className="btn"
            style={{ width: '100%', border: '1px solid var(--bz-border)', marginTop: 12, padding: 14 }}
            onClick={() => navigate(`/tx/${selected}`)}
          >
            Ver detalle del B-UID →
          </button>
        )}
      </div>
    </div>
  )
}

export default ActiveRoute
