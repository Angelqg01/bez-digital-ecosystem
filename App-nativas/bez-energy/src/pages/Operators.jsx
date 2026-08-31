/**
 * Operators — ADMIN-only console to provision VPP operators.
 *
 * An admin grants the `operator` role (which unlocks SCADA dispatch, arbitrage
 * execution, CAE minting and demand-response on the backend) and can revoke it.
 * Every change is audited server-side in operator_provisioning_log.
 *
 * Non-admins never see this route (App gates the nav item + shows a denial here).
 */
import React from 'react'
import { ShieldCheck, UserPlus, Trash2, Loader2, AlertTriangle, BadgeCheck } from 'lucide-react'
import useMe from '../hooks/useMe'
import { listOperators, grantOperator, revokeOperator } from '../api'

const Operators = () => {
  const { me, loading: meLoading } = useMe()
  const [data, setData] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [identifier, setIdentifier] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState(null)

  const load = React.useCallback(async () => {
    try {
      setData(await listOperators())
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  React.useEffect(() => { if (me.is_admin) load() }, [me.is_admin, load])

  const onGrant = async (e) => {
    e.preventDefault()
    const value = identifier.trim()
    if (!value) return
    setBusy(true); setNotice(null); setError(null)
    try {
      const payload = value.startsWith('0x') ? { walletAddress: value }
        : value.includes('@') ? { email: value } : { userId: value }
      const res = await grantOperator(payload)
      setNotice(res.already_operator ? 'User was already an operator.' : 'Operator role granted.')
      setIdentifier('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onRevoke = async (id) => {
    setBusy(true); setNotice(null); setError(null)
    try {
      await revokeOperator(id)
      setNotice('Operator role revoked.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (meLoading) return <div style={{ color: 'white', padding: 40 }}><Loader2 className="spin" /> Resolviendo permisos…</div>

  if (!me.is_admin) return (
    <div className="card" style={{ padding: 32, maxWidth: 520 }}>
      <AlertTriangle color="var(--bez-warning, #f59e0b)" />
      <h2 style={{ marginTop: 12 }}>Acceso restringido</h2>
      <p style={{ color: 'var(--bez-text-sec)', marginTop: 8 }}>
        Esta sección es exclusiva del rol <strong>administrador</strong>. Tu rol actual
        es <strong>{me.role}</strong>. Solicita acceso al administrador del nodo VPP.
      </p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck color="var(--bez-primary)" /> Gestión de Operarios
        </h1>
        <p style={{ color: 'var(--bez-text-sec)', marginTop: 8 }}>
          Concede o revoca el rol <strong>operador</strong>. Los operadores pueden
          despachar comandos SCADA, ejecutar arbitraje y activar respuesta a la demanda.
        </p>
      </header>

      {(error || notice) && (
        <div className="card" style={{ padding: 14, borderLeft: `3px solid ${error ? 'var(--bez-danger,#ef4444)' : 'var(--bez-primary)'}` }}>
          <span style={{ color: error ? 'var(--bez-danger,#ef4444)' : 'var(--bez-primary)' }}>
            {error || notice}
          </span>
        </div>
      )}

      <section className="card" style={{ padding: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Conceder rol de operador</h3>
        <form onSubmit={onGrant} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="0x… (wallet)  ·  email  ·  user id (UUID)"
            style={{ flex: 1, minWidth: 280, padding: '10px 14px', background: 'var(--bez-surface-2)', border: '1px solid var(--bez-border)', borderRadius: 12, color: 'white', outline: 'none' }}
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />} Conceder
          </button>
        </form>
      </section>

      <section className="card">
        <div style={{ padding: 20, borderBottom: '1px solid var(--bez-border)' }}>
          <h3>Operadores y administradores ({data?.operators?.length ?? 0})</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--bez-border)' }}>
                <th style={{ padding: 14, color: 'var(--bez-text-muted)' }}>USUARIO</th>
                <th style={{ padding: 14, color: 'var(--bez-text-muted)' }}>WALLET</th>
                <th style={{ padding: 14, color: 'var(--bez-text-muted)' }}>ROL</th>
                <th style={{ padding: 14, color: 'var(--bez-text-muted)' }}>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {(data?.operators || []).map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--bez-border)' }}>
                  <td style={{ padding: 14 }}>{u.username || u.email || '—'}</td>
                  <td style={{ padding: 14, fontFamily: 'monospace' }}>{u.wallet_address ? `${u.wallet_address.slice(0, 8)}…${u.wallet_address.slice(-4)}` : '—'}</td>
                  <td style={{ padding: 14 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: u.role === 'admin' ? 'var(--bez-gold,#FFD700)' : 'var(--bez-primary)' }}>
                      <BadgeCheck size={14} /> {u.role}
                    </span>
                  </td>
                  <td style={{ padding: 14 }}>
                    {u.role === 'operator' ? (
                      <button className="btn" onClick={() => onRevoke(u.id)} disabled={busy}
                        style={{ background: 'var(--bez-surface-3)', border: '1px solid var(--bez-border)', color: 'var(--bez-danger,#ef4444)', fontSize: 12 }}>
                        <Trash2 size={13} /> Revocar
                      </button>
                    ) : <span style={{ color: 'var(--bez-text-muted)' }}>protegido</span>}
                  </td>
                </tr>
              ))}
              {!data?.operators?.length && (
                <tr><td colSpan={4} style={{ padding: 20, color: 'var(--bez-text-muted)' }}>Sin operadores todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!!data?.candidates?.length && (
        <section className="card">
          <div style={{ padding: 20, borderBottom: '1px solid var(--bez-border)' }}>
            <h3>Candidatos recientes ({data.candidates.length})</h3>
            <p style={{ color: 'var(--bez-text-muted)', fontSize: 12, marginTop: 4 }}>Usuarios registrados que aún no son operadores.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {data.candidates.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--bez-border)' }}>
                    <td style={{ padding: 14 }}>{u.username || u.email || '—'}</td>
                    <td style={{ padding: 14, fontFamily: 'monospace' }}>{u.wallet_address ? `${u.wallet_address.slice(0, 8)}…${u.wallet_address.slice(-4)}` : '—'}</td>
                    <td style={{ padding: 14 }}>
                      <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={busy}
                        onClick={() => grantOperator({ userId: u.id }).then(() => load()).catch((e) => setError(e.message))}>
                        <UserPlus size={13} /> Promover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export default Operators
