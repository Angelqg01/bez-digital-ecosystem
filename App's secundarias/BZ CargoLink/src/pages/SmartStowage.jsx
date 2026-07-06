import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Box,
  Target,
  AlertCircle,
  CheckCircle2,
  Package,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTransactions } from '../hooks/useTransaction'
import { cargoLinkApi } from '../services/cargoLinkApi'

function authKey() {
  return localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
}

const SmartStowage = () => {
  const navigate = useNavigate()
  const { transactions, loading: txLoading } = useTransactions({ status: 'CUSTOMS_CLEARED' })
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState(null)
  const [error, setError] = useState('')
  const [items, setItems] = useState([
    { id: 1, weight: 200, x: 50, y: 50 },
  ])

  const addItem = () => {
    setItems([...items, { id: Date.now(), weight: 200, x: 50, y: 50 }])
  }
  const removeItem = (id) => {
    if (items.length <= 1) return
    setItems(items.filter(i => i.id !== id))
  }
  const updateItem = (id, field, value) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: Number(value) || 0 } : i))
  }

  const calculateCOG = () => {
    const totalMass = items.reduce((a, i) => a + i.weight, 0)
    if (totalMass === 0) return { x: 0, y: 0, total: 0 }
    const cogX = items.reduce((a, i) => a + (i.weight * i.x), 0) / totalMass
    const cogY = items.reduce((a, i) => a + (i.weight * i.y), 0) / totalMass
    return { x: cogX, y: cogY, total: totalMass }
  }

  const cog = calculateCOG()

  const validateStowage = async () => {
    if (!selected) { setError('Selecciona un B-UID'); return }
    setError('')
    setLoading(true)
    try {
      const key = authKey()
      const res = await cargoLinkApi.advanceTransaction(key, selected, {
        items: items.map(i => ({ x: i.x, y: i.y, weight: i.weight })),
      })
      setValidation(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const result = validation?.validation || validation?.result

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <Box size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Physical Layout v1.0</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Smart Stowage</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Calcula el centro de gravedad y valida la estiba para avanzar a STOWED.
        </p>
      </header>

      {/* B-UID selector */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <label style={labelStyle}>Selecciona B-UID (estado CUSTOMS_CLEARED)</label>
        {txLoading ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Cargando...</p>
        ) : transactions.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>
            No hay B-UIDs pendientes de estiba. Despacha primero en Customs.
          </p>
        ) : (
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setValidation(null); setError('') }}
            style={selectStyle}
          >
            <option value="">— Elige un B-UID —</option>
            {transactions.map(t => (
              <option key={t.b_uid} value={t.b_uid}>
                {t.b_uid} {t.cargo?.weight ? `· ${t.cargo.weight}kg` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Container Visualization */}
      <div className="card" style={{ padding: 0, height: 300, position: 'relative', background: '#0e0e0e', border: '2px solid var(--bz-border)', marginBottom: 20 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'linear-gradient(var(--bz-border) 1px, transparent 1px), linear-gradient(90deg, var(--bz-border) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div style={{ position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 }}>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                position: 'absolute', top: `${item.y}%`, left: `${item.x}%`,
                width: 50, height: 50, background: 'rgba(0,240,255,0.2)',
                border: '1px solid var(--bz-primary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900,
              }}
            >
              {item.weight}kg
            </motion.div>
          ))}
          {cog.total > 0 && (
            <motion.div
              animate={{ top: `${cog.y}%`, left: `${cog.x}%` }}
              style={{ position: 'absolute', transform: 'translate(-50%, -50%)', zIndex: 20 }}
            >
              <Target size={28} color="#ffb4ab" className="animate-pulse" />
              <div style={{ position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 9, fontWeight: 900, color: '#ffb4ab', background: 'rgba(0,0,0,0.8)', padding: '1px 5px' }}>
                COG
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Items editor */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--bz-text-muted)' }}>Bultos ({items.length})</h3>
          <button onClick={addItem} className="btn" style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--bz-border)' }}>
            <Plus size={14} /> Añadir
          </button>
        </div>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Peso (kg)</label>
              <input style={inputStyle} type="number" value={item.weight} onChange={e => updateItem(item.id, 'weight', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>X (%)</label>
              <input style={inputStyle} type="number" min="0" max="100" value={item.x} onChange={e => updateItem(item.id, 'x', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Y (%)</label>
              <input style={inputStyle} type="number" min="0" max="100" value={item.y} onChange={e => updateItem(item.id, 'y', e.target.value)} />
            </div>
            <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px 4px' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Physics Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ margin: 0 }}>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Payload</p>
          <h4 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{cog.total} kg</h4>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>COG</p>
          <h4 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--bz-primary)' }}>
            ({cog.x.toFixed(1)}, {cog.y.toFixed(1)})
          </h4>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card" style={{
          padding: 14, marginBottom: 20,
          borderLeft: `3px solid ${result.status === 'VERIFIED' ? 'var(--bz-secondary)' : '#f59e0b'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {result.status === 'VERIFIED'
              ? <CheckCircle2 size={18} color="var(--bz-secondary)" />
              : <AlertCircle size={18} color="#f59e0b" />}
            <span style={{ fontSize: 13, fontWeight: 800, color: result.status === 'VERIFIED' ? 'var(--bz-secondary)' : '#f59e0b' }}>
              ESTIBA {result.status}
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--bz-text-muted)' }}>
            COG: ({result.cog?.x}, {result.cog?.y}) · Peso total: {result.totalWeight}kg
            · Desviación X: {result.deviation?.x}% Y: {result.deviation?.y}%
          </p>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 12, borderLeft: '3px solid #ef4444', marginBottom: 20 }}>
          <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>
        </div>
      )}

      {/* Action */}
      <button
        className="btn btn-primary"
        style={{ width: '100%', padding: 20, marginBottom: 12 }}
        onClick={validateStowage}
        disabled={loading || !selected || !!validation}
      >
        <Package size={20} />
        {loading ? 'VALIDANDO ESTIBA...' : (validation ? 'ESTIBADO' : 'VALIDAR ESTIBA EN L2')}
      </button>

      {validation && (
        <button
          className="btn"
          style={{ width: '100%', border: '1px solid var(--bz-border)', padding: 14 }}
          onClick={() => navigate(`/tx/${selected}`)}
        >
          Ver detalle del B-UID →
        </button>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--bz-text-muted)', textTransform: 'uppercase', marginBottom: 3 }
const inputStyle = {
  width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--bz-border)', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
}
const selectStyle = {
  width: '100%', padding: '10px 12px', background: '#090d16',
  border: '1px solid var(--bz-border)', borderRadius: 10, color: '#fff', fontSize: 13,
}

export default SmartStowage
