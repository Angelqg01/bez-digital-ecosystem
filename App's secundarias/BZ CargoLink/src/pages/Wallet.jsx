import React, { useState } from 'react'
import {
  Wallet as WalletIcon,
  Tag,
  AlertCircle,
} from 'lucide-react'
import { useBilling } from '../hooks/useBilling'
import { useTransactions } from '../hooks/useTransaction'
import { useNavigate } from 'react-router-dom'

const Wallet = () => {
  const navigate = useNavigate()
  const { bezBalance, plans, history, packages, loading: billingLoading, error: billingError } = useBilling()
  const { transactions, loading: txLoading } = useTransactions()
  const [showAllAssets, setShowAllAssets] = useState(false)

  const activePlan = plans[0]
  const visibleTx = showAllAssets ? transactions : transactions.slice(0, 5)
  const balanceDisplay = bezBalance != null ? Number(bezBalance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <WalletIcon size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Financial Terminal v2.0</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Earnings & Assets</h1>
      </header>

      {billingError && (
        <div className="card" style={{ padding: 12, borderLeft: '3px solid #f59e0b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} color="#f59e0b" />
          <span style={{ fontSize: 11, color: '#f59e0b' }}>Billing API offline — los datos se cargarán cuando el backend esté disponible.</span>
        </div>
      )}

      {/* Main Balance Card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #131313, #1e1e1e)', borderLeft: '4px solid var(--bz-primary)', padding: 24, marginBottom: 24 }}>
        <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Global Ledger Balance</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, fontFamily: 'Space Grotesk' }}>
            {billingLoading ? '...' : balanceDisplay}
          </h2>
          <span style={{ fontSize: 14, color: 'var(--bz-primary)', fontWeight: 800 }}>$BEZ</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>B-UIDs activos</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--bz-secondary)' }}>
              {txLoading ? '...' : transactions.length}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Plan base</p>
            <p style={{ fontSize: 14, fontWeight: 800 }}>{activePlan.name}</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Paquetes crédito</p>
            <p style={{ fontSize: 14, fontWeight: 800 }}>{packages.length || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Planes disponibles</p>
            <p style={{ fontSize: 14, fontWeight: 800 }}>{plans.length} tiers</p>
          </div>
        </div>
      </div>

      {/* dNFT Inventory — real B-UIDs */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Active B-UID Manifests (dNFT)</h3>
          {transactions.length > 5 && (
            <button
              onClick={() => setShowAllAssets(v => !v)}
              style={{ background: 'transparent', border: 'none', fontSize: 10, color: 'var(--bz-primary)', fontWeight: 800, cursor: 'pointer' }}
            >
              {showAllAssets ? 'VIEW LESS' : 'VIEW ALL'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {txLoading ? (
            <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Cargando B-UIDs...</p>
          ) : visibleTx.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>No hay B-UIDs activos. Crea uno desde el panel POS en API Hub.</p>
          ) : (
            visibleTx.map(tx => (
              <AssetItem
                key={tx.b_uid}
                id={tx.b_uid}
                status={tx.status}
                val={tx.cargo?.weight ? `${tx.cargo.weight} kg` : tx.cargo?.type || '—'}
                onClick={() => navigate(`/tx/${tx.b_uid}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* Billing History */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, textTransform: 'uppercase' }}>Ledger Activity</h3>
        <div className="card" style={{ padding: 0 }}>
          {history.length === 0 ? (
            <div style={{ padding: 18, color: 'var(--bz-text-muted)', fontSize: 12 }}>
              {billingLoading ? 'Cargando historial...' : 'Sin actividad de billing registrada.'}
            </div>
          ) : (
            history.slice(0, 8).map((entry, i) => (
              <TxRow
                key={entry.id || i}
                type={entry.type || entry.description || 'TRANSACTION'}
                val={`${entry.amount != null ? (entry.amount > 0 ? '+' : '') + entry.amount : '—'} $BEZ`}
                date={entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                status={entry.status || 'CONFIRMED'}
                txHash={entry.txHash}
              />
            ))
          )}
        </div>
      </div>

      {/* Plans preview */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, textTransform: 'uppercase' }}>Planes de suscripción</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {plans.map(plan => (
            <div key={plan.id} className="card" style={{ margin: 0, position: 'relative' }}>
              {plan.badge && (
                <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 7, fontWeight: 900, background: 'var(--bz-primary)', color: '#000', padding: '2px 6px', borderRadius: 4 }}>
                  {plan.badge}
                </span>
              )}
              <p style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{plan.name}</p>
              <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', marginTop: 2 }}>{plan.profile}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--bz-primary)', fontFamily: 'Space Grotesk', marginTop: 8 }}>
                {plan.priceEUR === 0 ? 'GRATIS' : `${plan.priceEUR}€/mes`}
              </p>
              <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', marginTop: 4 }}>
                {plan.aiActions ? `${plan.aiActions.toLocaleString()} acciones IA` : 'Ilimitadas'} · {plan.gasSubsidy}% gas
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const AssetItem = ({ id, status, val, onClick }) => (
  <div
    className="card"
    style={{ margin: 0, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
    onClick={onClick}
  >
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 32, height: 32, background: 'rgba(0, 240, 255, 0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Tag size={16} color="var(--bz-primary)" />
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 800 }}>{id}</p>
        <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontFamily: 'monospace' }}>{val}</p>
      </div>
    </div>
    <span style={{ fontSize: 8, fontWeight: 900, background: '#0e0e0e', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--bz-border)' }}>{status}</span>
  </div>
)

const TxRow = ({ type, val, date, status, txHash }) => (
  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bz-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <p style={{ fontSize: 11, fontWeight: 700 }}>{type}</p>
      <p style={{ fontSize: 9, color: 'var(--bz-text-muted)' }}>{date}</p>
      {txHash && <p style={{ fontSize: 8, color: 'var(--bz-primary)', fontFamily: 'monospace' }}>{txHash.slice(0, 18)}...</p>}
    </div>
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: val.startsWith('+') ? 'var(--bz-secondary)' : 'white' }}>{val}</p>
      <p style={{ fontSize: 8, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>{status}</p>
    </div>
  </div>
)

export default Wallet
