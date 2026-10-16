import React from 'react'

/** Dice de dónde vienen los datos: demostración (ámbar, con salida a «conectar planta») o lecturas reales (verde). */
export default function SourceBadge({ simulated, source }) {
  if (simulated) {
    return (
      <div role="status" data-testid="source-badge" style={{ background: 'rgba(245,158,11,0.12)', padding: '8px 14px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.45)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: '#f59e0b' }}>DATOS DE DEMOSTRACIÓN</span>
        <a href="/scada" style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-primary)', textDecoration: 'underline' }}>Conectar planta</a>
      </div>
    )
  }
  return (
    <div role="status" data-testid="source-badge" style={{ background: 'var(--bez-surface-2)', padding: '8px 16px', borderRadius: 20, border: '1px solid var(--bez-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bez-secondary)' }} />
      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>EN VIVO · {source || 'nodos'}</span>
    </div>
  )
}
