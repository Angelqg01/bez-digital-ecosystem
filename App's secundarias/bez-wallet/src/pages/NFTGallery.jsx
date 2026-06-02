import React, { useState } from 'react';

const MOCK_NFTS = [
  { id: '#4892', name: 'Grain Shipment — Durango', sector: 'Logistics', icon: '🚢', status: 'verified', date: '2026-04-28', fingerprint: '0xaF3c...8d21' },
  { id: '#4785', name: 'Premium Olive Oil — Batch 127', sector: 'Food Safety', icon: '🫒', status: 'verified', date: '2026-04-25', fingerprint: '0x7Be1...4f09' },
  { id: '#4701', name: 'Carbon Credit — Andalucía S1', sector: 'Environment', icon: '🌱', status: 'verified', date: '2026-04-22', fingerprint: '0xd4A0...c3b8' },
  { id: '#4688', name: 'Luxury Watch — Ref. 5711/1A', sector: 'Retail & Luxury', icon: '⌚', status: 'pending', date: '2026-04-20', fingerprint: '0x2Fc8...a1e5' },
  { id: '#4612', name: 'Pharma Container — Cold Chain', sector: 'Pharma', icon: '💊', status: 'verified', date: '2026-04-18', fingerprint: '0x91Db...f7c2' },
  { id: '#4590', name: 'Steel Coil — 12T Grade Q345', sector: 'Industrial', icon: '🏗️', status: 'verified', date: '2026-04-15', fingerprint: '0xbE09...3d46' },
  { id: '#4501', name: 'Wine Collection — Ribera 2024', sector: 'Food Safety', icon: '🍷', status: 'verified', date: '2026-04-12', fingerprint: '0x5Da7...e2f1' },
  { id: '#4423', name: 'Solar Panel Array — 50kW', sector: 'Energy', icon: '☀️', status: 'pending', date: '2026-04-10', fingerprint: '0xc8F3...b094' },
];

const SECTORS = ['All', 'Logistics', 'Food Safety', 'Retail & Luxury', 'Environment', 'Pharma', 'Industrial', 'Energy'];

export default function NFTGallery() {
  const [filter, setFilter] = useState('All');
  const [selectedNFT, setSelectedNFT] = useState(null);

  const filtered = filter === 'All' ? MOCK_NFTS : MOCK_NFTS.filter(n => n.sector === filter);

  if (selectedNFT) {
    return (
      <div>
        <div className="page-header animate-in">
          <button className="btn-secondary" onClick={() => setSelectedNFT(null)} style={{ marginBottom: '1rem' }}>
            ← Back to Gallery
          </button>
          <h1 className="page-title">{selectedNFT.name}</h1>
          <p className="page-subtitle">RWA Asset {selectedNFT.id} · {selectedNFT.sector}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="animate-in-delay-1">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="nft-image" style={{ aspectRatio: '1', fontSize: '5rem' }}>
              {selectedNFT.icon}
              <div className={`nft-badge ${selectedNFT.status}`}>{selectedNFT.status}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card">
              <div className="card-title">Asset Details</div>
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  ['Token ID', selectedNFT.id],
                  ['Sector', selectedNFT.sector],
                  ['Minted', selectedNFT.date],
                  ['SIFT Hash', selectedNFT.fingerprint],
                  ['Chain', 'BeZhas L2 (2708)'],
                  ['Standard', 'ERC-721 + RWA Metadata'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--bezhas-text-muted)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Vision Verification</div>
              <div style={{ marginTop: '1rem' }}>
                <div style={{
                  padding: '0.75rem 1rem',
                  background: selectedNFT.status === 'verified' ? 'var(--bezhas-success-bg)' : 'var(--bezhas-warning-bg)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  color: selectedNFT.status === 'verified' ? 'var(--bezhas-success)' : 'var(--bezhas-warning)',
                  fontSize: '0.85rem', fontWeight: 600
                }}>
                  <span>{selectedNFT.status === 'verified' ? '✅' : '⏳'}</span>
                  {selectedNFT.status === 'verified'
                    ? 'Gemini Vision: APPROVED (98.7% confidence)'
                    : 'Awaiting vision verification...'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-primary" style={{ flex: 1 }}>Transfer Asset</button>
              <button className="btn-secondary" style={{ flex: 1 }}>View on Explorer</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">RWA Assets</h1>
        <p className="page-subtitle">Tus activos del mundo real tokenizados en la blockchain de BeZhas</p>
      </div>

      {/* ── Filter Bar ──────────────────────────── */}
      <div className="animate-in-delay-1" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {SECTORS.map(s => (
          <button
            key={s}
            className="btn-secondary"
            onClick={() => setFilter(s)}
            style={{
              background: filter === s ? 'rgba(var(--bezhas-primary-rgb), 0.1)' : undefined,
              borderColor: filter === s ? 'var(--bezhas-primary)' : undefined,
              color: filter === s ? 'var(--bezhas-primary)' : undefined,
              fontSize: '0.8rem', padding: '0.4rem 0.85rem'
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── NFT Grid ────────────────────────────── */}
      <div className="nft-grid animate-in-delay-2">
        {filtered.map(nft => (
          <div key={nft.id} className="nft-card" onClick={() => setSelectedNFT(nft)}>
            <div className="nft-image">
              {nft.icon}
              <div className={`nft-badge ${nft.status}`}>{nft.status}</div>
            </div>
            <div className="nft-info">
              <div className="nft-name">{nft.name}</div>
              <div className="nft-sector">{nft.sector}</div>
              <div className="nft-id">{nft.id} · {nft.fingerprint}</div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h3 style={{ marginBottom: '0.5rem' }}>No assets in this sector</h3>
          <p style={{ color: 'var(--bezhas-text-muted)', fontSize: '0.9rem' }}>
            Scan a physical asset with BEZ Scanner to mint your first RWA NFT
          </p>
        </div>
      )}
    </div>
  );
}
