/**
 * Operators — ADMIN-only console to provision CargoLink actors + IoT devices.
 *
 * Two sections:
 * 1. Role-scoped API keys (pos | customs | carrier | logistics | lastmile | admin)
 * 2. IoT device registration (gps | temp | shock | rfid | multi) bound to B-UIDs
 */
import React from 'react'
import { useAuth } from '../context/AuthProvider'
import { cargoLinkAdmin, cargoLinkApi, KEY_ROLES } from '../services/cargoLinkApi'
import { useTransactions } from '../hooks/useTransaction'

const ROLE_LABEL = {
  pos: 'POS / Cliente', customs: 'Aduanas', carrier: 'Naviera / Carrier',
  logistics: 'Logística', lastmile: 'Última milla', admin: 'Administrador',
}

const DEVICE_TYPES = ['gps', 'temp', 'shock', 'rfid', 'multi']
const DEVICE_TYPE_LABEL = {
  gps: 'GPS Tracker', temp: 'Temperatura', shock: 'Acelerómetro',
  rfid: 'RFID Reader', multi: 'Multi-sensor',
}

const Operators = () => {
  const { user, token } = useAuth()
  const isAdmin = (user?.role || '').toLowerCase() === 'admin'

  const [keys, setKeys] = React.useState([])
  const [error, setError] = React.useState(null)
  const [notice, setNotice] = React.useState(null)
  const [issued, setIssued] = React.useState(null) // plaintext key shown once
  const [busy, setBusy] = React.useState(false)
  const [form, setForm] = React.useState({ bezhasId: '', role: 'customs', label: '' })

  // IoT device state
  const { transactions } = useTransactions()
  const [deviceForm, setDeviceForm] = React.useState({ deviceId: '', type: 'multi', bUid: '', label: '' })
  const [issuedDeviceKey, setIssuedDeviceKey] = React.useState(null)
  const [deviceBusy, setDeviceBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const data = await cargoLinkAdmin.listKeys()
      setKeys(data.keys || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  React.useEffect(() => { if (isAdmin && token) load() }, [isAdmin, token, load])

  const onIssue = async (e) => {
    e.preventDefault()
    if (!form.bezhasId.trim()) { setError('Indica un BeZhas_ID.'); return }
    setBusy(true); setError(null); setNotice(null); setIssued(null)
    try {
      const res = await cargoLinkAdmin.issueKey({
        bezhasId: form.bezhasId.trim(), role: form.role, label: form.label.trim() || undefined,
      })
      setIssued(res.apiKey)
      setNotice(`Clave de ${ROLE_LABEL[res.role] || res.role} emitida. Cópiala ahora: no se vuelve a mostrar.`)
      setForm({ bezhasId: '', role: 'customs', label: '' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onRevoke = async (id) => {
    setBusy(true); setError(null); setNotice(null)
    try {
      await cargoLinkAdmin.revokeKey(id)
      setNotice('Clave revocada.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!isAdmin) return (
    <div style={{ padding: 32, maxWidth: 520, margin: '24px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
      <h2 style={{ color: '#fff', fontWeight: 900 }}>Acceso restringido</h2>
      <p style={{ color: 'var(--bz-text-muted)', marginTop: 8 }}>
        La gestión de operarios es exclusiva del rol <strong>administrador</strong>.
        Tu rol actual es <strong>{user?.role || 'invitado'}</strong>.
      </p>
    </div>
  )

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--bz-border)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>Gestión de Operarios</h1>
        <p style={{ color: 'var(--bz-text-muted)', marginTop: 6, fontSize: 13 }}>
          Emite y revoca las claves role-scoped de los actores que validan los B-UID
          (POS, aduanas, naviera, logística, última milla).
        </p>
      </header>

      {(error || notice) && (
        <div className="card" style={{ padding: 12, borderLeft: `3px solid ${error ? '#ef4444' : 'var(--bz-primary)'}` }}>
          <span style={{ color: error ? '#ef4444' : 'var(--bz-primary)', fontSize: 13 }}>{error || notice}</span>
        </div>
      )}

      {issued && (
        <div className="card" style={{ padding: 14, border: '1px solid var(--bz-primary)' }}>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Clave emitida (cópiala ahora)</p>
          <code style={{ display: 'block', marginTop: 6, color: 'var(--bz-primary)', fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace' }}>{issued}</code>
        </div>
      )}

      <section className="card" style={{ padding: 18 }}>
        <h3 style={{ color: '#fff', marginBottom: 12, fontSize: 15 }}>Emitir clave de operario</h3>
        <form onSubmit={onIssue} style={{ display: 'grid', gap: 10 }}>
          <input style={inputStyle} placeholder="BeZhas_ID (ej. BEZ-XXXX-YYYY)"
            value={form.bezhasId} onChange={(e) => setForm({ ...form, bezhasId: e.target.value })} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select style={{ ...inputStyle, flex: 1, minWidth: 160, background: '#090d16' }}
              value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {KEY_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
            </select>
            <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Etiqueta (opcional)"
              value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>
            {busy ? 'Emitiendo…' : '+ Emitir clave'}
          </button>
        </form>
      </section>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bz-border)' }}>
          <h3 style={{ color: '#fff', fontSize: 15 }}>Operarios activos ({keys.length})</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--bz-border)' }}>
                <th style={{ padding: 12, color: 'var(--bz-text-muted)' }}>BEZHAS_ID</th>
                <th style={{ padding: 12, color: 'var(--bz-text-muted)' }}>ROL</th>
                <th style={{ padding: 12, color: 'var(--bz-text-muted)' }}>ETIQUETA</th>
                <th style={{ padding: 12, color: 'var(--bz-text-muted)' }}>ESTADO</th>
                <th style={{ padding: 12, color: 'var(--bz-text-muted)' }}>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} style={{ borderBottom: '1px solid var(--bz-border)' }}>
                  <td style={{ padding: 12, fontFamily: 'monospace', color: '#fff' }}>{k.bezhas_id}</td>
                  <td style={{ padding: 12, color: 'var(--bz-primary)' }}>{ROLE_LABEL[k.role] || k.role}</td>
                  <td style={{ padding: 12, color: 'var(--bz-text-muted)' }}>{k.label || '—'}</td>
                  <td style={{ padding: 12, color: k.status === 'active' ? 'var(--bz-secondary)' : '#ef4444' }}>{k.status}</td>
                  <td style={{ padding: 12 }}>
                    {k.status === 'active'
                      ? <button className="btn" onClick={() => onRevoke(k.id)} disabled={busy}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12 }}>Revocar</button>
                      : <span style={{ color: 'var(--bz-text-muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
              {!keys.length && (
                <tr><td colSpan={5} style={{ padding: 18, color: 'var(--bz-text-muted)' }}>Sin operarios emitidos todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* IoT Device Registration */}
      <section style={{ marginTop: 8 }}>
        <header style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>Dispositivos IoT</h2>
          <p style={{ color: 'var(--bz-text-muted)', marginTop: 4, fontSize: 13 }}>
            Registra sensores (GPS, temperatura, acelerómetro, RFID) y vincúlalos a un B-UID.
            La device key se muestra una sola vez.
          </p>
        </header>

        {issuedDeviceKey && (
          <div className="card" style={{ padding: 14, border: '1px solid #f59e0b', marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: '#f59e0b', textTransform: 'uppercase', fontWeight: 800 }}>
              Device Key (cópiala ahora — no se vuelve a mostrar)
            </p>
            <code style={{ display: 'block', marginTop: 6, color: '#f59e0b', fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {issuedDeviceKey}
            </code>
          </div>
        )}

        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <h3 style={{ color: '#fff', marginBottom: 12, fontSize: 15 }}>Registrar dispositivo</h3>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const key = localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
            if (!key) { setError('Sin autenticación'); return }
            setDeviceBusy(true); setError(null); setNotice(null); setIssuedDeviceKey(null)
            try {
              const res = await cargoLinkApi.registerDevice(key, {
                deviceId: deviceForm.deviceId.trim() || undefined,
                type: deviceForm.type,
                bUid: deviceForm.bUid || undefined,
                label: deviceForm.label.trim() || undefined,
              })
              setIssuedDeviceKey(res.deviceKey)
              setNotice(`Dispositivo ${res.device?.device_id || 'registrado'}. Copia la device key ahora.`)
              setDeviceForm({ deviceId: '', type: 'multi', bUid: '', label: '' })
            } catch (err) {
              setError(err.message)
            } finally {
              setDeviceBusy(false)
            }
          }} style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Device ID (auto si vacío)"
                value={deviceForm.deviceId} onChange={e => setDeviceForm({ ...deviceForm, deviceId: e.target.value })} />
              <select style={{ ...inputStyle, flex: 1, minWidth: 140, background: '#090d16' }}
                value={deviceForm.type} onChange={e => setDeviceForm({ ...deviceForm, type: e.target.value })}>
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{DEVICE_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select style={{ ...inputStyle, flex: 1, minWidth: 200, background: '#090d16' }}
                value={deviceForm.bUid} onChange={e => setDeviceForm({ ...deviceForm, bUid: e.target.value })}>
                <option value="">Sin vincular a B-UID</option>
                {transactions.map(t => (
                  <option key={t.b_uid} value={t.b_uid}>{t.b_uid} · {t.status}</option>
                ))}
              </select>
              <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Etiqueta (ej. Contenedor A3)"
                value={deviceForm.label} onChange={e => setDeviceForm({ ...deviceForm, label: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={deviceBusy} style={{ justifySelf: 'start' }}>
              {deviceBusy ? 'Registrando…' : '+ Registrar dispositivo'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

export default Operators
