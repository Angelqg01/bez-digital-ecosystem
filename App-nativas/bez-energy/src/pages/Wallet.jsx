import React, { useState, useEffect, useCallback } from 'react'
import { Wallet as WalletIcon, Database, Leaf, Factory, Plus } from 'lucide-react'
import { getWalletStats, getWalletHistory, getCaeTokens, buyEnergyCredit } from '../api'

const num = (v, d = 2) => Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/**
 * Cartera de energía. Antes mostraba 4.892,50 BEZ, 50.000 en staking, activos RWA con fotos, un «Burn Tracker» y una
 * propuesta de la DAO inventados, y `parseFloat(balance) || 4892.50` convertía un saldo real de 0 en 4.892,50. Ahora sólo
 * hay datos de la cuenta (saldo, staking, créditos, movimientos, certificados CAE); si no hay, se dice.
 */
const EnergyWallet = () => {
  const [stats, setStats] = useState(undefined)   // undefined = cargando · null = no disponible
  const [history, setHistory] = useState([])
  const [cae, setCae] = useState(null)
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  // Cada bloque pinta cuando llega: los certificados CAE leen la cadena y pueden tardar sin bloquear el saldo.
  const load = useCallback(() => {
    getWalletStats().then(setStats)
    getWalletHistory(10).then(setHistory)
    getCaeTokens().then(setCae)
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])

  const credit = async (e) => {
    e.preventDefault()
    setNotice(null)
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) { setNotice({ kind: 'error', text: 'El hash de la transacción debe tener el formato 0x + 64 caracteres hexadecimales.' }); return }
    setBusy(true)
    try {
      const r = await buyEnergyCredit(Number(amount), txHash.trim())
      if (r.success === false || r.error) setNotice({ kind: 'error', text: r.error || 'No se pudo acreditar la compra.' })
      else { setNotice({ kind: 'ok', text: `Compra acreditada. Nuevo saldo: ${num(r.newBalance)} BZHS.` }); setAmount(''); setTxHash(''); load() }
    } finally { setBusy(false) }
  }

  if (stats === undefined) return <div style={{ color: 'white', padding: 40 }}>Cargando cartera…</div>
  if (stats === null) return (
    <div style={{ color: '#FF6B9D', padding: 40 }}>
      <strong>Cartera no disponible.</strong>
      <div style={{ color: '#9aa', marginTop: 8, fontSize: 14 }}>No se pudo leer tu cuenta de energía. Inicia sesión y reintenta.</div>
    </div>
  )

  const st = stats.staking || {}
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        <div className="card" style={{ padding: 32, position: 'relative', background: 'var(--bez-surface)' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, padding: 32, opacity: 0.05 }}><WalletIcon size={140} /></div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Saldo de energía</p>
          <h2 data-testid="wallet-balance" style={{ fontSize: 44, fontWeight: 800, marginBottom: 8 }}>{num(stats.balance)} <span style={{ fontSize: 18 }}>BZHS</span></h2>
          <p style={{ fontSize: 12, color: 'var(--bez-text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{stats.address}</p>

          <form onSubmit={credit} style={{ display: 'grid', gap: 8, marginTop: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 700 }}>Acreditar una compra de BZHS</p>
            <p style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>Paga desde tu wallet y pega aquí el hash: el servidor lo verifica on-chain antes de acreditar.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input aria-label="Cantidad de BZHS" type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Cantidad" style={{ ...inp, width: 110 }} />
              <input aria-label="Hash de la transacción" required value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x… hash de la transacción" style={{ ...inp, flex: 1, minWidth: 200 }} />
              <button type="submit" className="btn btn-primary" disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} />{busy ? 'Verificando…' : 'Acreditar'}</button>
            </div>
            {notice && <p role="status" style={{ fontSize: 12, color: notice.kind === 'ok' ? 'var(--bez-secondary)' : '#FF6B9D' }}>{notice.text}</p>}
          </form>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 8 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Staking y reputación</h3>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bez-secondary)', border: '1px solid var(--bez-secondary)', padding: '4px 12px', borderRadius: 20 }}>REPUTACIÓN {stats.reputation}/100</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StatRow label="En staking" val={`${num(st.staked_bzhs)} BZHS`} />
            <StatRow label="APY estimado" val={`${st.apy_pct ?? '0.0'} %`} color="var(--bez-secondary)" />
            <StatRow label="Recompensas pendientes" val={`${num(st.pending_rewards_bzhs)} BZHS`} />
            <StatRow label="Rendimiento 30 días" val={`${stats.yieldPercentage} %`} />
            <StatRow label="Créditos de energía" val={`${num(stats.energyCredits?.available_kwh ?? 0, 1)} kWh disp. · ${num(stats.energyCredits?.reserved_kwh ?? 0, 1)} reservados`} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Certificados CAE (RWA)</h3>
            <Factory size={20} color="var(--bez-primary-light)" />
          </div>
          <p style={{ fontSize: 28, fontWeight: 800 }}>{cae ? cae.total_tokens ?? 0 : '—'}</p>
          <p style={{ fontSize: 12, color: 'var(--bez-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            {cae && (cae.total_tokens || 0) > 0 ? 'Certificados de ahorro energético emitidos a tu nombre.' : 'Aún no tienes certificados. Se emiten por ahorro energético verificado con lecturas de tus nodos.'}
          </p>
        </div>

        <div className="card" style={{ gridColumn: 'span 2', padding: 0, minWidth: 0 }}>
          <div style={{ padding: 24, borderBottom: '1px solid var(--bez-border)' }}><h3 style={{ fontSize: 18, fontWeight: 700 }}>Movimientos</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
              <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--bez-border)' }}>
                {['TIPO', 'CANTIDAD', 'ESTADO', 'FECHA'].map((h) => <th key={h} style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--bez-text-muted)' }}>Sin movimientos todavía.</td></tr>}
                {history.map((h, i) => (
                  <tr key={h.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: 16 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{h.type === 'STAKING' ? <Database size={14} /> : <Leaf size={14} />}{h.type}</span></td>
                    <td style={{ padding: 16, fontWeight: 700 }}>{Number(h.amount_bzhs ?? 0) >= 0 ? '+' : ''}{num(h.amount_bzhs)} BZHS</td>
                    <td style={{ padding: 16, color: 'var(--bez-text-muted)' }}>{h.status || '—'}</td>
                    <td style={{ padding: 16, color: 'var(--bez-text-muted)' }}>{h.created_at ? new Date(h.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const inp = { padding: '10px 12px', background: '#090d16', border: '1px solid var(--bez-border)', borderRadius: 8, color: '#fff', fontSize: 13 }
const StatRow = ({ label, val, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
    <span style={{ fontSize: 13, color: 'var(--bez-text-sec)' }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: color || 'white', textAlign: 'right' }}>{val}</span>
  </div>
)

export default EnergyWallet
