import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Wallet as WalletIcon, 
  Tag
} from 'lucide-react'
import { bezhasPlatform } from '../services/bezhasPlatform'
import { usePlatformState } from '../hooks/usePlatformState'

const Wallet = () => {
  const { platformState } = usePlatformState()
  const plan = bezhasPlatform.plans[platformState.planId]
  const [showAllAssets, setShowAllAssets] = useState(false)
  const assets = [
    { id: 'BZ-LOG-ES-17148', status: 'IN_TRANSIT', val: '450kg' },
    { id: 'BZ-LOG-ES-17149', status: 'STOWED', val: '820kg' },
    { id: 'BZ-LOG-DE-16920', status: 'ARRIVED', val: '120kg' },
    ...platformState.blocks.map(block => ({
      id: block.payloadPreview?.bUid || block.id,
      status: block.event,
      val: `${block.debitAmount || 0} BEZ`,
    })),
  ]
  const visibleAssets = showAllAssets ? assets : assets.slice(0, 3)

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <WalletIcon size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Financial Terminal v1.0</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Earnings & Assets</h1>
      </header>

      {/* Main Balance Card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #131313, #1e1e1e)', borderLeft: '4px solid var(--bz-primary)', padding: 24, marginBottom: 24 }}>
        <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Global Ledger Balance</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{platformState.bezBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h2>
          <span style={{ fontSize: 14, color: 'var(--bz-primary)', fontWeight: 800 }}>$BEZ</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Freemium API</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--bz-secondary)' }}>{platformState.freeQuotaRemaining} calls left</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Active Plan</p>
            <p style={{ fontSize: 14, fontWeight: 800 }}>{plan.name}</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Gas Tank</p>
            <p style={{ fontSize: 14, fontWeight: 800 }}>{platformState.gasBalance.toFixed(2)} BEZ</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>L2 Blocks</p>
            <p style={{ fontSize: 14, fontWeight: 800 }}>{platformState.blocks.length} Anchored</p>
          </div>
        </div>
      </div>

      {/* dNFT Inventory (B-UIDs) */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Active B-UID Manifests (dNFT)</h3>
          <button
            onClick={() => setShowAllAssets(value => !value)}
            style={{ background: 'transparent', border: 'none', fontSize: 10, color: 'var(--bz-primary)', fontWeight: 800, cursor: 'pointer' }}
          >
            {showAllAssets ? 'VIEW LESS' : 'VIEW ALL'}
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleAssets.map(asset => (
            <AssetItem key={`${asset.id}-${asset.status}`} id={asset.id} status={asset.status} val={asset.val} />
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, textTransform: 'uppercase' }}>Ledger Activity</h3>
        <div className="card" style={{ padding: 0 }}>
          {platformState.ledger.slice(0, 8).map(entry => (
            <TxRow
              key={entry.id}
              type={entry.type}
              val={`${entry.amount > 0 && !entry.type.includes('USAGE') && !entry.type.includes('STAKED') ? '+' : entry.amount ? '-' : ''}${entry.amount} $BEZ`}
              date={new Date(entry.createdAt).toLocaleString()}
              status={entry.status}
              txHash={entry.txHash}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const AssetItem = ({ id, status, val }) => (
  <div className="card" style={{ margin: 0, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 32, height: 32, background: 'rgba(0, 240, 255, 0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Tag size={16} color="var(--bz-primary)" />
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 800 }}>{id}</p>
        <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', fontFamily: 'monospace' }}>Weight: {val}</p>
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
      <p style={{ fontSize: 8, color: 'var(--bz-primary)', fontFamily: 'monospace' }}>{txHash?.slice(0, 18)}...</p>
    </div>
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: val.startsWith('+') ? 'var(--bz-secondary)' : (status === 'Locked' ? 'var(--bz-primary)' : 'white') }}>{val}</p>
      <p style={{ fontSize: 8, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>{status}</p>
    </div>
  </div>
)

export default Wallet
