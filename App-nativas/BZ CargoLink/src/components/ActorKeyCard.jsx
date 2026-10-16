import React, { useState } from 'react'
import { getActorKey, setActorKey } from '../services/actorKey'

/** Guarda la clave de operador (`bzk_live_…`) con la que el navegador opera los B-UIDs, geocercas y telemetría. */
export default function ActorKeyCard({ onChange, compact = false }) {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(!!getActorKey())
  const save = () => {
    if (!/^bzk_(live|test)_[a-f0-9]{16,}$/i.test(value.trim())) { return window.alert?.('La clave debe tener el formato bzk_live_… (la emite un admin en Operadores).') }
    setActorKey(value); setValue(''); setSaved(true); onChange?.()
  }
  const clear = () => { setActorKey(''); setSaved(false); onChange?.() }
  return (
    <div className="card" data-testid="actor-key-card" style={{ padding: compact ? 12 : 16, marginBottom: 14, borderLeft: `3px solid ${saved ? 'var(--bz-secondary)' : '#f59e0b'}` }}>
      <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: saved ? 'var(--bz-secondary)' : '#f59e0b', margin: 0 }}>
        {saved ? 'Clave de operador activa' : 'Falta la clave de operador'}
      </p>
      <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', margin: '4px 0 8px' }}>
        Los B-UIDs, geocercas y telemetría se operan con una clave con rol (POS, aduana, transportista…) que emite un admin en «Operadores». No sirve el inicio de sesión.
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Clave de operador" type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder={saved ? '•••••••• (guardada)' : 'bzk_live_…'}
          style={{ flex: 1, padding: '8px 10px', background: '#090d16', border: '1px solid var(--bz-border)', borderRadius: 8, color: '#fff', fontSize: 12 }} />
        <button type="button" className="btn" style={{ border: '1px solid var(--bz-border)', padding: '8px 12px' }} onClick={save} disabled={!value.trim()}>Guardar</button>
        {saved && <button type="button" className="btn" style={{ border: '1px solid var(--bz-border)', padding: '8px 12px', color: '#ff6b6b' }} onClick={clear}>Quitar</button>}
      </div>
    </div>
  )
}
