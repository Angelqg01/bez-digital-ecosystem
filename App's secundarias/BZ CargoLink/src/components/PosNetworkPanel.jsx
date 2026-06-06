/**
 * PosNetworkPanel — DevHub panel that closes the visible loop:
 *   link POS  →  sync orders into B-UIDs  →  see each B-UID advance through the
 *   lifecycle  →  reflected back in the user's dashboard.
 *
 * Talks to the real Core API. Degrades gracefully when the API/role key isn't
 * reachable (shows a notice instead of crashing).
 */

import React, { useEffect, useState } from 'react'
import { Plug, RefreshCw, Boxes, AlertCircle } from 'lucide-react'
import { cargoLinkApi, LIFECYCLE_STAGES } from '../services/cargoLinkApi'

const stageIndex = status => LIFECYCLE_STAGES.indexOf(status)

const StatusTrail = ({ status }) => {
  const current = stageIndex(status)
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      {LIFECYCLE_STAGES.map((stage, i) => (
        <div
          key={stage}
          title={stage}
          style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= current && current >= 0 ? 'var(--bz-primary)' : 'var(--bz-border)',
          }}
        />
      ))}
    </div>
  )
}

const PosNetworkPanel = ({ apiKey }) => {
  const [posLink, setPosLink] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [notice, setNotice] = useState('')
  const [offline, setOffline] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ provider: 'generic', baseUrl: '', apiKey: '' })

  const load = async () => {
    if (!apiKey) return
    try {
      const [linkRes, txRes] = await Promise.all([
        cargoLinkApi.getPosLink(apiKey).catch(() => ({ posLink: null })),
        cargoLinkApi.listTransactions(apiKey, { limit: 25 }),
      ])
      setPosLink(linkRes.posLink || null)
      setTransactions(txRes.transactions || [])
      setOffline(false)
    } catch (err) {
      // 401 (no role key yet) or network — keep the panel usable.
      setOffline(true)
      setNotice(`Core API no conectada: ${err.message}. Configura una llave de rol y la URL del API.`)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [apiKey])

  const handleLink = async (e) => {
    e.preventDefault()
    setBusy(true); setNotice('')
    try {
      const res = await cargoLinkApi.linkPos(apiKey, form)
      setPosLink(res.posLink)
      setNotice(`POS '${res.posLink.provider}' vinculado.`)
    } catch (err) {
      setNotice(err.message)
    } finally { setBusy(false) }
  }

  const handleSync = async () => {
    setBusy(true); setNotice('')
    try {
      const res = await cargoLinkApi.syncPos(apiKey)
      setNotice(`Sincronizado: ${res.created.length} B-UID nuevos, ${res.skipped?.length || 0} ya existentes.`)
      await load()
    } catch (err) {
      setNotice(err.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Plug size={18} color="var(--bz-primary)" />
        <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Red POS · Transacciones B-UID</h3>
      </div>
      <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginBottom: 16 }}>
        Vincula la API de tu POS a tu BeZhas_ID. Cada orden entra como un B-UID que aduana, naviera,
        logística y última milla validan; el estado se refleja aquí y en tu plataforma vía webhook.
      </p>

      {/* Link POS form */}
      <form onSubmit={handleLink} style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={form.provider}
            onChange={e => setForm({ ...form, provider: e.target.value })}
            style={{ background: '#0e0e0e', border: '1px solid var(--bz-border)', color: 'var(--bz-text)', padding: '10px', borderRadius: 8, fontSize: 12 }}
          >
            {['generic', 'shopify', 'square', 'toast', 'sap'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            type="url" required placeholder="https://api.tupos.com"
            value={form.baseUrl}
            onChange={e => setForm({ ...form, baseUrl: e.target.value })}
            style={{ flex: 1, background: '#0e0e0e', border: '1px solid var(--bz-border)', color: 'var(--bz-text)', padding: '10px 12px', borderRadius: 8, fontSize: 12 }}
          />
        </div>
        <input
          type="password" placeholder="POS API key (opcional)"
          value={form.apiKey}
          onChange={e => setForm({ ...form, apiKey: e.target.value })}
          style={{ background: '#0e0e0e', border: '1px solid var(--bz-border)', color: 'var(--bz-text)', padding: '10px 12px', borderRadius: 8, fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
            <Plug size={16} /> {posLink ? 'Actualizar POS' : 'Vincular POS'}
          </button>
          <button type="button" className="btn" style={{ flex: 1, background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)' }} onClick={handleSync} disabled={busy || !posLink}>
            <RefreshCw size={16} /> Sincronizar
          </button>
        </div>
      </form>

      {posLink && (
        <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', marginBottom: 12 }}>
          Vinculado: <strong style={{ color: 'var(--bz-primary)' }}>{posLink.provider}</strong> · {posLink.base_url} · key {posLink.apiKeyMasked || '—'}
        </p>
      )}

      {notice && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: offline ? 'var(--bz-error)' : 'var(--bz-primary)', marginBottom: 12 }}>
          {offline && <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span>{notice}</span>
        </div>
      )}

      {/* Transactions feed */}
      <div style={{ borderTop: '1px solid var(--bz-border)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Boxes size={14} color="var(--bz-text-muted)" />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--bz-text-muted)' }}>
            B-UIDs en red ({transactions.length})
          </span>
        </div>

        {transactions.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', fontStyle: 'italic' }}>
            {offline ? 'Sin conexión al Core API.' : 'Aún no hay transacciones. Vincula tu POS y pulsa Sincronizar.'}
          </p>
        ) : (
          transactions.map(tx => (
            <div key={tx.b_uid} style={{ padding: '10px 0', borderBottom: '1px solid var(--bz-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <code style={{ fontSize: 12, fontWeight: 800, color: 'var(--bz-text)' }}>{tx.b_uid}</code>
                <span style={{ fontSize: 9, fontWeight: 900, color: tx.status === 'DELIVERED' ? 'var(--bz-secondary)' : 'var(--bz-primary)', textTransform: 'uppercase' }}>
                  {tx.status}
                </span>
              </div>
              {tx.pos_ref && <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', marginTop: 2 }}>POS: {tx.pos_ref}{tx.destination ? ` → ${tx.destination}` : ''}</p>}
              <StatusTrail status={tx.status} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default PosNetworkPanel
