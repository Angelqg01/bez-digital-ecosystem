import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe,
  Send,
  CheckCircle2,
  Zap,
  Building2,
  AlertTriangle,
} from 'lucide-react'
import { useTransactions } from '../hooks/useTransaction'
import { cargoLinkApi } from '../services/cargoLinkApi'

function authKey() {
  return localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
}

const CustomsSync = () => {
  const navigate = useNavigate()
  const { transactions, loading: txLoading } = useTransactions({ status: 'CREATED' })
  const [selected, setSelected] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    manifestId: '',
    declaredValue: '',
    hsCode: '',
  })

  const tx = transactions.find(t => t.b_uid === selected)

  const handleSync = async () => {
    if (!selected) { setError('Selecciona un B-UID'); return }
    if (!form.declaredValue) { setError('Indica el valor declarado'); return }
    setError('')
    setSyncing(true)
    try {
      const key = authKey()
      const res = await cargoLinkApi.advanceTransaction(key, selected, {
        manifestId: form.manifestId || tx?.pos_ref || selected,
        declaredValue: Number(form.declaredValue),
        hsCode: form.hsCode || undefined,
      })
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const validation = result?.validation || result?.result

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <Globe size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Regulatory Gateway</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Customs Sync</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Despacho aduanero real: valida un B-UID y lo avanza a CUSTOMS_CLEARED.
        </p>
      </header>

      {/* B-UID selector */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
          Selecciona B-UID (estado CREATED)
        </label>
        {txLoading ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Cargando transacciones...</p>
        ) : transactions.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>
            No hay B-UIDs pendientes de aduana. Crea uno desde el panel POS.
          </p>
        ) : (
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setResult(null); setError('') }}
            style={{
              width: '100%', padding: '10px 12px', background: '#090d16',
              border: '1px solid var(--bz-border)', borderRadius: 10, color: '#fff', fontSize: 13,
            }}
          >
            <option value="">— Elige un B-UID —</option>
            {transactions.map(t => (
              <option key={t.b_uid} value={t.b_uid}>
                {t.b_uid} {t.origin ? `(${t.origin})` : ''} {t.cargo?.type ? `· ${t.cargo.type}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Form */}
      {selected && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12, color: 'var(--bz-text-muted)' }}>Datos de despacho</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={labelStyle}>Manifest ID</label>
              <input
                style={inputStyle}
                placeholder={tx?.pos_ref || selected}
                value={form.manifestId}
                onChange={e => setForm({ ...form, manifestId: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Valor declarado (USD) *</label>
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="15000"
                  value={form.declaredValue}
                  onChange={e => setForm({ ...form, declaredValue: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Código HS</label>
                <input
                  style={inputStyle}
                  placeholder="8471.30"
                  value={form.hsCode}
                  onChange={e => setForm({ ...form, hsCode: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {result && validation && (
        <div className="card" style={{
          background: 'rgba(121, 255, 91, 0.05)',
          border: '1px solid var(--bz-secondary)',
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bz-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00363a', flexShrink: 0 }}>
            <CheckCircle2 size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--bz-secondary)' }}>
              ADUANA DESPACHADA ({validation.lane || 'CLEARED'})
            </h4>
            <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginTop: 2 }}>
              Arancel estimado: ${validation.dutyEstimate?.toFixed(2) || '—'}
              {validation.inspectionRequired && ' · Inspección requerida'}
            </p>
            <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', marginTop: 2 }}>
              HS: {validation.hsCode || '—'} · Valor: ${validation.declaredValue || '—'} · Standard: {validation.standard || 'UBL_2_1'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 12, borderLeft: '3px solid #ef4444', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>
          </div>
        </div>
      )}

      {/* Action */}
      <button
        className="btn btn-primary"
        style={{ width: '100%', padding: 20, marginBottom: 12 }}
        onClick={handleSync}
        disabled={syncing || !selected || !!result}
      >
        <Send size={20} />
        {syncing ? 'VALIDANDO ADUANA...' : (result ? 'DESPACHADO' : 'DESPACHAR ADUANA')}
      </button>

      {result && (
        <button
          className="btn"
          style={{ width: '100%', border: '1px solid var(--bz-border)', marginBottom: 12, padding: 14 }}
          onClick={() => navigate(`/tx/${selected}`)}
        >
          Ver detalle del B-UID →
        </button>
      )}

      {/* Partner Agencies */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, opacity: 0.5, marginTop: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <Building2 size={24} style={{ margin: '0 auto 4px' }} />
          <p style={{ fontSize: 8, fontWeight: 800 }}>ASYCUDA</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Globe size={24} style={{ margin: '0 auto 4px' }} />
          <p style={{ fontSize: 8, fontWeight: 800 }}>WCO-SIMPLE</p>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase', marginBottom: 4 }
const inputStyle = {
  width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--bz-border)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none',
}

export default CustomsSync
