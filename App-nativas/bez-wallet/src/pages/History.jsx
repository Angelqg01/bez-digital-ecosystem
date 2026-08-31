import React, { useState } from 'react';

const ALL_TXS = [
  { id: 1, type: 'Received BEZ', address: '0x8a2F...c3D1', amount: '+1,200.00', time: '12 min ago', dir: 'in', hash: '0x4f2a...8c31', block: 1847293 },
  { id: 2, type: 'NFT Minted', address: 'LogisticsNFT #4892', amount: '−0.05', time: '1h ago', dir: 'mint', hash: '0x7e1b...d402', block: 1847201 },
  { id: 3, type: 'Sent BEZ', address: '0x3bF0...9aE7', amount: '−500.00', time: '3h ago', dir: 'out', hash: '0xb3c9...a714', block: 1847102 },
  { id: 4, type: 'Staking Reward', address: 'StakingPool', amount: '+45.20', time: '6h ago', dir: 'in', hash: '0x2d8f...e5b0', block: 1846980 },
  { id: 5, type: 'Gas Recharge', address: 'Stripe → Gas Tank', amount: '−$25.00', time: '1d ago', dir: 'out', hash: '0x91a4...c2d8', block: 1846501 },
  { id: 6, type: 'NFT Transfer', address: '0xCc42...1fB8', amount: 'NFT #4701', time: '2d ago', dir: 'out', hash: '0xf8e2...b916', block: 1845820 },
  { id: 7, type: 'Received BEZ', address: '0x1Da7...eF03', amount: '+3,500.00', time: '3d ago', dir: 'in', hash: '0xa6d1...c3f7', block: 1845102 },
  { id: 8, type: 'Farming Harvest', address: 'LiquidityFarming', amount: '+127.80', time: '4d ago', dir: 'in', hash: '0x5c09...d841', block: 1844500 },
  { id: 9, type: 'Quality Escrow', address: 'QualityEscrow', amount: '−2,000.00', time: '5d ago', dir: 'out', hash: '0xe7b3...a295', block: 1843900 },
  { id: 10, type: 'Bridge L1→L2', address: 'BeZhas Bridge', amount: '+5,000.00', time: '1w ago', dir: 'in', hash: '0x3f4a...e108', block: 1842100 },
];

const FILTERS = ['All', 'Sent', 'Received', 'NFTs', 'DeFi'];

export default function History() {
  const [filter, setFilter] = useState('All');

  const filtered = ALL_TXS.filter(tx => {
    if (filter === 'All') return true;
    if (filter === 'Sent') return tx.dir === 'out';
    if (filter === 'Received') return tx.dir === 'in';
    if (filter === 'NFTs') return tx.type.includes('NFT');
    if (filter === 'DeFi') return ['Staking Reward', 'Farming Harvest', 'Quality Escrow'].includes(tx.type);
    return true;
  });

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Transaction History</h1>
        <p className="page-subtitle">Historial completo de operaciones en BeZhas L2</p>
      </div>

      {/* ── Filters ─────────────────────────────── */}
      <div className="animate-in-delay-1" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            className="btn-secondary"
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'rgba(var(--bezhas-primary-rgb), 0.1)' : undefined,
              borderColor: filter === f ? 'var(--bezhas-primary)' : undefined,
              color: filter === f ? 'var(--bezhas-primary)' : undefined,
              fontSize: '0.8rem', padding: '0.4rem 0.85rem'
            }}
          >
            {f}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>
            {filtered.length} transactions
          </span>
        </div>
      </div>

      {/* ── Transaction List ────────────────────── */}
      <div className="card animate-in-delay-2" style={{ padding: '0.75rem' }}>
        <div className="tx-list">
          {filtered.map(tx => (
            <div key={tx.id} className="tx-item" style={{ cursor: 'pointer' }}>
              <div className={`tx-icon ${tx.dir}`}>
                {tx.dir === 'in' ? '↙️' : tx.dir === 'mint' ? '🔷' : '↗️'}
              </div>
              <div className="tx-info">
                <div className="tx-type">{tx.type}</div>
                <div className="tx-address">{tx.address}</div>
              </div>
              <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                <div className={`tx-amount-value ${tx.dir}`}>{tx.amount} BEZ</div>
                <div className="tx-time">{tx.time}</div>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                marginLeft: '1rem', minWidth: '100px'
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  color: 'var(--bezhas-primary)', cursor: 'pointer'
                }}>
                  {tx.hash}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                  color: 'var(--bezhas-text-muted)'
                }}>
                  Block #{tx.block.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
          <p style={{ color: 'var(--bezhas-text-muted)' }}>No transactions match this filter</p>
        </div>
      )}
    </div>
  );
}
